"""llm.py — Compatibility shim for existing agent code.

All specialist agents call ask_llm_streaming(messages, temperature, max_tokens).
This shim routes those calls through the 3-stage pipeline orchestrator so agents
get the full Gemini → OpenRouter → Groq treatment without any code changes.

For simple direct LLM calls (e.g. tests), use the provider clients directly.
"""

from __future__ import annotations

import logging
from typing import AsyncGenerator, List, Optional

logger = logging.getLogger(__name__)


async def ask_llm_streaming(
    messages: List[dict],
    temperature: float = 0.25,
    max_tokens: int = 8192,
    model: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """Stream text chunks from Groq (Stage 3 only) for direct agent use.

    This is used by agents that already have their own context-building and
    just need to stream a response from the best available model.

    For the full 3-stage pipeline, agents should call pipeline.orchestrator.run_pipeline().
    """
    from providers.groq_client import get_groq_client
    from config import GROQ_MODEL

    client = get_groq_client()
    target_model = model or GROQ_MODEL

    try:
        async for chunk in client.stream(
            messages=messages,
            model=target_model,
            temperature=temperature,
            max_tokens=max_tokens,
        ):
            yield chunk
    except Exception as e:
        logger.error(f"ask_llm_streaming error: {e}")
        # Try OpenRouter as fallback
        try:
            from providers.openrouter_client import get_openrouter_client
            from config import OPENROUTER_MODEL
            or_client = get_openrouter_client()
            async for chunk in or_client.stream(
                model=OPENROUTER_MODEL,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            ):
                yield chunk
        except Exception as e2:
            logger.error(f"ask_llm_streaming fallback also failed: {e2}")
            yield f"\n\n[Error: LLM unavailable — Groq: {e} | OpenRouter fallback: {e2}]"
