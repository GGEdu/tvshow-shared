"""Unit tests for tvshow_common.llm.client.LLMClient."""

from __future__ import annotations

import pytest

from tvshow_common.llm.client import LLMClient, LLMError


def test_anthropic_request_shape() -> None:
    client = LLMClient(
        provider="anthropic",
        api_key="test-key",
        model="claude-haiku-4-5-20251001",
    )
    body, headers = client._build_request(
        system="sys", user="usr", max_tokens=128, temperature=0.0
    )
    assert body["model"] == "claude-haiku-4-5-20251001"
    assert body["system"] == "sys"
    assert body["messages"] == [{"role": "user", "content": "usr"}]
    assert headers["x-api-key"] == "test-key"
    assert headers["anthropic-version"] == "2023-06-01"


def test_openrouter_request_shape() -> None:
    client = LLMClient(
        provider="openrouter",
        api_key="or-key",
        model="anthropic/claude-haiku-4.5",
        referer="https://example.com",
        title="MyApp",
    )
    body, headers = client._build_request(
        system="sys", user="usr", max_tokens=128, temperature=0.0
    )
    assert body["model"] == "anthropic/claude-haiku-4.5"
    assert body["messages"][0] == {"role": "system", "content": "sys"}
    assert body["messages"][1] == {"role": "user", "content": "usr"}
    assert headers["Authorization"] == "Bearer or-key"
    assert headers["HTTP-Referer"] == "https://example.com"
    assert headers["X-Title"] == "MyApp"


def test_litellm_request_shape() -> None:
    client = LLMClient(
        provider="litellm",
        api_key="sk-litellm-test",
        model="agent",
        base_url="http://192.168.1.18:4000",
        title="ReconcilerTest",
    )
    body, headers = client._build_request(
        system="sys", user="usr", max_tokens=128, temperature=0.0
    )
    assert body["model"] == "agent"
    assert body["messages"][0] == {"role": "system", "content": "sys"}
    assert headers["Authorization"] == "Bearer sk-litellm-test"
    assert client.endpoint == "http://192.168.1.18:4000/v1/chat/completions"
    assert "HTTP-Referer" not in headers
    assert headers["X-Title"] == "ReconcilerTest"


def test_litellm_requires_base_url() -> None:
    with pytest.raises(ValueError, match="base_url is required"):
        LLMClient(provider="litellm", api_key="x", model="agent")


def test_rejects_unknown_provider() -> None:
    with pytest.raises(ValueError, match="Unknown provider"):
        LLMClient(provider="bogus", api_key="x", model="m")


def test_parses_fenced_json() -> None:
    text = """```json
{"kind": "same_series", "target_tmdb_id": 65930, "confidence": 0.92}
```"""
    data = LLMClient._parse_json(text)
    assert data["kind"] == "same_series"
    assert data["target_tmdb_id"] == 65930


def test_parses_bare_json() -> None:
    text = '{"kind": "no_confident_match", "confidence": 0.3}'
    assert LLMClient._parse_json(text)["kind"] == "no_confident_match"


def test_rejects_empty_text() -> None:
    with pytest.raises(LLMError, match="empty"):
        LLMClient._parse_json("")


def test_rejects_invalid_json() -> None:
    with pytest.raises(LLMError, match="parse"):
        LLMClient._parse_json("not json")


def test_rejects_non_object_json() -> None:
    with pytest.raises(LLMError, match="non-object"):
        LLMClient._parse_json("[1, 2, 3]")


def test_extracts_anthropic_response() -> None:
    payload = {"content": [{"type": "text", "text": '{"kind": "same_series"}'}]}
    assert LLMClient._extract_text(payload) == '{"kind": "same_series"}'


def test_extracts_openai_compat_response() -> None:
    payload = {
        "choices": [{"message": {"content": '{"kind": "same_series"}'}}]
    }
    assert LLMClient._extract_text(payload) == '{"kind": "same_series"}'


def test_is_configured_reflects_api_key() -> None:
    has_key = LLMClient(provider="anthropic", api_key="x", model="m")
    no_key = LLMClient(provider="anthropic", api_key="", model="m")
    assert has_key.is_configured() is True
    assert no_key.is_configured() is False


async def test_complete_json_raises_when_unconfigured() -> None:
    client = LLMClient(provider="anthropic", api_key="", model="m")
    with pytest.raises(LLMError, match="no API key"):
        await client.complete_json(system="s", user="u")
