from html.parser import HTMLParser
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import unquote, urlsplit

import pytest

from build_site import DATA_FILES, MODULES, build_site


class LocalReferences(HTMLParser):
    def __init__(self):
        super().__init__()
        self.references = []

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name in {"href", "src"} and value:
                self.references.append(value)


def test_build_contains_only_the_allowlisted_learner_site():
    with TemporaryDirectory() as temporary:
        output = Path(temporary) / "public"
        file_count, size = build_site(output)
        files = {path.relative_to(output).as_posix() for path in output.rglob("*") if path.is_file()}

        assert file_count == len(files)
        assert size == sum(path.stat().st_size for path in output.rglob("*") if path.is_file())
        assert "index.html" in files
        assert "assets/js/runners/py-worker.js" in files
        assert "modules/m3-laboratoire/index.html" in files
        assert set(DATA_FILES) <= files
        assert all(any(path.startswith(f"modules/{module}/") for path in files) for module in MODULES)
        assert not any(
            name in path.split("/") or path.endswith((".pyc", ".pyo"))
            for path in files
            for name in ("grading", "grading-private", "scripts", "student-workspace", "__pycache__")
        )
        assert not any("answer_sources" in path.lower() or "ground_truth" in path.lower() for path in files)
        assert "data/hqo_full.sqlite" not in files
        assert size < 1_000_000_000


def test_all_local_html_links_in_publish_output_resolve():
    with TemporaryDirectory() as temporary:
        output = Path(temporary) / "public"
        build_site(output)
        for html_file in output.rglob("*.html"):
            parser = LocalReferences()
            parser.feed(html_file.read_text(encoding="utf-8"))
            for reference in parser.references:
                parsed = urlsplit(reference)
                if parsed.scheme or parsed.netloc or not parsed.path:
                    continue
                target = (html_file.parent / unquote(parsed.path)).resolve()
                assert target.is_relative_to(output.resolve()), reference
                assert target.is_file(), f"{html_file.relative_to(output)} -> {reference}"


def test_build_refuses_to_overwrite_an_existing_directory():
    with TemporaryDirectory() as temporary:
        output = Path(temporary) / "existing"
        output.mkdir()
        marker = output / "keep.txt"
        marker.write_text("keep", encoding="utf-8")
        with pytest.raises(FileExistsError, match="already exists"):
            build_site(output)
        assert marker.read_text(encoding="utf-8") == "keep"
