import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "grading"))
import hashing as H


MODULE = ROOT / "modules" / "m0-eveil"
SNAPSHOT = ROOT / "data" / "compendium" / "compendium_snapshot.json"
ANSWER_KEY = ROOT / "data" / "expected" / "answers_hashed.json"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_module0_content_and_question_bank():
    manifest = read_json(MODULE / "manifest.json")
    quiz = read_json(MODULE / "quiz.json")
    exercises = read_json(MODULE / "exercises.json")
    page = (MODULE / "index.html").read_text(encoding="utf-8")

    assert manifest["id"] == "m0"
    assert len(manifest["lessons"]) == 7
    assert [exercise["id"] for exercise in exercises["exercises"]] == ["E0.1", "E0.2", "E0.3"]
    assert all(not exercise.get("starter_code") for exercise in exercises["exercises"])
    assert page.count("<summary>Solution commentée</summary>") == 3
    assert 'await get_json(url)' in page
    assert 'result = sum(counts.values())' in page
    assert 'result = json.dumps(top_five, ensure_ascii=False)' in page
    assert len(quiz["questions"]) == 20
    assert {level: sum(question["difficulty"] == level for question in quiz["questions"])
            for level in (1, 2, 3)} == {1: 8, 2: 8, 3: 4}
    assert all(question.get("explanation") for question in quiz["questions"])
    assert all("answer" not in question and "correct" not in question for question in quiz["questions"])
    assert all(lesson in page for lesson in [f'id="L0.{number}"' for number in range(1, 8)])
    dungeon = read_json(MODULE / "dungeon.json")
    assert dungeon == {"question_count": 10, "time_limit_seconds": 900, "pass_percent": 80}
    lore = read_json(ROOT / "assets" / "data" / "lore.json")
    assert lore["bosses"]["m0"] == "Bokoblin"


def test_module0_exercise_hashes_match_the_snapshot():
    snapshot = read_json(SNAPSHOT)
    answers = read_json(ANSWER_KEY)
    salt = answers["salt"]
    entries = snapshot["entries"]
    lynel = next(entry for entry in entries if entry["name"] == "white-maned lynel")
    expected_e01 = f'{lynel["category"]}|{len(lynel.get("drops") or [])}'
    assert H.hash_text("E0.1", expected_e01, salt) == answers["items"]["E0.1"]["hash"]

    assert H.match_num(
        "E0.2",
        len(entries),
        answers["items"]["E0.2"]["tol"],
        salt,
        answers["items"]["E0.2"]["hash"],
    )

    monsters = [entry for entry in entries if entry["category"] == "monsters"]
    monsters.sort(key=lambda entry: (-len(entry.get("common_locations") or []), entry["name"]))
    expected_e03 = json.dumps([entry["name"] for entry in monsters[:5]], ensure_ascii=False)
    assert H.hash_text("E0.3", expected_e03, salt) == answers["items"]["E0.3"]["hash"]


def test_module0_answer_key_has_all_client_question_ids():
    quiz = read_json(MODULE / "quiz.json")
    exercises = read_json(MODULE / "exercises.json")
    answer_ids = {exercise["id"] for exercise in exercises["exercises"]}
    answer_ids.update(question["id"] for question in quiz["questions"])
    answers = read_json(ANSWER_KEY)
    assert answer_ids <= answers["items"].keys()
