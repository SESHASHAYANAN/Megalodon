import os
from pathlib import Path
from typing import Dict, List
from repo_context import RepoContext, FileInfo

def scan_repo(project_root: str, ignore_patterns: List[str] = None) -> RepoContext:
    ctx = RepoContext(project_root)
    ignore_patterns = ignore_patterns or []

    for root, dirs, files in os.walk(project_root):
        for fname in files:
            rel_path = Path(root).relative_to(project_root) / fname
            if any(pattern in str(rel_path) for pattern in ignore_patterns):
                continue
            if _should_include(rel_path):
                process_file(rel_path, ctx)

    ctx.file_tree = _build_file_tree(ctx)
    return ctx

def process_file(rel_path: Path, ctx: RepoContext) -> None:
    try:
        with open(rel_path, 'r') as file:
            content = file.read()
            file_info = FileInfo(
                rel_path=str(rel_path),
                abs_path=str(rel_path.absolute()),
                language=_detect_language(rel_path),
                extension=rel_path.suffix[1:],
                size_bytes=len(content),
                line_count=content.count('\n') + 1,
                checksum=_calculate_checksum(content),
                content=content,
                is_truncated=False
            )
            ctx.files[str(rel_path)] = file_info
            ctx.file_map[str(rel_path)] = content
    except Exception as e:
        print(f"Error processing file {rel_path}: {e}")

def _should_include(rel_path: Path) -> bool:
    # Add custom include logic here
    return True

def _detect_language(rel_path: Path) -> str:
    # Add custom language detection logic here
    return "unknown"

def _calculate_checksum(content: str) -> str:
    import hashlib
    return hashlib.sha256(content.encode()).hexdigest()

def _build_file_tree(ctx: RepoContext) -> str:
    # Add custom file tree building logic here
    return ""
