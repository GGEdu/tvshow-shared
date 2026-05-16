"""LLM gateway client — used by reconciler / matcher / future agents.

Provider-agnostic wrapper around chat completions. Three providers supported
out of the box: 'litellm' (recommended — shared gateway), 'anthropic' (direct),
'openrouter' (direct). All three return JSON dicts; the prompt is responsible
for instructing the model to emit JSON.
"""

from tvshow_common.llm.client import LLMClient, LLMError

__all__ = ["LLMClient", "LLMError"]
