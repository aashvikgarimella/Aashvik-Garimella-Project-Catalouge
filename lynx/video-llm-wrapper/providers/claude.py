"""Claude adapter: samples keyframes with ffmpeg and sends them as vision input.

Claude doesn't ingest video files directly, so we extract evenly-spaced
frames (with timestamps) and let the model reason over the visual sequence.
"""

from __future__ import annotations

import os

import anthropic

from processing import extract_frames
from providers.base import VideoProvider

DEFAULT_MODEL = "claude-opus-4-8"


class ClaudeProvider(VideoProvider):
    id = "claude"
    name = "Claude (Anthropic)"
    method = "Keyframes sampled with ffmpeg (visuals only — no audio track)"

    def available(self) -> bool:
        return bool(os.environ.get("ANTHROPIC_API_KEY"))

    def analyze(self, video_path: str, prompt: str) -> str:
        client = anthropic.Anthropic()
        model = os.environ.get("ANTHROPIC_MODEL", DEFAULT_MODEL)
        frames = extract_frames(video_path)

        content: list[dict] = []
        for i, frame in enumerate(frames, start=1):
            content.append({
                "type": "text",
                "text": f"Frame {i}/{len(frames)} — timestamp {frame.label}:",
            })
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": frame.jpeg_b64,
                },
            })
        content.append({
            "type": "text",
            "text": (
                "The images above are evenly-spaced frames from a video, in "
                "chronological order with their timestamps. You do not have "
                "the audio track, so rely on visual evidence (including any "
                "on-screen text).\n\n" + prompt
            ),
        })

        with client.messages.stream(
            model=model,
            max_tokens=16000,
            thinking={"type": "adaptive"},
            messages=[{"role": "user", "content": content}],
        ) as stream:
            message = stream.get_final_message()

        if message.stop_reason == "refusal":
            raise RuntimeError("Claude declined to analyze this video.")
        return "".join(b.text for b in message.content if b.type == "text")
