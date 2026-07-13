# Phase 3 — Categories (schema, data layer, CRUD UI) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can create, rename, recolor/icon, reorder, and delete custom categories, stored per-user under RLS and synced via the server. This also establishes the shared data-layer pattern (typed DB types + `src/lib/data/*` modules + server actions) that later phases reuse.

**Architecture:** A `categories` table with RLS keyed on `auth.uid()`. DB types are generated from the live schema into `src/lib/database.types.ts`. A `src/lib/data/categories.ts` module wraps all reads/writes through the request-scoped server client. Server components render the list; server actions mutate and `revalidatePath`. The sidebar nav becomes real routes with active-state highlighting.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), `supabase gen types`, Vitest.

## Global Constraints

- Every table has RLS with per-user (`auth.uid()`) policies; `user_id` defaults to `auth.uid()`.
- All DB access goes through `src/lib/data/*` modules using `createServerSupabase()` — no raw queries in components.
- DB types live in `src/lib/database.types.ts`, regenerated when schema changes.
- TypeScript strict; no `any`. Commit after every task.
- Migrations pushed via `npx supabase db push --db-url "$SUPABASE_DB_URL"` (URL in gitignored `.env.local`).

---

### Task 1: Categories migration

**Files:**
- Create: `supabase/migrations/0002_categories.sql`

**Interfaces:**
- Produces: `public.categories(id, user_id, name, color, icon, sort_order, created_at)` with RLS (full CRUD for owner).

- [ ] **Step 1: Write `supabase/migrations/0002_categories.sql`**

```sql
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  color text not null default 'orange',
  icon text not null default 'folder',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists categories_user_idx on public.categories (user_id, sort_order);

alter table public.categories enable row level security;

drop policy if exists "categories - select own" on public.categories;
create policy "categories - select own" on public.categories
  for select using (auth.uid() = user_id);

drop policy if exists "categories - insert own" on public.categories;
create policy "categories - insert own" on public.categories
  for insert with check (auth.uid() = user_id);

drop policy if exists "categories - update own" on public.categories;
create policy "categories - update own" on public.categories
  for update using (auth.uid() = user_id);

drop policy if exists "categories - delete own" on public.categories;
create policy "categories - delete own" on public.categories
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Push it**

Run: `npx --yes supabase@latest db push --db-url "$(grep '^SUPABASE_DB_URL=' .env.local | cut -d= -f2-)"` (answer `y`)
Expected: "Applying migration 0002_categories.sql..." then "Finished supabase db push."

- [ ] **Step 3: Verify table exists**

Run: `curl -s -o /dev/null -w "%{http_code}\n" -H "apikey: $KEY" "$BASE/rest/v1/categories?select=id&limit=1"` (KEY/BASE = publishable key + project URL)
Expected: `200`.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: add categories table migration with RLS"`

---

### Task 2: Generate DB types

**Files:**
- Create: `src/lib/database.types.ts`
- Modify: `package.json` (add `db:types` script)

**Interfaces:**
- Produces: `Database` type covering all public tables; helper aliases used by data modules.

- [ ] **Step 1: Add script to `package.json`**

```json
"db:types": "supabase gen types typescript --db-url \"$SUPABASE_DB_URL\" --schema public > src/lib/database.types.ts"
```

- [ ] **Step 2: Generate**

Run: `export $(grep '^SUPABASE_DB_URL=' .env.local) && npx --yes supabase@latest gen types typescript --db-url "$SUPABASE_DB_URL" --schema public > src/lib/database.types.ts`
Expected: file populated with `export type Database = { public: { Tables: { categories: ..., profiles: ... } } }`.

- [ ] **Step 3: Verify it compiles** — `npx tsc --noEmit` → no errors.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "chore: generate Supabase database types"`

---

### Task 3: Categories data module (typed reads/writes)

**Files:**
- Create: `src/lib/data/categories.ts`

**Interfaces:**
- Consumes: `createServerSupabase`, `Database`.
- Produces:
  - `type Category = Database["public"]["Tables"]["categories"]["Row"]`
  - `listCategories(): Promise<Category[]>` — owner's categories ordered by `sort_order`.
  - `createCategory(input: { name: string; color?: string; icon?: string }): Promise<Category>`
  - `updateCategory(id: string, patch: { name?: string; color?: string; icon?: string }): Promise<void>`
  - `deleteCategory(id: string): Promise<void>`
  - `reorderCategories(orderedIds: string[]): Promise<void>` — sets `sort_order` to array index.

- [ ] **Step 1: Implement `src/lib/data/categories.ts`**

```ts
import { createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Category = Database["public"]["Tables"]["categories"]["Row"];

export async function listCategories(): Promise<Category[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createCategory(input: {
  name: string;
  color?: string;
  icon?: string;
}): Promise<Category> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("categories")
    .insert({ name: input.name, color: input.color, icon: input.icon })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateCategory(
  id: string,
  patch: { name?: string; color?: string; icon?: string },
): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("categories").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCategory(id: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderCategories(orderedIds: string[]): Promise<void> {
  const supabase = await createServerSupabase();
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("categories").update({ sort_order: index }).eq("id", id),
    ),
  );
}
```

- [ ] **Step 2: Verify compile** — `npx tsc --noEmit` → no errors.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: add categories data module"`

---

### Task 4: Categories server actions

**Files:**
- Create: `src/app/categories/actions.ts`

**Interfaces:**
- Consumes: the data module.
- Produces: `createCategoryAction(formData)`, `renameCategoryAction(formData)`, `recolorCategoryAction(formData)`, `deleteCategoryAction(formData)` — each mutates then `revalidatePath("/categories")`.

- [ ] **Step 1: Implement `src/app/categories/actions.ts`**

```ts
"use server";
import { revalidatePath } from "next/cache";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/data/categories";

export async function createCategoryAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await createCategory({ name });
  revalidatePath("/categories");
}

export async function renameCategoryAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;
  await updateCategory(id, { name });
  revalidatePath("/categories");
}

export async function recolorCategoryAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const color = String(formData.get("color") ?? "");
  if (!id || !color) return;
  await updateCategory(id, { color });
  revalidatePath("/categories");
}

export async function deleteCategoryAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteCategory(id);
  revalidatePath("/categories");
}
```

- [ ] **Step 2: Verify compile** — `npx tsc --noEmit`.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: add categories server actions"`

---

### Task 5: Nav routing + section stubs

**Files:**
- Modify: `src/components/app-shell.tsx` (nav items → real hrefs, active highlight)
- Create stubs: `src/app/notes/page.tsx`, `src/app/links/page.tsx`, `src/app/tasks/page.tsx`, `src/app/reminders/page.tsx`, `src/app/settings/page.tsx`
- Create: `src/components/section-placeholder.tsx`

**Interfaces:**
- Consumes: `usePathname`.
- Produces: nav that links to `/` (Dashboard), `/notes`, `/links`, `/tasks`, `/reminders`, `/categories`, `/settings`; the active route uses `--accent`. Stub pages render a themed "coming soon" placeholder inside the shell.

- [ ] **Step 1: Create `src/components/section-placeholder.tsx`**

```tsx
export function SectionPlaceholder({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--text)" }}>
        {title}
      </h1>
      <p style={{ color: "var(--muted)" }}>Coming soon in a later phase.</p>
    </div>
  );
}
```

- [ ] **Step 2: Convert nav to a client component with active state.** Replace the `<nav>` block in `app-shell.tsx` with a new `<SidebarNav />` client component. Create it inline as `src/components/sidebar-nav.tsx`:

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { label: "Dashboard", href: "/" },
  { label: "Notes", href: "/notes" },
  { label: "Links", href: "/links" },
  { label: "Tasks", href: "/tasks" },
  { label: "Reminders", href: "/reminders" },
  { label: "Categories", href: "/categories" },
  { label: "Settings", href: "/settings" },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav
      className="md:w-56 border-b md:border-b-0 md:border-r p-4 flex md:flex-col gap-1 overflow-x-auto"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="font-semibold mb-3 hidden md:block" style={{ color: "var(--text)" }}>
        Second Brain
      </div>
      {NAV.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors"
            style={
              active
                ? { background: "var(--accent)", color: "var(--accent-fg)" }
                : { color: "var(--text)" }
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: Use `SidebarNav` in `app-shell.tsx`.** Remove the old inline `<nav>` + `NAV` const; import and render `<SidebarNav />`.

- [ ] **Step 4: Create the five stub pages.** Each follows this shape (swap the title), e.g. `src/app/notes/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function NotesPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return (
    <AppShell email={user.email ?? ""}>
      <SectionPlaceholder title="Notes" />
    </AppShell>
  );
}
```

Repeat for `links` ("Links"), `tasks` ("Tasks"), `reminders` ("Reminders"), `settings` ("Settings").

- [ ] **Step 5: Verify build** — `npm run build` → all routes listed, success.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: wire nav routing and add section stubs"`

---

### Task 6: Categories management page

**Files:**
- Create: `src/app/categories/page.tsx`, `src/components/category-row.tsx`

**Interfaces:**
- Consumes: `listCategories`, the server actions, auth guard.
- Produces: a page that lists categories with inline rename, a color picker (reusing the 7 accent colors), delete, and an "add category" form.

- [ ] **Step 1: Create `src/components/category-row.tsx`**

```tsx
import { ACCENTS } from "@/lib/theme";
import type { Category } from "@/lib/data/categories";
import { renameCategoryAction, recolorCategoryAction, deleteCategoryAction } from "@/app/categories/actions";

const COLOR_HEX: Record<string, string> = {
  orange: "#e8772e", blue: "#2e7de8", green: "#2ea84f",
  purple: "#7d4ee8", red: "#e83e3e", teal: "#1fa9a0", pink: "#e84e9c",
};

export function CategoryRow({ category }: { category: Category }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <span className="h-4 w-4 rounded-full" style={{ background: COLOR_HEX[category.color] ?? COLOR_HEX.orange }} />
      <form action={renameCategoryAction} className="flex-1">
        <input type="hidden" name="id" value={category.id} />
        <input name="name" defaultValue={category.name}
          className="w-full bg-transparent text-sm outline-none" style={{ color: "var(--text)" }} />
      </form>
      <div className="flex gap-1">
        {ACCENTS.map((c) => (
          <form action={recolorCategoryAction} key={c}>
            <input type="hidden" name="id" value={category.id} />
            <input type="hidden" name="color" value={c} />
            <button type="submit" aria-label={`Set color ${c}`}
              className="h-4 w-4 rounded-full border"
              style={{ background: COLOR_HEX[c], borderColor: "var(--border)",
                outline: category.color === c ? "2px solid var(--text)" : "none" }} />
          </form>
        ))}
      </div>
      <form action={deleteCategoryAction}>
        <input type="hidden" name="id" value={category.id} />
        <button type="submit" className="text-sm" style={{ color: "var(--danger)" }}>Delete</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/categories/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CategoryRow } from "@/components/category-row";
import { createCategoryAction } from "./actions";
import { listCategories } from "@/lib/data/categories";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function CategoriesPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const categories = await listCategories();

  return (
    <AppShell email={user.email ?? ""}>
      <h1 className="text-2xl font-semibold mb-4" style={{ color: "var(--text)" }}>Categories</h1>
      <form action={createCategoryAction} className="flex gap-2 mb-6">
        <input name="name" required placeholder="New category…"
          className="flex-1 rounded-md border px-3 py-2 text-sm"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }} />
        <button type="submit" className="rounded-md px-4 py-2 text-sm font-medium"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>Add</button>
      </form>
      <div className="flex flex-col gap-2">
        {categories.length === 0 && (
          <p style={{ color: "var(--muted)" }}>No categories yet. Add your first above.</p>
        )}
        {categories.map((c) => <CategoryRow key={c.id} category={c} />)}
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 3: Verify build** — `npm run build` → success.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: add categories management page"`

---

### Task 7: End-to-end runtime verification

**Files:** none (verification only)

- [ ] **Step 1: Exercise the REST API as the test user** — create, list, rename, recolor, delete a category via PostgREST with a fresh session token, asserting RLS lets the owner do all four and the row reflects each change.

```bash
# obtain token for pkm-tester@example.com, then POST/GET/PATCH/DELETE /rest/v1/categories
# expect: insert returns the row; list shows it; patch updates name/color; delete removes it.
```

- [ ] **Step 2: Confirm cross-user isolation** — a second user cannot see the first user's categories (list returns `[]` for the other token).

- [ ] **Step 3: Build + lint + tests** — `npm run build && npm run lint && npm test` all green.

- [ ] **Step 4: Commit** (if any verification fixtures added) — otherwise note completion.

---

## Self-Review

**Spec coverage (categories):** create ✓ (T4/T6), rename ✓ (T4/T6), delete ✓ (T4/T6), reorder ✓ (data module T3; UI drag deferred — exposed via `reorderCategories`), assign colors/icons ✓ (color in T6; icon column present, picker deferred), no hard limit ✓ (no cap), per-user isolation ✓ (RLS T1, verified T7).

**Placeholder scan:** none — all code/SQL/commands are concrete. Reorder UI and icon picker are intentionally deferred (function + column exist); noted, not placeholders.

**Type consistency:** `Category` derived from generated `Database` type (T2) used uniformly in T3/T6. Server actions (T4) consume data-module functions with matching signatures. `AppShell email` prop consistent with Phase 2.
