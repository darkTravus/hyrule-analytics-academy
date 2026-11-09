import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "grading"))
import hashing as H


MODULE = ROOT / "modules" / "m1-inventaire"
DATA = ROOT / "data" / "excel"
ANSWER_KEY = ROOT / "data" / "expected" / "answers_hashed.json"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def assert_text_answer(answer_key, answer_id, value):
    item = answer_key["items"][answer_id]
    assert item["kind"] == "text"
    assert H.hash_text(answer_id, value, answer_key["salt"]) == item["hash"]


def assert_number_answer(answer_key, answer_id, value):
    item = answer_key["items"][answer_id]
    assert item["kind"] == "num"
    assert H.match_num(answer_id, value, item["tol"], answer_key["salt"], item["hash"])


def clean_extract(path):
    data = pd.read_csv(path, parse_dates=["order_date"])
    clean = data.drop_duplicates().copy()
    clean = clean[
        (clean["unit_price"] >= 0)
        & (clean["qty"] > 0)
        & (clean["order_date"] <= pd.Timestamp("2026-07-01T23:59:59Z"))
    ].copy()
    clean["item_name"] = clean["item_name"].str.strip().str.lower()
    clean["line_revenue"] = clean["qty"] * clean["unit_price"]
    return data, clean


def exercise_facts(clean):
    march = clean[
        (clean["order_date"].dt.year == 2026)
        & (clean["order_date"].dt.month == 3)
    ]
    rupees = clean[clean["currency"] == "RUPEES"]
    top = rupees.groupby("item_name")["line_revenue"].sum().sort_values(ascending=False)
    pc_eur = clean[(clean["platform"] == "pc") & (clean["currency"] == "EUR")]
    average_basket = pc_eur.groupby("order_id")["line_revenue"].sum().mean()
    return {
        "march_rupees": march.loc[march["currency"] == "RUPEES", "line_revenue"].sum(),
        "top_item": top.index[0],
        "top_item_revenue": top.iloc[0],
        "pc_eur_average_basket": average_basket,
    }


def test_module1_structure_and_question_bank():
    manifest = read_json(MODULE / "manifest.json")
    exercises = read_json(MODULE / "exercises.json")["exercises"]
    quiz = read_json(MODULE / "quiz.json")
    page = (MODULE / "index.html").read_text(encoding="utf-8")

    assert manifest["id"] == "m1"
    assert len(manifest["lessons"]) == 7
    assert [exercise["id"] for exercise in exercises] == [
        "E1.1", "E1.2", "E1.3", "E1.4", "E1.5", "E1.6",
    ]
    assert len(quiz["questions"]) == 20
    assert {
        level: sum(question["difficulty"] == level for question in quiz["questions"])
        for level in (1, 2, 3)
    } == {1: 8, 2: 8, 3: 4}
    assert all(question.get("explanation") for question in quiz["questions"])
    assert all("answer" not in question and "correct" not in question for question in quiz["questions"])
    assert all(len(question["options"]) == 4 for question in quiz["questions"])
    assert all(len({option["id"] for option in question["options"]}) == 4 for question in quiz["questions"])
    assert all(f'id="L1.{number}"' in page for number in range(1, 8))
    assert "boutique_extrait.xlsx" in page
    assert "boutique_extrait_boss.csv" in page
    assert "m1/classeur.xlsx" in page


def test_module1_hashes_match_both_generated_extracts():
    answer_key = read_json(ANSWER_KEY)
    source, clean = clean_extract(DATA / "boutique_extrait.csv")
    assert len(source) == 10_000
    assert source.duplicated().sum() == 40
    assert len(source.columns) == 10
    assert_text_answer(answer_key, "E1.1.grain", "ligne de commande")
    assert_number_answer(answer_key, "E1.1.rows", len(source))
    assert_number_answer(answer_key, "E1.1.columns", len(source.columns))
    counts = {
        "duplicates": source.duplicated().sum(),
        "negative_prices": (source["unit_price"] < 0).sum(),
        "future_dates": (source["order_date"].dt.date > pd.Timestamp("2026-07-01").date()).sum(),
        "inconsistent_names": source["item_name"].str.contains(r"^\s|\s$", regex=True).sum(),
        "zero_quantities": (source["qty"] == 0).sum(),
    }
    assert counts == {
        "duplicates": 40,
        "negative_prices": 12,
        "future_dates": 25,
        "inconsistent_names": 300,
        "zero_quantities": 18,
    }
    for key, value in counts.items():
        assert_number_answer(answer_key, f"E1.2.{key}", value)
    facts = exercise_facts(clean)
    assert_number_answer(answer_key, "E1.3.revenue", facts["march_rupees"])
    assert_text_answer(answer_key, "E1.4.item", facts["top_item"])
    assert_number_answer(answer_key, "E1.4.revenue", facts["top_item_revenue"])
    assert_number_answer(answer_key, "E1.5.average_basket", facts["pc_eur_average_basket"])

    _, boss_clean = clean_extract(DATA / "boutique_extrait_boss.csv")
    boss_facts = exercise_facts(boss_clean)
    assert_number_answer(answer_key, "B1.1.revenue", boss_facts["march_rupees"])
    assert_text_answer(answer_key, "B1.2.item", boss_facts["top_item"])
    assert_number_answer(answer_key, "B1.2.revenue", boss_facts["top_item_revenue"])
    assert_number_answer(answer_key, "B1.3.average_basket", boss_facts["pc_eur_average_basket"])

    required_ids = {
        "E1.1.rows", "E1.1.columns", "E1.1.grain",
        "E1.2.duplicates", "E1.2.negative_prices", "E1.2.future_dates",
        "E1.2.inconsistent_names", "E1.2.zero_quantities",
        "E1.3.revenue", "E1.4.item", "E1.4.revenue", "E1.5.average_basket",
        "B1.1.revenue", "B1.2.item", "B1.2.revenue", "B1.3.average_basket",
        *(question["id"] for question in read_json(MODULE / "quiz.json")["questions"]),
    }
    assert required_ids <= answer_key["items"].keys()
