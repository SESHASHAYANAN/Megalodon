"""SecurityAgent — uses the full 3-stage Gemini→OpenRouter→Groq pipeline.

Stage 1 (Gemini): reads all files (including config files) and maps them.
Stage 2 (OpenRouter): performs cross-file vulnerability pattern analysis.
Stage 3 (Groq): produces complete security audit with severity ratings and fixes.
"""

from typing import AsyncGenerator

from repo_context import RepoContext


class SecurityAgent:
    """Performs exhaustive security audit via 3-stage pipeline."""

    async def run(self, ctx: RepoContext, task: str) -> AsyncGenerator[dict, None]:
        from pipeline.orchestrator import run_pipeline

        yield {
            "type": "thinking",
            "content": (
                f"🔒 SecurityAgent: scanning {ctx.read_files} files for vulnerabilities "
                f"via Gemini → OpenRouter → Groq pipeline..."
            ),
        }
        yield {
            "type": "repo_scan",
            "content": (
                f"🔍 Scanning {ctx.read_files} files — {ctx.total_chars:,} chars — "
                f"running 15-point security checklist via Gemini 3-stage pipeline."
            ),
        }

        async for event in run_pipeline(ctx, query=task, task_type="security"):
            yield event
