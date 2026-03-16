"""pipeline/orchestrator.py — Chains all 3 pipeline stages: Gemini → OpenRouter → Groq.

run_pipeline(ctx, task_type, query) is an async generator that:
  1. Runs Stage 1 (Gemini via OpenRouter): file reading + summaries
  2. Runs Stage 2 (OpenRouter non-Gemini): cross-file reasoning + analysis artifact
  3. Runs Stage 3 (Groq): streams final developer-facing response

Implements graceful degradation:
  - If Stage 3 (Groq) fails → surfaces Stage 2 analysis
  - If Stage 2 (OpenRouter) fails → uses Stage 1 summaries as fallback analysis
  - If Stage 1 (Gemini) fails → surfaces partial summaries

Compatible with all specialist agents via ask_llm_streaming() shim in llm.py.
"""

from __future__ import annotations

import logging
from typing import AsyncGenerator, Optional

from cache import SummaryCache, get_cache
from pipeline.stage1_gemini import run_stage1
from pipeline.stage2_openrouter import run_stage2
from pipeline.stage3_groq import run_stage3
from repo_context import RepoContext

logger = logging.getLogger(__name__)

# ── Task type normalization ───────────────────────────────────────────────────

_TASK_TYPE_MAP = {
    "explain": "explain",
    "overview": "explain",
    "architecture": "explain",
    "bug": "bug",
    "debug": "bug",
    "fix": "bug",
    "error": "bug",
    "feature": "feature",
    "add": "feature",
    "implement": "feature",
    "code": "feature",
    "refactor": "refactor",
    "clean": "refactor",
    "improve": "refactor",
    "security": "security",
    "audit": "security",
    "vulnerability": "security",
    "list": "explain",
}


def normalize_task_type(task_type: str) -> str:
    """Normalize a task type string to one of the canonical types."""
    t = task_type.lower().strip()
    return _TASK_TYPE_MAP.get(t, "feature")


async def run_pipeline(
    ctx: RepoContext,
    query: str,
    task_type: str = "explain",
    no_cache: bool = False,
    cache: Optional[SummaryCache] = None,
) -> AsyncGenerator[dict, None]:
    """Full 3-stage pipeline: Gemini → OpenRouter → Groq.

    Yields SSE-style event dicts throughout all stages:
      {"type": "thinking", "content": ...}
      {"type": "stage1_start", ...}
      {"type": "stage1_progress", "file": ..., "cached": bool, ...}
      {"type": "stage1_complete", ...}
      {"type": "stage2_start", ...}
      {"type": "stage2_complete", ...}
      {"type": "stage3_start", ...}
      {"type": "stream", "content": text_chunk}  ← the actual answer
      {"type": "stage3_complete", ...}
      {"type": "code", "content": full_response}
      {"type": "done", "content": ...}
      {"type": "error", "content": ..., "stage": ...}

    Args:
        ctx: Populated RepoContext (from scan_repo + build_graph).
        query: The user's question/task in natural language.
        task_type: One of: explain, bug, feature, refactor, security.
        no_cache: If True, bypass the SQLite summary cache.
        cache: Optional custom SummaryCache instance.

    The generator never raises — all errors are surfaced as {type: error} events.
    """
    task_type = normalize_task_type(task_type)
    cache = cache or get_cache(no_cache=no_cache)

    yield {
        "type": "thinking",
        "content": (
            f"🚀 Starting 3-stage pipeline: Gemini → OpenRouter → Groq\n"
            f"Task: {task_type} | Query: {query[:120]}{'...' if len(query) > 120 else ''}"
        ),
        "task_type": task_type,
        "pipeline": ["gemini/stage1", STAGE2_MODEL_LABEL, "groq/stage3"],
    }

    # ── Stage 1 — Gemini: file reading + summaries ────────────────────────────
    stage1_ok = True
    try:
        async for event in run_stage1(ctx, cache=cache, no_cache=no_cache):
            yield event
            if event.get("type") == "error":
                stage1_ok = False
    except Exception as e:
        stage1_ok = False
        logger.error(f"Stage 1 unhandled error: {e}")
        yield {
            "type": "error",
            "content": f"❌ Stage 1 (Gemini) crashed: {e}",
            "stage": "stage1",
        }

    if not ctx.file_summaries:
        stage1_ok = False
        yield {
            "type": "error",
            "content": (
                "❌ Stage 1 produced no file summaries. "
                "Check your OPENROUTER_API_KEY and GEMINI_MODEL configuration."
            ),
            "stage": "stage1",
        }

    # ── Stage 2 — OpenRouter: cross-file reasoning ────────────────────────────
    stage2_ok = True
    if stage1_ok:
        try:
            async for event in run_stage2(ctx, query=query, task_type=task_type):
                yield event
                if event.get("type") == "error":
                    stage2_ok = False
        except Exception as e:
            stage2_ok = False
            logger.error(f"Stage 2 unhandled error: {e}")
            yield {
                "type": "error",
                "content": f"❌ Stage 2 (OpenRouter) crashed: {e}",
                "stage": "stage2",
            }
    else:
        # Even if Stage 1 failed partially, try to build a minimal analysis
        stage2_ok = False
        if ctx.file_summaries:
            from pipeline.stage2_openrouter import _build_fallback_analysis
            ctx.analysis_artifact = _build_fallback_analysis(
                ctx, query, task_type, "Stage 1 partial failure"
            )
            stage2_ok = True

    # ── Stage 3 — Groq: final answer synthesis ────────────────────────────────
    if stage2_ok or ctx.analysis_artifact:
        try:
            async for event in run_stage3(ctx, query=query, task_type=task_type):
                yield event
        except Exception as e:
            logger.error(f"Stage 3 unhandled error: {e}")
            yield {
                "type": "error",
                "content": f"❌ Stage 3 (Groq) crashed: {e}",
                "stage": "stage3",
            }
            # Surface Stage 2 analysis as fallback text
            if ctx.analysis_artifact:
                from pipeline.stage3_groq import _build_stage2_fallback_response
                fallback = _build_stage2_fallback_response(ctx.analysis_artifact, query)
                yield {"type": "stream", "content": fallback}
                yield {"type": "code", "content": fallback}
    else:
        # ── Emergency Groq fallback — both Stage 1 + 2 failed ─────────────
        yield {
            "type": "thinking",
            "content": "⚠️ Stage 1 + 2 failed. Attempting Groq emergency fallback...",
        }
        try:
            import httpx
            from config import GROQ_API_KEY, GROQ_BASE_URL, GROQ_MODEL
            if not GROQ_API_KEY:
                raise ValueError("GROQ_API_KEY not configured")

            groq_messages = [{
                "role": "system",
                "content": (
                    "You are a senior developer. The user has a codebase and a task. "
                    "You do NOT have file summaries available (the analysis pipeline failed). "
                    "Do your best with general knowledge. Produce complete, production-ready code."
                ),
            }, {
                "role": "user",
                "content": f"Task: {query}\n\nPlease provide your best solution."
            }]

            async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
                resp = await client.post(
                    f"{GROQ_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {GROQ_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": GROQ_MODEL,
                        "messages": groq_messages,
                        "temperature": 0.3,
                        "max_tokens": 8192,
                        "stream": False,
                    },
                )
                resp.raise_for_status()
                groq_text = resp.json()["choices"][0]["message"]["content"]

            yield {"type": "stream", "content": groq_text}
            yield {"type": "code", "content": groq_text}
            logger.info("Groq emergency fallback succeeded.")

        except Exception as fallback_err:
            logger.error(f"Groq emergency fallback also failed: {fallback_err}")
            yield {
                "type": "error",
                "content": (
                    "❌ Pipeline failed at all 3 stages:\\n"
                    "  • Stage 1 (Gemini via OpenRouter): file reading failed — check OPENROUTER_API_KEY\\n"
                    "  • Stage 2 (OpenRouter reasoning): analysis failed — check API key + connectivity\\n"
                    "  • Stage 3 (Groq fallback): emergency call failed — check GROQ_API_KEY\\n\\n"
                    f"Last error: {fallback_err}\\n\\n"
                    "💡 Click **Retry** to try again, or verify your API keys in backend/.env"
                ),
                "stage": "pipeline",
            }

    yield {
        "type": "done",
        "content": "✅ Pipeline complete.",
        "task_type": task_type,
        "query": query[:120],
    }


# ── Label helpers ─────────────────────────────────────────────────────────────

def _get_stage2_label() -> str:
    """Return a human-readable label for the Stage 2 model."""
    try:
        from config import OPENROUTER_MODEL
        return f"openrouter/{OPENROUTER_MODEL}"
    except Exception:
        return "openrouter/stage2"


STAGE2_MODEL_LABEL = _get_stage2_label()
