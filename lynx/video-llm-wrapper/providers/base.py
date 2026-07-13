"""Provider abstraction: implement analyze() to add a new LLM backend."""

from __future__ import annotations

from abc import ABC, abstractmethod


class VideoProvider(ABC):
    #: unique id used in the API/UI, e.g. "claude"
    id: str
    #: human-readable name, e.g. "Claude (Anthropic)"
    name: str
    #: one-line description of how this provider sees the video
    method: str

    @abstractmethod
    def available(self) -> bool:
        """True when the provider has credentials configured."""

    @abstractmethod
    def analyze(self, video_path: str, prompt: str) -> str:
        """Analyze the video at video_path per the prompt; return Markdown."""
