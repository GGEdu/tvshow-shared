"""Provider-agnostic LLM client for JSON-mode chat completions.

Three providers supported:

  - 'litellm' (recommended): calls the shared LiteLLM gateway. Centralises
    provider credentials, observability, retries, and failover.

  - 'anthropic': calls https://api.anthropic.com/v1/messages directly using
    `ANTHROPIC_API_KEY`. Native messages API.

  - 'openrouter': calls https://openrouter.ai/api/v1/chat/completions using
    `OPENROUTER_API_KEY`. OpenAI-compatible payload.

All three return a parsed JSON dict. The prompt must instruct the model to
emit JSON; we strip ```json/``` fences if present.

Design notes:
  - No coupling to any application's `settings`. The constructor takes
    explicit args; callers wire them from their own config.
  - httpx-direct instead of provider SDKs — fewer deps, easier to mock.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# Strip leading ```json ... ``` and trailing ``` if the model wrapped its JSON.
_FENCE_RE = re.compile(r"^```(?:json)?\s*([\s\S]*?)\s*```\s*$", re.MULTILINE)


class LLMError(Exception):
    """Raised when the LLM call fails or returns invalid JSON."""


class LLMClient:
    """Single-turn chat client that returns parsed JSON."""

    def __init__(
        self,
        *,
        provider: str,
        api_key: str,
        model: str,
        base_url: str | None = None,
        timeout_seconds: float = 30.0,
        # Optional analytics headers — only consumed by openrouter / litellm
        referer: str | None = None,
        title: str | None = None,
    ) -> None:
        self.provider = provider.lower()
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.referer = referer
        self.title = title

        if self.provider == "litellm":
            if not base_url:
                raise ValueError("base_url is required for provider='litellm'")
            self.endpoint = base_url.rstrip("/") + "/v1/chat/completions"
        elif self.provider == "anthropic":
            self.endpoint = "https://api.anthropic.com/v1/messages"
        elif self.provider == "openrouter":
            self.endpoint = "https://openrouter.ai/api/v1/chat/completions"
        else:
            raise ValueError(
                f"Unknown provider='{self.provider}' "
                "(must be 'litellm', 'anthropic' or 'openrouter')"
            )

    def is_configured(self) -> bool:
        """True when an API key is set."""
        return bool(self.api_key)

    async def complete_json(
        self,
        *,
        system: str,
        user: str,
        max_tokens: int = 1024,
        temperature: float = 0.0,
    ) -> dict[str, Any]:
        """Send a single-turn message and return parsed JSON.

        Raises LLMError on transport error, HTTP error, or unparseable JSON.
        Callers should catch this and degrade to a safe default.
        """
        if not self.is_configured():
            raise LLMError(
                f"LLM provider '{self.provider}' has no API key configured"
            )

        body, headers = self._build_request(
            system=system, user=user, max_tokens=max_tokens, temperature=temperature
        )

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                resp = await client.post(self.endpoint, json=body, headers=headers)
                resp.raise_for_status()
                payload = resp.json()
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "LLM HTTP error (status=%s): %s",
                exc.response.status_code,
                exc.response.text[:500],
            )
            raise LLMError(f"LLM HTTP {exc.response.status_code}") from exc
        except httpx.HTTPError as exc:
            logger.warning("LLM network error: %s", exc)
            raise LLMError(f"LLM network error: {exc}") from exc

        text = self._extract_text(payload)
        return self._parse_json(text)

    # ─── Internals ──────────────────────────────────────────────────────

    def _build_request(
        self, *, system: str, user: str, max_tokens: int, temperature: float
    ) -> tuple[dict, dict]:
        if self.provider == "anthropic":
            body = {
                "model": self.model,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "system": system,
                "messages": [{"role": "user", "content": user}],
            }
            headers = {
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            }
            return body, headers

        # litellm + openrouter share the OpenAI-compatible chat/completions shape
        body = {
            "model": self.model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "content-type": "application/json",
        }
        if self.provider == "openrouter":
            if self.referer:
                headers["HTTP-Referer"] = self.referer
            if self.title:
                headers["X-Title"] = self.title
        elif self.provider == "litellm" and self.title:
            headers["X-Title"] = self.title
        return body, headers

    @staticmethod
    def _extract_text(payload: dict) -> str:
        """Pluck the assistant's text from either provider's response shape."""
        # Anthropic: { content: [{ type: "text", text: "..." }, ...] }
        if "content" in payload and isinstance(payload["content"], list):
            parts = [
                p.get("text", "")
                for p in payload["content"]
                if p.get("type") == "text"
            ]
            return "\n".join(parts).strip()
        # OpenRouter / LiteLLM / OpenAI: { choices: [{ message: { content: "..." } }] }
        if "choices" in payload and payload["choices"]:
            return (payload["choices"][0].get("message") or {}).get("content", "").strip()
        return ""

    @staticmethod
    def _parse_json(text: str) -> dict[str, Any]:
        """Strip code fences, then json.loads. Raise LLMError on failure."""
        if not text:
            raise LLMError("LLM returned empty text")

        candidate = text
        match = _FENCE_RE.match(text)
        if match:
            candidate = match.group(1)

        try:
            data = json.loads(candidate)
        except json.JSONDecodeError as exc:
            logger.warning("LLM JSON parse failed: %s — text=%s", exc, text[:500])
            raise LLMError(f"LLM JSON parse failed: {exc}") from exc

        if not isinstance(data, dict):
            raise LLMError(f"LLM returned non-object JSON: {type(data).__name__}")
        return data
