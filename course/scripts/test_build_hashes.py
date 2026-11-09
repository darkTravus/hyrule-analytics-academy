#!/usr/bin/env python3
"""Focused tests for build_hashes.py; run with python scripts/test_build_hashes.py."""

from __future__ import annotations

import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from build_hashes import DefinitionError, build_hashes


class BuildHashesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / "course with spaces"
        self.root.mkdir()
        self.database = self.root / "sample.sqlite"
        connection = sqlite3.connect(self.database)
        try:
            connection.execute("CREATE TABLE sample (label TEXT, value REAL)")
            connection.executemany(
                "INSERT INTO sample VALUES (?, ?)",
                [("alpha", 1.234), ("beta", 2.0)],
            )
            connection.commit()
        finally:
            connection.close()
        self.source = self.root / "sources.json"
        self.output = self.root / "answers_hashed.json"

    def tearDown(self) -> None:
        self.temp.cleanup()

    def _write_source(self, items: dict) -> None:
        self.source.write_text(json.dumps({"items": items}), encoding="utf-8")

    def test_builds_text_numeric_and_sql_hashes(self) -> None:
        self._write_source({
            "E0.1.category": {"kind": "text", "value": " Monsters "},
            "E1.2.count": {"kind": "num", "value": 2, "tol": 0},
            "Q0.1": {"kind": "text", "value": "option-a"},
            "E2.1": {
                "kind": "sql",
                "database": "sample.sqlite",
                "query": "SELECT label, value FROM sample",
                "order_matters": False,
            },
        })

        result = build_hashes(self.source, self.output, self.root, "test-salt")
        saved = json.loads(self.output.read_text(encoding="utf-8"))

        self.assertEqual(saved, result)
        self.assertEqual(saved["salt"], "test-salt")
        self.assertEqual(set(saved["items"]), {"E0.1.category", "E1.2.count", "Q0.1", "E2.1"})
        self.assertEqual(saved["items"]["E2.1"]["kind"], "sql")
        self.assertEqual(saved["items"]["E1.2.count"]["kind"], "num")
        self.assertEqual(saved["items"]["Q0.1"]["kind"], "text")

    def test_reuses_existing_salt(self) -> None:
        self._write_source({"E0.1.category": {"kind": "text", "value": "monsters"}})
        self.output.write_text(
            json.dumps({"salt": "preserved", "items": {}}),
            encoding="utf-8",
        )

        result = build_hashes(self.source, self.output, self.root)

        self.assertEqual(result["salt"], "preserved")

    def test_rejects_non_read_only_sql(self) -> None:
        self._write_source({
            "E2.1": {
                "kind": "sql",
                "database": "sample.sqlite",
                "query": "DELETE FROM sample",
            },
        })

        with self.assertRaises(DefinitionError):
            build_hashes(self.source, self.output, self.root, "test-salt")

    def test_rejects_database_outside_course_root(self) -> None:
        outside = self.root.parent / "outside.sqlite"
        connection = sqlite3.connect(outside)
        connection.close()
        self._write_source({
            "E2.1": {
                "kind": "sql",
                "database": "../outside.sqlite",
                "query": "SELECT 1",
            },
        })

        try:
            with self.assertRaises(DefinitionError):
                build_hashes(self.source, self.output, self.root, "test-salt")
        finally:
            outside.unlink(missing_ok=True)

    def test_rejects_empty_source(self) -> None:
        self._write_source({})

        with self.assertRaises(DefinitionError):
            build_hashes(self.source, self.output, self.root, "test-salt")


if __name__ == "__main__":
    unittest.main()
