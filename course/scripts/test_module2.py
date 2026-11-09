import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "grading"))
import hashing as H


MODULE = ROOT / "modules" / "m2-archives"
ANSWER_KEY = ROOT / "data" / "expected" / "answers_hashed.json"
PRIVATE_ANSWERS = ROOT.parent / "grading-private" / "module2_answer_sources.json"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def run_reference(item):
    database = (ROOT / item["database"]).resolve()
    connection = sqlite3.connect(f"{database.as_uri()}?mode=ro", uri=True)
    try:
        connection.execute("PRAGMA query_only = ON")
        return connection.execute(item["query"]).fetchall()
    finally:
        connection.close()


def test_module2_structure_and_question_bank():
    manifest = read_json(MODULE / "manifest.json")
    schema = read_json(MODULE / "schema.json")
    exercises = read_json(MODULE / "exercises.json")
    quiz = read_json(MODULE / "quiz.json")
    boss = read_json(MODULE / "boss.json")
    page = (MODULE / "index.html").read_text(encoding="utf-8")

    assert manifest["id"] == "m2"
    assert manifest["status"] == "available"
    assert len(manifest["lessons"]) == 9
    assert len(exercises["exercises"]) == 30
    assert len(exercises["debugging"]) == 5
    assert all(
        exercise["type"] == "sql"
        for exercise in exercises["exercises"] + exercises["debugging"]
    )
    assert all("xp" in exercise for exercise in exercises["exercises"])
    assert all("xp" not in exercise for exercise in exercises["debugging"])
    assert [exercise["id"] for exercise in exercises["exercises"]] == [
        f"E2.{number}" for number in range(1, 31)
    ]
    assert [exercise["id"] for exercise in exercises["debugging"]] == [
        f"D2.{number}" for number in range(1, 6)
    ]
    assert all(len(exercise["hints"]) == 3 for exercise in exercises["exercises"] + exercises["debugging"])
    assert len(schema["tables"]) == 14
    assert len(schema["relationships"]) == 14
    assert len(quiz["questions"]) == 20
    assert {
        level: sum(question["difficulty"] == level for question in quiz["questions"])
        for level in (1, 2, 3)
    } == {1: 8, 2: 8, 3: 4}
    assert all(question.get("explanation") for question in quiz["questions"])
    assert all("answer" not in question and "correct" not in question for question in quiz["questions"])
    assert len(boss["questions"]) == 6
    assert boss["time_limit_seconds"] == 90 * 60
    assert boss["pass_score"] == 5
    assert all(f'id="L2.{number}"' in page for number in range(1, 10))
    assert all("solution" not in exercise for exercise in exercises["exercises"] + exercises["debugging"])
    assert "data/hqo_boss.sqlite" in manifest["data"][1]
    assert "EXPLAIN QUERY PLAN" in page


def test_module2_reference_queries_match_generated_answer_hashes():
    definitions = read_json(PRIVATE_ANSWERS)["items"]
    answer_key = read_json(ANSWER_KEY)
    module = read_json(MODULE / "exercises.json")
    quiz = read_json(MODULE / "quiz.json")
    boss = read_json(MODULE / "boss.json")
    required_ids = {
        *(exercise["id"] for exercise in module["exercises"]),
        *(exercise["id"] for exercise in module["debugging"]),
        *(question["id"] for question in quiz["questions"]),
        *(question["id"] for question in boss["questions"]),
    }
    assert required_ids <= definitions.keys()
    assert required_ids <= answer_key["items"].keys()

    for answer_id in required_ids:
        definition = definitions[answer_id]
        if definition["kind"] == "sql":
            result = run_reference(definition)
            actual_hash = H.hash_rows(
                answer_id,
                result,
                answer_key["salt"],
                definition.get("order_matters", False),
            )
            assert answer_key["items"][answer_id]["kind"] == "sql"
            assert actual_hash == answer_key["items"][answer_id]["hash"], answer_id
        else:
            assert H.hash_text(answer_id, definition["value"], answer_key["salt"]) == \
                answer_key["items"][answer_id]["hash"]


def test_m2_boss_database_is_a_distinct_course_dataset():
    primary = sqlite3.connect(
        f"{(ROOT / 'data' / 'hqo_lite.sqlite').as_uri()}?mode=ro", uri=True
    )
    alternate_path = ROOT / "data" / "hqo_boss.sqlite"
    alternate = sqlite3.connect(f"{alternate_path.as_uri()}?mode=ro", uri=True)
    try:
        primary_tables = {
            row[0] for row in primary.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        alternate_tables = {
            row[0] for row in alternate.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        assert len(primary_tables) == 14
        assert alternate_tables == primary_tables
        primary_segments = primary.execute(
            "SELECT country, platform, COUNT(*) FROM players GROUP BY country, platform ORDER BY country, platform"
        ).fetchall()
        alternate_segments = alternate.execute(
            "SELECT country, platform, COUNT(*) FROM players GROUP BY country, platform ORDER BY country, platform"
        ).fetchall()
        assert alternate_segments != primary_segments
        assert alternate.execute("SELECT COUNT(*) FROM players").fetchone()[0] == 2_000
        assert alternate.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] > 0
        assert alternate.execute("SELECT COUNT(*) FROM orders").fetchone()[0] > 0
        assert alternate_path.stat().st_size < 5_000_000
    finally:
        primary.close()
        alternate.close()
