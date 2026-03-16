"""DebugAgent — uses the full 3-stage Gemini→OpenRouter→Groq pipeline.

Stage 1 (Gemini): reads all files, identifies symbols and dependencies.
Stage 2 (OpenRouter): traces the bug across files, identifies root cause location.
Stage 3 (Groq): produces complete root-cause analysis + fixed file contents.
"""

from typing import AsyncGenerator

from repo_context import RepoContext


class DebugAgent:
    """Finds root cause and applies complete fix via 3-stage pipeline."""

    async def run(self, ctx: RepoContext, task: str) -> AsyncGenerator[dict, None]:
        from pipeline.orchestrator import run_pipeline

        yield {
            "type": "thinking",
            "content": (
                f"🐛 DebugAgent: loading {ctx.read_files} files for root cause analysis "
                f"via Gemini → OpenRouter → Groq pipeline..."
            ),
        }
        yield {
            "type": "repo_scan",
            "content": (
                f"🔍 Loaded {ctx.read_files} files — {ctx.total_chars:,} chars — "
                f"sending to Gemini for dependency mapping + bug tracing."
            ),
        }

        # Run full pipeline with bug task type
        full_response = ""
        async for event in run_pipeline(ctx, query=task, task_type="bug"):
            yield event
            if event.get("type") == "stream":
                full_response += event.get("content", "")

        # Write any fixed files embedded in the response
        if full_response:
            from agents.code_writer_agent import _write_files_from_response
            written = _write_files_from_response(full_response, ctx.project_root)
            if written:
                yield {
                    "type": "files_written",
                    "content": (
                        f"💾 Fixed and wrote {len(written)} files to disk: "
                        f"{', '.join(written)}"
                    ),
                    "files": written,
                }
