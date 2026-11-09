#!/usr/bin/env python3
"""Fetch a structured-only snapshot of the public Hyrule Compendium API."""

import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


API_URL = "https://api.hyrule-compendium.com/v3/compendium/all"
USER_AGENT = "Hyrule-Analytics-Academy/1.0 (educational dataset snapshot)"
ALLOWED_FIELDS = (
    "id",
    "name",
    "category",
    "common_locations",
    "drops",
    "properties",
    "hearts_recovered",
    "cooking_effect",
    "edible",
    "dlc",
    "fuse_attack_power",
)


def fetch_entries(timeout: int = 20, retries: int = 3) -> list[dict]:
    last_error = None
    for attempt in range(retries):
        if attempt:
            time.sleep(max(1, 2 ** (attempt - 1)))
        request = Request(API_URL, headers={"User-Agent": USER_AGENT})
        try:
            with urlopen(request, timeout=timeout) as response:
                if response.status != 200:
                    raise RuntimeError(f"Compendium returned HTTP {response.status}")
                payload = json.loads(response.read().decode("utf-8"))
            entries = payload.get("data")
            if not isinstance(entries, list):
                raise ValueError("Compendium response must contain a 'data' list")
            if any(not isinstance(entry, dict) for entry in entries):
                raise ValueError("Compendium response contains a non-object entry")
            return entries
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, ValueError, RuntimeError) as exc:
            last_error = exc
    raise RuntimeError(f"Could not fetch a valid Compendium snapshot after {retries} attempts") from last_error


def build_snapshot(entries: list[dict]) -> dict:
    structured = [
        {key: entry[key] for key in ALLOWED_FIELDS if key in entry}
        for entry in entries
    ]
    return {
        "source": API_URL,
        "collected_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "count": len(structured),
        "entries": structured,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "compendium" / "compendium_snapshot.json",
    )
    args = parser.parse_args()

    snapshot = build_snapshot(fetch_entries())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {snapshot['count']} structured entries to {args.output}")


if __name__ == "__main__":
    main()
