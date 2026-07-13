# VideoLens

A local web app that lets any LLM analyze video. Drop in a video and either:

- **Summarize** — get the gist, a timeline, and key takeaways
- **Answer questions** — paste a list of questions; each is answered from the recording with timestamps
- **Extract recipe** — turn a cooking video into a structured recipe (ingredients, steps, tips)

## Providers

The LLM backend is pluggable (`providers/`). Two ship out of the box:

| Provider | How it sees the video |
|---|---|
| **Gemini** | Uploads the video file natively — full motion **and audio**. Best for recipes and talking-head videos. |
| **Claude** | Samples evenly-spaced keyframes with ffmpeg and sends them as vision input (visuals only, no audio). |

To add another LLM: subclass `VideoProvider` in `providers/base.py` and register it in `providers/__init__.py` (~50 lines — reuse `processing.extract_frames` for any vision-only model).

## Setup

Requires `ffmpeg` on PATH (already installed via Homebrew).

```sh
cd ~/Documents/CODE/video-llm-wrapper
python3 -m venv .venv                # already done
./.venv/bin/pip install -r requirements.txt   # already done
cp .env.example .env                 # then paste in your API key(s)
```

You only need **one** key:
- `GEMINI_API_KEY` — free at https://aistudio.google.com/apikey
- `ANTHROPIC_API_KEY` — https://console.anthropic.com/

## Run — web app

```sh
./.venv/bin/uvicorn server:app --port 8321
```

Open http://127.0.0.1:8321 — drop a video, pick a job, pick a model, hit **Analyze video**. Analysis takes ~30 s to a few minutes depending on video length; a timecode counter runs while it works.

## Run — command line

```sh
# summarize (default mode, auto-picks the first provider with a key)
./.venv/bin/python main.py path/to/video.mp4

# extract a recipe
./.venv/bin/python main.py cooking.mp4 --mode recipe

# answer questions (repeat -q, or --questions-file questions.txt)
./.venv/bin/python main.py demo.mov -q "What app is shown?" -q "What happens at the end?"

# force a specific provider
./.venv/bin/python main.py video.mp4 --provider claude
```

The answer prints to stdout (progress goes to stderr), so you can pipe it: `... main.py video.mp4 > summary.md`.

## Notes

- Uploads are written to a temp file, analyzed, then deleted. Gemini uploads are deleted from Google's Files API after each request (they'd auto-expire in 48 h anyway).
- Model overrides: set `ANTHROPIC_MODEL` / `GEMINI_MODEL` in `.env`.
- Frame sampling (Claude path): ~1 frame per 15 s, between 4 and 20 frames, scaled to ≤1024 px wide — tune in `processing.py`.
