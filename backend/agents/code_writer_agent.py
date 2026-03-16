"""CodeWriterAgent — uses the full 3-stage Gemini→OpenRouter→Groq pipeline.

Stage 1 (Gemini): reads all files, produces structured summaries.
Stage 2 (OpenRouter): identifies files to modify, builds implementation plan.
Stage 3 (Groq): writes complete production code with FILE: path blocks.
"""

import re
from pathlib import Path
from typing import AsyncGenerator

from repo_context import RepoContext


class CodeWriterAgent:
    """Generates and writes production code via 3-stage pipeline."""

    async def run(self, ctx: RepoContext, task: str) -> AsyncGenerator[dict, None]:
        from pipeline.orchestrator import run_pipeline

        yield {
            "type": "thinking",
            "content": (
                f"⚙️ CodeWriterAgent: building full context from {ctx.read_files} files "
                f"via Gemini → OpenRouter → Groq pipeline..."
            ),
        }
        yield {
            "type": "repo_scan",
            "content": (
                f"📖 Loaded {ctx.read_files}/{ctx.total_files} files — "
                f"{ctx.total_chars:,} chars — starting 3-stage code generation."
            ),
        }

        # Run full pipeline
        full_response = ""
        async for event in run_pipeline(ctx, query=task, task_type="feature"):
            yield event
            if event.get("type") == "stream":
                full_response += event.get("content", "")

        # Parse and write files to disk from FILE: path blocks in the response
        if full_response:
            written = _write_files_from_response(full_response, ctx.project_root)
            if written:
                yield {
                    "type": "files_written",
                    "content": (
                        f"💾 Wrote {len(written)} files to disk: "
                        f"{', '.join(written)}"
                    ),
                    "files": written,
                }


def _write_files_from_response(response: str, project_root: str) -> list:
    """Parse FILE: path blocks from agent response and write them to disk.

    Security: verifies all paths resolve inside project_root (no path traversal).
    """
    written = []

    # Pattern: FILE: some/path.ext\n```lang\n...content...```
    pattern = re.compile(
        r"FILE:\s*(.+?)\n```[^\n]*\n(.*?)```",
        re.DOTALL,
    )

    for match in pattern.finditer(response):
        rel_path = match.group(1).strip()
        content = match.group(2)

        # Security: reject path traversal outside project_root
        target = Path(project_root) / rel_path
        try:
            target.resolve().relative_to(Path(project_root).resolve())
        except ValueError:
            continue

        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
            written.append(rel_path)
        except OSError as e:
            print(f"[CodeWriterAgent] Failed to write {rel_path}: {e}")

    return written
