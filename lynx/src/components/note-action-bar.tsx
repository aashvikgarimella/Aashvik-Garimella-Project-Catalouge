"use client";

import { useState, useTransition } from "react";
import type { Category } from "@/lib/data/categories";
import type { Reminder } from "@/lib/data/reminders";
import {
  pinNoteAction,
  archiveNoteAction,
  duplicateNoteAction,
  deleteNoteAction,
  assignCategoryAction,
  createAndAssignCategoryAction,
} from "@/app/notes/[id]/actions";
import { addReminderAction, deleteReminderAction } from "@/app/notes/[id]/reminder-actions";

const NEW = "__new__";

export function NoteActionBar({
  id,
  pinned,
  archived = false,
  categoryId,
  categories,
  reminders,
}: {
  id: string;
  pinned: boolean;
  archived?: boolean;
  categoryId: string | null;
  categories: Category[];
  reminders: Reminder[];
}) {
  const [pending, start] = useTransition();
  const [reminderOpen, setReminderOpen] = useState(false);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const addReminder = addReminderAction.bind(null, id);

  const pill =
    "rounded-full px-3.5 py-1.5 text-sm font-medium transition-transform hover:-translate-y-0.5 disabled:opacity-50";
  const pillStyle = {
    background: "var(--pill)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow)",
    color: "var(--text)",
  } as const;

  function onCategoryChange(value: string) {
    if (value === NEW) {
      setCatName("");
      setCatModalOpen(true);
      return;
    }
    start(() => void assignCategoryAction(id, value || null));
  }

  function createCategory() {
    const name = catName.trim();
    if (!name) return;
    start(() => void createAndAssignCategoryAction(id, name));
    setCatModalOpen(false);
  }

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Category"
          value={categoryId ?? ""}
          disabled={pending}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="rounded-full px-3 py-1.5 text-sm"
          style={pillStyle}
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value={NEW}>+ New category…</option>
        </select>

        <button type="button" className={pill} style={pillStyle} disabled={pending}
          onClick={() => start(() => void pinNoteAction(id, !pinned))}>
          {pinned ? "Unpin" : "Pin"}
        </button>
        <button type="button" className={pill} style={pillStyle} disabled={pending}
          onClick={() => start(() => void duplicateNoteAction(id))}>
          Duplicate
        </button>
        <button type="button" className={pill} style={pillStyle} disabled={pending}
          onClick={() => start(() => void archiveNoteAction(id, !archived))}>
          {archived ? "Unarchive" : "Archive"}
        </button>
        <button type="button" className={pill} style={{ ...pillStyle, color: "var(--danger)" }} disabled={pending}
          onClick={() => setDeleteOpen(true)}>
          Delete
        </button>
        <button type="button" className={pill} style={pillStyle}
          onClick={() => setReminderOpen((o) => !o)}>
          Add reminder
        </button>
      </div>

      {reminderOpen && (
        <form
          action={addReminder}
          onSubmit={() => setReminderOpen(false)}
          className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border p-3"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <input type="datetime-local" name="remind_at" required
            className="rounded-lg border px-2 py-1.5 text-sm"
            style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
          <input name="message" placeholder="Optional message…"
            className="flex-1 rounded-lg border px-2 py-1.5 text-sm"
            style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
          <button type="submit" className="rounded-lg px-3 py-1.5 text-sm font-medium"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>Set</button>
        </form>
      )}

      {reminders.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {reminders.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs"
              style={{ background: "var(--surface-2)", color: "var(--text)" }}>
              {new Date(r.remind_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              {r.message ? ` · ${r.message}` : ""}
              <button type="button" aria-label="Delete reminder" disabled={pending}
                onClick={() => start(() => void deleteReminderAction(id, r.id))}
                style={{ color: "var(--danger)" }}>×</button>
            </span>
          ))}
        </div>
      )}

      {catModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
          onClick={() => setCatModalOpen(false)}>
          <div className="w-full max-w-xs rounded-2xl border p-5"
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-lg)" }}>
            <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--text)" }}>New category</h3>
            <input
              autoFocus
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createCategory(); }}
              placeholder="Category name"
              className="mb-3 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCatModalOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm" style={{ color: "var(--muted)" }}>Cancel</button>
              <button type="button" onClick={createCategory}
                className="rounded-lg px-3 py-1.5 text-sm font-medium"
                style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
          onClick={() => setDeleteOpen(false)}>
          <div className="w-full max-w-xs rounded-2xl border p-5"
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-lg)" }}>
            <h3 className="mb-1 text-sm font-semibold" style={{ color: "var(--text)" }}>Delete note?</h3>
            <p className="mb-4 text-sm" style={{ color: "var(--muted)" }}>
              This permanently deletes the note. This can&apos;t be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm" style={{ color: "var(--muted)" }}>Cancel</button>
              <button type="button" disabled={pending}
                onClick={() => { setDeleteOpen(false); start(() => void deleteNoteAction(id)); }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium"
                style={{ background: "var(--danger)", color: "#fff" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
