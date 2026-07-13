"""Command-line entry point for VideoLens — test the wrapper without the web UI.

Examples:
    ./.venv/bin/python main.py ~/Documents/CreateTaskVideo.mov
    ./.venv/bin/python main.py video.mp4 --mode recipe
    ./.venv/bin/python main.py video.mp4 --mode questions -q "What app is shown?" -q "What happens at the end?"
    ./.venv/bin/python main.py video.mp4 --provider claude
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from prompts import build_prompt  # noqa: E402
from providers import REGISTRY, list_providers  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="videolens",
        description="Analyze a video with an LLM: summarize it, answer questions about it, or extract a recipe.",
    )
    parser.add_argument("video", help="path to the video file (mp4, mov, webm, ...)")
    parser.add_argument(
        "--mode", "-m",
        choices=["summarize", "questions", "recipe"],
        default="summarize",
        help="what to do with the video (default: summarize)",
    )
    parser.add_argument(
        "--question", "-q",
        action="append",
        default=[],
        metavar="TEXT",
        help="a question to answer (repeat for multiple; implies --mode questions)",
    )
    parser.add_argument(
        "--questions-file",
        metavar="FILE",
        help="file with one question per line (implies --mode questions)",
    )
    parser.add_argument(
        "--provider", "-p",
        choices=sorted(REGISTRY),
        help="which LLM to use (default: first one with an API key configured)",
    )
    args = parser.parse_args()

    video = Path(args.video).expanduser()
    if not video.is_file():
        parser.error(f"video not found: {video}")

    questions = list(args.question)
    if args.questions_file:
        questions += [q for q in Path(args.questions_file).expanduser().read_text().splitlines() if q.strip()]
    mode = "questions" if questions else args.mode
    if mode == "questions" and not questions:
        parser.error("--mode questions needs -q/--question or --questions-file")

    if args.provider:
        provider = REGISTRY[args.provider]
        if not provider.available():
            parser.error(f"{provider.name} has no API key configured — add it to .env")
    else:
        provider = next((REGISTRY[p["id"]] for p in list_providers() if p["available"]), None)
        if provider is None:
            parser.error("no provider has an API key — set GEMINI_API_KEY or ANTHROPIC_API_KEY in .env")

    prompt = build_prompt(mode, "\n".join(questions))

    print(f"video    : {video.name}", file=sys.stderr)
    print(f"mode     : {mode}", file=sys.stderr)
    print(f"provider : {provider.name}", file=sys.stderr)
    print(f"method   : {provider.method}", file=sys.stderr)
    print("analyzing… (this can take 30s–3min)\n", file=sys.stderr)

    start = time.monotonic()
    try:
        result = provider.analyze(str(video), prompt)
    except Exception as e:
        print(f"error: {e}", file=sys.stderr)
        return 1

    print(result)
    print(f"\n[done in {time.monotonic() - start:.0f}s]", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
