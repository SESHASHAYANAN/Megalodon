"""pipeline/stage3_groq.py — Stage 3: Final answer synthesis via Groq.

Receives Stage 2 analysis artifact + key code snippets + user query.
Streams the final developer-facing response.
Optimized for low latency and code quality.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import AsyncGenerator, List, Optional

from jinja2 import Environment, FileSystemLoader

from config import GROQ_MODEL, STAGE3_MAX_TOKENS, STAGE3_TEMPERATURE
from providers.groq_client import get_groq_client
from repo_context import RepoContext

logger = logging.getLogger(__name__)

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
_JINJA_ENV = Environment(
    loader=FileSystemLoader(str(_PROMPTS_DIR)),
    autoescape=False,
    trim_blocks=True,
    lstrip_blocks=True,
)

# Task-type → temperature tuning
_TASK_TEMPERATURES = {
    "explain": 0.3,
    "bug": 0.1,   # More deterministic for bug fixes
    "feature": 0.25,
    "code": 0.25,
    "refactor": 0.2,
    "security": 0.1,
}

_MAX_SNIPPETS_CHARS = 20_000
_MAX_ANALYSIS_JSON_CHARS = 15_000


def _build_snippets_block(analysis: dict, ctx: RepoContext) -> str:
    """Build a focused code snippets block from the Stage 2 analysis."""
    snippets = analysis.get("key_snippets", [])
    parts = []
    total = 0

    for snippet in snippets:
        rel_path = snippet.get("rel_path", "")
        code = snippet.get("code", "")
        description = snippet.get("description", "")
        lines = snippet.get("lines", "")

        if not code and rel_path in ctx.file_map:
            # Pull from file_map if the snippet has no code
            code = ctx.file_map[rel_path][:3000]

        if code:
            ext = Path(rel_path).suffix.lstrip(".")
            block = (
                f"**{rel_path}** (lines {lines}): {description}\n"
                f"```{ext}\n{code}\n```\n"
            )
            if total + len(block) > _MAX_SNIPPETS_CHARS:
                break
            parts.append(block)
            total += len(block)

    # If no snippets, grab top relevant files from analysis
    if not parts:
        relevant = analysis.get("relevant_files", [])
        for item in relevant[:5]:
            rel_path = item.get("rel_path", "")
            content = ctx.file_map.get(rel_path, "")
            if content and not content.startswith("["):
                ext = Path(rel_path).suffix.lstrip(".")
                block = (
                    f"**{rel_path}**: {item.get('reason', '')}\n"
                    f"```{ext}\n{content[:3000]}\n```\n"
                )
                if total + len(block) > _MAX_SNIPPETS_CHARS:
                    break
                parts.append(block)
                total += len(block)

    return "\n".join(parts) if parts else "(no code snippets available)"


def _build_relevant_file_contents(analysis: dict, ctx: RepoContext) -> str:
    """Build the relevant file contents block for Stage 3 prompt."""
    files_to_read = analysis.get("implementation_plan", {}).get("files_to_read", [])
    files_to_modify = analysis.get("implementation_plan", {}).get("files_to_modify", [])
    files_to_create = analysis.get("implementation_plan", {}).get("files_to_create", [])

    # Combine all files we need to show
    all_files = list(dict.fromkeys(
        files_to_modify + files_to_read + files_to_create[:3]
    ))

    # Fallback: use relevant_files from analysis
    if not all_files:
        all_files = [
            item["rel_path"]
            for item in analysis.get("relevant_files", [])[:8]
            if item.get("relevance") in ("HIGH", "MEDIUM")
        ]

    parts = []
    total = 0
    max_total = 30_000

    for rel_path in all_files[:12]:
        content = ctx.file_map.get(rel_path, "")
        if not content or content.startswith("["):
            continue
        ext = Path(rel_path).suffix.lstrip(".")
        block = f"### {rel_path}\n```{ext}\n{content[:8000]}\n```\n"
        if total + len(block) > max_total:
            break
        parts.append(block)
        total += len(block)

    return "\n".join(parts) if parts else "(no file contents provided)"


async def run_stage3(
    ctx: RepoContext,
    query: str,
    task_type: str = "explain",
) -> AsyncGenerator[dict, None]:
    """Run Stage 3: stream final answer via Groq.

    Yields SSE-style event dicts including streaming text chunks.
    """
    if not ctx.analysis_artifact:
        yield {
            "type": "error",
            "content": "Stage 3: No analysis artifact available from Stage 2.",
            "stage": "stage3",
        }
        return

    client = get_groq_client()
    analysis = ctx.analysis_artifact

    yield {
        "type": "stage3_start",
        "content": (
            f"⚡ Stage 3 — Groq ({GROQ_MODEL}): "
            f"generating final response..."
        ),
        "model": GROQ_MODEL,
    }

    # Build prompt
    analysis_json = json.dumps(analysis, indent=2)[:_MAX_ANALYSIS_JSON_CHARS]
    key_snippets = _build_snippets_block(analysis, ctx)
    relevant_file_contents = _build_relevant_file_contents(analysis, ctx)

    template = _JINJA_ENV.get_template("stage3_groq.jinja")
    prompt_content = template.render(
        task_type=task_type,
        query=query,
        analysis_json=analysis_json,
        key_snippets=key_snippets,
        relevant_file_contents=relevant_file_contents,
    )

    messages = [
        {
            "role": "user",
            "content": prompt_content,
        }
    ]

    # Per-task temperature
    temperature = _TASK_TEMPERATURES.get(task_type, STAGE3_TEMPERATURE)

    # Stream response from Groq
    full_response = ""
    chunk_count = 0

    try:
        async for chunk in client.stream(
            messages=messages,
            model=GROQ_MODEL,
            temperature=temperature,
            max_tokens=STAGE3_MAX_TOKENS,
            top_p=0.95,
        ):
            full_response += chunk
            chunk_count += 1
            yield {"type": "stream", "content": chunk}

        if not full_response.strip():
            raise RuntimeError("Groq returned an empty response")

        yield {
            "type": "stage3_complete",
            "content": f"✅ Stage 3 complete — {len(full_response):,} chars generated.",
            "response_length": len(full_response),
        }
        yield {"type": "code", "content": full_response}

    except Exception as e:
        err_msg = f"Stage 3 (Groq) error: {e}"
        logger.error(err_msg)

        # Graceful degradation: surface Stage 2 analysis as text
        fallback = _build_stage2_fallback_response(analysis, query)

        yield {
            "type": "stage3_fallback",
            "content": (
                f"⚠️ Stage 3 (Groq) failed: {e}. "
                f"Surfacing Stage 2 analysis instead."
            ),
            "error": str(e),
        }
        yield {"type": "stream", "content": fallback}
        yield {"type": "code", "content": fallback}


def _build_stage2_fallback_response(analysis: dict, query: str) -> str:
    """Build a human-readable fallback response from Stage 2 analysis data."""
    lines = [
        f"## Analysis for: {query}\n",
        f"*Note: Stage 3 (Groq) was unavailable. Showing Stage 2 analysis.*\n",
    ]

    if analysis.get("query_summary"):
        lines.append(f"**Task**: {analysis['query_summary']}\n")

    findings = analysis.get("analysis", {}).get("findings", [])
    if findings:
        lines.append("\n### Findings\n")
        for f in findings:
            lines.append(f"- {f}")

    relevant = analysis.get("relevant_files", [])
    if relevant:
        lines.append("\n### Relevant Files\n")
        for item in relevant[:10]:
            lines.append(
                f"- **{item['rel_path']}** ({item.get('relevance', 'N/A')}): "
                f"{item.get('reason', '')}"
            )

    plan = analysis.get("implementation_plan", {})
    steps = plan.get("steps", [])
    if steps:
        lines.append("\n### Implementation Steps\n")
        for step in steps:
            lines.append(
                f"{step.get('step', '')}. **{step.get('file', '')}**: "
                f"{step.get('action', '')}"
            )

    snippets = analysis.get("key_snippets", [])
    if snippets:
        lines.append("\n### Key Code Snippets\n")
        for s in snippets[:3]:
            rel_path = s.get("rel_path", "")
            code = s.get("code", "")
            if code:
                ext = Path(rel_path).suffix.lstrip(".")
                lines.append(f"**{rel_path}**\n```{ext}\n{code}\n```\n")

    return "\n".join(lines)
