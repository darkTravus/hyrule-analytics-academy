#!/usr/bin/env python3
"""Generate the reproducible synthetic Hyrule Quest Online teaching datasets."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import re
import sqlite3
import zipfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd


SEED = 20261104
PLAYER_COUNT = 12_000
SNAPSHOT_DATE = date(2026, 7, 1)
START_DATE = date(2025, 1, 1)
END_DATE = SNAPSHOT_DATE - timedelta(days=1)
SALT = "hyrule-academy-public-course-salt-v1"
ROOT = Path(__file__).resolve().parents[1]
ZIP_TIMESTAMP = (2026, 7, 1, 0, 0, 0)

COUNTRIES = ["FR", "US", "DE", "GB", "CA", "ES", "BR", "BE", "JP", "CH", "OTHER"]
COUNTRY_P = [0.28, 0.18, 0.08, 0.07, 0.06, 0.06, 0.06, 0.05, 0.05, 0.03, 0.08]
PLATFORMS = ["ios", "android", "pc"]
CHANNELS = ["organic", "ads", "friend_referral", "influencer", "store_feature"]
CHANNEL_P = [0.35, 0.30, 0.12, 0.15, 0.08]
CLASSES = ["guerrier", "archer", "mage", "gardien"]
CLASS_P = [0.40, 0.30, 0.20, 0.10]
AGE_BANDS = ["16-24", "25-34", "35-44", "45+"]
AGE_P = [0.25, 0.38, 0.24, 0.13]
PATCH_DATES = [
    ("1.9", "2024-12-10", "Bêta fermée."),
    ("2.0", "2025-01-15", "Lancement public."),
    ("2.1", "2025-06-10", "Une nouvelle région est ouverte."),
    ("2.2", "2025-11-18", "La boutique évolue ; le volume de commandes progresse."),
    ("2.3", "2026-04-10", "Les points de vie des boss augmentent."),
    ("2.4", "2026-06-02", "La version PC est lancée."),
]
REGION_NAMES = [
    "Hyrule Field", "Hebra Mountains", "West Necluda", "Gerudo Highlands",
    "East Necluda", "Hyrule Ridge", "Tabantha Frontier", "Gerudo Desert",
    "Lanayru Great Spring", "Zora Domain", "Lake Hylia North", "Death Mountain Peak",
]


def write_csv(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False, encoding="utf-8", lineterminator="\n")


def write_json(data: object, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_zip_timestamps(path: Path) -> None:
    with zipfile.ZipFile(path, "r") as source:
        entries = [
            (info.filename, source.read(info.filename), info.compress_type, info.external_attr)
            for info in sorted(source.infolist(), key=lambda item: item.filename)
        ]
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, content, compression, external_attr in entries:
            if name == "docProps/core.xml":
                content = re.sub(
                    rb"(<dcterms:modified[^>]*>).*?(</dcterms:modified>)",
                    rb"\g<1>2026-07-01T00:00:00Z\g<2>",
                    content,
                )
            info = zipfile.ZipInfo(name, date_time=ZIP_TIMESTAMP)
            info.compress_type = compression
            info.external_attr = external_attr
            archive.writestr(info, content)
    path.write_bytes(buffer.getvalue())


def sample_dates(rng: np.random.Generator) -> list[date]:
    """Reserve the three exact experiment populations, then sample the base cohort."""
    korok_start, korok_end = date(2026, 2, 1), date(2026, 3, 15)
    hearts_start, hearts_end = date(2026, 5, 4), date(2026, 5, 17)
    pc_start, pc_end = date(2026, 6, 1), date(2026, 6, 30)

    def uniform_days(start: date, end: date, n: int) -> list[date]:
        span = (end - start).days + 1
        offsets = rng.integers(0, span, n)
        return [start + timedelta(days=int(offset)) for offset in offsets]

    fixed = uniform_days(korok_start, korok_end, 4_000)
    fixed += uniform_days(hearts_start, hearts_end, 600)
    fixed += uniform_days(pc_start, pc_end, 2_000)
    remaining = PLAYER_COUNT - len(fixed)

    candidates = [
        START_DATE + timedelta(days=i)
        for i in range((END_DATE - START_DATE).days + 1)
        if not (korok_start <= START_DATE + timedelta(days=i) <= korok_end)
        and not (hearts_start <= START_DATE + timedelta(days=i) <= hearts_end)
        and not (pc_start <= START_DATE + timedelta(days=i) <= pc_end)
    ]
    weights = []
    for day in candidates:
        weekend = 1.25 if day.weekday() >= 5 else 1.0
        trend = 1.02 ** ((day.year - 2025) * 12 + day.month - 1)
        weights.append(12 * weekend * trend)
    probabilities = np.asarray(weights, dtype=float)
    probabilities /= probabilities.sum()
    extra = rng.choice(len(candidates), size=remaining, replace=True, p=probabilities)
    fixed.extend(candidates[int(i)] for i in extra)
    rng.shuffle(fixed)
    return fixed


def make_reference_tables(compendium_snapshot_path: Path) -> dict[str, pd.DataFrame]:
    regions = pd.DataFrame({
        "region_id": np.arange(1, 13),
        "region_name": REGION_NAMES,
        "biome": ["plaine", "montagne", "forêt", "désert", "lac", "plaine",
                  "montagne", "désert", "lac", "forêt", "lac", "volcan"],
        "danger_level": [2, 5, 2, 4, 2, 3, 4, 5, 3, 3, 1, 5],
    })
    quests = pd.DataFrame({
        "quest_id": np.arange(1, 61),
        "title": [f"Mission du royaume n°{i:02d}" for i in range(1, 61)],
        "quest_type": ["main"] * 20 + ["side"] * 20 + ["shrine"] * 12 + ["dungeon"] * 8,
        "region_id": np.tile(np.arange(1, 13), 5)[:60],
        "difficulty": np.tile([1, 2, 3, 4, 5], 12),
        "recommended_level": np.tile(np.arange(5, 41, 5), 8)[:60],
        "reward_rupees": np.tile([80, 120, 160, 220, 300], 12),
    })
    bosses = pd.DataFrame({
        "boss_id": np.arange(1, 9),
        "boss_name": ["Gardien de Pierre", "Reine des Sables", "Ombre des Bois",
                      "Drake des Cimes", "Sentinelle Rouge", "Bête du Marais",
                      "Titan des Cendres", "Seigneur du Néant"],
        "region_id": np.arange(1, 9),
        "base_hp": [800, 1400, 2100, 2800, 3600, 4400, 5200, 6000],
        "difficulty": np.arange(1, 9).clip(1, 5),
    })
    patches = pd.DataFrame([
        {"patch_id": i + 1, "version": version, "release_date": release,
         "notes": notes}
        for i, (version, release, notes) in enumerate(PATCH_DATES)
    ])
    items = []
    categories = [("potion", 20), ("arme", 20), ("armure", 15),
                  ("cosmétique", 15), ("pack_rupees", 6), ("pack_aventurier", 4)]
    item_id = 1
    eur_prices = [1.99, 4.99, 9.99, 19.99, 49.99, 99.99]
    for category, count in categories:
        for i in range(count):
            is_euro = category.startswith("pack_")
            items.append({
                "item_id": item_id,
                "item_name": f"{category.replace('_', ' ').title()} {i + 1:02d}",
                "category": category,
                "rarity": ["commun", "rare", "épique", "légendaire"][i % 4],
                "price_rupees": None if is_euro else int(30 + (i % 10) * 45),
                "price_eur": eur_prices[i] if category == "pack_rupees" else
                    (round(2.99 + i * 5, 2) if category == "pack_aventurier" else None),
                "compendium_name": None,
            })
            item_id += 1
    snapshot = json.loads(compendium_snapshot_path.read_text(encoding="utf-8"))
    compendium_names = sorted({
        entry["name"] for entry in snapshot.get("entries", [])
        if isinstance(entry.get("name"), str) and entry["name"].strip()
    })
    if len(compendium_names) < 40:
        raise ValueError(f"Compendium snapshot must contain at least 40 named entries: {compendium_snapshot_path}")
    compendium_rng = np.random.default_rng(SEED + 1)
    item_indexes = compendium_rng.choice(len(items), 40, replace=False)
    selected_names = compendium_rng.choice(compendium_names, 40, replace=False)
    for item_index, name in zip(item_indexes, selected_names):
        items[int(item_index)]["compendium_name"] = str(name)
    return {
        "regions": regions,
        "quests": quests,
        "bosses": bosses,
        "patches": patches,
        "shop_items": pd.DataFrame(items),
    }


def make_players(rng: np.random.Generator) -> pd.DataFrame:
    signup_dates = sample_dates(rng)
    player_ids = [f"P{i:06d}" for i in range(1, PLAYER_COUNT + 1)]
    platforms = np.empty(PLAYER_COUNT, dtype=object)
    dates = np.asarray(signup_dates, dtype=object)
    pc_cohort = np.flatnonzero((dates >= date(2026, 6, 1)) & (dates <= date(2026, 6, 30)))
    rng.shuffle(pc_cohort)
    platforms[pc_cohort[:1_000]] = "pc"
    platforms[pc_cohort[1_000:]] = rng.choice(["ios", "android"], size=1_000, p=[0.475, 0.525])
    other = np.ones(PLAYER_COUNT, dtype=bool)
    other[pc_cohort] = False
    platforms[other] = rng.choice(PLATFORMS, size=int(other.sum()), p=[0.38, 0.42, 0.20])
    signup_timestamps = []
    for day in signup_dates:
        hour = int(rng.choice([9, 12, 15, 18, 19, 20, 21, 22, 23], p=[
            0.04, 0.05, 0.06, 0.13, 0.16, 0.17, 0.16, 0.13, 0.10
        ]))
        signup_timestamps.append(datetime.combine(day, datetime.min.time()).replace(
            hour=hour, minute=int(rng.integers(0, 60)), tzinfo=timezone.utc
        ).isoformat().replace("+00:00", "Z"))
    return pd.DataFrame({
        "player_id": player_ids,
        "signup_ts": signup_timestamps,
        "signup_date": [d.isoformat() for d in signup_dates],
        "country": rng.choice(COUNTRIES, PLAYER_COUNT, p=COUNTRY_P),
        "platform": platforms,
        "age_band": rng.choice(AGE_BANDS, PLAYER_COUNT, p=AGE_P),
        "hero_class": rng.choice(CLASSES, PLAYER_COUNT, p=CLASS_P),
        "acquisition_channel": rng.choice(CHANNELS, PLAYER_COUNT, p=CHANNEL_P),
        "is_premium": rng.binomial(1, 0.06, PLAYER_COUNT),
    })


def make_experiments(players: pd.DataFrame, rng: np.random.Generator) -> tuple[pd.DataFrame, dict, pd.DataFrame]:
    dates = pd.to_datetime(players["signup_date"]).dt.date
    assignments: list[dict] = []
    forced_d7: dict[str, dict[str, bool]] = {}
    player_index = {pid: i for i, pid in enumerate(players["player_id"])}

    korok = players.loc[(dates >= date(2026, 2, 1)) & (dates <= date(2026, 3, 15)), "player_id"].to_numpy()
    rng.shuffle(korok)
    for variant, members, retained_count in (
        ("control", korok[:2_000], 400),
        ("treatment", korok[2_000:], 480),
    ):
        retained = set(rng.choice(members, retained_count, replace=False).tolist())
        for pid in members:
            assignments.append({"experiment_id": "EXP_KOROK_2026_02", "player_id": pid,
                                "variant": variant, "assigned_ts": f"{players.at[player_index[pid], 'signup_date']}T00:00:00Z"})
            forced_d7[pid] = {"retained": pid in retained}

    hearts = players.loc[(dates >= date(2026, 5, 4)) & (dates <= date(2026, 5, 17)), "player_id"].to_numpy()
    rng.shuffle(hearts)
    hearts_bought: set[str] = set()
    for variant, members, bought_count in (
        ("control", hearts[:300], 24),
        ("treatment", hearts[300:], 36),
    ):
        buyers = set(rng.choice(members, bought_count, replace=False).tolist())
        hearts_bought.update(buyers)
        for pid in members:
            assignments.append({"experiment_id": "EXP_HEARTS_2026_05", "player_id": pid,
                                "variant": variant, "assigned_ts": f"{players.at[player_index[pid], 'signup_date']}T00:00:00Z"})

    june = players.loc[(dates >= date(2026, 6, 1)) & (dates <= date(2026, 6, 30))].copy()
    pc_ids = june.loc[june["platform"] == "pc", "player_id"].to_numpy()
    mobile_ids = june.loc[june["platform"] != "pc", "player_id"].to_numpy()
    rng.shuffle(pc_ids)
    rng.shuffle(mobile_ids)
    group_a = np.concatenate((mobile_ids[:800], pc_ids[:200]))
    group_b = np.concatenate((mobile_ids[800:], pc_ids[200:]))
    rng.shuffle(group_a)
    rng.shuffle(group_b)
    pack_buyers: set[str] = set()
    for variant, members in (("A", group_a), ("B", group_b)):
        for pid in members:
            assignments.append({"experiment_id": "EXP_PACK_2026_06", "player_id": pid,
                                "variant": variant, "assigned_ts": f"{players.at[player_index[pid], 'signup_date']}T00:00:00Z"})
        pc = [pid for pid in members if players.at[player_index[pid], "platform"] == "pc"]
        pc_count = 24 if variant == "A" else 92
        pack_buyers.update(rng.choice(pc, pc_count, replace=False).tolist())

    for platform in ("android", "ios"):
        mobile_a = [pid for pid in group_a if players.at[player_index[pid], "platform"] == platform]
        mobile_b = [pid for pid in group_b if players.at[player_index[pid], "platform"] == platform]
        count_a = int(round(24 * len(mobile_a) / len(group_a)))
        count_b = int(math.floor(count_a / len(mobile_a) * len(mobile_b)))
        while count_b and count_b / len(mobile_b) >= count_a / len(mobile_a):
            count_b -= 1
        pack_buyers.update(rng.choice(mobile_a, count_a, replace=False).tolist())
        pack_buyers.update(rng.choice(mobile_b, count_b, replace=False).tolist())

    experiments = pd.DataFrame([
        {"experiment_id": "EXP_KOROK_2026_02", "experiment_label": "Récompense Korok",
         "hypothesis": "Une récompense au premier donjon améliore la rétention à J7.",
         "start_date": "2026-02-01", "end_date": "2026-03-15", "primary_metric": "retained_d7"},
        {"experiment_id": "EXP_HEARTS_2026_05", "experiment_label": "Cœurs bonus",
         "hypothesis": "Un tutoriel plus généreux augmente les premiers achats.",
         "start_date": "2026-05-04", "end_date": "2026-05-17", "primary_metric": "first_purchase_within_7d"},
        {"experiment_id": "EXP_PACK_2026_06", "experiment_label": "Pack aventurier",
         "hypothesis": "Une offre de pack augmente les achats en euros.",
         "start_date": "2026-06-01", "end_date": "2026-06-30", "primary_metric": "bought_pack_within_3d"},
    ])
    return experiments, {
        "forced_d7": forced_d7,
        "hearts_buyers": hearts_bought,
        "pack_buyers": pack_buyers,
    }, pd.DataFrame(assignments)


def activity_probability(day: int) -> float:
    anchors = {0: 1.0, 1: 0.41, 7: 0.20, 14: 0.13, 30: 0.08, 60: 0.045}
    if day in anchors:
        return anchors[day]
    if day > 60:
        return 0.045 * math.exp(-(day - 60) / 65)
    left = max(d for d in anchors if d < day)
    right = min(d for d in anchors if d > day)
    return anchors[left] + (anchors[right] - anchors[left]) * (day - left) / (right - left)


def make_sessions(players: pd.DataFrame, regions: pd.DataFrame, forced_d7: dict, rng: np.random.Generator) -> pd.DataFrame:
    signup = pd.to_datetime(players["signup_date"]).dt.date.to_numpy()
    ids = players["player_id"].to_numpy()
    region_ids = regions["region_id"].to_numpy()
    region_weights = np.asarray([0.16, 0.08, 0.10, 0.08, 0.08, 0.10, 0.07, 0.07, 0.08, 0.06, 0.06, 0.06])
    forced = {pid: data["retained"] for pid, data in forced_d7.items()}
    records: list[tuple] = []
    next_id = 1
    max_age = max((END_DATE - d).days for d in signup)
    for age in range(max_age + 1):
        eligible = np.flatnonzero(np.asarray([(d + timedelta(days=age)) <= END_DATE for d in signup]))
        if not len(eligible):
            continue
        active = rng.random(len(eligible)) < activity_probability(age)
        if age == 7:
            active = np.asarray([
                forced.get(ids[i], bool(active[pos]))
                for pos, i in enumerate(eligible)
            ])
        active_players = eligible[active]
        if not len(active_players):
            continue
        counts = 1 + rng.poisson(0.6, len(active_players))
        repeated = np.repeat(active_players, counts)
        n = len(repeated)
        day_values = np.asarray([signup[i] + timedelta(days=age) for i in repeated], dtype=object)
        dates = np.asarray([d.isoformat() for d in day_values])
        post_patch = np.asarray([d >= date(2026, 4, 10) for d in day_values])
        region = rng.choice(region_ids, n, p=region_weights)
        difficulty = np.asarray([regions.loc[regions["region_id"] == r, "danger_level"].iloc[0] for r in region])
        duration = np.clip(rng.lognormal(mean=math.log(14), sigma=0.6, size=n), 1.0, 180.0)
        enemies = rng.poisson(6 * duration / 14)
        deaths = rng.poisson(0.8 * difficulty * np.where(post_patch, 1.15, 1.0))
        rupees = np.maximum(0, (enemies * (4 + rng.gamma(shape=2, scale=1, size=n))).astype(int))
        hours = rng.choice([8, 12, 16, 18, 19, 20, 21, 22, 23], n,
                           p=[0.03, 0.05, 0.08, 0.14, 0.15, 0.17, 0.16, 0.13, 0.09])
        minutes = rng.integers(0, 60, n)
        for pos in range(n):
            ts = f"{dates[pos]}T{int(hours[pos]):02d}:{int(minutes[pos]):02d}:00Z"
            records.append((next_id, ids[repeated[pos]], ts, round(float(duration[pos]), 2),
                            int(region[pos]), int(enemies[pos]), int(deaths[pos]), int(rupees[pos])))
            next_id += 1
    return pd.DataFrame(records, columns=[
        "session_id", "player_id", "start_ts", "duration_min", "region_id",
        "enemies_defeated", "deaths", "rupees_earned",
    ])


def make_quest_attempts(players: pd.DataFrame, quests: pd.DataFrame, rng: np.random.Generator) -> pd.DataFrame:
    n = 40_000
    player_ix = rng.integers(0, len(players), n)
    quest_ix = rng.integers(0, len(quests), n)
    quest_rows = quests.iloc[quest_ix]
    probability = np.clip(0.75 - 0.12 * (quest_rows["difficulty"].to_numpy() - 1), 0.2, 0.9)
    completed = rng.binomial(1, probability)
    timestamps = []
    for i in player_ix:
        signup = date.fromisoformat(players.iloc[i]["signup_date"])
        available = max(0, (END_DATE - signup).days)
        timestamps.append((signup + timedelta(days=int(rng.integers(0, available + 1)))).isoformat() + "T18:00:00Z")
    return pd.DataFrame({
        "attempt_id": np.arange(1, n + 1),
        "player_id": players["player_id"].to_numpy()[player_ix],
        "quest_id": quests["quest_id"].to_numpy()[quest_ix],
        "started_ts": timestamps,
        "completed": completed,
        "duration_min": np.round(rng.lognormal(math.log(18), 0.5, n), 2),
        "deaths": rng.poisson(1.0, n),
    })


def make_boss_fights(players: pd.DataFrame, bosses: pd.DataFrame, rng: np.random.Generator) -> pd.DataFrame:
    n = 25_000
    player_ix = rng.integers(0, len(players), n)
    boss_ix = rng.integers(0, len(bosses), n)
    boss = bosses.iloc[boss_ix]
    dates = []
    for i in player_ix:
        signup = date.fromisoformat(players.iloc[i]["signup_date"])
        available = max(0, (END_DATE - signup).days)
        dates.append(signup + timedelta(days=int(rng.integers(0, available + 1))))
    difficulty = boss["difficulty"].to_numpy()
    post = np.asarray([d >= date(2026, 4, 10) for d in dates])
    p_win = np.clip((0.60 - 0.08 * (difficulty - 1)) * np.where(post, 0.8, 1.0), 0.05, 0.9)
    result = np.where(rng.random(n) < p_win, "win", "lose")
    return pd.DataFrame({
        "fight_id": np.arange(1, n + 1),
        "player_id": players["player_id"].to_numpy()[player_ix],
        "boss_id": bosses["boss_id"].to_numpy()[boss_ix],
        "fight_ts": [d.isoformat() + "T20:00:00Z" for d in dates],
        "result": result,
        "duration_sec": rng.integers(45, 900, n),
        "hearts_at_start": rng.integers(3, 21, n),
        "damage_taken": rng.integers(0, 20, n),
        "attempt_no": rng.choice([1, 2, 3, 4], n, p=[0.55, 0.27, 0.12, 0.06]),
    })


def make_orders(players: pd.DataFrame, items: pd.DataFrame, special_buyers: set[str],
                pack_buyers: set[str], rng: np.random.Generator) -> tuple[pd.DataFrame, pd.DataFrame]:
    ids = players["player_id"].to_numpy()
    signup = {row.player_id: date.fromisoformat(row.signup_date) for row in players.itertuples()}
    hearts_ids = set(players.loc[
        players["signup_date"].between("2026-05-04", "2026-05-17"), "player_id"
    ])
    eligible_early = np.asarray([
        pid for pid in ids if signup[pid] <= date(2026, 6, 16) and pid not in hearts_ids
    ])
    early_rupee = rng.choice(eligible_early, 1_680, replace=False).tolist()
    euro_pool = set(special_buyers) | set(pack_buyers)
    remaining = [pid for pid in ids if pid not in euro_pool and signup[pid] <= date(2026, 6, 10)]
    euro_pool.update(rng.choice(remaining, 720 - len(euro_pool), replace=False).tolist())

    euro_buyer_ids = sorted(euro_pool)
    euro_order_players = euro_buyer_ids * 2
    extra = rng.choice(euro_buyer_ids, 60, replace=True).tolist()
    euro_order_players.extend(extra)
    orders: list[dict] = []
    order_id = 1
    for pid in euro_order_players:
        min_offset = 1 if pid in special_buyers or pid in pack_buyers else 15
        if pid in special_buyers:
            offset = int(rng.integers(1, 7))
        elif pid in pack_buyers:
            offset = int(rng.integers(0, 3))
        else:
            offset = int(rng.integers(min_offset, 60))
        order_date = min(END_DATE, signup[pid] + timedelta(days=offset))
        is_experiment_buyer = pid in special_buyers or pid in pack_buyers
        orders.append({
            "order_id": order_id, "player_id": pid, "order_ts": order_date.isoformat() + "T20:00:00Z",
            "currency": "EUR", "status": "completed" if is_experiment_buyer else
                rng.choice(["completed", "refunded", "failed"], p=[0.94, 0.04, 0.02]),
            "payment_method": rng.choice(["card", "paypal", "apple_pay", "google_pay"]),
        })
        order_id += 1

    rupee_order_players = list(early_rupee)
    later_pool = [pid for pid in ids if pid not in set(early_rupee) and signup[pid] <= date(2026, 6, 1)]
    rupee_order_players.extend(rng.choice(later_pool, 7_500 - len(early_rupee), replace=True).tolist())
    for pid in rupee_order_players:
        order_date = signup[pid] + timedelta(days=int(rng.integers(0, 14))) if pid in early_rupee else \
            signup[pid] + timedelta(days=int(rng.integers(15, 100)))
        order_date = min(END_DATE, order_date)
        orders.append({
            "order_id": order_id, "player_id": pid, "order_ts": order_date.isoformat() + "T20:00:00Z",
            "currency": "RUPEES", "status": rng.choice(["completed", "refunded", "failed"], p=[0.94, 0.04, 0.02]),
            "payment_method": None,
        })
        order_id += 1
    orders_frame = pd.DataFrame(orders)

    eur_items = items[items["price_eur"].notna()]
    rupee_items = items[items["price_rupees"].notna()]
    lines: list[dict] = []
    for order in orders_frame.itertuples():
        line_count = int(rng.choice([1, 2, 3], p=[0.56, 0.34, 0.10]))
        selection = eur_items if order.currency == "EUR" else rupee_items
        if order.currency == "EUR" and order.player_id not in pack_buyers:
            selection = selection[selection["category"] != "pack_aventurier"]
        chosen = selection.sample(line_count, replace=True, random_state=int(rng.integers(0, 2**31 - 1)))
        if order.currency == "EUR" and order.player_id in pack_buyers:
            pack_items = items[items["category"] == "pack_aventurier"]
            pack_item = pack_items.sample(1, random_state=int(rng.integers(0, 2**31 - 1)))
            chosen = pd.concat([pack_item, chosen.iloc[1:]], ignore_index=True)
        for line_no, item in enumerate(chosen.itertuples(), 1):
            if order.currency == "EUR":
                unit_price = float(item.price_eur)
            else:
                unit_price = float(item.price_rupees)
            lines.append({
                "order_id": order.order_id, "line_no": line_no, "item_id": item.item_id,
                "qty": int(rng.integers(1, 4)), "unit_price": unit_price,
            })
    return orders_frame, pd.DataFrame(lines)


def make_reviews(players: pd.DataFrame, rng: np.random.Generator) -> tuple[pd.DataFrame, list[str]]:
    labels = np.asarray(["positive"] * 330 + ["neutral"] * 90 + ["negative"] * 180, dtype=object)
    rng.shuffle(labels)
    positive = ["J'adore le rythme des missions.", "Le monde est agréable à explorer.", "Très bonne surprise, je reviens souvent."]
    neutral = ["Le jeu est correct, sans plus.", "Une expérience convenable.", "Quelques bonnes idées, mais rien de marquant."]
    negative = ["Les commandes me frustrent.", "Je rencontre trop de problèmes techniques.", "La progression devient pénible."]
    themes = ["difficulty", "bugs", "price", "graphics", "story", "controls", "other"]
    rows = []
    ids = rng.choice(players["player_id"].to_numpy(), 600, replace=False)
    for i, (sentiment, pid) in enumerate(zip(labels, ids), 1):
        templates = {"positive": positive, "neutral": neutral, "negative": negative}[sentiment]
        text = str(rng.choice(templates))
        if rng.random() < 0.20:
            text = text.replace("e", "é", 1)
        if rng.random() < 0.15:
            text += " 🙂"
        lang = "en" if rng.random() < 0.05 else "fr"
        if lang == "en":
            text = {"positive": "A delightful adventure.", "neutral": "It is fine.",
                    "negative": "Too many frustrating issues."}[sentiment]
        rating = int(rng.choice([4, 5]) if sentiment == "positive" else
                     3 if sentiment == "neutral" else rng.choice([1, 2]))
        if rng.random() < 0.10:
            rating = int(rng.integers(1, 6))
        review_date = date.fromisoformat(players.loc[players["player_id"] == pid, "signup_date"].iloc[0])
        review_date = min(END_DATE, review_date + timedelta(days=int(rng.integers(0, 60))))
        rows.append({
            "review_id": i, "player_id": pid, "review_ts": review_date.isoformat() + "T12:00:00Z",
            "rating": rating, "lang": lang, "review_text": text, "theme": str(rng.choice(themes)),
        })
    return pd.DataFrame(rows), labels.tolist()


def make_ml_data(players: pd.DataFrame, sessions: pd.DataFrame, quest_attempts: pd.DataFrame,
                 orders: pd.DataFrame, boss_fights: pd.DataFrame, rng: np.random.Generator) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    session_dates = pd.to_datetime(sessions["start_ts"], utc=True)
    session_signup = players.set_index("player_id")["signup_date"]
    offsets = (session_dates.dt.date.to_numpy() -
               pd.to_datetime(sessions["player_id"].map(session_signup)).dt.date.to_numpy()).astype("timedelta64[D]").astype(int)
    early = sessions.assign(day_offset=offsets).query("0 <= day_offset <= 14")
    agg = early.groupby("player_id").agg(
        sessions_d0_14=("session_id", "count"),
        active_days_d0_14=("start_ts", lambda x: pd.to_datetime(x, utc=True).dt.date.nunique()),
        avg_session_min_d0_14=("duration_min", "mean"),
        deaths_first_3_sessions=("deaths", "sum"),
        rupees_balance_d14=("rupees_earned", "sum"),
    )
    regions_visited = early.groupby("player_id")["region_id"].nunique().rename("regions_visited_d14")
    agg = agg.join(regions_visited)
    eligible = players[pd.to_datetime(players["signup_date"]).dt.date <= date(2025, 12, 31)].set_index("player_id")
    quest_counts = quest_attempts.groupby("player_id")["completed"].sum().rename("quests_completed_d14")
    signup_date_map = eligible["signup_date"]
    early_attempts = quest_attempts[
        quest_attempts.apply(
            lambda row: 0 <= (date.fromisoformat(row["started_ts"][:10]) -
                              date.fromisoformat(signup_date_map.get(row["player_id"], "1900-01-01"))).days <= 14,
            axis=1,
        )
    ].groupby("player_id")["completed"].sum().rename("quests_completed_d14")
    agg = agg.join(early_attempts)
    agg = agg.join(eligible[["signup_date", "country", "platform", "acquisition_channel", "hero_class", "age_band"]], how="inner")
    agg = agg[agg["sessions_d0_14"] >= 3].copy()
    agg["avg_session_min_d0_14"] = agg["avg_session_min_d0_14"].round(2)
    agg["quests_completed_d14"] = agg["quests_completed_d14"].fillna(0).astype(int)
    agg["first_boss_win_by_d14"] = rng.binomial(1, 0.35, len(agg))
    agg["days_to_first_dungeon"] = np.where(rng.random(len(agg)) < 0.35, np.nan, rng.integers(1, 15, len(agg)))
    early_orders = orders.merge(players[["player_id", "signup_date"]], on="player_id")
    early_orders["offset"] = (
        pd.to_datetime(early_orders["order_ts"], utc=True).dt.date -
        pd.to_datetime(early_orders["signup_date"]).dt.date
    ).map(lambda delta: delta.days)
    bought = set(early_orders.loc[(early_orders["currency"] == "RUPEES") & early_orders["offset"].between(0, 14), "player_id"])
    agg["purchased_by_d14"] = agg.index.isin(bought).astype(int)
    agg["patch_era"] = np.where(pd.to_datetime(agg["signup_date"]).dt.date >= date(2026, 4, 10),
                                "depuis_2_3", "avant_2_3")
    z_quests = (agg["quests_completed_d14"] - agg["quests_completed_d14"].mean()) / (agg["quests_completed_d14"].std() or 1)
    z_deaths = (agg["deaths_first_3_sessions"] - agg["deaths_first_3_sessions"].mean()) / (agg["deaths_first_3_sessions"].std() or 1)
    logit = (
        2.2 * (
            -0.35 * z_quests + 0.30 * z_deaths
            + 0.55 * (agg["acquisition_channel"] == "ads").astype(int)
            - 0.90 * agg["first_boss_win_by_d14"]
            - 0.70 * agg["purchased_by_d14"]
            + 0.25 * (agg["platform"] == "android").astype(int)
            + 0.25 * (agg["patch_era"] == "depuis_2_3").astype(int)
        )
        + rng.normal(0, 0.5, len(agg))
    )
    target_rate = 0.28
    low, high = -10.0, 10.0
    for _ in range(80):
        intercept = (low + high) / 2
        rate = (1 / (1 + np.exp(-(logit + intercept)))).mean()
        if rate < target_rate:
            low = intercept
        else:
            high = intercept
    churn_probability = 1 / (1 + np.exp(-(logit + (low + high) / 2)))
    churn = rng.binomial(1, churn_probability)
    agg["churn_d15_44"] = churn
    agg["signup_date"] = pd.to_datetime(agg["signup_date"]).dt.date.astype(str)
    churn_by_player = agg["churn_d15_44"].to_dict()
    session_signup = players.set_index("player_id")["signup_date"]
    session_offsets = (
        pd.to_datetime(sessions["start_ts"], utc=True).dt.date.to_numpy()
        - pd.to_datetime(sessions["player_id"].map(session_signup)).dt.date.to_numpy()
    ).astype("timedelta64[D]").astype(int)
    adjusted = sessions.copy()
    remove_ids = {
        pid for pid, outcome in churn_by_player.items() if int(outcome) == 1
    }
    remove_mask = adjusted["player_id"].isin(remove_ids).to_numpy() & (session_offsets >= 15)
    adjusted = adjusted.loc[~remove_mask].copy()
    synthetic_rows = []
    next_session_id = int(adjusted["session_id"].max()) + 1
    region_ids = [1, 2, 3, 4]
    for pid, outcome in churn_by_player.items():
        if int(outcome) == 0:
            player_signup = date.fromisoformat(session_signup[pid])
            active_day = player_signup + timedelta(days=44)
            synthetic_rows.append({
                "session_id": next_session_id, "player_id": pid,
                "start_ts": active_day.isoformat() + "T20:00:00Z",
                "duration_min": 14.0, "region_id": int(rng.choice(region_ids)),
                "enemies_defeated": 6, "deaths": 1, "rupees_earned": 36,
            })
            next_session_id += 1
    if synthetic_rows:
        adjusted = pd.concat([adjusted, pd.DataFrame(synthetic_rows)], ignore_index=True)
    sessions = adjusted.sort_values("session_id").reset_index(drop=True)
    columns = [
        "signup_date", "country", "platform", "acquisition_channel", "hero_class", "age_band",
        "sessions_d0_14", "active_days_d0_14", "avg_session_min_d0_14",
        "deaths_first_3_sessions", "regions_visited_d14", "quests_completed_d14",
        "first_boss_win_by_d14", "days_to_first_dungeon", "purchased_by_d14",
        "rupees_balance_d14", "patch_era", "churn_d15_44",
    ]
    ml = agg[columns].reset_index()
    leaky = ml.drop(columns=["churn_d15_44"]).copy()
    full_stats = sessions.groupby("player_id").agg(
        sessions_total=("session_id", "count"),
        days_active_total=("start_ts", lambda x: pd.to_datetime(x, utc=True).dt.date.nunique()),
        last_session_date=("start_ts", "max"),
    )
    leaky = leaky.merge(full_stats, on="player_id", how="left")
    leaky["days_since_last_session"] = (
        pd.Timestamp("2026-07-01", tz="UTC") - pd.to_datetime(leaky["last_session_date"], utc=True)
    ).dt.days
    eur_spend = orders[orders["currency"] == "EUR"].groupby("player_id").size().rename("lifetime_spend_eur")
    leaky = leaky.merge(eur_spend, on="player_id", how="left")
    leaky["lifetime_spend_eur"] = leaky["lifetime_spend_eur"].fillna(0) * 9.99

    ltv_players = players[pd.to_datetime(players["signup_date"]).dt.date < date(2026, 4, 1)].copy()
    ltv = ltv_players[["player_id", "signup_date", "platform", "country", "acquisition_channel"]].copy()
    ltv["sessions_d0_7"] = rng.poisson(3.0, len(ltv))
    ltv["active_days_d0_7"] = np.minimum(8, rng.poisson(2.5, len(ltv)))
    ltv["spend_eur_d8_90"] = np.where(
        rng.random(len(ltv)) < 0.07, rng.lognormal(mean=2.2, sigma=1.0, size=len(ltv)), 0.0
    )
    ltv["spend_eur_d8_90"] = ltv["spend_eur_d8_90"].round(2)
    return ml, leaky, ltv, sessions


def make_excel_extract(orders: pd.DataFrame, lines: pd.DataFrame, items: pd.DataFrame,
                       players: pd.DataFrame, rng: np.random.Generator) -> tuple[pd.DataFrame, dict]:
    flat = lines.merge(orders, on="order_id").merge(items, on="item_id").merge(
        players[["player_id", "platform", "country"]], on="player_id"
    )
    flat = flat.rename(columns={"order_ts": "order_date"})
    flat = flat[["order_id", "order_date", "player_id", "item_name", "category", "qty",
                 "unit_price", "currency", "platform", "country"]]
    base = flat.drop_duplicates().sample(n=9_960, random_state=SEED).reset_index(drop=True)
    bad_qty = rng.choice(base.index.to_numpy(), 18, replace=False)
    base.loc[bad_qty, "qty"] = 0
    available = np.setdiff1d(base.index.to_numpy(), bad_qty)
    negative = rng.choice(available, 12, replace=False)
    base.loc[negative, "unit_price"] = -base.loc[negative, "unit_price"].abs()
    available = np.setdiff1d(available, negative)
    future = rng.choice(available, 25, replace=False)
    base.loc[future, "order_date"] = "2026-07-02T12:00:00Z"
    available = np.setdiff1d(available, future)
    messy = rng.choice(available, 300, replace=False)
    for index in messy:
        base.loc[index, "item_name"] = f"  {str(base.loc[index, 'item_name']).swapcase()} "
    duplicate_candidates = np.setdiff1d(available, messy)
    duplicate_ix = rng.choice(duplicate_candidates, 40, replace=False)
    extract = pd.concat([base, base.loc[duplicate_ix]], ignore_index=True)
    truth = {
        "duplicate_rows_added": 40,
        "negative_prices": 12,
        "future_dates": 25,
        "inconsistent_item_names": 300,
        "zero_quantities": 18,
        "source_row_numbers": {
            "zero_quantities": [int(i) + 2 for i in bad_qty],
            "negative_prices": [int(i) + 2 for i in negative],
            "future_dates": [int(i) + 2 for i in future],
            "inconsistent_item_names": [int(i) + 2 for i in messy],
            "duplicate_rows_added": [9_962 + i for i in range(40)],
        },
    }
    return extract, truth


def make_excel_boss_extract(orders: pd.DataFrame, lines: pd.DataFrame, items: pd.DataFrame,
                            players: pd.DataFrame, seed: int) -> tuple[pd.DataFrame, dict]:
    flat = lines.merge(orders, on="order_id").merge(items, on="item_id").merge(
        players[["player_id", "platform", "country"]], on="player_id"
    )
    flat = flat.rename(columns={"order_ts": "order_date"})
    flat = flat[["order_id", "order_date", "player_id", "item_name", "category", "qty",
                 "unit_price", "currency", "platform", "country"]]
    duplicate_count = 28
    rng = np.random.default_rng(seed)
    base = flat.drop_duplicates().sample(
        n=10_000 - duplicate_count,
        random_state=seed,
    ).reset_index(drop=True)
    bad_qty = rng.choice(base.index.to_numpy(), 14, replace=False)
    base.loc[bad_qty, "qty"] = 0
    available = np.setdiff1d(base.index.to_numpy(), bad_qty)
    negative = rng.choice(available, 7, replace=False)
    base.loc[negative, "unit_price"] = -base.loc[negative, "unit_price"].abs()
    available = np.setdiff1d(available, negative)
    future = rng.choice(available, 21, replace=False)
    base.loc[future, "order_date"] = "2026-07-02T12:00:00Z"
    available = np.setdiff1d(available, future)
    messy = rng.choice(available, 240, replace=False)
    for index in messy:
        base.loc[index, "item_name"] = f"  {str(base.loc[index, 'item_name']).swapcase()} "
    duplicate_candidates = np.setdiff1d(available, messy)
    duplicate_ix = rng.choice(duplicate_candidates, duplicate_count, replace=False)
    extract = pd.concat([base, base.loc[duplicate_ix]], ignore_index=True)
    truth = {
        "duplicate_rows_added": duplicate_count,
        "negative_prices": len(negative),
        "future_dates": len(future),
        "inconsistent_item_names": len(messy),
        "zero_quantities": len(bad_qty),
        "source_row_numbers": {
            "zero_quantities": [int(i) + 2 for i in bad_qty],
            "negative_prices": [int(i) + 2 for i in negative],
            "future_dates": [int(i) + 2 for i in future],
            "inconsistent_item_names": [int(i) + 2 for i in messy],
            "duplicate_rows_added": [10_000 - duplicate_count + i for i in range(duplicate_count)],
        },
    }
    return extract, truth


def make_star_schema(sessions: pd.DataFrame, orders: pd.DataFrame, lines: pd.DataFrame,
                     players: pd.DataFrame, items: pd.DataFrame, regions: pd.DataFrame) -> dict[str, pd.DataFrame]:
    dates = pd.to_datetime(sessions["start_ts"], utc=True).dt.date
    order_dates = pd.to_datetime(orders["order_ts"], utc=True).dt.date
    date_values = sorted(set(dates) | set(order_dates))
    dim_date = pd.DataFrame({"date_id": np.arange(1, len(date_values) + 1),
                             "date": [d.isoformat() for d in date_values]})
    parsed = pd.to_datetime(dim_date["date"])
    dim_date["year"] = parsed.dt.year
    dim_date["month"] = parsed.dt.month
    dim_date["week"] = parsed.dt.isocalendar().week.astype(int)
    dim_date["day"] = parsed.dt.day
    dim_player = players.copy()
    dim_player.insert(0, "player_key", np.arange(1, len(players) + 1))
    player_keys = dict(zip(dim_player["player_id"], dim_player["player_key"]))
    dim_item = items.copy()
    dim_item.insert(0, "item_key", np.arange(1, len(items) + 1))
    item_keys = dict(zip(dim_item["item_id"], dim_item["item_key"]))
    dim_region = regions.copy()
    dim_region.insert(0, "region_key", np.arange(1, len(regions) + 1))
    region_keys = dict(zip(dim_region["region_id"], dim_region["region_key"]))
    date_keys = dict(zip(dim_date["date"], dim_date["date_id"]))
    fact_sessions = sessions.copy()
    fact_sessions["player_key"] = fact_sessions["player_id"].map(player_keys)
    fact_sessions["region_key"] = fact_sessions["region_id"].map(region_keys)
    fact_sessions["date_key"] = pd.to_datetime(fact_sessions["start_ts"], utc=True).dt.date.astype(str).map(date_keys)
    fact_sessions = fact_sessions[["session_id", "player_key", "region_key", "date_key",
                                   "duration_min", "enemies_defeated", "deaths", "rupees_earned"]]
    fact_orders = lines.merge(orders, on="order_id")
    fact_orders["player_key"] = fact_orders["player_id"].map(player_keys)
    fact_orders["item_key"] = fact_orders["item_id"].map(item_keys)
    fact_orders["date_key"] = pd.to_datetime(fact_orders["order_ts"], utc=True).dt.date.astype(str).map(date_keys)
    fact_orders["revenue"] = (fact_orders["qty"] * fact_orders["unit_price"]).round(2)
    fact_orders = fact_orders[["order_id", "line_no", "player_key", "item_key", "date_key",
                               "currency", "status", "qty", "unit_price", "revenue"]]
    return {
        "dim_player": dim_player,
        "dim_date": dim_date,
        "dim_item": dim_item,
        "dim_region": dim_region,
        "fact_sessions": fact_sessions,
        "fact_orders": fact_orders,
    }


def make_corrupted(players: pd.DataFrame, sessions: pd.DataFrame, orders: pd.DataFrame,
                   lines: pd.DataFrame, root: Path, rng: np.random.Generator) -> None:
    subset_ids = set(players["player_id"].iloc[:2_000])
    raw_players = players[players["player_id"].isin(subset_ids)].copy().reset_index(drop=True)
    raw_sessions = sessions[sessions["player_id"].isin(subset_ids)].copy().reset_index(drop=True)
    raw_orders = orders[orders["player_id"].isin(subset_ids)].copy().reset_index(drop=True)
    raw_lines = lines[lines["order_id"].isin(set(raw_orders["order_id"]))].copy().reset_index(drop=True)
    clean_tables = {
        "players": raw_players.copy(),
        "sessions": raw_sessions.copy(),
        "orders": raw_orders.copy(),
        "order_lines": raw_lines.copy(),
    }

    duplicate_ids = rng.choice(raw_players["player_id"].to_numpy(), 24, replace=False)
    duplicates = raw_players[raw_players["player_id"].isin(duplicate_ids)].copy()
    duplicates["country"] = duplicates["country"].map({"FR": "France", "US": "USA", "DE": "Germany"}).fillna("FRANCE")
    duplicates["signup_date"] = pd.to_datetime(duplicates["signup_date"]).dt.strftime("%d/%m/%Y")
    raw_players["platform"] = raw_players["platform"].astype(object)
    missing_count = int(round(len(raw_players) * 0.04))
    missing_ix = rng.choice(raw_players.index.to_numpy(), missing_count, replace=False)
    third = missing_count // 3
    raw_players.loc[missing_ix[:third], "platform"] = ""
    raw_players.loc[missing_ix[third:2 * third], "platform"] = "N/A"
    raw_players.loc[missing_ix[2 * third:], "platform"] = "null"
    raw_players = pd.concat([raw_players, duplicates], ignore_index=True)
    raw_players.loc[raw_players.index[:15], "signup_date"] = "2026-07-10"

    n_sessions = len(raw_sessions)
    date_fmt = rng.choice(raw_sessions.index.to_numpy(), max(1, int(n_sessions * 0.06)), replace=False)
    remaining = np.setdiff1d(raw_sessions.index.to_numpy(), date_fmt)
    epoch = rng.choice(remaining, max(1, int(n_sessions * 0.02)), replace=False)
    raw_sessions["start_ts"] = raw_sessions["start_ts"].astype(object)
    raw_sessions.loc[date_fmt, "start_ts"] = pd.to_datetime(raw_sessions.loc[date_fmt, "start_ts"], utc=True).dt.strftime("%d/%m/%Y %H:%M")
    raw_sessions.loc[epoch, "start_ts"] = (
        pd.to_datetime(raw_sessions.loc[epoch, "start_ts"], utc=True).astype("int64") // 1_000_000_000
    ).astype(str)
    raw_sessions.loc[raw_sessions.sample(frac=0.003, random_state=SEED).index, "rupees_earned"] *= -1
    long_count = max(1, int(n_sessions * 0.0005))
    zero_count = max(1, int(n_sessions * 0.002))
    long_ix = rng.choice(raw_sessions.index.to_numpy(), long_count, replace=False)
    remaining_duration_ix = np.setdiff1d(raw_sessions.index.to_numpy(), long_ix)
    zero_ix = rng.choice(remaining_duration_ix, zero_count, replace=False)
    raw_sessions.loc[long_ix, "duration_min"] = 1500
    raw_sessions.loc[zero_ix, "duration_min"] = 0
    orphan_sessions = rng.choice(raw_sessions.index.to_numpy(), 25, replace=False)
    raw_sessions.loc[orphan_sessions, "player_id"] = "P999999"

    orphan_lines = rng.choice(raw_lines.index.to_numpy(), 40, replace=False)
    raw_lines.loc[orphan_lines, "order_id"] = 999_999_999
    raw_dir = root / "data" / "corrupted"
    raw_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(raw_dir / "hqo_corrupted.zip", "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, frame in (
            ("players_raw.csv", raw_players), ("sessions_raw.csv", raw_sessions),
            ("orders_raw.csv", raw_orders), ("order_lines_raw.csv", raw_lines),
        ):
            content = frame.to_csv(index=False, encoding="utf-8", lineterminator="\n")
            archive.writestr(name, content)
        write_clean_truth = {}
        for name, frame in clean_tables.items():
            rows = frame.astype(object).where(pd.notna(frame), "").values.tolist()
            payload = json.dumps([[str(x) for x in row] for row in rows], ensure_ascii=False, separators=(",", ":"))
            write_clean_truth[name] = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        archive.writestr("expected_clean_hashes.json",
                         json.dumps(write_clean_truth, ensure_ascii=False, indent=2) + "\n")
    normalize_zip_timestamps(raw_dir / "hqo_corrupted.zip")


def write_database(tables: dict[str, pd.DataFrame], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    primary = {
        "regions": ["region_id"], "players": ["player_id"], "sessions": ["session_id"],
        "quests": ["quest_id"], "quest_attempts": ["attempt_id"], "bosses": ["boss_id"],
        "boss_fights": ["fight_id"], "shop_items": ["item_id"], "orders": ["order_id"],
        "order_lines": ["order_id", "line_no"], "experiments": ["experiment_id"],
        "experiment_assignments": ["experiment_id", "player_id"], "patches": ["patch_id"],
        "reviews": ["review_id"],
    }
    foreign = {
        "quests": {"region_id": ("regions", "region_id")},
        "bosses": {"region_id": ("regions", "region_id")},
        "sessions": {"player_id": ("players", "player_id"), "region_id": ("regions", "region_id")},
        "quest_attempts": {"player_id": ("players", "player_id"), "quest_id": ("quests", "quest_id")},
        "boss_fights": {"player_id": ("players", "player_id"), "boss_id": ("bosses", "boss_id")},
        "orders": {"player_id": ("players", "player_id")},
        "order_lines": {"order_id": ("orders", "order_id"), "item_id": ("shop_items", "item_id")},
        "experiment_assignments": {"experiment_id": ("experiments", "experiment_id"),
                                   "player_id": ("players", "player_id")},
        "reviews": {"player_id": ("players", "player_id")},
    }
    with sqlite3.connect(path) as con:
        con.execute("PRAGMA foreign_keys = ON")
        for table, frame in tables.items():
            columns = []
            for col in frame.columns:
                dtype = frame[col].dtype
                sql_type = "INTEGER" if pd.api.types.is_integer_dtype(dtype) else \
                    "REAL" if pd.api.types.is_float_dtype(dtype) else "TEXT"
                columns.append(f'"{col}" {sql_type}')
            pk = primary.get(table, [])
            if pk:
                columns.append("PRIMARY KEY (" + ", ".join(f'"{c}"' for c in pk) + ")")
            for col, (parent, parent_col) in foreign.get(table, {}).items():
                columns.append(f'FOREIGN KEY ("{col}") REFERENCES "{parent}"("{parent_col}")')
            con.execute(f'CREATE TABLE "{table}" ({", ".join(columns)})')
            def sqlite_value(value):
                if pd.isna(value):
                    return None
                return value.item() if isinstance(value, np.generic) else value

            values = (
                tuple(sqlite_value(value) for value in row)
                for row in frame.itertuples(index=False, name=None)
            )
            placeholders = ",".join("?" for _ in frame.columns)
            col_names = ",".join(f'"{c}"' for c in frame.columns)
            con.executemany(f'INSERT INTO "{table}" ({col_names}) VALUES ({placeholders})', values)
        con.commit()


def generate_sql_boss_database(root: Path = ROOT, seed: int = SEED + 2) -> dict:
    """Generate an alternate-seed, browser-sized database for the M2 boss."""
    rng = np.random.default_rng(seed)
    refs = make_reference_tables(ROOT / "data" / "compendium" / "compendium_snapshot.json")
    players = make_players(rng)
    experiments, experiment_state, assignments = make_experiments(players, rng)
    sessions = make_sessions(players, refs["regions"], experiment_state["forced_d7"], rng)
    quest_attempts = make_quest_attempts(players, refs["quests"], rng)
    boss_fights = make_boss_fights(players, refs["bosses"], rng)
    orders, order_lines = make_orders(
        players, refs["shop_items"], experiment_state["hearts_buyers"],
        experiment_state["pack_buyers"], rng,
    )
    reviews, _ = make_reviews(players, rng)
    _, _, _, sessions = make_ml_data(
        players, sessions, quest_attempts, orders, boss_fights, rng,
    )
    tables = {
        "regions": refs["regions"], "players": players, "sessions": sessions,
        "quests": refs["quests"], "quest_attempts": quest_attempts, "bosses": refs["bosses"],
        "boss_fights": boss_fights, "shop_items": refs["shop_items"], "orders": orders,
        "order_lines": order_lines, "experiments": experiments,
        "experiment_assignments": assignments, "patches": refs["patches"], "reviews": reviews,
    }

    player_ids = set(rng.choice(players["player_id"].to_numpy(), 2_000, replace=False))
    boss_tables = {}
    for name, frame in tables.items():
        if name == "players":
            subset = frame[frame["player_id"].isin(player_ids)]
        elif name in {"sessions", "quest_attempts", "boss_fights", "orders", "reviews",
                      "experiment_assignments"}:
            subset = frame[frame["player_id"].isin(player_ids)]
        elif name == "order_lines":
            subset = frame[frame["order_id"].isin(set(boss_tables["orders"]["order_id"]))]
        else:
            subset = frame
        boss_tables[name] = subset.reset_index(drop=True)

    database_path = root / "data" / "hqo_boss.sqlite"
    write_database(boss_tables, database_path)
    return {
        "path": str(database_path),
        "seed": seed,
        "players": len(boss_tables["players"]),
        "sessions": len(boss_tables["sessions"]),
        "orders": len(boss_tables["orders"]),
    }


def generate_m3_boss_csv(root: Path = ROOT, seed: int = SEED + 3) -> dict:
    """Write a separate, reproducible M3 experiment with a planted five-point lift."""
    rng = np.random.default_rng(seed)
    rows = []
    for variant, retained_count in (("control", 360), ("treatment", 460)):
        retained = np.zeros(2_000, dtype=int)
        retained[rng.choice(2_000, retained_count, replace=False)] = 1
        rng.shuffle(retained)
        rows.extend({
            "experiment_id": "EXP_BOSS_2026_11",
            "participant_id": f"{variant[0].upper()}{index + 1:04d}",
            "variant": variant,
            "retained_d7": int(value),
        } for index, value in enumerate(retained))
    path = root / "data" / "csv" / "exp_boss.csv"
    write_csv(pd.DataFrame(rows), path)
    return {
        "seed": seed,
        "csv": str(path.relative_to(root)),
        "participants_per_arm": 2_000,
        "planted_rates": {"control": 0.18, "treatment": 0.23},
    }


def generate(root: Path = ROOT, seed: int = SEED, private_root: Path | None = None) -> dict:
    rng = np.random.default_rng(seed)
    (root / "data").mkdir(parents=True, exist_ok=True)
    refs = make_reference_tables(ROOT / "data" / "compendium" / "compendium_snapshot.json")
    players = make_players(rng)
    experiments, experiment_state, assignments = make_experiments(players, rng)
    refs["experiments"] = experiments
    sessions = make_sessions(players, refs["regions"], experiment_state["forced_d7"], rng)
    quest_attempts = make_quest_attempts(players, refs["quests"], rng)
    boss_fights = make_boss_fights(players, refs["bosses"], rng)
    orders, order_lines = make_orders(players, refs["shop_items"], experiment_state["hearts_buyers"],
                                      experiment_state["pack_buyers"], rng)
    reviews, review_labels = make_reviews(players, rng)

    tables = {
        "regions": refs["regions"], "players": players, "sessions": sessions,
        "quests": refs["quests"], "quest_attempts": quest_attempts, "bosses": refs["bosses"],
        "boss_fights": boss_fights, "shop_items": refs["shop_items"], "orders": orders,
        "order_lines": order_lines, "experiments": experiments, "experiment_assignments": assignments,
        "patches": refs["patches"], "reviews": reviews,
    }
    ml, leaky, ltv, sessions = make_ml_data(players, sessions, quest_attempts, orders, boss_fights, rng)
    tables["sessions"] = sessions
    excel, excel_truth = make_excel_extract(orders, order_lines, refs["shop_items"], players, rng)
    excel_boss, excel_boss_truth = make_excel_boss_extract(
        orders, order_lines, refs["shop_items"], players, seed + 1
    )
    star = make_star_schema(sessions, orders, order_lines, players, refs["shop_items"], refs["regions"])

    for name, frame in tables.items():
        write_csv(frame, root / "data" / "csv" / f"{name}.csv")
    write_database(tables, root / "data" / "hqo_full.sqlite")

    lite_ids = set(rng.choice(players["player_id"].to_numpy(), 2_000, replace=False))
    lite_tables = {}
    for name, frame in tables.items():
        if name == "players":
            subset = frame[frame["player_id"].isin(lite_ids)]
        elif name in {"sessions", "quest_attempts", "boss_fights", "orders", "reviews"}:
            subset = frame[frame["player_id"].isin(lite_ids)]
        elif name == "experiment_assignments":
            subset = frame[frame["player_id"].isin(lite_ids)]
        elif name == "order_lines":
            subset = frame[frame["order_id"].isin(set(lite_tables["orders"]["order_id"]))]
        else:
            subset = frame
        lite_tables[name] = subset.reset_index(drop=True)
    write_database(lite_tables, root / "data" / "hqo_lite.sqlite")
    for name, frame in star.items():
        write_csv(frame, root / "data" / "star_schema" / f"{name}.csv")
    write_csv(ml, root / "data" / "ml" / "ml_churn_players.csv")
    write_csv(leaky, root / "data" / "ml" / "players_snapshot_leaky.csv")
    write_csv(ltv, root / "data" / "ml" / "ml_ltv_players.csv")
    write_csv(excel, root / "data" / "excel" / "boutique_extrait.csv")
    write_csv(excel_boss, root / "data" / "excel" / "boutique_extrait_boss.csv")
    workbook_path = root / "data" / "excel" / "boutique_extrait.xlsx"
    try:
        from openpyxl import load_workbook

        excel.to_excel(workbook_path, index=False, engine="openpyxl")
        workbook = load_workbook(workbook_path)
        workbook.properties.created = datetime(2026, 7, 1)
        workbook.properties.modified = datetime(2026, 7, 1)
        workbook.save(workbook_path)
        normalize_zip_timestamps(workbook_path)
    except ImportError as exc:
        raise RuntimeError("Generating the Excel workbook requires openpyxl; install course/grading/requirements.txt") from exc
    if private_root is not None:
        private_root.mkdir(parents=True, exist_ok=True)
        write_json(excel_truth, private_root / "module1-boutique-anomalies.json")
        write_json(excel_boss_truth, private_root / "module1-boutique-boss-anomalies.json")
    make_corrupted(players, sessions, orders, order_lines, root, rng)
    review_hashes = sorted(hashlib.sha256(
        f"{i}|{label}|{SALT}".encode("utf-8")
    ).hexdigest() for i, label in enumerate(review_labels, 1))
    write_json(review_hashes, root / "data" / "reviews" / "reviews_gold_hashed.json")
    write_csv(reviews, root / "data" / "reviews" / "reviews.csv")

    facts = {
        "seed": seed,
        "players": len(players),
        "sessions": len(sessions),
        "orders": len(orders),
        "order_lines": len(order_lines),
        "retained_d7_control": 0.20,
        "retained_d7_treatment": 0.24,
        "review_count": len(reviews),
    }
    write_json(facts, root / "data" / "expected" / "facts.json")
    if private_root is not None:
        make_ground_truth(private_root, seed, facts, excel_truth, excel_boss_truth, experiment_state)
    return facts


def make_ground_truth(
    private_root: Path,
    seed: int,
    facts: dict,
    excel_truth: dict,
    excel_boss_truth: dict,
    experiment_state: dict,
) -> None:
    content = f"""# Vérité terrain — réservé à l'enseignant

Graine du générateur : `{seed}`.

## Faits générés

- Joueurs : {facts['players']}
- Sessions : {facts['sessions']}
- Commandes : {facts['orders']}
- Lignes de commande : {facts['order_lines']}

## Expériences

- EXP_KOROK_2026_02 : contrôle 20 % de rétention J7 ; traitement 24 %.
- EXP_HEARTS_2026_05 : contrôle 8 % et traitement 12 % d'achats en sept jours.
- EXP_PACK_2026_06 : le bras B est surreprésenté sur PC ; ses conversions sont plus faibles que A dans chaque plateforme, mais plus élevées globalement.

## Anomalies Excel

Les anomalies de l'extrait principal sont détaillées dans `module1-boutique-anomalies.json` :
40 doublons, 12 prix négatifs, 25 dates futures, 300 noms incohérents et 18 quantités nulles.
L'extrait bis a ses propres nombres et lignes dans `module1-boutique-boss-anomalies.json` :
{excel_boss_truth['duplicate_rows_added']} doublons, {excel_boss_truth['negative_prices']} prix négatifs,
{excel_boss_truth['future_dates']} dates futures, {excel_boss_truth['inconsistent_item_names']} noms incohérents
et {excel_boss_truth['zero_quantities']} quantités nulles.

## Churn

La cible est `churn_d15_44`. Les variables de `ml_churn_players.csv` ne dépassent pas J14.
`players_snapshot_leaky.csv` ajoute des variables calculées sur l'historique complet.

## Choix de génération à revoir après les tests

Le parcours d'expérimentation exige 4 000 inscriptions du 1er février au 15 mars, 600 du 4 au 17 mai,
et 2 000 en juin. Ces cohortes fixes priment sur les moyennes journalières approximatives du cahier.
Les seuils de statistiques et de modèles doivent être confirmés par `scripts/test_dataset.py`.
"""
    private_root.mkdir(parents=True, exist_ok=True)
    (private_root / "GROUND_TRUTH.md").write_text(content, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-root", type=Path, default=ROOT)
    parser.add_argument("--seed", type=int)
    parser.add_argument("--private-output", type=Path, default=ROOT.parent / "grading-private")
    boss_outputs = parser.add_mutually_exclusive_group()
    boss_outputs.add_argument("--boss-sqlite", action="store_true",
                              help="generate only the alternate-seed M2 boss database")
    boss_outputs.add_argument("--m3-boss-csv", action="store_true",
                              help="generate only the alternate-seed M3 experiment CSV")
    args = parser.parse_args()
    if args.boss_sqlite:
        seed = args.seed if args.seed is not None else SEED + 2
        print(json.dumps(generate_sql_boss_database(args.output_root, seed), indent=2))
        return
    if args.m3_boss_csv:
        seed = args.seed if args.seed is not None else SEED + 3
        print(json.dumps(generate_m3_boss_csv(args.output_root, seed), indent=2))
        return
    seed = args.seed if args.seed is not None else SEED
    facts = generate(args.output_root.resolve(), seed, args.private_output.resolve())
    print(json.dumps(facts, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
