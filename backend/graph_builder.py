"""graph_builder.py — AST-based dependency graph for Python, regex-based for JS/TS.

Populates RepoContext.graph (FileSymbols) and RepoContext.edges (DependencyEdge).
"""

from __future__ import annotations

import ast
import re
from pathlib import Path
from typing import Dict, List, Set

from repo_context import DependencyEdge, FileSymbols, RepoContext


# ── Python AST parser ─────────────────────────────────────────────────────────

def _parse_python(rel_path: str, content: str, all_files: Set[str]) -> FileSymbols:
    """Extract symbols from a Python file using ast."""
    symbols = FileSymbols(rel_path=rel_path, language="python")

    try:
        tree = ast.parse(content, filename=rel_path)
    except SyntaxError:
        # Truncated or invalid file — use regex fallback
        return _parse_python_regex(rel_path, content, all_files)

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # Only top-level functions (parent is Module)
            symbols.functions.append(node.name)

        elif isinstance(node, ast.ClassDef):
            symbols.classes.append(node.name)

        elif isinstance(node, ast.Import):
            for alias in node.names:
                module = alias.name.split(".")[0]
                symbols.imports.append(module)

        elif isinstance(node, ast.ImportFrom):
            if node.module:
                module_root = node.module.split(".")[0]
                # Detect relative imports (level > 0) as local
                if node.level and node.level > 0:
                    symbols.imports.append(f".{node.module}")
                    # Try to find the local file
                    local_guess = node.module.replace(".", "/") + ".py"
                    if any(local_guess in f for f in all_files):
                        symbols.local_deps.append(node.module)
                else:
                    symbols.imports.append(module_root)
                    # Check if this corresponds to a local project file
                    local_guess_py = node.module.replace(".", "/") + ".py"
                    local_guess_init = node.module.replace(".", "/") + "/__init__.py"
                    if any(local_guess_py in f or local_guess_init in f for f in all_files):
                        symbols.local_deps.append(node.module)

    # Exports: top-level names defined (not underscore-prefixed)
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            if not node.name.startswith("_"):
                symbols.exports.append(node.name)
        elif isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and not t.id.startswith("_"):
                    symbols.exports.append(t.id)

    # Deduplicate
    symbols.functions = list(dict.fromkeys(symbols.functions))
    symbols.classes = list(dict.fromkeys(symbols.classes))
    symbols.imports = list(dict.fromkeys(symbols.imports))
    symbols.exports = list(dict.fromkeys(symbols.exports))
    symbols.local_deps = list(dict.fromkeys(symbols.local_deps))
    return symbols


def _parse_python_regex(rel_path: str, content: str, all_files: Set[str]) -> FileSymbols:
    """Fallback Python parser using regex (for truncated files)."""
    symbols = FileSymbols(rel_path=rel_path, language="python")
    symbols.functions = re.findall(r"^def (\w+)\(", content, re.MULTILINE)
    symbols.classes = re.findall(r"^class (\w+)[\(:]", content, re.MULTILINE)
    imports = re.findall(r"^(?:from|import)\s+([\w.]+)", content, re.MULTILINE)
    symbols.imports = [i.split(".")[0] for i in imports]
    return symbols


# ── JavaScript / TypeScript regex parser ──────────────────────────────────────

_JS_IMPORT_RE = re.compile(
    r"""(?:import|require)\s*(?:\(?\s*)?['"]([^'"]+)['"]""",
    re.MULTILINE,
)
_JS_EXPORT_NAMED_RE = re.compile(
    r"""export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)""",
    re.MULTILINE,
)
_JS_FUNCTION_RE = re.compile(
    r"""(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:\(|(?:\w+\s*=>)))""",
    re.MULTILINE,
)
_JS_CLASS_RE = re.compile(r"""class\s+(\w+)""", re.MULTILINE)


def _parse_js(rel_path: str, content: str, all_files: Set[str]) -> FileSymbols:
    """Extract symbols from JS/TS files using regex."""
    lang = "typescript" if rel_path.endswith((".ts", ".tsx")) else "javascript"
    symbols = FileSymbols(rel_path=rel_path, language=lang)

    # Imports
    for m in _JS_IMPORT_RE.finditer(content):
        module = m.group(1)
        symbols.imports.append(module)
        # Detect local imports (start with . or ..)
        if module.startswith("."):
            symbols.local_deps.append(module)

    # Exports
    symbols.exports = _JS_EXPORT_NAMED_RE.findall(content)

    # Functions
    for m in _JS_FUNCTION_RE.finditer(content):
        name = m.group(1) or m.group(2)
        if name:
            symbols.functions.append(name)

    # Classes
    symbols.classes = _JS_CLASS_RE.findall(content)

    # Deduplicate
    symbols.imports = list(dict.fromkeys(symbols.imports))
    symbols.exports = list(dict.fromkeys(symbols.exports))
    symbols.functions = list(dict.fromkeys(symbols.functions[:30]))  # cap
    symbols.classes = list(dict.fromkeys(symbols.classes))
    symbols.local_deps = list(dict.fromkeys(symbols.local_deps))
    return symbols


# ── Build dependency edges ────────────────────────────────────────────────────

def _build_edges(
    graph: Dict[str, FileSymbols],
    all_files: Set[str],
) -> List[DependencyEdge]:
    """Convert local_deps in each FileSymbols to DependencyEdge objects."""
    edges: List[DependencyEdge] = []
    for rel_path, symbols in graph.items():
        for dep in symbols.local_deps:
            edges.append(DependencyEdge(
                source_file=rel_path,
                target_module=dep,
                import_line=0,  # line number not tracked at this level
                is_local=True,
            ))
    return edges


# ── Public API ────────────────────────────────────────────────────────────────

def build_graph(ctx: RepoContext) -> RepoContext:
    """Build dependency graph from ctx.file_map and populate ctx.graph + ctx.edges.

    This modifies ctx in-place and returns it.
    """
    all_files: Set[str] = set(ctx.file_map.keys())
    graph: Dict[str, FileSymbols] = {}

    for rel_path, content in ctx.file_map.items():
        # Skip error placeholder entries
        if content.startswith("[") and content.endswith("]"):
            continue

        ext = Path(rel_path).suffix.lower()
        name_lower = Path(rel_path).name.lower()

        if ext == ".py":
            symbols = _parse_python(rel_path, content, all_files)
        elif ext in {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}:
            symbols = _parse_js(rel_path, content, all_files)
        else:
            # Generic: just record the filename as a node with no symbols
            symbols = FileSymbols(rel_path=rel_path, language=ext.lstrip(".") or "text")

        graph[rel_path] = symbols

    ctx.graph = graph
    ctx.edges = _build_edges(graph, all_files)

    # Rebuild dependency_summary with graph data
    ctx.dependency_summary = ctx.build_dependency_summary()
    return ctx
