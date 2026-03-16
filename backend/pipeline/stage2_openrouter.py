"""pipeline/stage2_openrouter.py — Stage 2: Cross-file reasoning via OpenRouter (non-Gemini model).

Receives Stage 1 summaries and user query.
Produces a structured analysis artifact for Stage 3 (Groq).
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import AsyncGenerator, List, Optional

from jinja2 import Environment, FileSystemLoader

from config import (
    OPENROUTER_MODEL,
    STAGE2_MAX_TOKENS,
    STAGE2_TEMPERATURE,
)
from providers.openrouter_client import get_openrouter_client, _extract_json
from repo_context import RepoContext

logger = logging.getLogger(__name__)

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
_JINJA_ENV = Environment(
    loader=FileSystemLoader(str(_PROMPTS_DIR)),
    autoescape=False,
    trim_blocks=True,
    lstrip_blocks=True,
)

# Max summaries to include in Stage 2 prompt (to stay within context window)
_MAX_SUMMARIES_IN_PROMPT = 60
# Max chars of file content per relevant file
_MAX_SNIPPET_CHARS = 8_000
# Max total chars for key file contents block
_MAX_TOTAL_SNIPPET_CHARS = 40_000


def _select_relevant_files(
    ctx: RepoContext,
    query: str,
    top_n: int = 15,
) -> List[str]:
    """Heuristic selection of most relevant files for the query.

    Strategy:
    1. For each file summary, score by how many query words appear in purpose/responsibilities
    2. Return top_n files by score
    3. Always include entry files (app.py, main.py, index.js, etc.)
    """
    query_words = set(query.lower().split())

    # Priority entry point files
    entry_points = {
        "app.py", "main.py", "server.py", "index.js", "index.ts",
        "index.jsx", "index.tsx", "__main__.py", "cli.py",
    }

    scores = {}
    for rel_path, summary in ctx.file_summaries.items():
        score = 0
        text = " ".join([
            summary.get("purpose", ""),
            " ".join(summary.get("responsibilities", [])),
            " ".join(summary.get("exports", [])),
            str(summary.get("architecture_notes", "")),
        ]).lower()

        for word in query_words:
            if len(word) > 3 and word in text:
                score += 1

        # Boost entry points
        if Path(rel_path).name in entry_points:
            score += 3

        scores[rel_path] = score

    sorted_files = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [fp for fp, _ in sorted_files[:top_n]]


def _build_summaries_block(ctx: RepoContext, max_count: int) -> str:
    """Serialize file summaries to JSON string, capped to max_count."""
    truncated = dict(list(ctx.file_summaries.items())[:max_count])
    try:
        return json.dumps(truncated, indent=2)
    except (TypeError, ValueError):
        return str(truncated)


def _build_snippets_block(
    ctx: RepoContext,
    relevant_files: List[str],
    max_total_chars: int = _MAX_TOTAL_SNIPPET_CHARS,
) -> str:
    """Build a code snippet block for the most relevant files."""
    parts = []
    total = 0

    for rel_path in relevant_files:
        content = ctx.file_map.get(rel_path, "")
        if not content or content.startswith("["):
            continue

        snippet = content[:_MAX_SNIPPET_CHARS]
        ext = Path(rel_path).suffix.lstrip(".")
        block = f"### {rel_path}\n```{ext}\n{snippet}\n```\n"

        if total + len(block) > max_total_chars:
            remaining = max_total_chars - total
            if remaining > 500:
                parts.append(block[:remaining] + "\n[... truncated]\n")
            break

        parts.append(block)
        total += len(block)

    return "\n".join(parts) if parts else "(no file contents available)"


def _get_languages(ctx: RepoContext) -> str:
    """Return a comma-separated list of unique languages in the repo."""
    langs = set()
    for fi in ctx.files.values():
        if fi.language and fi.language not in ("text",):
            langs.add(fi.language)
    return ", ".join(sorted(langs)) if langs else "mixed"


async def run_stage2(
    ctx: RepoContext,
    query: str,
    task_type: str = "explain",
) -> AsyncGenerator[dict, None]:
    """Run Stage 2: cross-file reasoning via OpenRouter (non-Gemini).

    Yields SSE-style event dicts.
    Modifies ctx.analysis_artifact in-place.
    """
    if not ctx.file_summaries:
        yield {
            "type": "error",
            "content": "Stage 2: No file summaries available. Did Stage 1 complete?",
            "stage": "stage2",
        }
        return

    client = get_openrouter_client()

    yield {
        "type": "stage2_start",
        "content": (
            f"🧠 Stage 2 — {OPENROUTER_MODEL}: "
            f"cross-file reasoning for '{task_type}' task..."
        ),
        "model": OPENROUTER_MODEL,
    }

    # Select most relevant files
    relevant_files = _select_relevant_files(ctx, query)

    yield {
        "type": "stage2_selecting",
        "content": (
            f"📊 Selected {len(relevant_files)} relevant files from "
            f"{len(ctx.file_summaries)} summaries for focused analysis."
        ),
        "relevant_files": relevant_files,
    }

    # Build prompt
    summaries_json = _build_summaries_block(ctx, _MAX_SUMMARIES_IN_PROMPT)
    relevant_file_contents = _build_snippets_block(ctx, relevant_files)
    languages = _get_languages(ctx)

    template = _JINJA_ENV.get_template("stage2_openrouter.jinja")
    prompt_content = template.render(
        task_type=task_type,
        query=query,
        project_root=ctx.project_root,
        total_files=ctx.total_files,
        languages=languages,
        file_summaries_json=summaries_json,
        relevant_file_contents=relevant_file_contents,
    )

    messages = [
        {
            "role": "user",
            "content": prompt_content,
        }
    ]

    # Call OpenRouter non-Gemini model
    try:
        raw_response = await client.complete(
            model=OPENROUTER_MODEL,
            messages=messages,
            temperature=STAGE2_TEMPERATURE,
            max_tokens=STAGE2_MAX_TOKENS,
        )

        analysis = _extract_json(raw_response, context=f"Stage2({OPENROUTER_MODEL})")
        ctx.analysis_artifact = analysis

        relevant_count = len(analysis.get("relevant_files", []))
        snippets_count = len(analysis.get("key_snippets", []))

        yield {
            "type": "stage2_complete",
            "content": (
                f"✅ Stage 2 complete — {relevant_count} relevant files identified, "
                f"{snippets_count} key snippets extracted."
            ),
            "relevant_files_count": relevant_count,
            "snippets_count": snippets_count,
        }

    except Exception as e:
        err_msg = f"Stage 2 error: {e}"
        logger.error(err_msg)

        # Fallback: produce a minimal analysis from Stage 1 data
        ctx.analysis_artifact = _build_fallback_analysis(ctx, query, task_type, str(e))

        yield {
            "type": "stage2_fallback",
            "content": (
                f"⚠️ Stage 2 failed ({e}). Using Stage 1 summaries as fallback analysis."
            ),
            "error": str(e),
        }


def _build_fallback_analysis(
    ctx: RepoContext,
    query: str,
    task_type: str,
    error: str,
) -> dict:
    """Build a minimal analysis artifact from Stage 1 data when Stage 2 fails."""
    relevant = []
    for rel_path, summary in list(ctx.file_summaries.items())[:10]:
        relevant.append({
            "rel_path": rel_path,
            "relevance": "MEDIUM",
            "reason": summary.get("purpose", "N/A"),
            "key_sections": summary.get("exports", []),
        })

    snippets = []
    for rel_path in list(ctx.file_map.keys())[:5]:
        content = ctx.file_map[rel_path]
        if not content.startswith("["):
            snippets.append({
                "rel_path": rel_path,
                "description": ctx.file_summaries.get(rel_path, {}).get("purpose", ""),
                "lines": "1-50",
                "code": content[:2000],
            })

    return {
        "task_type": task_type,
        "query_summary": query,
        "relevant_files": relevant,
        "key_snippets": snippets,
        "cross_file_relationships": [],
        "analysis": {
            "findings": [f"Stage 2 unavailable: {error}. Using Stage 1 summaries."],
            "root_cause": "",
            "architecture_insights": ctx.dependency_summary[:2000],
            "bug_locations": [],
            "refactor_opportunities": [],
        },
        "implementation_plan": {
            "summary": f"Analyze the codebase for: {query}",
            "steps": [],
            "files_to_create": [],
            "files_to_modify": [],
            "files_to_read": list(ctx.file_map.keys())[:10],
        },
        "edge_cases": [],
        "test_suggestions": [],
        "_fallback": True,
        "_stage2_error": error,
    }
