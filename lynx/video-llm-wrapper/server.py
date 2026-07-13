"""VideoLens — analyze videos with any LLM.

Run:  ./.venv/bin/uvicorn server:app --port 8321
Then open http://127.0.0.1:8321
"""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from starlette.concurrency import run_in_threadpool

load_dotenv()

from prompts import build_prompt  # noqa: E402
from providers import REGISTRY, list_providers  # noqa: E402

app = FastAPI(title="VideoLens")

STATIC_DIR = Path(__file__).parent / "static"
ALLOWED_SUFFIXES = {".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v", ".mpg", ".mpeg"}
MAX_UPLOAD_BYTES = 500 * 1024 * 1024


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/providers")
def providers() -> JSONResponse:
    return JSONResponse(list_providers())


@app.post("/api/analyze")
async def analyze(
    file: UploadFile = File(...),
    mode: str = Form(...),
    provider: str = Form(...),
    questions: str = Form(""),
):
    prov = REGISTRY.get(provider)
    if prov is None:
        raise HTTPException(400, f"Unknown provider: {provider}")
    if not prov.available():
        raise HTTPException(400, f"{prov.name} has no API key configured — add it to .env")

    suffix = Path(file.filename or "video.mp4").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(400, f"Unsupported file type: {suffix or '(none)'}")

    try:
        prompt = build_prompt(mode, questions)
    except ValueError as e:
        raise HTTPException(400, str(e))

    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp_path = tmp.name
    try:
        written = 0
        while chunk := await file.read(1024 * 1024):
            written += len(chunk)
            if written > MAX_UPLOAD_BYTES:
                raise HTTPException(413, "Video exceeds the 500 MB upload limit")
            tmp.write(chunk)
        tmp.close()
        if written == 0:
            raise HTTPException(400, "Uploaded file is empty")

        try:
            result = await run_in_threadpool(prov.analyze, tmp_path, prompt)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(502, f"{prov.name} analysis failed: {e}")

        return JSONResponse({"provider": prov.name, "mode": mode, "result": result})
    finally:
        tmp.close()
        Path(tmp_path).unlink(missing_ok=True)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8321)
