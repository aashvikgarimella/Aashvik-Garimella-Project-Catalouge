"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Json } from "@/lib/database.types";
import { uploadNoteImage } from "@/lib/data/upload-image";
import {
  uploadNoteVideo,
  listNoteVideos,
  deleteNoteVideo,
  type NoteVideo,
  videoMime,
} from "@/lib/data/note-videos";
import { youtubeId } from "@/lib/links/parse-preview";
import { LinkPreview } from "./editor/link-preview-node";
import { NoteChat, type ChatVideo } from "./note-chat";

const EMPTY_DOC = { type: "doc", content: [] };

function isSingleUrl(text: string): boolean {
  return /^https?:\/\/\S+$/i.test(text.trim()) && !/\s/.test(text.trim());
}

function ToolBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-xl text-sm font-semibold transition-colors hover:opacity-70"
      style={{ color: "var(--text)" }}
    >
      {children}
    </button>
  );
}

// Minimal stroke icons (no emoji)
const I = {
  bullet: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" /></svg>
  ),
  ordered: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="10" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="10" y1="18" x2="20" y2="18" /><text x="2" y="9" fontSize="8" fill="currentColor" stroke="none">1</text><text x="2" y="20" fontSize="8" fill="currentColor" stroke="none">2</text></svg>
  ),
  task: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="7" height="7" rx="1.5" /><path d="M4.5 8.5l1.5 1.5 2.5-3" /><line x1="13" y1="7" x2="21" y2="7" /><line x1="13" y1="17" x2="21" y2="17" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg>
  ),
  image: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
  ),
};

export function NoteEditor({
  id,
  initialTitle,
  initialContent,
  aiEnabled = false,
}: {
  id: string;
  initialTitle: string;
  initialContent: Json;
  aiEnabled?: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  const [showFormat, setShowFormat] = useState(false);
  const titleRef = useRef(initialTitle);
  const editorRef = useRef<Editor | null>(null);
  const pendingRef = useRef<{ title: string; content: Json } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Video attachments (attachments table, like the iOS gallery)
  const [videos, setVideos] = useState<NoteVideo[]>([]);
  const [videoUploading, setVideoUploading] = useState(false);
  const [playing, setPlaying] = useState<NoteVideo | null>(null);

  // AI title suggestions
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const suggestAbort = useRef<AbortController | null>(null);

  // Capture the latest state and debounce a save. pendingRef always holds the
  // newest unsaved content so we can flush it on unmount (navigation).
  function markDirty() {
    const ed = editorRef.current;
    if (!ed) return;
    pendingRef.current = { title: titleRef.current, content: ed.getJSON() as Json };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  }

  // Persist via the HTTP route (NOT a server action — server-action arg
  // serialization silently drops nested node attrs like a link's url/image src).
  async function persist(p: { title: string; content: Json }) {
    await fetch("/api/notes/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title: p.title, content: p.content }),
    });
  }

  async function flush() {
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setSaving(true);
    await persist(p);
    setSaving(false);
  }

  function snapshot(): { title: string; content: Json } | null {
    const ed = editorRef.current;
    if (!ed) return null;
    return { title: titleRef.current, content: ed.getJSON() as Json };
  }

  // Reliable save that survives a page refresh/unload (server actions don't).
  function beaconSave(p: { title: string; content: Json }) {
    const payload = JSON.stringify({ id, title: p.title, content: p.content });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/notes/save", new Blob([payload], { type: "application/json" }));
    } else {
      void fetch("/api/notes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
    }
  }

  async function uploadAndInsert(file: File) {
    const ed = editorRef.current;
    if (!ed || !file.type.startsWith("image/")) return;
    const url = await uploadNoteImage(id, file);
    ed.chain().focus().setImage({ src: url }).run();
    const s = snapshot();
    if (s) beaconSave(s); // persist the image immediately, refresh-proof
    markDirty();
  }

  async function uploadVideo(file: File) {
    setVideoUploading(true);
    try {
      const vid = await uploadNoteVideo(id, file);
      setVideos((v) => [...v, vid]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Video upload failed.");
    } finally {
      setVideoUploading(false);
    }
  }

  /** Route a picked/dropped file to the right uploader. */
  function uploadMedia(file: File) {
    if (file.type.startsWith("video/")) return void uploadVideo(file);
    return void uploadAndInsert(file);
  }

  // Load existing video attachments (created here or on the phone).
  useEffect(() => {
    let alive = true;
    void listNoteVideos(id).then((v) => {
      if (alive) setVideos(v);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  /** Split streamed text into up to 3 cleaned title lines (strip numbering/bullets/quotes). */
  function parseTitles(raw: string): string[] {
    return raw
      .split("\n")
      .map((line) => line.trim().replace(/^\s*(?:[0-9]+[.)]|[-*•])\s*/, "").replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, ""))
      .filter((s) => s && !s.startsWith("⚠️"))
      .slice(0, 3);
  }

  /** Ask the AI for 3 concise title options and stream them into the card live. */
  async function suggestTitles() {
    suggestAbort.current?.abort();
    const ctrl = new AbortController();
    suggestAbort.current = ctrl;
    setSuggestError(null);
    setSuggestions([]);
    setSuggestLoading(true);
    setShowSuggest(true);
    try {
      const ctx = getNoteContext();
      const noteText = [titleRef.current, ctx.text].filter(Boolean).join("\n\n");
      const res = await fetch("/api/suggest-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId: id, noteText }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        setSuggestError((await res.text().catch(() => "")) || "Couldn't get suggestions.");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        const parsed = parseTitles(raw);
        if (parsed.length) setSuggestions(parsed);
      }
      if (raw.includes("⚠️")) {
        setSuggestError(raw.slice(raw.indexOf("⚠️")).trim());
      } else if (parseTitles(raw).length === 0) {
        setSuggestError("Couldn't come up with a title. Try again.");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setSuggestError("Couldn't get suggestions. Try again.");
      }
    } finally {
      setSuggestLoading(false);
    }
  }

  function applySuggestion(s: string) {
    setTitle(s);
    titleRef.current = s;
    markDirty();
    closeSuggest();
  }

  function closeSuggest() {
    suggestAbort.current?.abort();
    setSuggestLoading(false);
    setShowSuggest(false);
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Image,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Start writing…" }),
      LinkPreview,
    ],
    content: (initialContent as object) ?? EMPTY_DOC,
    immediatelyRender: false,
    onUpdate: () => markDirty(),
    editorProps: {
      handlePaste: (_view, event) => {
        const data = event.clipboardData;
        if (!data) return false;
        for (const item of Array.from(data.items)) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              void uploadAndInsert(file);
              return true;
            }
          }
        }
        const text = data.getData("text/plain");
        if (text && isSingleUrl(text)) {
          editorRef.current?.chain().focus().setLinkPreview({ url: text.trim() }).run();
          const s = snapshot();
          if (s) beaconSave(s); // persist the link immediately, refresh-proof
          markDirty();
          return true;
        }
        return false;
      },
      handleDrop: (_view, event, _slice, moved) => {
        if (moved) return false;
        const files = (event as DragEvent).dataTransfer?.files;
        if (files && files.length) {
          const media = Array.from(files).filter(
            (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
          );
          if (media.length) {
            media.forEach((f) => uploadMedia(f));
            return true;
          }
        }
        return false;
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Flush any pending save when leaving the page or navigating away — uses a
  // beacon so it survives even an immediate refresh.
  useEffect(() => {
    const flushBeacon = () => {
      if (pendingRef.current) {
        beaconSave(pendingRef.current);
        pendingRef.current = null;
      }
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flushBeacon();
    };
    window.addEventListener("pagehide", flushBeacon);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flushBeacon);
      document.removeEventListener("visibilitychange", onHide);
      if (timer.current) clearTimeout(timer.current);
      flushBeacon();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Build AI context from the note: plain text + linked pages + image URLs + the
  // note's videos in a stable order (uploads first, then YouTube links) labeled
  // "Video 1..N" so the user can refer to them by position — same as the app.
  function getNoteContext(): { text: string; imageUrls: string[]; videos: ChatVideo[] } {
    const ed = editorRef.current;
    if (!ed) return { text: "", imageUrls: [], videos: [] };
    const parts: string[] = [];
    const images: string[] = [];
    const ytUrls: string[] = [];
    const walk = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      const n = node as {
        type?: string;
        text?: string;
        attrs?: Record<string, unknown>;
        content?: unknown[];
      };
      if (n.type === "text" && typeof n.text === "string") parts.push(n.text);
      if (n.type === "linkPreview" && typeof n.attrs?.url === "string" && n.attrs.url) {
        parts.push(n.attrs.url as string);
      }
      if (n.type === "image" && typeof n.attrs?.src === "string") {
        images.push(n.attrs.src as string);
      }
      if (Array.isArray(n.content)) n.content.forEach(walk);
    };
    walk(ed.getJSON());

    const text = parts.join(" ").replace(/\s+/g, " ").trim();
    for (const url of text.match(/https?:\/\/[^\s)\]]+/g) ?? []) {
      if (youtubeId(url) && !ytUrls.includes(url)) ytUrls.push(url);
    }

    const chatVideos: ChatVideo[] = [
      ...videos.map((v) => ({
        kind: "upload" as const,
        url: v.url,
        mime: videoMime(v.path.split(".").pop() ?? ""),
      })),
      ...ytUrls.map((url) => ({ kind: "youtube" as const, url })),
    ].map((v, i) => ({ ...v, label: `Video ${i + 1}` }));

    return { text, imageUrls: images.slice(0, 4), videos: chatVideos.slice(0, 3) };
  }

  async function onPickMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    for (const file of files) {
      if (file.type.startsWith("video/")) await uploadVideo(file);
      else await uploadAndInsert(file);
    }
    e.target.value = "";
  }

  if (!editor) return null;

  return (
    <div>
      <div className="relative mb-3 flex items-center gap-3">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            titleRef.current = e.target.value;
            markDirty();
          }}
          placeholder="Untitled"
          className="flex-1 bg-transparent text-2xl font-bold outline-none"
          style={{ color: "var(--text)" }}
        />
        {aiEnabled && (
          <button
            type="button"
            aria-label="Suggest a title"
            title="Suggest a title"
            onClick={() => void suggestTitles()}
            disabled={editor.isEmpty}
            className="shrink-0 transition-opacity hover:opacity-70 disabled:opacity-30"
            style={{ color: "var(--accent)" }}
          >
            {/* wand + sparkles, mirroring the app's wand.and.stars */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 4V2M15 10V8M11 6h2M19 6h2M17.5 3.5l-1 1M17.5 8.5l-1 1M13.5 3.5l1 1" />
              <path d="M14 9L3 20l1 1L15 10l-1-1z" fill="currentColor" stroke="none" />
            </svg>
          </button>
        )}
        <span className="shrink-0 text-xs" style={{ color: "var(--muted)" }}>
          {saving ? "Saving…" : "Saved"}
        </span>

        {/* Floating AI title suggestions card, anchored under the title */}
        {showSuggest && (
          <div
            className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl border p-4"
            style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-lg)" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
                Suggested titles
              </span>
              <button type="button" aria-label="Close" onClick={closeSuggest} style={{ color: "var(--muted)" }}>
                ×
              </button>
            </div>
            {suggestError ? (
              <div className="space-y-2">
                <p className="text-xs" style={{ color: "var(--muted)" }}>{suggestError}</p>
                <button
                  type="button"
                  onClick={() => void suggestTitles()}
                  className="text-xs font-semibold"
                  style={{ color: "var(--accent)" }}
                >
                  Try again
                </button>
              </div>
            ) : suggestions.length === 0 && suggestLoading ? (
              <p className="text-xs" style={{ color: "var(--muted)" }}>Thinking…</p>
            ) : (
              <div>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applySuggestion(s)}
                    className="flex w-full items-center justify-between gap-2 py-2 text-left text-sm transition-opacity hover:opacity-70"
                    style={{
                      color: "var(--text)",
                      borderTop: i > 0 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    <span>{s}</span>
                    <span style={{ color: "var(--accent)" }}>↖</span>
                  </button>
                ))}
                {suggestLoading && (
                  <p className="pt-1 text-xs" style={{ color: "var(--muted)" }}>More…</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Apple Notes–style: a single format button that expands the toolbar */}
      <div className="mb-3 flex items-start gap-2">
        <div className="relative">
        <button
          type="button"
          aria-label="Formatting"
          aria-expanded={showFormat}
          onClick={() => setShowFormat((v) => !v)}
          className="rounded-full px-4 py-1.5 text-sm font-semibold transition-transform hover:-translate-y-0.5"
          style={{ background: "var(--pill)", border: "1px solid var(--border)", boxShadow: "var(--shadow)", color: "var(--text)" }}
        >
          Aa
        </button>
        {showFormat && (
          <div
            className="absolute left-0 top-full z-20 mt-2 flex flex-wrap gap-0.5 rounded-2xl border p-1.5"
            style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-lg)" }}
          >
            <ToolBtn label="Bold" onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></ToolBtn>
            <ToolBtn label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></ToolBtn>
            <ToolBtn label="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</ToolBtn>
            <ToolBtn label="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolBtn>
            <ToolBtn label="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()}>{I.bullet}</ToolBtn>
            <ToolBtn label="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}>{I.ordered}</ToolBtn>
            <ToolBtn label="Checklist" onClick={() => editor.chain().focus().toggleTaskList().run()}>{I.task}</ToolBtn>
          </div>
        )}
        </div>
      </div>

      {/* Video attachments — horizontal strip with play badges, like the app's gallery */}
      {(videos.length > 0 || videoUploading) && (
        <div className="mb-3 flex gap-2.5 overflow-x-auto py-1">
          {videos.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-label="Play video"
              onClick={() => setPlaying(v)}
              className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl transition-transform hover:scale-[1.02]"
              style={{ background: "var(--pill)", border: "1px solid var(--border)" }}
            >
              <video src={v.url} preload="metadata" muted playsInline className="h-full w-full object-cover" />
              <span className="absolute inset-0 grid place-items-center">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="rgba(255,255,255,0.92)" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.4))" }}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M10 8.5l6 3.5-6 3.5v-7z" fill="rgba(0,0,0,0.65)" />
                </svg>
              </span>
            </button>
          ))}
          {videoUploading && (
            <div
              className="grid h-28 w-28 shrink-0 place-items-center rounded-xl text-xs"
              style={{ background: "var(--pill)", color: "var(--muted)" }}
            >
              Uploading…
            </div>
          )}
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={onPickMedia} />
      <EditorContent editor={editor} />

      {/* Full-screen video player with close + delete, like the app */}
      {playing && (
        <div className="fixed inset-0 z-50 bg-black" onClick={() => setPlaying(null)}>
          <video
            src={playing.url}
            controls
            autoPlay
            playsInline
            className="h-full w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute left-4 right-4 top-4 flex justify-between" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setPlaying(null)}
              className="grid h-11 w-11 place-items-center rounded-full bg-black/50 text-lg text-white"
            >
              ×
            </button>
            <button
              type="button"
              aria-label="Delete video"
              onClick={(e) => {
                e.stopPropagation();
                const v = playing;
                setPlaying(null);
                setVideos((list) => list.filter((x) => x.id !== v.id));
                void deleteNoteVideo(v);
              }}
              className="grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating photo/file orb, bottom-right */}
      <button
        type="button"
        aria-label="Add photo or video"
        title="Add photo or video"
        onClick={() => fileRef.current?.click()}
        className="fixed right-6 z-30 grid h-14 w-14 place-items-center rounded-full transition-transform hover:scale-105"
        style={{ background: "var(--accent)", color: "var(--accent-fg)", boxShadow: "var(--shadow-lg)", bottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        {I.image}
      </button>

      {aiEnabled && <NoteChat noteId={id} getNoteContext={getNoteContext} />}
    </div>
  );
}
