"""ExplainAgent — uses the full 3-stage Gemini→OpenRouter→Groq pipeline.

Stage 1 (Gemini): reads all files, builds structured summaries.
Stage 2 (OpenRouter): cross-file architecture analysis.
Stage 3 (Groq): streams final architectural explanation.
"""

from typing import AsyncGenerator
from repo_context import RepoContext


class ExplainAgent:
    """Produces thorough architectural explanation via 3-stage pipeline."""

    async def run(self, ctx: RepoContext, task: str) -> AsyncGenerator[dict, None]:
        from pipeline.orchestrator import run_pipeline

        yield {
            "type": "thinking",
            "content": (
                f"📚 ExplainAgent: analyzing {ctx.read_files} files via "
                f"Gemini → OpenRouter → Groq pipeline..."
            ),
        }
        yield {
            "type": "repo_scan",
            "content": (
                f"📖 Loaded {ctx.read_files}/{ctx.total_files} files — "
                f"{ctx.total_chars:,} chars — starting 3-stage pipeline."
            ),
        }

        async for event in run_pipeline(ctx, query=task, task_type="explain"):
            yield event
