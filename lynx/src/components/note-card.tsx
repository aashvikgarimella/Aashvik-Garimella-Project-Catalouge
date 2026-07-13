"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import type { Note } from "@/lib/data/notes";
import { deleteNoteListAction } from "@/app/notes/list-actions";

function formatReminder(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function NoteCard({
  note,
  meta,
  metaColor,
  reminderAt,
}: {
  note: Note;
  meta?: string;
  metaColor?: string;
  reminderAt?: string;
}) {
  const title = note.title.trim() || "Untitled";
  const snippet = note.content_text.slice(0, 140);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  function startPress() {
    longPressed.current = false;
    timer.current = setTimeout(() => {
      longPressed.current = true;
      setConfirm(true);
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(12);
    }, 450);
  }
  function cancelPress() {
    if (timer.current) clearTimeout(timer.current);
  }

  return (
    <div className="relative">
      <Link
        href={`/notes/${note.id}`}
        onClick={(e) => {
          if (longPressed.current) e.preventDefault(); // long-press shouldn't open the note
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setConfirm(true);
        }}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
        className="flex select-none flex-col rounded-2xl border p-4 transition-transform active:scale-[0.98]"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface)",
          boxShadow: "var(--shadow)",
        }}
      >
        <div className="flex items-start gap-2">
          <h3 className="flex-1 font-medium" style={{ color: "var(--text)" }}>
            {title}
          </h3>
          {note.pinned && (
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{ background: "var(--accent)" }}
              aria-label="Pinned"
              title="Pinned"
            />
          )}
        </div>
        {snippet && (
          <p className="mt-1 line-clamp-3 text-sm" style={{ color: "var(--muted)" }}>
            {snippet}
          </p>
        )}
        {(meta || reminderAt) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {meta && (
              <span className="flex items-center gap-1" style={{ color: "var(--muted)" }}>
                {metaColor && (
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: metaColor }} />
                )}
                {meta}
              </span>
            )}
            {reminderAt && (
              <span className="flex items-center gap-1" style={{ color: "var(--accent)" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {formatReminder(reminderAt)}
              </span>
            )}
          </div>
        )}
      </Link>

      {confirm && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl border p-3 text-center"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-lg)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
            Delete this note?
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirm(false)}
              className="rounded-full px-4 py-1.5 text-sm transition-transform active:scale-95"
              style={{ background: "var(--pill)", border: "1px solid var(--border)", color: "var(--text)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => start(() => void deleteNoteListAction(note.id))}
              className="rounded-full px-4 py-1.5 text-sm font-medium transition-transform active:scale-95 disabled:opacity-60"
              style={{ background: "var(--danger)", color: "#fff" }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
