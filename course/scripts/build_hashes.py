#!/usr/bin/env python3
"""Build grading hashes from reviewed answer definitions.

The source JSON has this shape:
{
  "items": {
    "E1.2.anomaly_count": {"kind": "num", "value": 5, "tol": 0},
    "E1.3.revenue": {"kind": "num", "value": 123.45, "tol": 0.01},
    "E0.1.category": {"kind": "text", "value": "monsters"},
    "E2.1": {
      "kind": "sql",
      "database": "data/hqo_lite.sqlite",
      "query": "SELECT platform, COUNT(*) FROM players GROUP BY platform",
      "order_matters": false
    }
  }
}

Text and numeric values must come from a reviewed exercise solution or a
calculation over the generated data. SQL definitions are executed read-only.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import secrets
import sqlite3
import sys
import tempfile
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "grading"))
import hashing as H  # noqa: E402


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "data" / "expected" / "answer_sources.json"
DEFAULT_OUTPUT = ROOT / "data" / "expected" / "answers_hashed.json"
ITEM_ID = re.compile(r"^[EDBQ]\d+\.\d+(?:\.[A-Za-z0-9_]+)?$")
READ_QUERY = re.compile(r"(?is)^\s*(SELECT|WITH)\b")


class DefinitionError(ValueError):
    """A source definition is incomplete or invalid."""


def _validate_finite_number(value: Any, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise DefinitionError(f"{label} must be a number")
    number = float(value)
    if not math.isfinite(number):
        raise DefinitionError(f"{label} must be finite")
    return number


def _run_read_query(database: Path, query: str) -> list[tuple[Any, ...]]:
    if not isinstance(query, str) or not READ_QUERY.match(query):
        raise DefinitionError("SQL definitions must start with SELECT or WITH")
    if not database.is_file():
        raise DefinitionError(f"database does not exist: {database}")

    database_uri = database.resolve().as_uri()
    connection = sqlite3.connect(f"{database_uri}?mode=ro", uri=True)
    connection.execute("PRAGMA query_only = ON")
    try:
        return connection.execute(query).fetchall()
    finally:
        connection.close()


def _build_item(key: str, definition: Any, salt: str, root: Path) -> dict[str, Any]:
    if not ITEM_ID.fullmatch(key):
        raise DefinitionError(f"invalid exercise answer id: {key!r}")
    if not isinstance(definition, dict):
        raise DefinitionError(f"{key}: definition must be an object")

    kind = definition.get("kind")
    if kind == "text":
        value = definition.get("value")
        if not isinstance(value, str):
            raise DefinitionError(f"{key}: text value must be a string")
        return {"kind": "text", "hash": H.hash_text(key, value, salt)}

    if kind == "num":
        value = _validate_finite_number(definition.get("value"), f"{key}.value")
        tolerance = _validate_finite_number(definition.get("tol", 0), f"{key}.tol")
        if tolerance < 0:
            raise DefinitionError(f"{key}.tol must not be negative")
        return {
            "kind": "num",
            "tol": tolerance,
            "hash": H.hash_num(key, value, tolerance, salt),
        }

    if kind == "sql":
        database_value = definition.get("database")
        query = definition.get("query")
        order_matters = definition.get("order_matters", False)
        if not isinstance(database_value, str) or not database_value:
            raise DefinitionError(f"{key}: database must be a non-empty path")
        if not isinstance(query, str) or not query.strip():
            raise DefinitionError(f"{key}: query must be a non-empty string")
        if not isinstance(order_matters, bool):
            raise DefinitionError(f"{key}.order_matters must be a boolean")
        database = (root / database_value).resolve()
        try:
            database.relative_to(root.resolve())
        except ValueError as exc:
            raise DefinitionError(f"{key}: database must be inside {root}") from exc
        rows = _run_read_query(database, query)
        return {
            "kind": "sql",
            "order_matters": order_matters,
            "hash": H.hash_rows(key, rows, salt, order_matters),
        }

    raise DefinitionError(f"{key}: unsupported kind {kind!r}; use text, num, or sql")


def build_hashes(
    source: Path,
    output: Path,
    root: Path,
    salt: str | None = None,
) -> dict[str, Any]:
    source_data = json.loads(source.read_text(encoding="utf-8"))
    if not isinstance(source_data, dict) or not isinstance(source_data.get("items"), dict):
        raise DefinitionError("source must contain an 'items' object")
    definitions = source_data["items"]
    if not definitions:
        raise DefinitionError("source contains no answer definitions")

    if salt is None and output.is_file():
        existing = json.loads(output.read_text(encoding="utf-8"))
        salt = existing.get("salt") if isinstance(existing, dict) else None
    salt = salt or secrets.token_hex(16)
    if not isinstance(salt, str) or not salt:
        raise DefinitionError("salt must be a non-empty string")

    items = {
        key: _build_item(key, definition, salt, root)
        for key, definition in sorted(definitions.items())
    }
    result = {"salt": salt, "items": items}
    _write_json_atomically(output, result)
    return result


def _write_json_atomically(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_name: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            newline="\n",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temp_file:
            temp_name = temp_file.name
            json.dump(data, temp_file, ensure_ascii=False, indent=2, sort_keys=True)
            temp_file.write("\n")
        os.replace(temp_name, path)
    except OSError:
        if temp_name is not None:
            try:
                os.unlink(temp_name)
            except FileNotFoundError:
                pass
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--salt", help="explicit project salt; otherwise reuse or create one")
    args = parser.parse_args()

    try:
        result = build_hashes(args.source, args.output, args.root, args.salt)
    except (OSError, json.JSONDecodeError, DefinitionError, sqlite3.Error) as exc:
        print(f"build_hashes: {exc}", file=sys.stderr)
        return 1

    print(f"Wrote {len(result['items'])} answer hashes to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
