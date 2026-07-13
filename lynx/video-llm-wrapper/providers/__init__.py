"""Provider registry. To add a new LLM, subclass VideoProvider and list it here."""

from providers.base import VideoProvider
from providers.claude import ClaudeProvider
from providers.gemini import GeminiProvider

_PROVIDERS: list[VideoProvider] = [
    GeminiProvider(),
    ClaudeProvider(),
]

REGISTRY: dict[str, VideoProvider] = {p.id: p for p in _PROVIDERS}


def list_providers() -> list[dict]:
    return [
        {
            "id": p.id,
            "name": p.name,
            "method": p.method,
            "available": p.available(),
        }
        for p in _PROVIDERS
    ]
