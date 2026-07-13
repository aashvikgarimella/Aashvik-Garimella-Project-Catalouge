"use client";

import { useState } from "react";
import Link from "next/link";
import { newNoteAction } from "@/app/notes/new-actions";

export type MenuGroup = { label: string; items: { id: string; title: string }[] };

export function MenuDrawer({
  open,
  onClose,
  groups,
  groupingLabel,
  archived,
}: {
  open: boolean;
  onClose: () => void;
  groups: MenuGroup[];
  groupingLabel: string;
  archived: { id: string; title: string }[];
}) {
  const [showArchived, setShowArchived] = useState(false);
  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed left-0 top-0 z-40 h-full w-[min(90vw,320px)] overflow-y-auto p-4 transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "var(--surface)", borderRight: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
      >
        <div className="mb-4 mt-12 flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            By {groupingLabel}
          </span>
          <button onClick={onClose} aria-label="Close menu" style={{ color: "var(--muted)" }}>×</button>
        </div>

        <form action={newNoteAction} className="mb-4">
          <button
            type="submit"
            className="w-full rounded-xl px-3 py-2 text-sm font-medium"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            + New note
          </button>
        </form>

        {groups.length === 0 && (
          <p className="text-sm" style={{ color: "var(--muted)" }}>No notes yet.</p>
        )}

        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            <div className="mb-1 px-1 text-xs font-semibold" style={{ color: "var(--muted)" }}>
              {group.label}
            </div>
            <div className="flex flex-col">
              {group.items.map((item) => (
                <Link
                  key={item.id}
                  href={`/notes/${item.id}`}
                  onClick={onClose}
                  className="truncate rounded-lg px-3 py-1.5 text-sm transition-colors hover:opacity-70"
                  style={{ color: "var(--text)" }}
                >
                  {item.title || "Untitled"}
                </Link>
              ))}
            </div>
          </div>
        ))}

        {archived.length > 0 && (
          <div className="mt-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="flex w-full items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--muted)" }}
            >
              <span>Archived ({archived.length})</span>
              <span>{showArchived ? "−" : "+"}</span>
            </button>
            {showArchived && (
              <div className="mt-1 flex flex-col">
                {archived.map((item) => (
                  <Link
                    key={item.id}
                    href={`/notes/${item.id}`}
                    onClick={onClose}
                    className="truncate rounded-lg px-3 py-1.5 text-sm transition-colors hover:opacity-70"
                    style={{ color: "var(--muted)" }}
                  >
                    {item.title || "Untitled"}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
