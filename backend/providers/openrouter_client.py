"""providers/openrouter_client.py — Async OpenRouter HTTP client with streaming.

Used for:
  - Stage 1: Gemini model (large-context file reading & summarization)
  - Stage 2: Non-Gemini model (cross-file reasoning & analysis)

Both stages go through OpenRouter using the same client, just with different model names.
"""

from __future__ import annotations

import json
import logging
from typing import AsyncGenerator, List, Optional

import httpx

from config import OPENROUTER_API_KEY, OPENROUTER_BASE_URL

logger = logging.getLogger(__name__)

# HTTP timeout settings
_CONNECT_TIMEOUT = 15.0   # seconds
_READ_TIMEOUT = 120.0     # seconds (LLM responses can be slow)

# OpenRouter-specific headers (for model routing quality)
_EXTRA_HEADERS = {
    "HTTP-Referer": "https://github.com/gitai-agent",
    "X-Title": "GitAI Coding Agent",
}


class OpenRouterClient:
    """Async HTTP client for OpenRouter API with streaming support."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        self.api_key = api_key or OPENROUTER_API_KEY
        self.base_url = (base_url or OPENROUTER_BASE_URL).rstrip("/")

        if not self.api_key:
            raise EnvironmentError(
                "OPENROUTER_API_KEY is not set. "
                "Please add it to backend/.env"
            )

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            **_EXTRA_HEADERS,
        }

    async def complete(
        self,
        model: str,
        messages: List[dict],
        temperature: float = 0.2,
        max_tokens: int = 4096,
        stream: bool = False,
    ) -> str:
        """Non-streaming completion. Returns the full response text."""
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(_READ_TIMEOUT, connect=_CONNECT_TIMEOUT)
        ) as client:
            try:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self._headers(),
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]

            except httpx.HTTPStatusError as e:
                body = e.response.text[:500]
                raise RuntimeError(
                    f"OpenRouter API error {e.response.status_code} "
                    f"for model {model}: {body}"
                ) from e
            except (httpx.RequestError, KeyError) as e:
                raise RuntimeError(
                    f"OpenRouter request failed for model {model}: {e}"
                ) from e

    async def stream(
        self,
        model: str,
        messages: List[dict],
        temperature: float = 0.2,
        max_tokens: int = 4096,
    ) -> AsyncGenerator[str, None]:
        """Streaming completion. Yields text chunks as they arrive via SSE."""
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(_READ_TIMEOUT, connect=_CONNECT_TIMEOUT)
        ) as client:
            try:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    headers=self._headers(),
                    json=payload,
                ) as resp:
                    resp.raise_for_status()
                    async for raw_line in resp.aiter_lines():
                        line = raw_line.strip()
                        if not line or line == "data: [DONE]":
                            continue
                        if line.startswith("data: "):
                            json_str = line[len("data: "):]
                            try:
                                chunk_data = json.loads(json_str)
                                delta = chunk_data["choices"][0]["delta"]
                                text = delta.get("content", "")
                                if text:
                                    yield text
                            except (json.JSONDecodeError, KeyError, IndexError):
                                continue

            except httpx.HTTPStatusError as e:
                body = e.response.text[:500]
                raise RuntimeError(
                    f"OpenRouter streaming error {e.response.status_code} "
                    f"for model {model}: {body}"
                ) from e
            except httpx.RequestError as e:
                raise RuntimeError(
                    f"OpenRouter connection failed for model {model}: {e}"
                ) from e

    async def complete_json(
        self,
        model: str,
        messages: List[dict],
        temperature: float = 0.1,
        max_tokens: int = 4096,
    ) -> dict:
        """Non-streaming completion that parses the response as JSON.

        Tries to extract a JSON object from the response even if there
        is surrounding markdown or text.
        """
        raw = await self.complete(model, messages, temperature, max_tokens)
        return _extract_json(raw, context=f"OpenRouter({model})")

    async def health_check(self, model: str = "openai/gpt-3.5-turbo") -> dict:
        """Validate API key with a minimal test call."""
        try:
            result = await self.complete(
                model=model,
                messages=[{"role": "user", "content": "Say OK"}],
                max_tokens=5,
                temperature=0,
            )
            return {"status": "ok", "model": model, "response": result[:20]}
        except Exception as e:
            return {"status": "error", "model": model, "error": str(e)[:200]}


def _extract_json(text: str, context: str = "") -> dict:
    """Try to extract a JSON dict from LLM output.

    Handles cases where the model wraps JSON in markdown code fences.
    """
    # Try direct parse first
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to extract from ```json ... ``` block
    import re
    json_block = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if json_block:
        try:
            return json.loads(json_block.group(1))
        except json.JSONDecodeError:
            pass

    # Try to find the first { ... } span
    brace_match = re.search(r"\{.*\}", text, re.DOTALL)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except json.JSONDecodeError:
            pass

    # Return the raw text wrapped in a dict as a fallback
    logger.warning(f"{context}: Could not parse JSON from response, returning raw.")
    return {"raw_response": text, "parse_error": True}


# ── Module-level singleton ────────────────────────────────────────────────────

_client: Optional[OpenRouterClient] = None


def get_openrouter_client() -> OpenRouterClient:
    """Return the module-level OpenRouterClient singleton."""
    global _client
    if _client is None:
        _client = OpenRouterClient()
    return _client
