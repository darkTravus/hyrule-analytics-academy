#!/usr/bin/env python3
"""Build a minimal, static GitHub Pages artifact from the learner-facing course."""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
COURSE = ROOT / "course"
MODULES = ("m0-eveil", "m1-inventaire", "m2-archives", "m3-laboratoire")
DATA_FILES = (
    "data/expected/answers_hashed.json",
    "data/compendium/compendium_snapshot.json",
    "data/hqo_lite.sqlite",
    "data/hqo_boss.sqlite",
    "data/excel/boutique_extrait.csv",
    "data/excel/boutique_extrait.xlsx",
    "data/excel/boutique_extrait_boss.csv",
    "data/csv/players.csv",
    "data/csv/experiment_assignments.csv",
    "data/csv/sessions.csv",
    "data/csv/orders.csv",
    "data/csv/order_lines.csv",
    "data/csv/shop_items.csv",
    "data/csv/exp_boss.csv",
)
EXCLUDED_NAMES = {
    "__pycache__",
    ".pytest_cache",
    "grading",
    "grading-private",
    "scripts",
    "student-workspace",
}
EXCLUDED_FILES = {
    "answer_sources.json",
    "GROUND_TRUTH.md",
    "README-ENSEIGNANT.md",
}


def _copy_file(relative_path: str, destination: Path) -> int:
    source = COURSE / relative_path
    if not source.is_file():
        raise FileNotFoundError(f"Required publish file is missing: {source}")
    target = destination / relative_path
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    return 1


def _copy_tree(relative_path: str, destination: Path) -> int:
    source_root = COURSE / relative_path
    if not source_root.is_dir():
        raise FileNotFoundError(f"Required publish directory is missing: {source_root}")
    copied = 0
    for source in sorted(source_root.rglob("*")):
        relative = source.relative_to(COURSE)
        if any(part in EXCLUDED_NAMES for part in relative.parts):
            continue
        if source.name in EXCLUDED_FILES or source.suffix == ".pyc":
            continue
        if not source.is_file():
            continue
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        copied += 1
    return copied


def build_site(destination: Path) -> tuple[int, int]:
    """Build the allow-listed learner site into a new, empty destination."""
    destination = destination.resolve()
    if destination.exists():
        raise FileExistsError(f"Output already exists; choose an empty path: {destination}")

    destination.mkdir(parents=True)
    try:
        count = _copy_file("index.html", destination)
        count += _copy_tree("assets", destination)
        for module in MODULES:
            count += _copy_tree(f"modules/{module}", destination)
        for relative_path in DATA_FILES:
            count += _copy_file(relative_path, destination)

        published_files = [path for path in destination.rglob("*") if path.is_file()]
        forbidden = [
            path for path in published_files
            if any(part in EXCLUDED_NAMES for part in path.relative_to(destination).parts)
            or path.name in EXCLUDED_FILES
            or path.suffix == ".pyc"
        ]
        if forbidden:
            raise RuntimeError(f"Forbidden file reached the publish output: {forbidden[0]}")
        return count, sum(path.stat().st_size for path in published_files)
    except Exception:
        shutil.rmtree(destination)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "dist",
        help="new, empty output directory (default: repository dist/)",
    )
    args = parser.parse_args()
    try:
        count, size = build_site(args.output)
    except (OSError, RuntimeError) as error:
        print(f"build_site: {error}", file=sys.stderr)
        return 1
    print(f"Built {count} files ({size:,} bytes) in {args.output.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
