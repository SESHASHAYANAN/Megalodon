"""repo_context.py — RepoContext dataclass and FileInfo namedtuple.

Holds the complete state of a scanned repository, used by all agents and
the 3-stage pipeline. Built by repo_scanner.py.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional


@dataclass
class FileInfo:
    """Metadata + content for a single source file."""

    rel_path: str          # Relative path from project_root
    abs_path: str          # Absolute filesystem path
    language: str          # Detected language (python, javascript, etc.)
    extension: str         # File extension without leading dot
    size_bytes: int        # File size in bytes
    line_count: int        # Number of lines
    checksum: str          # SHA-256 hex digest of file content
    content: str           # Full file content (may be truncated for huge files)
    is_truncated: bool     # True if content was truncated at read time

    @property
    def short_path(self) -> str:
        """Return the last 3 path components for display."""
        parts = Path(self.rel_path).parts
        return "/".join(parts[-3:]) if len(parts) > 3 else self.rel_path


@dataclass
class DependencyEdge:
    """A directed edge in the dependency graph."""

    source_file: str       # rel_path of the importing file
    target_module: str     # The imported module/file name
    import_line: int       # Line number of the import statement
    is_local: bool         # True if it's a project-internal import


@dataclass
class FileSymbols:
    """Extracted symbols from a file (functions, classes, imports)."""

    rel_path: str
    language: str
    functions: List[str] = field(default_factory=list)    # function names
    classes: List[str] = field(default_factory=list)      # class names
    imports: List[str] = field(default_factory=list)      # imported modules
    exports: List[str] = field(default_factory=list)      # exported symbols
    local_deps: List[str] = field(default_factory=list)   # project-internal deps


@dataclass
class RepoContext:
    """Complete context snapshot of a repository, consumed by all agents."""

    # ── Core fields (populated by repo_scanner) ───────────────────────────────
    project_root: str
    file_map: Dict[str, str] = field(default_factory=dict)
    # file_map: {rel_path → file_content} — the primary data store for agents

    files: Dict[str, FileInfo] = field(default_factory=dict)
    # files: {rel_path → FileInfo} — detailed metadata

    # ── Graph / Dependency data (populated by graph_builder) ─────────────────
    graph: Dict[str, FileSymbols] = field(default_factory=dict)
    # graph: {rel_path → FileSymbols}

    edges: List[DependencyEdge] = field(default_factory=list)
    # edges: all cross-file dependency edges

    # ── Derived / display fields ──────────────────────────────────────────────
    file_tree: str = ""               # Text tree for display in prompts
    dependency_summary: str = ""      # Human-readable dependency summary for LLM

    # ── Stats ─────────────────────────────────────────────────────────────────
    total_files: int = 0              # Total files found (including binary/skipped)
    read_files: int = 0              # Files whose content was actually read
    skipped_files: int = 0           # Files skipped (binary, too large, sensitive)
    total_lines: int = 0             # Sum of line_count across all read files
    total_chars: int = 0             # Sum of len(content) across all read files

    # ── Stage 1 pipeline outputs ──────────────────────────────────────────────
    file_summaries: Dict[str, dict] = field(default_factory=dict)
    # file_summaries: {rel_path → Gemini-produced JSON summary}

    project_map: Optional[dict] = None
    # project_map: aggregated project-level summary produced after Stage 1

    # ── Stage 2 pipeline outputs ──────────────────────────────────────────────
    analysis_artifact: Optional[dict] = None
    # analysis_artifact: OpenRouter cross-file analysis JSON

    def get_checksum(self, rel_path: str) -> Optional[str]:
        """Return SHA-256 checksum for a file, or None if not found."""
        fi = self.files.get(rel_path)
        return fi.checksum if fi else None

    def get_relevant_files(self, rel_paths: List[str]) -> Dict[str, str]:
        """Return subset of file_map for the given rel_paths."""
        return {p: self.file_map[p] for p in rel_paths if p in self.file_map}

    @property
    def all_checksums(self) -> Dict[str, str]:
        """Return {rel_path → checksum} for all files."""
        return {p: fi.checksum for p, fi in self.files.items()}

    def build_file_tree(self) -> str:
        """Build a formatted ASCII file tree from file_map keys."""
        if not self.file_map:
            return "(empty)"

        lines = [f"{Path(self.project_root).name}/"]
        paths = sorted(self.file_map.keys())

        for rel_path in paths:
            depth = rel_path.count("/") + rel_path.count("\\")
            indent = "  " * depth
            name = Path(rel_path).name
            lines.append(f"{indent}├── {name}")

        return "\n".join(lines)

    def build_dependency_summary(self) -> str:
        """Build a human-readable dependency summary for LLM prompts."""
        if not self.graph:
            return "No dependency graph available."

        parts = []
        for rel_path, symbols in sorted(self.graph.items()):
            items = []
            if symbols.classes:
                items.append(f"classes: {', '.join(symbols.classes[:10])}")
            if symbols.functions:
                items.append(f"functions: {', '.join(symbols.functions[:10])}")
            if symbols.local_deps:
                items.append(f"imports: {', '.join(symbols.local_deps[:8])}")
            if items:
                parts.append(f"• {rel_path}\n  " + " | ".join(items))

        return "\n".join(parts) if parts else "Dependency graph is empty."

    def finalize(self) -> "RepoContext":
        """Build derived fields (file_tree, dependency_summary) after scanning."""
        self.file_tree = self.build_file_tree()
        self.dependency_summary = self.build_dependency_summary()
        return self
