"""providers/groq_client.py — Async Groq client for Stage 3 final answer synthesis.

Uses httpx directly (OpenAI-compatible REST API) for full async streaming support.
Groq is optimized for low-latency inference; used only in Stage 3.
"""

from __future__ import annotations

import json
import logging
from typing import AsyncGenerator, List, Optional

import httpx

from config import GROQ_API_KEY, GROQ_BASE_URL, GROQ_MODEL

logger = logging.getLogger(__name__)

_CONNECT_TIMEOUT = 10.0
_READ_TIMEOUT = 90.0


class GroqClient:
    """Async client for Groq's OpenAI-compatible API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        default_model: Optional[str] = None,
    ):
        self.api_key = api_key or GROQ_API_KEY
        self.base_url = (base_url or GROQ_BASE_URL).rstrip("/")
        self.default_model = default_model or GROQ_MODEL

        if not self.api_key:
            raise EnvironmentError(
                "GROQ_API_KEY is not set. "
                "Please add it to backend/.env"
            )

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def complete(
        self,
        messages: List[dict],
        model: Optional[str] = None,
        temperature: float = 0.25,
        max_tokens: int = 8192,
        top_p: float = 0.95,
    ) -> str:
        """Non-streaming completion. Returns the full response text."""
        payload = {
            "model": model or self.default_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": top_p,
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
                    f"Groq API error {e.response.status_code}: {body}"
                ) from e
            except (httpx.RequestError, KeyError) as e:
                raise RuntimeError(f"Groq request failed: {e}") from e

    async def stream(
        self,
        messages: List[dict],
        model: Optional[str] = None,
        temperature: float = 0.25,
        max_tokens: int = 8192,
        top_p: float = 0.95,
    ) -> AsyncGenerator[str, None]:
        """Streaming completion. Yields text delta chunks as they arrive."""
        payload = {
            "model": model or self.default_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": top_p,
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
                    # Don't use raise_for_status() on streaming responses —
                    # it crashes httpx because the body hasn't been read yet.
                    if resp.status_code >= 400:
                        body = (await resp.aread()).decode("utf-8", errors="replace")[:500]
                        raise RuntimeError(
                            f"Groq streaming error {resp.status_code}: {body}"
                        )
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

            except RuntimeError:
                raise  # re-raise our own RuntimeError from above
            except httpx.RequestError as e:
                raise RuntimeError(f"Groq connection failed: {e}") from e


    async def health_check(self) -> dict:
        """Validate API key with a minimal test call."""
        try:
            result = await self.complete(
                messages=[{"role": "user", "content": "Say OK"}],
                max_tokens=5,
                temperature=0,
            )
            return {"status": "ok", "model": self.default_model, "response": result[:20]}
        except Exception as e:
            return {"status": "error", "model": self.default_model, "error": str(e)[:200]}


# ── Module-level singleton ────────────────────────────────────────────────────

_client: Optional[GroqClient] = None


def get_groq_client() -> GroqClient:
    """Return the module-level GroqClient singleton."""
    global _client
    if _client is None:
        _client = GroqClient()
    return _client
