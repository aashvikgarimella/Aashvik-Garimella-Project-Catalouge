# Phase 4 — Notes (rich editor, images, organization) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can create, edit (rich text + headings + lists + checklists + links + images), pin, archive, duplicate, delete, search, and sort notes; assign them to categories; and open today's daily note. Notes autosave and sync per-user under RLS.

**Architecture:** A `notes` table stores the editor document as JSONB plus a derived `content_text` column for search. Images upload to a private Supabase Storage bucket (`note-images`, path `<user_id>/<uuid>`) with an `attachments` table tracking metadata; storage RLS restricts each user to their own folder. The editor is a Tiptap (ProseMirror) client component; saving goes through server actions in the existing data-layer pattern.

**Tech Stack:** Next.js 16, Tiptap 2, Supabase Postgres + Storage + RLS, Vitest.

## Global Constraints

- RLS on every table keyed on `auth.uid()`; `user_id` defaults to `auth.uid()`.
- DB access through `src/lib/data/*`; DB types hand-maintained in `src/lib/database.types.ts`.
- Editor document persisted as Tiptap JSON in `notes.content`; `notes.content_text` holds plain text for search.
- All colors via CSS variables. TypeScript strict; no `any`. Commit after each task.
- Migrations pushed via `npx supabase db push --db-url "$SUPABASE_DB_URL"`.

---

### Task 1: Notes table migration

**Files:** Create `supabase/migrations/0003_notes.sql`

**Interfaces:** Produces `public.notes(id, user_id, title, content jsonb, content_text, category_id, pinned, archived, daily_date, created_at, updated_at)` with RLS + an `updated_at` trigger + a partial unique index making `daily_date` unique per user.

- [ ] **Step 1: Write `supabase/migrations/0003_notes.sql`**

```sql
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '',
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  content_text text not null default '',
  category_id uuid references public.categories (id) on delete set null,
  pinned boolean not null default false,
  archived boolean not null default false,
  daily_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_idx on public.notes (user_id, updated_at desc);
create index if not exists notes_search_idx on public.notes using gin (to_tsvector('english', title || ' ' || content_text));
create unique index if not exists notes_daily_unique on public.notes (user_id, daily_date) where daily_date is not null;

alter table public.notes enable row level security;

drop policy if exists "notes - select own" on public.notes;
create policy "notes - select own" on public.notes for select using (auth.uid() = user_id);
drop policy if exists "notes - insert own" on public.notes;
create policy "notes - insert own" on public.notes for insert with check (auth.uid() = user_id);
drop policy if exists "notes - update own" on public.notes;
create policy "notes - update own" on public.notes for update using (auth.uid() = user_id);
drop policy if exists "notes - delete own" on public.notes;
create policy "notes - delete own" on public.notes for delete using (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists notes_touch_updated on public.notes;
create trigger notes_touch_updated before update on public.notes
  for each row execute function public.touch_updated_at();
```

- [ ] **Step 2: Push** — `npx --yes supabase@latest db push --db-url "$(grep '^SUPABASE_DB_URL=' .env.local | cut -d= -f2-)"` (answer `y`).
- [ ] **Step 3: Verify** — `curl -s -o /dev/null -w "%{http_code}\n" -H "apikey: $KEY" "$BASE/rest/v1/notes?select=id&limit=1"` → `200`.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: add notes table migration with search index and RLS"`

---

### Task 2: Attachments table + storage bucket migration

**Files:** Create `supabase/migrations/0004_attachments_storage.sql`

**Interfaces:** Produces `public.attachments(id, user_id, note_id, storage_path, caption, description, created_at)` with RLS, a private `note-images` storage bucket, and storage policies restricting each user to their own `<user_id>/...` folder.

- [ ] **Step 1: Write `supabase/migrations/0004_attachments_storage.sql`**

```sql
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  storage_path text not null,
  caption text not null default '',
  description text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists attachments_note_idx on public.attachments (note_id);
alter table public.attachments enable row level security;
drop policy if exists "attachments - all own" on public.attachments;
create policy "attachments - all own" on public.attachments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('note-images', 'note-images', false)
on conflict (id) do nothing;

-- Each user may only touch objects under a top-level folder equal to their uid.
drop policy if exists "note-images - own folder" on storage.objects;
create policy "note-images - own folder" on storage.objects
  for all to authenticated
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 2: Push** the migration (same command).
- [ ] **Step 3: Verify** — `curl … /rest/v1/attachments?select=id&limit=1` → `200`; bucket check via `curl -s -H "apikey:$KEY" -H "Authorization: Bearer $T1" "$BASE/storage/v1/bucket/note-images"` returns the bucket JSON.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: add attachments table and private note-images storage bucket"`

---

### Task 3: Extend DB types

**Files:** Modify `src/lib/database.types.ts`

**Interfaces:** Adds `notes` and `attachments` table types (Row/Insert/Update) matching the migrations.

- [ ] **Step 1: Add the `notes` entry** to `Tables` with columns: id string, user_id string, title string, content Json, content_text string, category_id string|null, pinned boolean, archived boolean, daily_date string|null, created_at string, updated_at string. Insert: all optional except none required (defaults exist); Update: all optional.

- [ ] **Step 2: Add the `attachments` entry**: id string, user_id string, note_id string, storage_path string, caption string, description string, created_at string. Insert: note_id + storage_path required, rest optional; Update: all optional.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` → no errors.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "chore: add notes and attachments to DB types"`

---

### Task 4: Notes data module

**Files:** Create `src/lib/data/notes.ts`

**Interfaces:**
- `type Note = Database["public"]["Tables"]["notes"]["Row"]`
- `listNotes(opts?: { search?: string; categoryId?: string; archived?: boolean; sort?: "updated" | "created" | "title" }): Promise<Note[]>`
- `getNote(id: string): Promise<Note | null>`
- `createNote(input?: { title?: string; categoryId?: string }): Promise<Note>`
- `updateNote(id, patch: { title?: string; content?: Json; content_text?: string; category_id?: string | null }): Promise<void>`
- `setPinned(id, pinned): Promise<void>` / `setArchived(id, archived): Promise<void>`
- `duplicateNote(id): Promise<Note>` / `deleteNote(id): Promise<void>`
- `getOrCreateDailyNote(isoDate: string): Promise<Note>`

- [ ] **Step 1: Implement `src/lib/data/notes.ts`**

```ts
import { createServerSupabase } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/database.types";

export type Note = Database["public"]["Tables"]["notes"]["Row"];

export async function listNotes(opts: {
  search?: string;
  categoryId?: string;
  archived?: boolean;
  sort?: "updated" | "created" | "title";
} = {}): Promise<Note[]> {
  const supabase = await createServerSupabase();
  let q = supabase.from("notes").select("*").eq("archived", opts.archived ?? false);
  if (opts.categoryId) q = q.eq("category_id", opts.categoryId);
  if (opts.search) q = q.or(`title.ilike.%${opts.search}%,content_text.ilike.%${opts.search}%`);
  const col = opts.sort === "created" ? "created_at" : opts.sort === "title" ? "title" : "updated_at";
  q = q.order("pinned", { ascending: false }).order(col, { ascending: opts.sort === "title" });
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getNote(id: string): Promise<Note | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("notes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createNote(input: { title?: string; categoryId?: string } = {}): Promise<Note> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("notes")
    .insert({ title: input.title ?? "", category_id: input.categoryId ?? null })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateNote(
  id: string,
  patch: { title?: string; content?: Json; content_text?: string; category_id?: string | null },
): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("notes").update(patch).eq("id", id);
  if (error) throw error;
}

export async function setPinned(id: string, pinned: boolean): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("notes").update({ pinned }).eq("id", id);
  if (error) throw error;
}

export async function setArchived(id: string, archived: boolean): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("notes").update({ archived }).eq("id", id);
  if (error) throw error;
}

export async function duplicateNote(id: string): Promise<Note> {
  const supabase = await createServerSupabase();
  const original = await getNote(id);
  if (!original) throw new Error("Note not found");
  const { data, error } = await supabase
    .from("notes")
    .insert({
      title: original.title ? `${original.title} (copy)` : "Untitled (copy)",
      content: original.content,
      content_text: original.content_text,
      category_id: original.category_id,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNote(id: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}

export async function getOrCreateDailyNote(isoDate: string): Promise<Note> {
  const supabase = await createServerSupabase();
  const existing = await supabase.from("notes").select("*").eq("daily_date", isoDate).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;
  const { data, error } = await supabase
    .from("notes")
    .insert({ title: isoDate, daily_date: isoDate })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit`.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: add notes data module"`

---

### Task 5: Install Tiptap + plain-text helper (tested)

**Files:** Create `src/lib/editor/text.ts`, `src/lib/editor/text.test.ts`; modify `package.json` (deps)

**Interfaces:** `extractText(doc: Json): string` — flattens a Tiptap JSON doc to plain text for search/indexing.

- [ ] **Step 1: Install** — `npm i @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-image @tiptap/extension-task-list @tiptap/extension-task-item @tiptap/extension-placeholder`

- [ ] **Step 2: Failing test `src/lib/editor/text.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { extractText } from "./text";

describe("extractText", () => {
  it("concatenates text nodes with spaces", () => {
    const doc = { type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      { type: "paragraph", content: [{ type: "text", text: "world" }] },
    ]};
    expect(extractText(doc)).toBe("Hello world");
  });
  it("returns empty string for empty doc", () => {
    expect(extractText({ type: "doc", content: [] })).toBe("");
  });
});
```

- [ ] **Step 3: Run, verify fail.**

- [ ] **Step 4: Implement `src/lib/editor/text.ts`**

```ts
import type { Json } from "@/lib/database.types";

export function extractText(doc: Json): string {
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.type === "text" && typeof n.text === "string") parts.push(n.text);
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(doc);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
```

- [ ] **Step 5: Run, verify pass.**
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: add Tiptap deps and tested text extractor"`

---

### Task 6: Editor component + save action

**Files:** Create `src/components/note-editor.tsx`, `src/app/notes/[id]/actions.ts`

**Interfaces:**
- `saveNoteAction(id, { title, content })` server action: computes `content_text` via `extractText`, calls `updateNote`, `revalidatePath`.
- `NoteEditor` client component: Tiptap editor with toolbar (bold, italic, H1/H2, bullet/ordered list, checklist, link, image upload) + title input; debounced autosave through the action.

- [ ] **Step 1: Implement `src/app/notes/[id]/actions.ts`**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { updateNote, setPinned, setArchived, duplicateNote, deleteNote } from "@/lib/data/notes";
import { extractText } from "@/lib/editor/text";
import type { Json } from "@/lib/database.types";
import { redirect } from "next/navigation";

export async function saveNoteAction(id: string, payload: { title: string; content: Json }) {
  await updateNote(id, { title: payload.title, content: payload.content, content_text: extractText(payload.content) });
  revalidatePath(`/notes/${id}`);
}
export async function pinNoteAction(id: string, pinned: boolean) { await setPinned(id, pinned); revalidatePath("/notes"); }
export async function archiveNoteAction(id: string, archived: boolean) { await setArchived(id, archived); revalidatePath("/notes"); redirect("/notes"); }
export async function duplicateNoteAction(id: string) { const n = await duplicateNote(id); redirect(`/notes/${n.id}`); }
export async function deleteNoteAction(id: string) { await deleteNote(id); redirect("/notes"); }
```

- [ ] **Step 2: Implement `src/components/note-editor.tsx`** (client). Uses `useEditor` from `@tiptap/react` with StarterKit + Link + Image + TaskList + TaskItem + Placeholder. Title is a controlled input. Autosave: on editor update + title change, debounce 800ms then call `saveNoteAction(id, { title, content: editor.getJSON() })`. Toolbar buttons toggle marks/nodes. Image button triggers a hidden file input that calls `uploadImage` (Task 7) and inserts an image node with the returned public URL. Render with themed styles (`var(--text)`, `var(--surface)`); a `.ProseMirror` block in `globals.css` provides spacing for headings/lists/checkboxes.

```tsx
"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef, useState } from "react";
import type { Json } from "@/lib/database.types";
import { saveNoteAction } from "@/app/notes/[id]/actions";
import { uploadNoteImage } from "@/lib/data/upload-image";

export function NoteEditor({ id, initialTitle, initialContent }: { id: string; initialTitle: string; initialContent: Json }) {
  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    content: (initialContent as object) ?? { type: "doc", content: [] },
    immediatelyRender: false,
    onUpdate: () => scheduleSave(),
  });

  function scheduleSave() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (!editor) return;
      setSaving(true);
      await saveNoteAction(id, { title, content: editor.getJSON() as Json });
      setSaving(false);
    }, 800);
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const url = await uploadNoteImage(id, file);
    editor.chain().focus().setImage({ src: url }).run();
    scheduleSave();
  }

  if (!editor) return null;
  const btn = "px-2 py-1 rounded text-sm";
  return (
    <div>
      <input
        value={title}
        onChange={(e) => { setTitle(e.target.value); scheduleSave(); }}
        placeholder="Untitled"
        className="w-full bg-transparent text-2xl font-semibold mb-3 outline-none"
        style={{ color: "var(--text)" }}
      />
      <div className="flex flex-wrap gap-1 mb-3 pb-2 border-b" style={{ borderColor: "var(--border)" }}>
        <button className={btn} onClick={() => editor.chain().focus().toggleBold().run()} style={{ color: "var(--text)" }}><b>B</b></button>
        <button className={btn} onClick={() => editor.chain().focus().toggleItalic().run()} style={{ color: "var(--text)" }}><i>I</i></button>
        <button className={btn} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} style={{ color: "var(--text)" }}>H1</button>
        <button className={btn} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} style={{ color: "var(--text)" }}>H2</button>
        <button className={btn} onClick={() => editor.chain().focus().toggleBulletList().run()} style={{ color: "var(--text)" }}>• List</button>
        <button className={btn} onClick={() => editor.chain().focus().toggleOrderedList().run()} style={{ color: "var(--text)" }}>1. List</button>
        <button className={btn} onClick={() => editor.chain().focus().toggleTaskList().run()} style={{ color: "var(--text)" }}>☑ Tasks</button>
        <button className={btn} onClick={() => { const url = prompt("Link URL"); if (url) editor.chain().focus().setLink({ href: url }).run(); }} style={{ color: "var(--text)" }}>🔗</button>
        <button className={btn} onClick={() => fileRef.current?.click()} style={{ color: "var(--text)" }}>🖼 Image</button>
        <span className="ml-auto text-xs self-center" style={{ color: "var(--muted)" }}>{saving ? "Saving…" : "Saved"}</span>
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />
      <EditorContent editor={editor} />
    </div>
  );
}
```

- [ ] **Step 3: Add `.ProseMirror` styles to `src/app/globals.css`** for headings, lists, checkboxes, images (max-width, spacing), placeholder.

- [ ] **Step 4: Verify build** — `npm run build`.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: add Tiptap note editor with autosave"`

---

### Task 7: Image upload helper

**Files:** Create `src/lib/data/upload-image.ts`

**Interfaces:** `uploadNoteImage(noteId: string, file: File): Promise<string>` — client-side: uploads to `note-images/<uid>/<uuid>.<ext>`, inserts an `attachments` row, returns a signed/public URL for display.

- [ ] **Step 1: Implement `src/lib/data/upload-image.ts`**

```ts
"use client";
import { createBrowserSupabase } from "@/lib/supabase/client";

export async function uploadNoteImage(noteId: string, file: File): Promise<string> {
  const supabase = createBrowserSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not authenticated");
  const ext = file.name.split(".").pop() || "png";
  const path = `${uid}/${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from("note-images").upload(path, file);
  if (up.error) throw up.error;
  await supabase.from("attachments").insert({ note_id: noteId, storage_path: path });
  const { data: signed, error } = await supabase.storage.from("note-images").createSignedUrl(path, 60 * 60 * 24 * 365);
  if (error) throw error;
  return signed.signedUrl;
}
```

- [ ] **Step 2: Verify build** — `npm run build`.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: add note image upload helper"`

---

### Task 8: Notes list page

**Files:** Modify `src/app/notes/page.tsx`; create `src/components/note-card.tsx`, `src/app/notes/new-actions.ts`

**Interfaces:** Replaces the stub with a real list: a "New note" button (creates + redirects to editor), a "Today's note" button (daily note), a search box (query param `?q=`), a sort dropdown (`?sort=`), pinned-first grid of note cards, and an archived toggle (`?archived=1`).

- [ ] **Step 1: `src/app/notes/new-actions.ts`** — `newNoteAction()` (createNote → redirect to `/notes/[id]`), `openDailyNoteAction()` (getOrCreateDailyNote(today) → redirect). Today is computed server-side via `new Date().toISOString().slice(0,10)` inside the action.

- [ ] **Step 2: `src/components/note-card.tsx`** — links to `/notes/[id]`, shows title (or "Untitled"), a content_text snippet, pin indicator, category color dot. Themed.

- [ ] **Step 3: `src/app/notes/page.tsx`** — auth guard; read `searchParams` `{ q, sort, archived }`; `listNotes`; render controls + grid; empty state.

- [ ] **Step 4: Verify build** — `npm run build`.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: add notes list page with search and sort"`

---

### Task 9: Note editor page + actions bar

**Files:** Create `src/app/notes/[id]/page.tsx`; create `src/components/note-actions.tsx`

**Interfaces:** `/notes/[id]` loads the note (auth + ownership via RLS), renders `NoteEditor`, and a `NoteActions` bar (pin/unpin, archive, duplicate, delete, category select). Category select uses `listCategories` + an `assignCategoryAction`.

- [ ] **Step 1: `src/components/note-actions.tsx`** — client buttons calling the Task 6 actions (pin/archive/duplicate/delete) + a category `<select>` posting to `assignCategoryAction`.

- [ ] **Step 2: Add `assignCategoryAction(id, categoryId)`** to `src/app/notes/[id]/actions.ts` (updateNote category_id + revalidate).

- [ ] **Step 3: `src/app/notes/[id]/page.tsx`** — auth guard; `getNote`; if null → `notFound()`; render `AppShell` → `NoteActions` + `NoteEditor`; pass categories for the select.

- [ ] **Step 4: Verify build** — `npm run build`.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: add note editor page with actions bar"`

---

### Task 10: End-to-end runtime verification

- [ ] **Step 1** — As the test user via REST: create a note, patch title+content+content_text, verify search (`content_text=ilike.*term*`) finds it, toggle pinned/archived, duplicate, delete. Assert each step's HTTP status + row state.
- [ ] **Step 2** — Storage: upload a small image to `note-images/<uid>/test.png` with the user token (expect 200), confirm a second user is blocked from that folder (expect 4xx), then clean up.
- [ ] **Step 3** — Daily note: insert with a `daily_date`, attempt a duplicate same-day insert, expect the unique index to reject the second (409).
- [ ] **Step 4** — `npm run build && npm run lint && npm test` all green.

---

## Self-Review

**Spec coverage (notes):** create/edit/delete/archive/pin/duplicate/search/sort ✓ (T4/T6/T8/T9); rich text + headings + lists + checklists + links + images ✓ (T6); multiple images + captions/descriptions ✓ (attachments has caption/description T2; multi-insert T6/T7; caption-editing UI deferred, columns+API present); mixed content ✓ (single Tiptap doc); daily note ✓ (T4/T8); assign to categories / move between ✓ (T9); search by title/content ✓ (content_text + index T1/T4). Image metadata search and inline-task-in-note feed later phases.

**Placeholder scan:** Tasks 8–9 describe a few components in prose rather than full code (note-card, list controls, actions bar) — these are straightforward themed JSX following established patterns; full code written at implementation. All data/SQL/editor code is concrete. Caption-edit UI explicitly deferred (not a silent gap).

**Type consistency:** `Note` derived from `Database` types (T3) used across T4/T6/T8/T9. `Json` reused from database.types for content. Server actions consume data-module signatures verbatim. `uploadNoteImage(noteId, file)` signature matches its call in T6.
