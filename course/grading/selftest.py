"""Auto-test : la « solution de référence » doit passer, une copie dégradée doit échouer.
Usage : python grading/selftest.py   (fabrique un mini-cours et un dépôt élève dans un dossier temporaire)"""
import json, sqlite3, tempfile
from pathlib import Path
import hashing as H
import grade

SALT = "sel_test"
tmp = Path(tempfile.mkdtemp())
academy, ws = tmp / "academy", tmp / "ws"
for d in ("data/expected", "grading", "m2", "m0/x"):
    (academy / d if d != "m2" and d != "m0/x" else ws / d).mkdir(parents=True, exist_ok=True)
(academy / "grading/thresholds.json").write_text((Path(__file__).parent / "thresholds.json").read_text(encoding="utf-8"), encoding="utf-8")

db = academy / "data/hqo_lite.sqlite"
con = sqlite3.connect(db)
con.execute("create table players(player_id text, platform text, is_premium int)")
con.executemany("insert into players values(?,?,?)", [("P1", "ios", 0), ("P2", "pc", 1), ("P3", "pc", 0)])
con.commit(); con.close()

refs = {f"E2.{i}": "SELECT platform, COUNT(*) FROM players GROUP BY platform" for i in range(1, 31)}
items = {k: {"kind": "sql", "hash": H.hash_rows(k, [("ios", 1), ("pc", 2)], SALT)} for k in refs}
items["E0.1.category"] = {"kind": "text", "hash": H.hash_text("E0.1.category", "monsters", SALT)}
items["E0.1.drops"] = {"kind": "num", "hash": H.hash_num("E0.1.drops", 3, 0, SALT), "tol": 0}
items["E3.4.diff"] = {"kind": "num", "hash": H.hash_num("E3.4.diff", 0.04, 0.002, SALT), "tol": 0.002}
(academy / "data/expected/answers_hashed.json").write_text(json.dumps({"salt": SALT, "items": items}), encoding="utf-8")

def write_sql(n_ok):
    out = []
    for i, (k, q) in enumerate(refs.items()):
        out += [f"-- {k}", "-- explication" if i % 2 == 0 or True else "", q if i < n_ok else "SELECT 1;"]
    (ws / "m2/queries.sql").write_text("\n".join(out), encoding="utf-8")

write_sql(30); assert grade.grade("m2", ws, academy)["passed"], "30/30 doit passer"
write_sql(24); assert grade.grade("m2", ws, academy)["passed"], "24/30 doit passer (seuil)"
write_sql(23); assert not grade.grade("m2", ws, academy)["passed"], "23/30 doit échouer"

(ws / "README.md").write_text("\n".join(f"ligne {i}" for i in range(12)), encoding="utf-8")
for d in ("data", "notebooks", "src"):
    (ws / d).mkdir(exist_ok=True); (ws / d / ".gitkeep").write_text("x")
(ws / "m0").mkdir(exist_ok=True)
(ws / "m0/results.json").write_text(json.dumps({"E0.1": {"category": " Monsters ", "drops": 3}}), encoding="utf-8")
assert grade.grade("m0", ws, academy)["passed"], "m0 doit passer"
(ws / "m0/results.json").write_text(json.dumps({"E0.1": {"category": "food", "drops": 3}}), encoding="utf-8")
assert not grade.grade("m0", ws, academy)["passed"], "m0 mauvaise catégorie doit échouer"

# tolérance numérique : 0.041 passe, 0.06 échoue
for val, ok in ((0.041, True), (0.0385, True), (0.06, False)):
    assert H.match_num("E3.4.diff", val, 0.002, SALT, items["E3.4.diff"]["hash"]) is ok, val
print("selftest OK")
