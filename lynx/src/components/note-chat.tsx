"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type ChatMessage = { role: "user" | "assistant"; content: string };

/** A video the AI can watch: an uploaded attachment or a YouTube link, labeled by position. */
export type ChatVideo =
  | { kind: "upload"; label: string; url: string; mime: string }
  | { kind: "youtube"; label: string; url: string };

export function NoteChat({
  noteId,
  getNoteContext,
}: {
  noteId: string;
  getNoteContext: () => { text: string; imageUrls: string[]; videos: ChatVideo[] };
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Auto-grow the input as the user types.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // Persist the conversation per note so it stays until cleared. Loaded in an
  // effect (not a lazy initializer) so the SSR'd empty state hydrates cleanly.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`lynx-chat-${noteId}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- post-hydration restore; an initializer would mismatch SSR
      if (saved) setMessages(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, [noteId]);
  useEffect(() => {
    try {
      if (messages.length) localStorage.setItem(`lynx-chat-${noteId}`, JSON.stringify(messages));
    } catch {
      /* ignore */
    }
  }, [messages, noteId]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);
    try {
      const ctx = getNoteContext();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteId,
          history: next,
          noteText: ctx.text,
          imageUrls: ctx.imageUrls,
          videos: ctx.videos,
        }),
      });
      if (!res.ok || !res.body) {
        const errText = (await res.text().catch(() => "")) || "AI request failed.";
        setMessages([...next, { role: "assistant", content: errText }]);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: acc }]);
      }
    } catch {
      setMessages([...next, { role: "assistant", content: "AI request failed. Try again." }]);
    } finally {
      setLoading(false);
    }
  }

  const lastAssistantEmpty =
    loading && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content;

  return (
    <>
      {/* Floating AI launcher — stacked above the photo orb */}
      <button
        type="button"
        aria-label="AI assistant"
        onClick={() => setOpen(true)}
        className="fixed right-6 z-30 grid h-14 w-14 place-items-center rounded-full transition-transform hover:scale-105"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)", color: "var(--accent)", bottom: "calc(6rem + env(safe-area-inset-bottom))" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l1.6 4.6L18 8l-4.4 1.4L12 14l-1.6-4.6L6 8l4.4-1.4L12 2z" />
          <path d="M18.5 13l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" opacity="0.7" />
        </svg>
      </button>

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Chat panel */}
      <aside
        className={`fixed right-0 top-0 z-40 flex h-full w-[min(94vw,440px)] flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          background: "var(--bg)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <header className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="text-base font-semibold" style={{ color: "var(--text)" }}>
            lynx<span style={{ color: "var(--accent)" }}>.</span> AI
          </span>
          <div className="flex items-center gap-3">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  try { localStorage.removeItem(`lynx-chat-${noteId}`); } catch { /* ignore */ }
                }}
                className="text-xs"
                style={{ color: "var(--muted)" }}
              >
                Clear
              </button>
            )}
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} style={{ color: "var(--muted)" }}>
              ×
            </button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <p className="mt-6 text-sm" style={{ color: "var(--muted)" }}>
              {getNoteContext().videos.length > 0
                ? "Ask me anything — including the attached videos (e.g. “summarize the first video”)."
                : "Ask me anything — general questions, or about this note."}
            </p>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div
                  className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm"
                  style={{ background: "var(--surface-2)", color: "var(--text)" }}
                >
                  {m.content}
                </div>
              </div>
            ) : (
              m.content && (
                <div key={i} className="chat-md text-sm" style={{ color: "var(--text)" }}>
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              )
            ),
          )}
          {lastAssistantEmpty && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>Thinking…</p>
          )}
        </div>

        <div className="p-3">
          <div
            className="flex items-end gap-2 rounded-3xl px-4 py-2"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder="Ask lynx"
              className="max-h-40 flex-1 resize-none bg-transparent py-1 text-sm outline-none"
              style={{ color: "var(--text)" }}
            />
            <button
              type="button"
              aria-label="Send"
              onClick={() => void send()}
              disabled={loading || !input.trim()}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full disabled:opacity-40"
              style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
