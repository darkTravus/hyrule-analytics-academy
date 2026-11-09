#!/usr/bin/env python3
"""Acceptance checks for the generated teaching datasets.

Run only after `generate_hqo_dataset.py`. These checks intentionally include
the statistical and model thresholds from the course specification.
"""

from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import zipfile
from datetime import date
from pathlib import Path

import pandas as pd
import pytest
from scipy.stats import chi2_contingency
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from generate_hqo_dataset import SEED, generate, make_reference_tables


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def _read_csv(name: str) -> pd.DataFrame:
    path = DATA / name
    assert path.is_file(), f"{path} missing; run scripts/generate_hqo_dataset.py first"
    return pd.read_csv(path)


def _day_offsets(frame: pd.DataFrame, players: pd.DataFrame, timestamp: str) -> pd.Series:
    signup = players.set_index("player_id")["signup_date"]
    event_dates = pd.to_datetime(frame[timestamp], utc=True).dt.date
    signup_dates = pd.to_datetime(frame["player_id"].map(signup)).dt.date
    return pd.Series(
        (event_dates.to_numpy() - signup_dates.to_numpy()).astype("timedelta64[D]").astype(int),
        index=frame.index,
    )


def _auc_models(frame: pd.DataFrame, target: str) -> tuple[float, float]:
    numeric = [
        "sessions_d0_14", "active_days_d0_14", "avg_session_min_d0_14",
        "deaths_first_3_sessions", "regions_visited_d14", "quests_completed_d14",
        "first_boss_win_by_d14", "days_to_first_dungeon", "purchased_by_d14",
        "rupees_balance_d14",
    ]
    categorical = ["country", "platform", "acquisition_channel", "hero_class", "age_band", "patch_era"]
    x_train, x_test, y_train, y_test = train_test_split(
        frame[numeric + categorical].fillna(-1),
        frame[target].astype(int),
        test_size=0.25,
        random_state=2026,
        stratify=frame[target],
    )
    transformer = ColumnTransformer([
        ("numeric", StandardScaler(), numeric),
        ("categorical", OneHotEncoder(handle_unknown="ignore"), categorical),
    ])
    logistic = make_pipeline(transformer, LogisticRegression(max_iter=1_000, random_state=2026))
    logistic.fit(x_train, y_train)
    logistic_auc = roc_auc_score(y_test, logistic.predict_proba(x_test)[:, 1])

    hgb = make_pipeline(
        ColumnTransformer([
            ("numeric", "passthrough", numeric),
            ("categorical", OneHotEncoder(handle_unknown="ignore", sparse_output=False), categorical),
        ]),
        HistGradientBoostingClassifier(max_iter=120, max_leaf_nodes=15, random_state=2026),
    )
    hgb.fit(x_train, y_train)
    hgb_auc = roc_auc_score(y_test, hgb.predict_proba(x_test)[:, 1])
    return logistic_auc, hgb_auc


def test_core_volume_and_sqlite_integrity() -> None:
    with sqlite3.connect(DATA / "hqo_full.sqlite") as full:
        table_names = {
            row[0] for row in full.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        assert full.execute("SELECT COUNT(*) FROM players").fetchone()[0] == 12_000
        sessions = full.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
        orders = full.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
        assert 135_000 <= sessions <= 165_000
        assert 8_000 <= orders <= 10_000
        assert full.execute("PRAGMA foreign_key_check").fetchall() == []
        assert len(table_names) == 14
        full_ids = {row[0] for row in full.execute("SELECT player_id FROM players")}
        for table_name in table_names:
            csv_frame = _read_csv(f"csv/{table_name}.csv")
            columns = [
                row[1] for row in full.execute(f'PRAGMA table_info("{table_name}")')
            ]
            row_count = full.execute(f'SELECT COUNT(*) FROM "{table_name}"').fetchone()[0]
            assert list(csv_frame.columns) == columns
            assert len(csv_frame) == row_count
    with sqlite3.connect(DATA / "hqo_lite.sqlite") as lite:
        lite_ids = {row[0] for row in lite.execute("SELECT player_id FROM players")}
        lite_sessions = lite.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
        assert len(lite_ids) == 2_000
        assert lite_ids <= full_ids
        assert 20_000 <= lite_sessions <= 30_000
        assert lite.execute("PRAGMA foreign_key_check").fetchall() == []
    assert (DATA / "hqo_lite.sqlite").stat().st_size < 4 * 1024 * 1024


def test_korok_retention_effect() -> None:
    players = _read_csv("csv/players.csv")
    assignments = _read_csv("csv/experiment_assignments.csv")
    sessions = _read_csv("csv/sessions.csv")
    cohort = assignments[assignments["experiment_id"] == "EXP_KOROK_2026_02"].merge(
        players[["player_id", "signup_date"]], on="player_id"
    )
    assert len(cohort) == 4_000
    offsets = _day_offsets(sessions, players, "start_ts")
    d7_players = set(sessions.loc[offsets == 7, "player_id"])
    cohort["retained_d7"] = cohort["player_id"].isin(d7_players)
    rates = cohort.groupby("variant")["retained_d7"].mean()
    control, treatment = rates["control"], rates["treatment"]
    assert abs(control - 0.20) <= 0.015
    assert abs((treatment - control) - 0.04) <= 0.015
    table = pd.crosstab(cohort["variant"], cohort["retained_d7"])
    p_value = chi2_contingency(table, correction=False).pvalue
    assert p_value < 0.01


def test_hearts_purchase_experiment_power() -> None:
    players = _read_csv("csv/players.csv")
    assignments = _read_csv("csv/experiment_assignments.csv")
    orders = _read_csv("csv/orders.csv")
    cohort = assignments[assignments["experiment_id"] == "EXP_HEARTS_2026_05"].merge(
        players[["player_id", "signup_date"]], on="player_id"
    )
    dated = orders.merge(players[["player_id", "signup_date"]], on="player_id")
    dated["offset"] = (
        pd.to_datetime(dated["order_ts"], utc=True).dt.date -
        pd.to_datetime(dated["signup_date"]).dt.date
    ).map(lambda delta: delta.days)
    buyers = set(dated.loc[
        (dated["status"] == "completed") & dated["offset"].between(0, 6), "player_id"
    ])
    cohort["purchased"] = cohort["player_id"].isin(buyers)
    rates = cohort.groupby("variant")["purchased"].mean()
    assert abs(rates["control"] - 0.08) <= 0.01
    assert abs(rates["treatment"] - 0.12) <= 0.01
    p_value = chi2_contingency(pd.crosstab(cohort["variant"], cohort["purchased"]),
                               correction=False).pvalue
    assert 0.08 <= p_value <= 0.20


def test_pack_experiment_simpsons_paradox() -> None:
    players = _read_csv("csv/players.csv")
    assignments = _read_csv("csv/experiment_assignments.csv")
    orders = _read_csv("csv/orders.csv")
    lines = _read_csv("csv/order_lines.csv")
    items = _read_csv("csv/shop_items.csv")
    cohort = assignments[assignments["experiment_id"] == "EXP_PACK_2026_06"].merge(
        players[["player_id", "signup_date", "platform"]], on="player_id"
    )
    dated = orders.merge(lines, on="order_id").merge(
        items[["item_id", "category"]], on="item_id"
    ).merge(players[["player_id", "signup_date"]], on="player_id")
    dated["offset"] = (
        pd.to_datetime(dated["order_ts"], utc=True).dt.date -
        pd.to_datetime(dated["signup_date"]).dt.date
    ).map(lambda delta: delta.days)
    buyers = set(dated.loc[
        (dated["currency"] == "EUR") & (dated["status"] == "completed") &
        (dated["category"] == "pack_aventurier") &
        dated["offset"].between(0, 2), "player_id"
    ])
    cohort["bought"] = cohort["player_id"].isin(buyers)
    global_rates = cohort.groupby("variant")["bought"].mean()
    assert global_rates["B"] > global_rates["A"]
    for platform, group in cohort.groupby("platform"):
        rates = group.groupby("variant")["bought"].mean()
        assert rates["B"] < rates["A"], f"Simpson condition failed for {platform}"


def test_churn_prevalence_and_model_auc() -> None:
    frame = _read_csv("ml/ml_churn_players.csv")
    leaky = _read_csv("ml/players_snapshot_leaky.csv")
    assert 2_800 <= len(frame) <= 4_500
    prevalence = frame["churn_d15_44"].mean()
    assert abs(prevalence - 0.28) <= 0.015
    logistic_auc, hgb_auc = _auc_models(frame, "churn_d15_44")
    assert logistic_auc >= 0.72, f"logistic AUC {logistic_auc:.3f} < 0.72"
    assert 0.76 <= hgb_auc <= 0.82, f"boosting AUC {hgb_auc:.3f} outside [0.76, 0.82]"

    target = frame.set_index("player_id")["churn_d15_44"].astype(int)
    leaky = leaky.set_index("player_id").join(target, how="inner")
    signup_age = (
        pd.Timestamp("2026-07-01") - pd.to_datetime(leaky["signup_date"])
    ).dt.days
    inferred_last_session_age = signup_age - leaky["days_since_last_session"]
    auc = roc_auc_score(leaky["churn_d15_44"], -inferred_last_session_age)
    assert auc >= 0.97, f"leaky AUC {auc:.3f} < 0.97"


def test_excel_and_corrupted_package_anomalies() -> None:
    excel = _read_csv("excel/boutique_extrait.csv")
    assert len(excel) == 10_000
    from openpyxl import load_workbook

    workbook = load_workbook(DATA / "excel" / "boutique_extrait.xlsx", read_only=True, data_only=True)
    sheet = workbook.active
    assert sheet.max_row == 10_001
    assert sheet.max_column == 10
    assert tuple(cell.value for cell in next(sheet.iter_rows(max_row=1))) == tuple(excel.columns)
    workbook.close()
    assert int((excel["unit_price"] < 0).sum()) == 12
    assert int((excel["qty"] == 0).sum()) == 18
    assert int((pd.to_datetime(excel["order_date"], utc=True).dt.date > date(2026, 7, 1)).sum()) == 25
    assert excel.duplicated().sum() == 40
    assert int(excel["item_name"].str.contains(r"^\s|\s$", regex=True).sum()) == 300
    boss = _read_csv("excel/boutique_extrait_boss.csv")
    assert len(boss) == 10_000
    assert boss.duplicated().sum() == 28
    assert int((boss["unit_price"] < 0).sum()) == 7
    assert int((boss["qty"] == 0).sum()) == 14
    assert int((pd.to_datetime(boss["order_date"], utc=True).dt.date > date(2026, 7, 1)).sum()) == 21
    assert int(boss["item_name"].str.contains(r"^\s|\s$", regex=True).sum()) == 240
    assert not (DATA / "excel" / "boutique_anomalies.json").exists()
    assert not (DATA / "excel" / "boutique_boss_anomalies.json").exists()
    assert not (ROOT / "docs" / "GROUND_TRUTH.md").exists()

    with zipfile.ZipFile(DATA / "corrupted" / "hqo_corrupted.zip") as archive:
        players = pd.read_csv(archive.open("players_raw.csv"), dtype=str)
        sessions = pd.read_csv(archive.open("sessions_raw.csv"), dtype=str)
        lines = pd.read_csv(archive.open("order_lines_raw.csv"), dtype=str)
        ground_truth = json.loads(archive.read("expected_clean_hashes.json"))
    assert len(players) == 2_024
    assert players["player_id"].duplicated().sum() == 24
    assert int(players["signup_date"].eq("2026-07-10").sum()) == 15
    assert int(players["platform"].fillna("").isin(["", "N/A", "null"]).sum()) == 80
    assert int(sessions["player_id"].eq("P999999").sum()) == 25
    assert int(lines["order_id"].eq("999999999").sum()) == 40
    assert set(ground_truth) == {"players", "sessions", "orders", "order_lines"}


def test_no_personal_data_patterns() -> None:
    email = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I)
    ipv4 = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
    phone = re.compile(r"(?<!\d)(?:\+?\d[\s().-]?){8,}\d(?!\d)")
    outputs = list(DATA.rglob("*.csv"))

    def check_frame(frame: pd.DataFrame, location: str) -> None:
        forbidden_columns = {"name", "email", "phone", "ip_address", "address", "full_name"}
        assert not forbidden_columns.intersection(column.casefold() for column in frame.columns), location
        for column in frame.columns:
            values = frame[column]
            assert not values.str.contains(email, na=False).any(), f"email-like data in {location}:{column}"
            assert not values.str.contains(ipv4, na=False).any(), f"IP-like data in {location}:{column}"
            if not column.casefold().endswith(("_date", "_ts", "_id")) and column.casefold() != "date":
                assert not values.str.contains(phone, na=False).any(), f"phone-like data in {location}:{column}"

    for path in outputs:
        check_frame(pd.read_csv(path, dtype=str, keep_default_na=False), str(path))
    with zipfile.ZipFile(DATA / "corrupted" / "hqo_corrupted.zip") as archive:
        for name in archive.namelist():
            if name.endswith(".csv"):
                check_frame(pd.read_csv(archive.open(name), dtype=str, keep_default_na=False), name)
    facts = json.loads((DATA / "expected" / "facts.json").read_text(encoding="utf-8"))
    assert facts["seed"] == SEED


def test_compendium_references_are_joined() -> None:
    refs = make_reference_tables(DATA / "compendium" / "compendium_snapshot.json")
    assert refs["shop_items"]["compendium_name"].notna().sum() == 40
    snapshot = json.loads((DATA / "compendium" / "compendium_snapshot.json").read_text(encoding="utf-8"))
    known_locations = {
        location
        for entry in snapshot["entries"]
        for location in entry.get("common_locations") or []
    }
    matches = refs["regions"]["region_name"].isin(known_locations).sum()
    assert 8 <= matches <= 10


def test_seeded_generation_is_reproducible(tmp_path: Path) -> None:
    first_root = tmp_path / "first"
    second_root = tmp_path / "second"
    generate(first_root, SEED)
    generate(second_root, SEED)

    def file_hashes(root: Path) -> dict[str, str]:
        return {
            str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted(root.rglob("*"))
            if path.is_file()
        }

    assert file_hashes(first_root) == file_hashes(second_root)


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
