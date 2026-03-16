"""chunker.py — Code-aware chunker that splits files by syntax boundaries.

Instead of naive fixed-token splits, we split Python by function/class boundaries
and JS/TS by function/class regex. Each chunk carries leading imports for context.
Target: ≤ 4000 tokens (≈ 16,000 chars) per chunk.
"""

from __future__ import annotations

import ast
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple

# ── Target chunk size in characters (≈ 4000 tokens at ~4 chars/token) ─────────
DEFAULT_CHUNK_CHARS = 16_000
MIN_CHUNK_CHARS = 500  # Chunks smaller than this get merged with the next


@dataclass
class CodeChunk:
    """A single chunk of a source file."""

    file_path: str          # rel_path the chunk came from
    chunk_index: int        # 0-based index within the file
    start_line: int         # 1-indexed start line (inclusive)
    end_line: int           # 1-indexed end line (inclusive)
    content: str            # The actual code content
    language: str           # Detected language
    symbol_name: Optional[str] = None  # Class/function name if chunk is a single symbol
    header: str = ""        # Leading imports/context prepended to each chunk


def _extract_python_imports(content: str) -> str:
    """Return the leading import block of a Python file (first ≤40 import lines)."""
    lines = content.splitlines()
    import_lines = []
    for line in lines[:80]:
        stripped = line.strip()
        if stripped.startswith(("import ", "from ", "#!", "# -*-", '"""', "'''")):
            import_lines.append(line)
        elif stripped == "" and import_lines:
            import_lines.append("")
        elif import_lines and not stripped.startswith(("import ", "from ")):
            # Stop at first non-import non-blank line after imports started
            if len(import_lines) > 2:
                break
    return "\n".join(import_lines[:40])


def _extract_js_imports(content: str) -> str:
    """Return the leading import block of a JS/TS file."""
    lines = content.splitlines()
    import_lines = []
    in_imports = True
    for line in lines[:60]:
        stripped = line.strip()
        if in_imports and (
            stripped.startswith("import ")
            or stripped.startswith("const ")
            and "require(" in stripped
            or stripped.startswith("//")
            or stripped == ""
        ):
            import_lines.append(line)
        else:
            if import_lines:
                in_imports = False
    return "\n".join(import_lines[:30])


def _chunk_python(
    rel_path: str,
    content: str,
    max_chars: int = DEFAULT_CHUNK_CHARS,
) -> List[CodeChunk]:
    """Split a Python file into chunks at function/class boundaries."""
    header = _extract_python_imports(content)
    lines = content.splitlines(keepends=True)

    try:
        tree = ast.parse(content, filename=rel_path)
    except SyntaxError:
        # Fall back to fixed-size chunking
        return _chunk_fixed(rel_path, content, "python", max_chars=max_chars)

    # Collect top-level node boundaries
    boundaries: List[Tuple[int, int, str]] = []  # (start_line, end_line, name)

    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            start = node.lineno - 1   # 0-indexed
            end = node.end_lineno     # 0-indexed exclusive
            name = node.name
            boundaries.append((start, end, name))

    if not boundaries:
        return _chunk_fixed(rel_path, content, "python", max_chars=max_chars)

    chunks: List[CodeChunk] = []
    chunk_idx = 0

    # Handle lines before first boundary (module-level code/comments)
    first_start = boundaries[0][0]
    if first_start > 0:
        preamble = "".join(lines[:first_start])
        if preamble.strip():
            chunks.append(CodeChunk(
                file_path=rel_path,
                chunk_index=chunk_idx,
                start_line=1,
                end_line=first_start,
                content=preamble,
                language="python",
                symbol_name=None,
                header=header,
            ))
            chunk_idx += 1

    # Group small adjacent nodes into single chunks
    current_start: Optional[int] = None
    current_end: Optional[int] = None
    current_content: List[str] = []
    current_names: List[str] = []

    def flush_chunk():
        nonlocal chunk_idx, current_start, current_end, current_content, current_names
        if current_content:
            chunks.append(CodeChunk(
                file_path=rel_path,
                chunk_index=chunk_idx,
                start_line=current_start + 1,
                end_line=current_end,
                content="".join(current_content),
                language="python",
                symbol_name=", ".join(current_names) if len(current_names) == 1 else None,
                header=header,
            ))
            chunk_idx += 1
            current_start = None
            current_end = None
            current_content = []
            current_names = []

    for start, end, name in boundaries:
        node_lines = lines[start:end]
        node_content = "".join(node_lines)

        if current_start is None:
            current_start = start
            current_end = end
            current_content = node_lines
            current_names = [name]
        else:
            combined_len = len("".join(current_content)) + len(node_content)
            if combined_len <= max_chars:
                current_end = end
                current_content.extend(node_lines)
                current_names.append(name)
            else:
                flush_chunk()
                current_start = start
                current_end = end
                current_content = node_lines
                current_names = [name]

    flush_chunk()

    # Handle trailing module-level code after last boundary
    last_end = boundaries[-1][1]
    if last_end < len(lines):
        trailing = "".join(lines[last_end:])
        if trailing.strip():
            chunks.append(CodeChunk(
                file_path=rel_path,
                chunk_index=chunk_idx,
                start_line=last_end + 1,
                end_line=len(lines),
                content=trailing,
                language="python",
                header=header,
            ))

    return chunks if chunks else _chunk_fixed(rel_path, content, "python", max_chars)


_JS_BOUNDARY_RE = re.compile(
    r"""^(?:export\s+)?(?:async\s+)?(?:function\s+\w+|class\s+\w+|const\s+\w+\s*=\s*(?:async\s+)?(?:function|\())""",
    re.MULTILINE,
)


def _chunk_js(
    rel_path: str,
    content: str,
    max_chars: int = DEFAULT_CHUNK_CHARS,
) -> List[CodeChunk]:
    """Split a JS/TS file at function/class boundaries using regex."""
    header = _extract_js_imports(content)
    lang = "typescript" if rel_path.endswith((".ts", ".tsx")) else "javascript"

    boundaries = [m.start() for m in _JS_BOUNDARY_RE.finditer(content)]
    if not boundaries:
        return _chunk_fixed(rel_path, content, lang, max_chars)

    chunks: List[CodeChunk] = []
    for i, start_char in enumerate(boundaries):
        end_char = boundaries[i + 1] if i + 1 < len(boundaries) else len(content)
        segment = content[start_char:end_char]

        # If segment is too large, sub-chunk it
        if len(segment) > max_chars:
            sub = _chunk_fixed(rel_path, segment, lang, max_chars)
            for s in sub:
                s.chunk_index = len(chunks)
                s.header = header
                chunks.append(s)
        else:
            start_line = content[:start_char].count("\n") + 1
            end_line = start_line + segment.count("\n")
            chunks.append(CodeChunk(
                file_path=rel_path,
                chunk_index=len(chunks),
                start_line=start_line,
                end_line=end_line,
                content=segment,
                language=lang,
                header=header,
            ))

    return chunks


def _chunk_fixed(
    rel_path: str,
    content: str,
    language: str,
    max_chars: int = DEFAULT_CHUNK_CHARS,
) -> List[CodeChunk]:
    """Fall-back: split content into fixed-size chunks at line boundaries."""
    lines = content.splitlines(keepends=True)
    chunks: List[CodeChunk] = []
    current: List[str] = []
    current_chars = 0
    start_line = 1
    chunk_idx = 0

    for i, line in enumerate(lines, start=1):
        current.append(line)
        current_chars += len(line)
        if current_chars >= max_chars:
            chunks.append(CodeChunk(
                file_path=rel_path,
                chunk_index=chunk_idx,
                start_line=start_line,
                end_line=i,
                content="".join(current),
                language=language,
            ))
            chunk_idx += 1
            current = []
            current_chars = 0
            start_line = i + 1

    if current:
        chunks.append(CodeChunk(
            file_path=rel_path,
            chunk_index=chunk_idx,
            start_line=start_line,
            end_line=start_line + len(current) - 1,
            content="".join(current),
            language=language,
        ))

    return chunks


# ── Public API ────────────────────────────────────────────────────────────────

def chunk_file(
    rel_path: str,
    content: str,
    max_chars: int = DEFAULT_CHUNK_CHARS,
) -> List[CodeChunk]:
    """Split a source file into code-aware chunks.

    Uses AST for Python, regex for JS/TS, fixed-line fallback for others.
    Each chunk includes a header with leading imports for context.
    """
    ext = Path(rel_path).suffix.lower()

    if ext == ".py":
        return _chunk_python(rel_path, content, max_chars)
    elif ext in {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}:
        return _chunk_js(rel_path, content, max_chars)
    else:
        lang = ext.lstrip(".") or "text"
        return _chunk_fixed(rel_path, content, lang, max_chars)


def format_chunk_for_prompt(chunk: CodeChunk) -> str:
    """Format a CodeChunk for inclusion in an LLM prompt."""
    header_block = f"{chunk.header}\n\n" if chunk.header else ""
    loc = f"lines {chunk.start_line}-{chunk.end_line}"
    symbol = f" [{chunk.symbol_name}]" if chunk.symbol_name else ""
    return (
        f"### {chunk.file_path}{symbol} ({loc})\n"
        f"```{chunk.language}\n"
        f"{header_block}{chunk.content}\n"
        f"```"
    )
