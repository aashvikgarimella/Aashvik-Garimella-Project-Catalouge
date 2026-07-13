"""Video pre-processing for providers that can't ingest video natively.

Uses ffmpeg/ffprobe (must be on PATH) to sample evenly-spaced keyframes
from a video file and return them as base64 JPEGs with timestamps.
"""

from __future__ import annotations

import base64
import json
import math
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

MAX_FRAMES = 20
MIN_FRAMES = 4
FRAME_MAX_WIDTH = 1024


@dataclass
class Frame:
    timestamp_s: float
    jpeg_b64: str

    @property
    def label(self) -> str:
        m, s = divmod(int(self.timestamp_s), 60)
        return f"{m:02d}:{s:02d}"


def probe_duration(video_path: str) -> float:
    """Return video duration in seconds via ffprobe."""
    out = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "json", video_path,
        ],
        capture_output=True, text=True, check=True,
    )
    return float(json.loads(out.stdout)["format"]["duration"])


def extract_frames(video_path: str, max_frames: int = MAX_FRAMES) -> list[Frame]:
    """Sample evenly-spaced frames across the whole video."""
    duration = probe_duration(video_path)
    # ~1 frame per 15s of video, clamped to [MIN_FRAMES, max_frames]
    n = max(MIN_FRAMES, min(max_frames, math.ceil(duration / 15)))
    timestamps = [duration * (i + 0.5) / n for i in range(n)]

    frames: list[Frame] = []
    with tempfile.TemporaryDirectory() as tmp:
        for i, ts in enumerate(timestamps):
            out_path = Path(tmp) / f"frame_{i:03d}.jpg"
            subprocess.run(
                [
                    "ffmpeg", "-v", "error", "-ss", f"{ts:.3f}",
                    "-i", video_path,
                    "-frames:v", "1",
                    "-vf", f"scale='min({FRAME_MAX_WIDTH},iw)':-2",
                    "-q:v", "4",
                    str(out_path),
                ],
                capture_output=True, check=True,
            )
            if out_path.exists():
                frames.append(Frame(ts, base64.standard_b64encode(out_path.read_bytes()).decode()))
    if not frames:
        raise RuntimeError("ffmpeg could not extract any frames from the video")
    return frames
