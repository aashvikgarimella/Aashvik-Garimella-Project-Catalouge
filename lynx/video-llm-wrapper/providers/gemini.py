"""Gemini adapter: uploads the video file itself — native video + audio understanding."""

from __future__ import annotations

import os
import time

from providers.base import VideoProvider

DEFAULT_MODEL = "gemini-2.5-flash"
UPLOAD_TIMEOUT_S = 300


class GeminiProvider(VideoProvider):
    id = "gemini"
    name = "Gemini (Google)"
    method = "Native video upload — model sees full video and hears the audio"

    def available(self) -> bool:
        return bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))

    def analyze(self, video_path: str, prompt: str) -> str:
        from google import genai  # imported lazily so the app runs without the key

        client = genai.Client()
        model = os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)

        video_file = client.files.upload(file=video_path)
        try:
            deadline = time.monotonic() + UPLOAD_TIMEOUT_S
            while video_file.state and video_file.state.name == "PROCESSING":
                if time.monotonic() > deadline:
                    raise RuntimeError("Timed out waiting for Gemini to process the video")
                time.sleep(2)
                video_file = client.files.get(name=video_file.name)
            if video_file.state and video_file.state.name == "FAILED":
                raise RuntimeError("Gemini failed to process the uploaded video")

            response = client.models.generate_content(
                model=model,
                contents=[video_file, prompt],
            )
            if not response.text:
                raise RuntimeError("Gemini returned an empty response")
            return response.text
        finally:
            try:
                client.files.delete(name=video_file.name)
            except Exception:
                pass  # cleanup is best-effort; files auto-expire in 48h
