"""pipeline/stage1_gemini.py — Stage 1: Gemini via OpenRouter file reading and summarization.

For each source file in RepoContext:
  1. Check SQLite cache (keyed by SHA-256 + model name)
  2. If cache hit: use cached summary
  3. If cache miss: send file to Gemini via OpenRouter, get structured JSON summary, cache it

Output: ctx.file_summaries = {rel_path → summary_dict}
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import AsyncGenerator, Dict, Optional

from jinja2 import Environment, FileSystemLoader

from cache import SummaryCache, get_cache
from config import (
    GEMINI_MODEL,
    STAGE1_MAX_TOKENS,
    STAGE1_TEMPERATURE,
    MAX_FILE_CHARS,
)
from providers.openrouter_client import get_openrouter_client, _extract_json
from repo_context import RepoContext

logger = logging.getLogger(__name__)

# Load prompt templates from prompts/ directory
_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
_JINJA_ENV = Environment(
    loader=FileSystemLoader(str(_PROMPTS_DIR)),
    autoescape=False,
    trim_blocks=True,
    lstrip_blocks=True,
)


def _render_stage1_prompt(
    rel_path: str,
    language: str,
    size_bytes: int,
    line_count: int,
    content: str,
    dependency_hint: str = "",
) -> str:
    """Render the Stage 1 Jinja template for a single file."""
    template = _JINJA_ENV.get_template("stage1_gemini.jinja")
    return template.render(
        rel_path=rel_path,
        language=language,
        size_bytes=size_bytes,
        line_count=line_count,
        content=content[:MAX_FILE_CHARS],
        dependency_hint=dependency_hint,
    )


async def run_stage1(
    ctx: RepoContext,
    cache: Optional[SummaryCache] = None,
    no_cache: bool = False,
) -> AsyncGenerator[dict, None]:
    """Run Stage 1: read all files via Gemini and produce structured summaries.

    Yields SSE-style event dicts:
      {"type": "stage1_progress", "content": ..., "file": ..., "cached": bool}
      {"type": "stage1_complete", "content": ..., "summaries": {rel_path → dict}}
      {"type": "error", "content": ..., "stage": "stage1"}

    Modifies ctx.file_summaries in-place.
    """
    cache = cache or get_cache(no_cache=no_cache)
    client = get_openrouter_client()

    files = ctx.files
    if not files:
        yield {
            "type": "error",
            "content": "Stage 1: No files found in RepoContext. Did you run scan_repo()?",
            "stage": "stage1",
        }
        return

    yield {
        "type": "stage1_start",
        "content": (
            f"🔍 Stage 1 — Gemini ({GEMINI_MODEL}): "
            f"analyzing {len(files)} files..."
        ),
        "model": GEMINI_MODEL,
        "total_files": len(files),
    }

    # ── Batch cache lookup ────────────────────────────────────────────────────
    checksums = ctx.all_checksums
    cached_results = cache.get_many(checksums, model=GEMINI_MODEL)

    cache_hits = sum(1 for v in cached_results.values() if v is not None)
    cache_misses = len(files) - cache_hits

    if cache_hits > 0:
        yield {
            "type": "stage1_cache",
            "content": f"📦 Cache: {cache_hits} hits, {cache_misses} misses — skipping Gemini for cached files.",
            "hits": cache_hits,
            "misses": cache_misses,
        }

    summaries: Dict[str, dict] = {}
    processed = 0
    errors = []

    for rel_path, fi in sorted(files.items()):
        processed += 1

        # ── Cache hit ─────────────────────────────────────────────────────────
        if cached_results.get(rel_path) is not None:
            summaries[rel_path] = cached_results[rel_path]
            yield {
                "type": "stage1_progress",
                "content": f"[{processed}/{len(files)}] ✅ {rel_path} (cached)",
                "file": rel_path,
                "cached": True,
                "progress": processed / len(files),
            }
            continue

        # ── Build prompt ──────────────────────────────────────────────────────
        dependency_hint = ""
        if rel_path in ctx.graph:
            sym = ctx.graph[rel_path]
            parts = []
            if sym.functions:
                parts.append(f"Functions: {', '.join(sym.functions[:10])}")
            if sym.classes:
                parts.append(f"Classes: {', '.join(sym.classes[:10])}")
            if sym.local_deps:
                parts.append(f"Local deps: {', '.join(sym.local_deps[:8])}")
            dependency_hint = " | ".join(parts)

        prompt_content = _render_stage1_prompt(
            rel_path=rel_path,
            language=fi.language,
            size_bytes=fi.size_bytes,
            line_count=fi.line_count,
            content=fi.content,
            dependency_hint=dependency_hint,
        )

        messages = [
            {
                "role": "user",
                "content": prompt_content,
            }
        ]

        # ── Call Gemini via OpenRouter ─────────────────────────────────────────
        yield {
            "type": "stage1_progress",
            "content": f"[{processed}/{len(files)}] 🤖 Gemini reading: {rel_path}",
            "file": rel_path,
            "cached": False,
            "progress": processed / len(files),
        }

        try:
            raw_response = await client.complete(
                model=GEMINI_MODEL,
                messages=messages,
                temperature=STAGE1_TEMPERATURE,
                max_tokens=STAGE1_MAX_TOKENS,
            )

            summary = _extract_json(raw_response, context=f"Stage1({rel_path})")

            # Ensure rel_path is always set correctly in summary
            summary["rel_path"] = rel_path
            summary["language"] = fi.language

            # Store in cache
            cache.set(
                checksum=fi.checksum,
                model=GEMINI_MODEL,
                rel_path=rel_path,
                summary=summary,
            )
            summaries[rel_path] = summary

        except Exception as e:
            err_msg = f"Stage 1 error for {rel_path}: {e}"
            logger.error(err_msg)
            errors.append(err_msg)
            # Store a minimal fallback summary so Stage 2 still has something
            summaries[rel_path] = {
                "rel_path": rel_path,
                "language": fi.language,
                "purpose": "[Stage 1 error — could not summarize]",
                "error": str(e),
                "key_functions": [],
                "key_classes": [],
                "imports": {"stdlib": [], "third_party": [], "local": []},
                "exports": [],
                "local_dependencies": [],
            }

    # ── Populate context ──────────────────────────────────────────────────────
    ctx.file_summaries = summaries

    # Build project-level map from summaries
    ctx.project_map = _build_project_map(summaries, ctx)

    yield {
        "type": "stage1_complete",
        "content": (
            f"✅ Stage 1 complete — {len(summaries)} files summarized "
            f"({cache_hits} cached, {cache_misses} via Gemini"
            + (f", {len(errors)} errors" if errors else "")
            + ")"
        ),
        "summaries_count": len(summaries),
        "cache_hits": cache_hits,
        "errors": errors,
    }


def _build_project_map(summaries: Dict[str, dict], ctx: RepoContext) -> dict:
    """Aggregate file summaries into a project-level map."""
    languages = {}
    all_external_apis = set()
    all_local_deps = []

    for rel_path, s in summaries.items():
        lang = s.get("language", "unknown")
        languages[lang] = languages.get(lang, 0) + 1

        for api in s.get("external_apis", []):
            all_external_apis.add(api)

        for dep in s.get("local_dependencies", []):
            all_local_deps.append({"from": rel_path, "to": dep})

    return {
        "project_root": ctx.project_root,
        "total_files": ctx.total_files,
        "read_files": ctx.read_files,
        "language_breakdown": languages,
        "external_apis": list(all_external_apis),
        "dependency_edges_count": len(all_local_deps),
        "file_count": len(summaries),
    }
