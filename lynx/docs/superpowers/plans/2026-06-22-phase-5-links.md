# Phase 5 — Saved Links (with previews) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can paste a URL, save it (auto-fetching a title/description/image preview), attach a personal note, categorize it, search saved links, and delete them — all per-user under RLS.

**Architecture:** A `links` table stores the URL plus fetched preview metadata and an attached note. A server-side preview fetcher downloads the page and parses OpenGraph/meta tags (pure, tested parser). Follows the established data-layer pattern (migration → types → data module → server actions → UI).

**Tech Stack:** Next.js 16, Supabase Postgres + RLS, Vitest. No new runtime deps (preview parsed with a small regex extractor).

## Global Constraints

- RLS on `links` keyed on `auth.uid()`; `user_id` defaults to `auth.uid()`.
- DB access through `src/lib/data/links.ts`; types hand-maintained in `database.types.ts`.
- Preview fetch happens server-side only (never expose user IP/SSRF surface to client); cap response size and timeout.
- Cambria/Lynx design system; cards use `.panel`/`var(--shadow)` floating style. TS strict; commit per task.

---

### Task 1: Links migration

**Files:** Create `supabase/migrations/0005_links.sql`

**Interfaces:** `public.links(id, user_id, url, title, description, image_url, note, category_id, created_at)` with RLS.

- [ ] **Step 1: Write `supabase/migrations/0005_links.sql`**

```sql
create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  url text not null,
  title text not null default '',
  description text not null default '',
  image_url text not null default '',
  note text not null default '',
  category_id uuid references public.categories (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists links_user_idx on public.links (user_id, created_at desc);
alter table public.links enable row level security;
drop policy if exists "links - select own" on public.links;
create policy "links - select own" on public.links for select using (auth.uid() = user_id);
drop policy if exists "links - insert own" on public.links;
create policy "links - insert own" on public.links for insert with check (auth.uid() = user_id);
drop policy if exists "links - update own" on public.links;
create policy "links - update own" on public.links for update using (auth.uid() = user_id);
drop policy if exists "links - delete own" on public.links;
create policy "links - delete own" on public.links for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Push** — `npx --yes supabase@latest db push --db-url "$(grep '^SUPABASE_DB_URL=' .env.local | cut -d= -f2-)"` (answer `y`).
- [ ] **Step 3: Verify** — `curl … /rest/v1/links?select=id&limit=1` → `200`.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: add links table migration with RLS"`

---

### Task 2: Extend DB types

**Files:** Modify `src/lib/database.types.ts`

- [ ] **Step 1: Add `links` table** (Row/Insert/Update): id string, user_id string, url string, title string, description string, image_url string, note string, category_id string|null, created_at string. Insert requires `url`, rest optional; Update all optional.
- [ ] **Step 2: Verify** — `npx tsc --noEmit`.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "chore: add links to DB types"`

---

### Task 3: Preview metadata parser (pure, tested)

**Files:** Create `src/lib/links/parse-preview.ts`, `src/lib/links/parse-preview.test.ts`

**Interfaces:** `parsePreview(html: string, baseUrl: string): { title: string; description: string; image: string }` — prefers OG tags, falls back to `<title>`/`<meta name=description>`; resolves relative image URLs against `baseUrl`.

- [ ] **Step 1: Failing test `src/lib/links/parse-preview.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parsePreview } from "./parse-preview";

describe("parsePreview", () => {
  it("prefers OpenGraph tags", () => {
    const html = `<head>
      <meta property="og:title" content="OG Title" />
      <meta property="og:description" content="OG Desc" />
      <meta property="og:image" content="https://x.com/img.png" />
      <title>Fallback</title></head>`;
    expect(parsePreview(html, "https://x.com")).toEqual({
      title: "OG Title", description: "OG Desc", image: "https://x.com/img.png",
    });
  });
  it("falls back to <title> and meta description", () => {
    const html = `<title>Plain Title</title><meta name="description" content="Plain desc">`;
    const r = parsePreview(html, "https://x.com");
    expect(r.title).toBe("Plain Title");
    expect(r.description).toBe("Plain desc");
  });
  it("resolves relative og:image against base url", () => {
    const html = `<meta property="og:image" content="/cover.jpg">`;
    expect(parsePreview(html, "https://x.com/page").image).toBe("https://x.com/cover.jpg");
  });
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement `src/lib/links/parse-preview.ts`**

```ts
function meta(html: string, patterns: RegExp[]): string {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decode(m[1].trim());
  }
  return "";
}
function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
export function parsePreview(html: string, baseUrl: string): { title: string; description: string; image: string } {
  const title =
    meta(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
    ]) || meta(html, [/<title[^>]*>([^<]+)<\/title>/i]);
  const description = meta(html, [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
  ]);
  let image = meta(html, [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  ]);
  if (image && !/^https?:\/\//i.test(image)) {
    try { image = new URL(image, baseUrl).toString(); } catch { image = ""; }
  }
  return { title, description, image };
}
```

- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: add tested link preview parser"`

---

### Task 4: Preview fetcher + links data module

**Files:** Create `src/lib/links/fetch-preview.ts`, `src/lib/data/links.ts`

**Interfaces:**
- `fetchPreview(url: string): Promise<{ title; description; image }>` — server-only; GETs the URL with a 5s timeout and a desktop UA, reads up to ~200KB, runs `parsePreview`; returns empties on any failure (never throws).
- `type LinkRow`, `listLinks(opts?: { search?; categoryId? })`, `createLink(input)`, `updateLink(id, patch)`, `deleteLink(id)`.

- [ ] **Step 1: Implement `src/lib/links/fetch-preview.ts`**

```ts
import { parsePreview } from "./parse-preview";

export async function fetchPreview(url: string): Promise<{ title: string; description: string; image: string }> {
  const empty = { title: "", description: "", image: "" };
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LynxBot/1.0)" },
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) return empty;
    const html = (await res.text()).slice(0, 200_000);
    return parsePreview(html, res.url || url);
  } catch {
    return empty;
  }
}
```

- [ ] **Step 2: Implement `src/lib/data/links.ts`** (mirrors categories/notes pattern):

```ts
import { createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type LinkRow = Database["public"]["Tables"]["links"]["Row"];

export async function listLinks(opts: { search?: string; categoryId?: string } = {}): Promise<LinkRow[]> {
  const supabase = await createServerSupabase();
  let q = supabase.from("links").select("*");
  if (opts.categoryId) q = q.eq("category_id", opts.categoryId);
  if (opts.search) {
    const term = opts.search.replace(/[%,]/g, " ");
    q = q.or(`title.ilike.%${term}%,url.ilike.%${term}%,note.ilike.%${term}%`);
  }
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createLink(input: {
  url: string; title?: string; description?: string; image_url?: string; category_id?: string | null;
}): Promise<LinkRow> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("links").insert(input).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateLink(id: string, patch: { note?: string; category_id?: string | null; title?: string }): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("links").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteLink(id: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("links").delete().eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit`.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: add link preview fetcher and links data module"`

---

### Task 5: Links server actions

**Files:** Create `src/app/links/actions.ts`

**Interfaces:** `addLinkAction(formData)` (normalize URL → `fetchPreview` → `createLink` → revalidate); `updateLinkNoteAction(formData)`; `assignLinkCategoryAction(id, categoryId)`; `deleteLinkAction(formData)`.

- [ ] **Step 1: Implement `src/app/links/actions.ts`**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { fetchPreview } from "@/lib/links/fetch-preview";
import { createLink, updateLink, deleteLink } from "@/lib/data/links";

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try { return new URL(withScheme).toString(); } catch { return null; }
}

export async function addLinkAction(formData: FormData) {
  const url = normalizeUrl(String(formData.get("url") ?? ""));
  if (!url) return;
  const preview = await fetchPreview(url);
  await createLink({
    url,
    title: preview.title || url,
    description: preview.description,
    image_url: preview.image,
  });
  revalidatePath("/links");
}

export async function updateLinkNoteAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "");
  if (!id) return;
  await updateLink(id, { note });
  revalidatePath("/links");
}

export async function assignLinkCategoryAction(id: string, categoryId: string | null) {
  await updateLink(id, { category_id: categoryId });
  revalidatePath("/links");
}

export async function deleteLinkAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteLink(id);
  revalidatePath("/links");
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit`.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: add links server actions with preview fetch"`

---

### Task 6: Links page + link card

**Files:** Modify `src/app/links/page.tsx`; create `src/components/link-card.tsx`

**Interfaces:** Page (auth-guarded) with an add-URL form, a search box (`?q=`), and a grid of link cards. `LinkCard` shows the preview image (if any), title linking out (new tab), description, an editable note (inline form), a category select, and delete.

- [ ] **Step 1: `src/components/link-card.tsx`** — floating panel card: optional `<img src={image_url}>` (rounded top), title `<a href target=_blank rel="noopener noreferrer">`, hostname, description, a small `<form>` textarea for the note (submits `updateLinkNoteAction`), category `<select>` (client, posts `assignLinkCategoryAction` via a tiny client wrapper or a form), delete button. Themed with `var(--surface)`, `var(--shadow)`, `rounded-2xl`.

- [ ] **Step 2: `src/app/links/page.tsx`** — replace stub: auth guard; read `?q`; `listLinks({ search })`; load categories for selects; render add form + search + grid + empty state.

- [ ] **Step 3: Image host config** — Phase uses plain `<img>` (not `next/image`) for preview images to avoid remote-host allowlist config; note this choice in the commit.

- [ ] **Step 4: Verify build** — `npm run build`.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: add links page with preview cards, notes, categories"`

---

### Task 7: End-to-end runtime verification

- [ ] **Step 1** — As the test user via REST: insert a link, list it, update its note + category, search by title/url/note, delete; assert statuses + state.
- [ ] **Step 2** — RLS: second user cannot see the first user's links (`[]`).
- [ ] **Step 3** — Parser unit tests pass; `npm run build && npm run lint && npm test` all green.
- [ ] **Step 4** — (Optional) sanity-check `fetchPreview` against a real URL in a node one-liner; tolerate network-blocked envs (returns empties, never throws).

---

## Self-Review

**Spec coverage (links):** paste URL ✓ (T5 normalize), save for reference ✓ (T1/T5), attach note ✓ (note column + T5/T6), categorize ✓ (category_id + T5/T6), search ✓ (T4 listLinks), view previews when available ✓ (T3/T4 fetch + T6 render), per-user isolation ✓ (RLS T1/T7).

**Placeholder scan:** Task 6 describes the two view components in prose; full themed JSX written at implementation following the note-card pattern. All data/SQL/parser/action code is concrete.

**Type consistency:** `LinkRow` from `Database` types (T2) used across T4/T6. Action signatures consume data-module functions verbatim. `fetchPreview` returns `{title,description,image}` consumed in T5 and produced by `parsePreview` (T3) — names aligned.
