#!/usr/bin/env python3
"""Correcteur des livrables : un module, un dépôt élève, un verdict.

    python grading/grade.py --module m2 --workspace . --academy ../hyrule-analytics-academy

Même script en local (avant de pousser) et dans GitHub Actions. Dépendances : bibliothèque standard,
plus openpyxl pour le module 1 (grading/requirements.txt). Les valeurs attendues sont des hachages
(data/expected/answers_hashed.json) : voir hashing.py pour le format.
"""
import argparse
import csv
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import hashing as H  # noqa: E402

EX_ID = re.compile(r"^([EDB]\d+\.\d+)")
HEADER = re.compile(r"^\s*--\s*([ED]\d+\.\d+)\b", re.I)


class Report:
    def __init__(self, module):
        self.module, self.checks, self.exercises = module, [], {}

    def gate(self, id, ok, msg=""):
        """Condition bloquante (fichier présent, notebook propre...)."""
        self.checks.append({"id": id, "ok": bool(ok), "gate": True, "msg": msg})
        return ok

    def ex(self, ex_id, ok, msg=""):
        self.exercises[ex_id] = {"ok": bool(ok), "msg": msg}


def load_answers(academy, private):
    path = Path(private) if private else Path(academy) / "data/expected/answers_hashed.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    return data["salt"], data["items"]


def items_for(items, module):
    n = module[1:]
    return {k: v for k, v in items.items() if (m := EX_ID.match(k)) and m.group(1)[1:].split(".")[0] == n}


# --------------------------------------------------------------------------- contrôles génériques
def check_files(rep, ws, cfg):
    for f in cfg.get("files", []):
        p = ws / f
        rep.gate(f"fichier:{f}", p.is_file() and p.stat().st_size > 0, "présent et non vide" if p.is_file() else "introuvable")
    for d in cfg.get("dirs", []):
        p = ws / d
        rep.gate(f"dossier:{d}", p.is_dir() and any(p.iterdir()), "ajoute au moins un fichier (Git ignore les dossiers vides)")
    if "readme_lines" in cfg:
        p = ws / cfg.get("readme", "README.md")
        n = len([x for x in p.read_text(encoding="utf-8").splitlines() if x.strip()]) if p.is_file() else 0
        rep.gate("readme", n >= cfg["readme_lines"], f"{n} lignes non vides (minimum {cfg['readme_lines']})")
    if "note_words" in cfg and (ws / "m5/note.md").is_file():
        n = len((ws / "m5/note.md").read_text(encoding="utf-8").split())
        rep.gate("note", n >= cfg["note_words"], f"{n} mots (minimum {cfg['note_words']})")


def check_notebook(rep, ws, path):
    p = ws / path
    if not rep.gate(f"notebook:{path}", p.is_file(), "introuvable"):
        return
    try:
        cells = json.loads(p.read_text(encoding="utf-8"))["cells"]
    except (ValueError, KeyError):
        rep.gate("notebook:format", False, "fichier .ipynb illisible")
        return
    code = [c for c in cells if c["cell_type"] == "code"]
    errors = [o for c in code for o in c.get("outputs", []) if o.get("output_type") == "error"]
    rep.gate("notebook:exécuté", any(c.get("outputs") for c in code), "aucune sortie : lance « Restart & Run All » avant de sauvegarder")
    rep.gate("notebook:sans erreur", not errors, f"{len(errors)} cellule(s) en erreur")
    rep.gate("notebook:commenté", sum(c["cell_type"] == "markdown" for c in cells) >= 2, "ajoute au moins 2 cellules de texte")


def check_workbook(rep, ws, cfg):
    p = ws / cfg["workbook"]
    if not rep.gate("classeur", p.is_file(), "introuvable"):
        return
    try:
        import openpyxl
        wb = openpyxl.load_workbook(p, data_only=True, read_only=True)
    except Exception as e:  # noqa: BLE001
        rep.gate("classeur:lecture", False, f"illisible ({type(e).__name__})")
        return
    rep.gate("classeur:onglets", wb.sheetnames[:len(cfg["sheets"])] == cfg["sheets"], f"onglets trouvés : {wb.sheetnames}")
    nums = sum(isinstance(c.value, (int, float)) for row in wb[cfg["sheets"][-1]].iter_rows() for c in row)
    rep.gate("classeur:synthèse", nums >= 5, f"{nums} valeurs numériques dans « {cfg['sheets'][-1]} » (5 indicateurs attendus ; enregistre depuis Excel pour mémoriser les calculs)")


def check_results(rep, ws, module, cfg, salt, items):
    path = ws / module / "results.json"
    results = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}
    rep.gate("results.json", path.is_file(), "crée " + f"{module}/results.json" if not path.is_file() else "présent")
    by_ex = {}
    for key, it in items_for(items, module).items():
        ex = EX_ID.match(key).group(1)
        by_ex.setdefault(ex, []).append((key, it))
    for ex, parts in by_ex.items():
        bad = []
        for key, it in parts:
            v = results.get(ex, {}).get(key[len(ex) + 1:])
            if v is None:
                bad.append(f"{key} absent"); continue
            if it["kind"] == "num":
                try:
                    ok = H.match_num(key, float(v), it.get("tol", 0), salt, it["hash"])
                except (TypeError, ValueError):
                    ok = False
            else:
                ok = H.hash_text(key, v, salt) == it["hash"]
            if not ok:
                bad.append(f"{key} incorrect")
        rep.ex(ex, not bad, "; ".join(bad))
    for rng_key, (lo, hi) in cfg.get("ranges", {}).items():
        ex = EX_ID.match(rng_key).group(1)
        v = results.get(ex, {}).get(rng_key[len(ex) + 1:])
        ok = isinstance(v, (int, float)) and lo <= v <= hi
        rep.ex(rng_key, ok, f"{rng_key} = {v} (attendu entre {lo} et {hi}" + ("; au-dessus : cherche une fuite de données)" if isinstance(v, (int, float)) and v > hi else ")"))


# --------------------------------------------------------------------------- module 2 : SQL
def split_queries(text):
    blocks, cur = {}, None
    for line in text.splitlines():
        m = HEADER.match(line)
        if m:
            cur = m.group(1).upper(); blocks[cur] = []
        elif cur:
            blocks[cur].append(line)
    return {k: "\n".join(v) for k, v in blocks.items()}


def run_select(db, query, timeout_s=10):
    body = re.sub(r"--[^\n]*", "", query).strip().rstrip(";").strip()
    if not re.match(r"(?is)^(select|with)\b", body):
        raise ValueError("seules les requêtes SELECT / WITH sont acceptées")
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    deadline = time.time() + timeout_s
    con.set_progress_handler(lambda: 1 if time.time() > deadline else 0, 10000)
    try:
        return con.execute(body).fetchall()
    finally:
        con.close()


def check_sql(rep, ws, academy, cfg, salt, items):
    p = ws / cfg["sql_file"]
    if not rep.gate("fichier:sql", p.is_file(), f"{cfg['sql_file']} introuvable"):
        return
    blocks = split_queries(p.read_text(encoding="utf-8"))
    commented = sum(any(l.strip().startswith("--") for l in b.splitlines()) for b in blocks.values())
    rep.gate("commentaires", commented >= cfg["comment_ratio"] * max(len(blocks), 1),
             f"{commented}/{len(blocks)} requêtes commentées (au moins {int(cfg['comment_ratio'] * 100)} %)")
    db = Path(academy) / cfg["database"]
    for key, it in items_for(items, "m2").items():
        if key not in blocks:
            rep.ex(key, False, "requête absente (ajoute « -- " + key + " » avant la requête)"); continue
        try:
            rows = run_select(db, blocks[key])
        except Exception as e:  # noqa: BLE001
            rep.ex(key, False, f"erreur SQL : {e}"); continue
        ok = H.hash_rows(key, rows, salt, it.get("order_matters", False)) == it["hash"]
        rep.ex(key, ok, "" if ok else f"{len(rows)} ligne(s) renvoyée(s) : résultat différent de l'attendu")


# --------------------------------------------------------------------------- module 6 : script de nettoyage
def check_pipeline(rep, ws, cfg, salt, items):
    try:
        r = subprocess.run(cfg["cmd"].split(), cwd=ws, capture_output=True, text=True, timeout=cfg["timeout_s"])
        rep.gate("script:exécution", r.returncode == 0, r.stderr.strip()[-300:] or "code de sortie 0")
    except subprocess.TimeoutExpired:
        rep.gate("script:exécution", False, f"plus de {cfg['timeout_s']} s"); return
    for key, it in items_for(items, "m6").items():
        f = ws / cfg["clean_dir"] / (key.split(".", 1)[1] + ".csv")
        if not f.is_file():
            rep.ex(key, False, f"{f.name} non produit"); continue
        with f.open(encoding="utf-8", newline="") as fh:
            rows = list(csv.reader(fh))[1:]
        rep.ex(key, H.hash_rows(key, rows, salt, False) == it["hash"], "")


# --------------------------------------------------------------------------- module 8 : classification
def check_predictions(rep, ws, academy, cfg, salt):
    p = ws / cfg["predictions"]
    if not rep.gate("predictions.csv", p.is_file(), "introuvable"):
        return
    gold = set(json.loads((Path(academy) / cfg["gold"]).read_text(encoding="utf-8")))
    with p.open(encoding="utf-8", newline="") as fh:
        rows = list(csv.DictReader(fh))
    rep.gate("predictions:lignes", len(rows) == cfg["rows"], f"{len(rows)} lignes (attendu {cfg['rows']})")
    good = sum(H.sha256(f"{r['review_id']}|{r['sentiment'].strip().lower()}|{salt}") in gold for r in rows)
    acc = good / max(len(rows), 1)
    rep.ex("E8.3.accuracy", acc >= cfg["accuracy_min"], f"exactitude {acc:.3f} (seuil {cfg['accuracy_min']})")


# --------------------------------------------------------------------------- orchestration
def grade(module, ws, academy, private=None):
    cfg = json.loads((Path(academy) / "grading/thresholds.json").read_text(encoding="utf-8"))[module]
    salt, items = load_answers(academy, private)
    rep = Report(module)
    check_files(rep, ws, cfg)
    if "notebook" in cfg: check_notebook(rep, ws, cfg["notebook"])
    if "workbook" in cfg: check_workbook(rep, ws, cfg)
    if "sql_file" in cfg: check_sql(rep, ws, academy, cfg, salt, items)
    elif cfg.get("cmd"): check_pipeline(rep, ws, cfg, salt, items)
    elif "predictions" in cfg: check_predictions(rep, ws, academy, cfg, salt)
    elif not cfg.get("structure_only"): check_results(rep, ws, module, cfg, salt, items)

    done = {k: v for k, v in rep.exercises.items() if k.startswith("E") or k.startswith("B")}
    passed = sum(v["ok"] for v in done.values())
    ratio = passed / len(done) if done else 1.0
    gates_ok = all(c["ok"] for c in rep.checks if c.get("gate"))
    musts_ok = all(rep.exercises.get(m, {}).get("ok") for m in cfg.get("must", []))
    enough = passed >= cfg["min_exercises"] if "min_exercises" in cfg else ratio >= cfg.get("min_ratio", 0.8)
    ok = gates_ok and musts_ok and enough
    commit = os.environ.get("GITHUB_SHA", "local")[:12]
    return {"module": module, "passed": ok, "exercises_passed": passed, "exercises_total": len(done),
            "ratio": round(ratio, 3), "threshold": cfg.get("min_ratio"), "must": cfg.get("must", []),
            "checks": rep.checks, "exercises": rep.exercises, "commit": commit,
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "token": H.sha256(f"{module}|{passed}/{len(done)}|{commit}|{salt}")[:16],
            "human_review": cfg.get("human_review", "mémos et présentations corrigés par le formateur")}


def markdown(r):
    out = [f"## {'✅' if r['passed'] else '❌'} Module {r['module']} : {r['exercises_passed']}/{r['exercises_total']} exercices ({r['ratio']:.0%})", ""]
    out += [f"- {'✔' if c['ok'] else '✘'} **{c['id']}** {c['msg']}" for c in r["checks"]]
    out += [f"- {'✔' if v['ok'] else '✘'} `{k}` {v['msg']}" for k, v in r["exercises"].items()]
    out += ["", f"Jeton : `{r['token']}` (commit {r['commit']}). À relire par un humain : {r['human_review']}."]
    return "\n".join(out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--module", required=True, help="m0 à m9")
    ap.add_argument("--workspace", default=".")
    ap.add_argument("--academy", default=".academy")
    ap.add_argument("--private-answers", help="fichier de réponses non publié (correction à enjeu élevé)")
    ap.add_argument("--report", default="grading-report.json")
    a = ap.parse_args()
    rep = grade(a.module, Path(a.workspace), a.academy, a.private_answers)
    Path(a.report).write_text(json.dumps(rep, ensure_ascii=False, indent=2), encoding="utf-8")
    md = markdown(rep)
    print(md)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as fh:
            fh.write(md + "\n")
    sys.exit(0 if rep["passed"] else 1)
