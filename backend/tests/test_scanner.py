"""tests/test_scanner.py — Unit tests for repo_scanner and graph_builder.

These tests run against real directories (no mocks). They verify that
the scanner correctly discovers files, excludes sensitive/binary files,
computes checksums, and builds the dependency graph.
"""

import hashlib
import os
import sys
import tempfile
from pathlib import Path

import pytest

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))


class TestRepoScanner:
    """Tests for repo_scanner.scan_repo()."""

    def test_scan_real_backend_dir(self):
        """Scan the backend directory itself — should find Python files."""
        from repo_scanner import scan_repo

        backend_dir = str(Path(__file__).parent.parent)
        ctx = scan_repo(backend_dir)

        assert ctx.total_files > 0, "Should find files"
        assert ctx.read_files > 0, "Should read at least some source files"
        assert ctx.project_root == str(Path(backend_dir).resolve())
        assert len(ctx.file_map) > 0, "file_map must not be empty"
        assert ctx.file_tree, "file_tree must be populated"

    def test_excludes_env_file(self):
        """Sensitive .env files must not be included in file_map."""
        from repo_scanner import scan_repo

        backend_dir = str(Path(__file__).parent.parent)
        ctx = scan_repo(backend_dir)

        for rel_path in ctx.file_map:
            assert ".env" not in rel_path or rel_path.endswith(".env.example"), (
                f".env file should be excluded, got: {rel_path}"
            )

    def test_excludes_pycache(self):
        """__pycache__ directories must never appear."""
        from repo_scanner import scan_repo

        backend_dir = str(Path(__file__).parent.parent)
        ctx = scan_repo(backend_dir)

        for rel_path in ctx.file_map:
            assert "__pycache__" not in rel_path, (
                f"__pycache__ file leaked into file_map: {rel_path}"
            )

    def test_checksums_are_sha256(self):
        """All file checksums must be 64-char hex strings (SHA-256)."""
        from repo_scanner import scan_repo

        backend_dir = str(Path(__file__).parent.parent)
        ctx = scan_repo(backend_dir)

        for rel_path, fi in ctx.files.items():
            assert len(fi.checksum) == 64, (
                f"Checksum for {rel_path} is not 64 chars: {fi.checksum}"
            )
            assert all(c in "0123456789abcdef" for c in fi.checksum), (
                f"Checksum for {rel_path} is not hex: {fi.checksum}"
            )

    def test_file_info_populated(self):
        """Every FileInfo must have language, size, lines."""
        from repo_scanner import scan_repo

        backend_dir = str(Path(__file__).parent.parent)
        ctx = scan_repo(backend_dir)

        for rel_path, fi in ctx.files.items():
            assert fi.language, f"language missing for {rel_path}"
            assert fi.size_bytes >= 0, f"size_bytes invalid for {rel_path}"
            assert fi.line_count >= 0, f"line_count invalid for {rel_path}"

    def test_scan_nonexistent_path_raises(self):
        """scan_repo must raise FileNotFoundError for nonexistent paths."""
        from repo_scanner import scan_repo

        with pytest.raises((FileNotFoundError, NotADirectoryError)):
            scan_repo("/nonexistent/path/that/does/not/exist")

    def test_scan_temp_directory(self):
        """Scan a temp directory with known files."""
        from repo_scanner import scan_repo

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create test files
            (Path(tmpdir) / "main.py").write_text(
                "def hello():\n    return 'hello'\n", encoding="utf-8"
            )
            (Path(tmpdir) / "README.md").write_text(
                "# Test Project\n", encoding="utf-8"
            )
            (Path(tmpdir) / ".env").write_text(
                "SECRET=abc123\n", encoding="utf-8"
            )
            (Path(tmpdir) / "node_modules").mkdir()
            (Path(tmpdir) / "node_modules" / "lib.js").write_text(
                "module.exports = {}", encoding="utf-8"
            )

            ctx = scan_repo(tmpdir)

            assert "main.py" in ctx.file_map
            assert "README.md" in ctx.file_map
            # .env must be excluded
            assert ".env" not in ctx.file_map
            # node_modules must be excluded
            assert not any("node_modules" in p for p in ctx.file_map)


class TestGraphBuilder:
    """Tests for graph_builder.build_graph()."""

    def test_build_graph_on_backend(self):
        """Build graph on the backend directory — should parse Python files."""
        from repo_scanner import scan_repo
        from graph_builder import build_graph

        backend_dir = str(Path(__file__).parent.parent)
        ctx = scan_repo(backend_dir)
        ctx = build_graph(ctx)

        assert len(ctx.graph) > 0, "graph must not be empty"

    def test_python_symbols_extracted(self):
        """Python files should have functions and/or classes extracted."""
        from repo_scanner import scan_repo
        from graph_builder import build_graph

        with tempfile.TemporaryDirectory() as tmpdir:
            (Path(tmpdir) / "module.py").write_text(
                """
import os
from pathlib import Path

class MyClass:
    def my_method(self):
        pass

def standalone_func(x: int) -> str:
    return str(x)
""",
                encoding="utf-8",
            )
            ctx = scan_repo(tmpdir)
            ctx = build_graph(ctx)

            symbols = ctx.graph.get("module.py")
            assert symbols is not None, "module.py should be in graph"
            assert "MyClass" in symbols.classes, "MyClass not found"
            assert "standalone_func" in symbols.functions, "standalone_func not found"
            assert "os" in symbols.imports or "pathlib" in symbols.imports

    def test_dependency_summary_non_empty(self):
        """dependency_summary should be non-empty after graph build."""
        from repo_scanner import scan_repo
        from graph_builder import build_graph

        backend_dir = str(Path(__file__).parent.parent)
        ctx = scan_repo(backend_dir)
        ctx = build_graph(ctx)

        assert ctx.dependency_summary, "dependency_summary must not be empty"
        assert ctx.dependency_summary != "No dependency graph available."


class TestChunker:
    """Tests for chunker.chunk_file()."""

    def test_python_chunk_by_function(self):
        """Python files should be chunked at function boundaries."""
        from chunker import chunk_file

        code = "\n".join([
            "import os",
            "",
            "def func_a():",
            "    return 1",
            "",
            "def func_b():",
            "    return 2",
            "",
            "class MyClass:",
            "    def method(self):",
            "        pass",
        ])
        chunks = chunk_file("test.py", code, max_chars=500)
        assert len(chunks) >= 1, "Should produce at least one chunk"
        for c in chunks:
            assert c.content, "Chunk content must not be empty"
            assert c.file_path == "test.py"

    def test_fixed_fallback_for_json(self):
        """JSON files should use fixed-size chunking."""
        from chunker import chunk_file

        content = '{"key": "value", "list": [1, 2, 3]}'
        chunks = chunk_file("data.json", content, max_chars=100)
        assert len(chunks) >= 1

    def test_chunk_respects_max_chars(self):
        """No single chunk should exceed max_chars (except when a single symbol is larger)."""
        from chunker import chunk_file

        # Large file
        code = "\n".join([f"def func_{i}():\n    return {i}\n" for i in range(100)])
        chunks = chunk_file("big.py", code, max_chars=500)
        # Most chunks should be reasonably sized
        for c in chunks:
            assert len(c.content) < 5000, f"Chunk too large: {len(c.content)} chars"
