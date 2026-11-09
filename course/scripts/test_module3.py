import json
import math
import sys
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from scipy.stats import lognorm, norm

ROOT = Path(__file__).resolve().parents[1]
MODULE = ROOT / "modules" / "m3-laboratoire"
PRIVATE = ROOT.parent / "grading-private" / "answer_sources.json"
HASHES = ROOT / "data" / "expected" / "answers_hashed.json"
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "grading"))
import hashing
from generate_hqo_dataset import generate_m3_boss_csv


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_module3_content_and_answer_contract():
    manifest = read_json(MODULE / "manifest.json")
    exercises = read_json(MODULE / "exercises.json")
    quiz = read_json(MODULE / "quiz.json")
    boss = read_json(MODULE / "boss.json")
    page = (MODULE / "index.html").read_text(encoding="utf-8")
    source = read_json(PRIVATE)["items"]
    hashes = read_json(HASHES)["items"]

    assert manifest["id"] == "m3"
    assert manifest["status"] == "available"
    assert len(manifest["lessons"]) == 8
    assert len(exercises["exercises"]) == 8
    assert [exercise["id"] for exercise in exercises["exercises"]] == [
        f"E3.{number}" for number in range(1, 9)
    ]
    assert all(exercise["type"] == "python" for exercise in exercises["exercises"])
    assert all(exercise["answer_expression"] == "answer" for exercise in exercises["exercises"])
    assert all(package in {
        "numpy", "pandas", "scipy", "matplotlib", "statsmodels", "scikit-learn",
    } for exercise in exercises["exercises"] for package in exercise["packages"])
    assert len(quiz["questions"]) == 20
    assert {
        level: sum(question["difficulty"] == level for question in quiz["questions"])
        for level in (1, 2, 3)
    } == {1: 8, 2: 8, 3: 4}
    for question in quiz["questions"]:
        assert question["explanation"]
        assert len(question["options"]) == 4
        assert len({option["id"] for option in question["options"]}) == 4
        assert source[question["id"]]["value"] in {option["id"] for option in question["options"]}
    boss_ids = [f"B3.1.{field['key']}" for field in boss["fields"]]
    required_ids = {
        *(exercise["id"] for exercise in exercises["exercises"]),
        *(question["id"] for question in quiz["questions"]),
        *boss_ids,
    }
    assert required_ids <= source.keys()
    assert required_ids <= hashes.keys()
    answer_salt = read_json(HASHES)["salt"]
    for answer_id in required_ids:
        definition = source[answer_id]
        public = hashes[answer_id]
        assert public["kind"] == definition["kind"]
        if definition["kind"] == "text":
            expected_hash = hashing.hash_text(answer_id, definition["value"], answer_salt)
        else:
            expected_hash = hashing.hash_num(
                answer_id,
                definition["value"],
                definition.get("tol", 0),
                answer_salt,
            )
        assert public["hash"] == expected_hash
    assert boss["time_limit_seconds"] == 2 * 60 * 60
    assert boss["minimum_memo_words"] == 150
    assert boss["max_score"] == 7
    assert "exp_boss.csv" in manifest["data"][-1]
    assert (ROOT / "data" / "csv" / "exp_boss.csv").is_file()
    assert all(f'id="L3.{number}"' in page for number in range(1, 9))
    assert "Le laboratoire de Purah" in page
    assert not (ROOT / "data" / "expected" / "answer_sources.json").exists()


def test_m3_reference_answers_match_generated_data():
    source = read_json(PRIVATE)["items"]
    data = ROOT / "data" / "csv"
    durations = pd.read_csv(data / "sessions.csv", usecols=["duration_min"])["duration_min"].dropna().to_numpy()
    rng = np.random.default_rng(42)
    simulated_mean = round(float(rng.choice(durations, size=(1000, 30), replace=True).mean(axis=1).mean()), 1)
    assert simulated_mean == source["E3.1"]["value"]

    sigma, _, scale = lognorm.fit(durations, floc=0)
    skew = lognorm.stats(sigma, loc=0, scale=scale, moments="s")
    e32 = json.dumps([
        round(float(durations.mean()), 3),
        round(float(np.median(durations)), 3),
        round(float(sigma), 3),
        round(float(scale), 3),
        round(float(skew), 3),
    ], separators=(",", ":"))
    assert e32 == source["E3.2"]["value"]

    regression = pd.read_csv(
        data / "sessions.csv",
        usecols=["rupees_earned", "duration_min", "deaths"],
    ).dropna()
    features = np.column_stack([
        np.ones(len(regression)),
        regression[["duration_min", "deaths"]].to_numpy(),
    ])
    target = regression["rupees_earned"].to_numpy()
    coefficients = np.linalg.lstsq(features, target, rcond=None)[0]
    r_squared = 1 - np.sum((target - features @ coefficients) ** 2) / np.sum((target - target.mean()) ** 2)
    e33 = json.dumps([round(float(value), 3) for value in [*coefficients, r_squared]], separators=(",", ":"))
    assert e33 == source["E3.3"]["value"]

    players = pd.read_csv(data / "players.csv", usecols=["player_id", "signup_date"])
    assignments = pd.read_csv(data / "experiment_assignments.csv")
    cohort = assignments[assignments["experiment_id"] == "EXP_KOROK_2026_02"].merge(players, on="player_id")
    sessions = pd.read_csv(data / "sessions.csv", usecols=["player_id", "start_ts"])
    sessions["date"] = pd.to_datetime(sessions["start_ts"], utc=True).dt.date
    signup = players.set_index("player_id")["signup_date"]
    sessions["signup"] = pd.to_datetime(sessions["player_id"].map(signup)).dt.date
    sessions["offset"] = (sessions["date"] - sessions["signup"]).map(lambda value: value.days)
    retained = set(sessions.loc[sessions["offset"] == 7, "player_id"])
    cohort["retained"] = cohort["player_id"].isin(retained)
    rates = cohort.groupby("variant")["retained"].agg(["sum", "count", "mean"])
    control, treatment = rates.loc["control"], rates.loc["treatment"]
    difference = treatment["mean"] - control["mean"]
    standard_error = math.sqrt(
        control["mean"] * (1 - control["mean"]) / control["count"]
        + treatment["mean"] * (1 - treatment["mean"]) / treatment["count"]
    )
    pooled = (control["sum"] + treatment["sum"]) / (control["count"] + treatment["count"])
    null_error = math.sqrt(pooled * (1 - pooled) * (1 / control["count"] + 1 / treatment["count"]))
    p_value = 2 * norm.sf(abs(difference / null_error))
    e34 = json.dumps([
        round(float(control["mean"]), 3),
        round(float(treatment["mean"]), 3),
        round(float(difference), 3),
        round(float(difference - 1.95996398454 * standard_error), 3),
        round(float(difference + 1.95996398454 * standard_error), 3),
        round(float(p_value), 3),
    ], separators=(",", ":"))
    assert e34 == source["E3.4"]["value"]

    assert source["E3.5"]["value"] == 1681
    assert source["E3.6"]["value"] == 0.37
    assert source["E3.8"]["value"] == round(
        0.005 * 0.98 / (0.005 * 0.98 + 0.995 * 0.02), 3
    )

    players = pd.read_csv(
        data / "players.csv",
        usecols=["player_id", "signup_date", "platform"],
    )
    pack_cohort = assignments[assignments["experiment_id"] == "EXP_PACK_2026_06"].merge(
        players, on="player_id"
    )
    orders = pd.read_csv(data / "orders.csv")
    lines = pd.read_csv(data / "order_lines.csv")
    items = pd.read_csv(data / "shop_items.csv", usecols=["item_id", "category"])
    eligible = orders.merge(lines, on="order_id").merge(items, on="item_id")
    eligible = eligible.merge(players[["player_id", "signup_date"]], on="player_id")
    eligible["offset"] = (
        pd.to_datetime(eligible["order_ts"], utc=True).dt.date
        - pd.to_datetime(eligible["signup_date"]).dt.date
    ).map(lambda value: value.days)
    buyers = set(eligible.loc[
        (eligible["currency"] == "EUR")
        & (eligible["status"] == "completed")
        & (eligible["category"] == "pack_aventurier")
        & eligible["offset"].between(0, 2),
        "player_id",
    ])
    pack_cohort["bought"] = pack_cohort["player_id"].isin(buyers)
    values = []
    global_rates = pack_cohort.groupby("variant")["bought"].mean()
    values.extend([global_rates["A"], global_rates["B"]])
    platform_rates = {}
    for platform in ("android", "ios", "pc"):
        rates = pack_cohort[pack_cohort["platform"] == platform].groupby("variant")["bought"].mean()
        platform_rates[platform] = rates
        values.extend([rates["A"], rates["B"]])
    e37 = json.dumps([round(float(value), 3) for value in values], separators=(",", ":"))
    assert e37 == source["E3.7"]["value"]
    assert global_rates["B"] > global_rates["A"]
    assert all(rates["B"] < rates["A"] for rates in platform_rates.values())

def test_m3_boss_csv_is_reproducible_and_has_the_planted_effect():
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        first = generate_m3_boss_csv(root, seed=20261107)
        csv_path = root / first["csv"]
        first_bytes = csv_path.read_bytes()
        second = generate_m3_boss_csv(root, seed=20261107)
        assert first == second
        assert csv_path.read_bytes() == first_bytes
        frame = pd.read_csv(csv_path)
        assert frame["participant_id"].is_unique
        assert frame.groupby("variant").size().to_dict() == {
            "control": 2_000,
            "treatment": 2_000,
        }
        rates = frame.groupby("variant")["retained_d7"].mean()
        assert rates.to_dict() == {"control": 0.18, "treatment": 0.23}
