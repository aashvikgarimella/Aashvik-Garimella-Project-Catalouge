import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { getProfile } from "@/lib/data/profile";
import {
  isAiConfigured,
  resolveProvider,
  getModelForProvider,
  getOpenAiApiKey,
  getAnthropicApiKey,
} from "@/lib/ai/config";
import { buildChatSystem, type ChatMessage } from "@/lib/ai/chat";
import { streamGeminiNative, type VideoRef } from "@/lib/ai/gemini-native";
import { fetchPreview } from "@/lib/links/fetch-preview";
import { logAiActivity } from "@/lib/ai/log";
import { overHourlyLimit } from "@/lib/ai/limit";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { safeFetch } from "@/lib/net/safe-fetch";

/** Fetch previews for URLs in the note so the AI knows linked pages/videos. */
async function enrichLinks(noteText: string, system: string): Promise<string> {
  const urls = Array.from(
    new Set(noteText.match(/https?:\/\/[^\s)\]]+/g) ?? []),
  ).slice(0, 3);
  if (urls.length === 0) return system;
  const previews = await Promise.all(urls.map((u) => fetchPreview(u).catch(() => null)));
  const lines = previews
    .filter((p): p is NonNullable<typeof p> => !!p && !!(p.title || p.description))
    .map((p) => `- ${p.title || p.url}${p.description ? `: ${p.description}` : ""} (${p.url})`);
  if (lines.length === 0) return system;
  return `${system}\n\nLinked content in this note (pages/videos):\n${lines.join("\n")}`;
}

type Img = { data: string; mediaType: string };

async function fetchImageBase64(url: string): Promise<Img | null> {
  try {
    // SSRF guard: private/internal hosts are blocked; our own storage is always allowed.
    const storageHost = new URL(getSupabaseEnv().url).hostname;
    const res = await safeFetch(url, { timeoutMs: 8000, allowHosts: [storageHost] });
    if (!res || !res.ok) return null;
    const mediaType = res.headers.get("content-type") || "image/png";
    if (!mediaType.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 5 * 1024 * 1024) return null;
    return { data: buf.toString("base64"), mediaType };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    history?: ChatMessage[];
    noteText?: string;
    noteId?: string | null;
    imageUrls?: string[];
    videos?: VideoRef[];
  };
  // Cap all client-controlled inputs: message count, message size, note size, media counts.
  const history = (body.history ?? [])
    .slice(-20)
    .map((m) => ({ ...m, content: (m.content ?? "").slice(0, 8_000) }));
  const noteText = (body.noteText ?? "").slice(0, 24_000);
  const noteId = body.noteId ?? null;
  const imageUrls = (body.imageUrls ?? []).slice(0, 4);
  const videos = (body.videos ?? []).slice(0, 3);

  const profile = await getProfile();
  if (!profile) return new Response("Not signed in.", { status: 401 });
  if (!profile.ai_enabled) return new Response("AI is off. Enable it in Settings.", { status: 400 });
  if (!isAiConfigured()) return new Response("No AI key configured.", { status: 400 });
  if (await overHourlyLimit()) {
    return new Response("You've hit the hourly AI limit. Try again in a bit.", { status: 429 });
  }

  const provider = resolveProvider(profile.ai_provider);
  if (!provider) return new Response("No AI provider.", { status: 400 });
  const model = getModelForProvider(provider);

  // Only Gemini can watch videos; tell other providers what they're missing.
  const videoLabels = provider === "gemini" ? videos.map((v) => v.label) : [];
  let system = await enrichLinks(noteText, buildChatSystem(noteText, videoLabels));
  if (provider !== "gemini" && videos.length) {
    system += `\n\nThe note has ${videos.length} attached video(s), but the current AI provider can't watch videos — say so if asked about them (Gemini can).`;
  }

  const lastIdx = history.length - 1;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        if (provider === "gemini") {
          // Native endpoint: web tools (google_search + url_context) and video
          // understanding — full parity with the iOS app (+ note images kept).
          const images = (await Promise.all(imageUrls.map(fetchImageBase64))).filter(
            (x): x is Img => x !== null,
          );
          for await (const delta of streamGeminiNative({ model, system, history, videos, images })) {
            full += delta;
            controller.enqueue(encoder.encode(delta));
          }
        } else if (provider === "openai") {
          const client = new OpenAI({ apiKey: getOpenAiApiKey()! });
          const images = (await Promise.all(imageUrls.map(fetchImageBase64))).filter(
            (x): x is Img => x !== null,
          );
          const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: "system", content: system },
            ...history.map((m, i): OpenAI.Chat.Completions.ChatCompletionMessageParam => {
              if (i === lastIdx && m.role === "user" && images.length) {
                return {
                  role: "user",
                  content: [
                    { type: "text", text: m.content },
                    ...images.map((img) => ({
                      type: "image_url" as const,
                      image_url: { url: `data:${img.mediaType};base64,${img.data}` },
                    })),
                  ],
                };
              }
              return m;
            }),
          ];
          const completion = await client.chat.completions.create({
            model,
            max_tokens: 2048,
            stream: true,
            messages,
          });
          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta?.content ?? "";
            if (delta) {
              full += delta;
              controller.enqueue(encoder.encode(delta));
            }
          }
        } else {
          const client = new Anthropic({ apiKey: getAnthropicApiKey()! });
          const images = (await Promise.all(imageUrls.map(fetchImageBase64))).filter(
            (x): x is Img => x !== null,
          );
          const messages: Anthropic.MessageParam[] = history.map((m, i) => {
            if (i === lastIdx && m.role === "user" && images.length) {
              return {
                role: "user" as const,
                content: [
                  { type: "text" as const, text: m.content },
                  ...images.map((img) => ({
                    type: "image" as const,
                    source: {
                      type: "base64" as const,
                      media_type: img.mediaType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
                      data: img.data,
                    },
                  })),
                ],
              };
            }
            return { role: m.role, content: m.content };
          });
          const completion = client.messages.stream({ model, max_tokens: 2048, system, messages });
          for await (const event of completion) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              full += event.delta.text;
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
        }
      } catch (e) {
        const msg = e instanceof Error && e.message ? e.message : "AI request failed. Try again.";
        controller.enqueue(encoder.encode(`\n\n⚠️ ${msg}`));
      } finally {
        const lastUser = [...history].reverse().find((m) => m.role === "user");
        await logAiActivity({ noteId, action: "chat", input: lastUser?.content ?? "", output: full });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
