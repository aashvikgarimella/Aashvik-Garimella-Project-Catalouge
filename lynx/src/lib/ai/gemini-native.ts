/**
 * Native Gemini endpoint (NOT the OpenAI-compat adapter) — the web twin of the
 * iOS app's AIService.swift. Native gets us what the adapter can't:
 * `google_search` + `url_context` tools (browse the web, read links) and
 * `fileData` video parts (watch uploaded videos and YouTube links).
 */
import { getGeminiApiKey } from "./config";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { safeFetch } from "@/lib/net/safe-fetch";

const API_BASE = "https://generativelanguage.googleapis.com";
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // matches the iOS client cap

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type InlineImage = { data: string; mediaType: string };
export type VideoRef =
  | { kind: "youtube"; label: string; url: string }
  | { kind: "upload"; label: string; url: string; mime: string };

type FilePart = { label: string; fileUri: string; mimeType?: string };

// Gemini file uris stay valid for 48h; cache per storage URL so repeat questions
// about the same video don't re-upload it. (Module-level: survives within a
// server instance, resets on redeploy — worst case we re-upload.)
const fileCache = new Map<string, { uri: string; expires: number }>();

/** Download a note video from our storage and push it to Gemini's Files API. */
async function uploadVideoFile(v: Extract<VideoRef, { kind: "upload" }>): Promise<FilePart> {
  const cached = fileCache.get(v.url);
  if (cached && cached.expires > Date.now()) {
    return { label: v.label, fileUri: cached.uri, mimeType: v.mime };
  }

  const storageHost = new URL(getSupabaseEnv().url).hostname;
  const res = await safeFetch(v.url, { timeoutMs: 60_000, allowHosts: [storageHost] });
  if (!res || !res.ok) throw new Error(`Couldn't read ${v.label} from storage.`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length === 0) throw new Error(`${v.label} is empty.`);
  if (bytes.length > MAX_VIDEO_BYTES) {
    throw new Error(`${v.label} is too large for AI analysis — keep it under 200 MB.`);
  }

  const key = getGeminiApiKey()!;

  // 1. Start a resumable upload session.
  const start = await fetch(`${API_BASE}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": key,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.length),
      "X-Goog-Upload-Header-Content-Type": v.mime,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: v.label } }),
  });
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!start.ok || !uploadUrl) throw new Error(`Couldn't start the upload for ${v.label}.`);

  // 2. Upload the bytes and finalize in one shot.
  const up = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.length),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });
  const upJson = (await up.json().catch(() => null)) as {
    file?: { name?: string; uri?: string; state?: string };
  } | null;
  const file = upJson?.file;
  if (!up.ok || !file?.name || !file?.uri) throw new Error(`The upload failed for ${v.label}.`);

  // 3. Poll until the file finishes processing (ACTIVE) or fails.
  let state = file.state ?? "PROCESSING";
  for (let i = 0; state === "PROCESSING" && i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const check = await fetch(`${API_BASE}/v1beta/${file.name}`, {
      headers: { "x-goog-api-key": key },
    });
    const j = (await check.json().catch(() => null)) as { state?: string } | null;
    state = j?.state ?? state;
  }
  if (state === "FAILED") throw new Error(`Gemini couldn't process ${v.label}.`);
  if (state === "PROCESSING") throw new Error(`Timed out preparing ${v.label}. Try a shorter clip.`);

  fileCache.set(v.url, { uri: file.uri, expires: Date.now() + 40 * 60 * 60 * 1000 });
  return { label: v.label, fileUri: file.uri, mimeType: v.mime };
}

/** Resolve all video refs to Gemini parts (YouTube passes straight through). */
export async function prepareVideos(videos: VideoRef[]): Promise<FilePart[]> {
  const parts: FilePart[] = [];
  for (const v of videos) {
    if (v.kind === "youtube") parts.push({ label: v.label, fileUri: v.url });
    else parts.push(await uploadVideoFile(v));
  }
  return parts;
}

/**
 * Stream a completion from the native Gemini endpoint with web tools enabled.
 * Labeled video parts are attached to the latest user turn, so the model can
 * watch them and the user can refer to them by position ("the first video").
 * Retries 429/503 with progressive backoff, like the iOS client.
 */
export async function* streamGeminiNative(opts: {
  model: string;
  system: string;
  history: ChatTurn[];
  videos?: VideoRef[];
  images?: InlineImage[];
}): AsyncGenerator<string> {
  const parts = opts.videos?.length ? await prepareVideos(opts.videos) : [];

  type Part = Record<string, unknown>;
  const contents: { role: string; parts: Part[] }[] = opts.history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  if (parts.length || opts.images?.length) {
    const lastUser = contents.map((c) => c.role).lastIndexOf("user");
    if (lastUser >= 0) {
      const prefix: Part[] = parts.flatMap((p) => [
        { text: `${p.label}:` },
        { fileData: p.mimeType ? { fileUri: p.fileUri, mimeType: p.mimeType } : { fileUri: p.fileUri } },
      ]);
      const imgs: Part[] = (opts.images ?? []).map((img) => ({
        inlineData: { mimeType: img.mediaType, data: img.data },
      }));
      contents[lastUser].parts = [...prefix, ...imgs, ...contents[lastUser].parts];
    }
  }

  const body = {
    contents,
    systemInstruction: { parts: [{ text: opts.system }] },
    // google_search: browse the web; url_context: read the content of any URL
    // in the prompt (news, YouTube, etc.) — same tools as the iOS app.
    tools: [{ google_search: {} }, { url_context: {} }],
  };

  const url = `${API_BASE}/v1beta/models/${opts.model}:streamGenerateContent?alt=sse`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-goog-api-key": getGeminiApiKey()!, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.status === 429 || res.status === 503) {
      if (attempt < 4) {
        await new Promise((r) => setTimeout(r, attempt * 2000));
        continue;
      }
      throw new Error(
        res.status === 429
          ? "You've hit the AI usage limit for now. Wait a minute and try again."
          : "The AI is busy right now — try again in a moment.",
      );
    }
    if (!res.ok || !res.body) {
      const err = (await res.text().catch(() => "")).slice(0, 300);
      throw new Error(`AI request failed (${res.status}). ${err}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const chunk = line.slice(5).trim();
        if (!chunk || chunk === "[DONE]") continue;
        try {
          const json = JSON.parse(chunk) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          for (const p of json.candidates?.[0]?.content?.parts ?? []) {
            if (p.text) yield p.text;
          }
        } catch {
          /* partial/keepalive chunk — skip */
        }
      }
    }
    return;
  }
}
