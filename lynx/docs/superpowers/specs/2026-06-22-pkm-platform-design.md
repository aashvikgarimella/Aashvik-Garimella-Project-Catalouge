# Design Spec — Personal Knowledge Management & Productivity Platform

**Date:** 2026-06-22
**Status:** Approved (design + build order)
**Working name:** TBD ("THE_PRODUCT")

## 1. Vision & Scope

A cross-platform personal knowledge-management and productivity platform — a "digital second brain" — that syncs across devices and lets users capture notes, images, links, tasks, and reminders in a clean, minimal interface, with optional AI assistance and an architecture ready for future agentic AI.

### In scope for v1 (the buildable "whole product")
Accounts/auth, cloud sync, notes (rich text + images + mixed content), saved links with previews, custom categories, tasks, reminders, dashboard/home with startup preferences, full theming (cream + orange, dark mode, swappable accent), and the **optional** in-note AI assistant. Plus the cross-cutting architectural seams for the agentic future: AI service layer, tool registry, permission framework, activity log.

### Deferred (architectural hooks only, not implemented in v1)
Autonomous multi-step agents, RAG / long-term memory, real-time collaboration & shared workspaces, browser extension, voice/video/PDF attachments, calendar integration, multi-provider AI, offline write-sync conflict resolution beyond basic.

## 2. Platform Strategy

**Web-first PWA.** One responsive Next.js codebase serves desktop browsers, tablets, and mobile browsers, installable as a PWA. This covers all four target platforms (iOS, Android, desktop, tablets) immediately; native store apps can be wrapped later (e.g. Capacitor) without rewriting. UX stays consistent across platforms while respecting touch vs. pointer interaction.

## 3. Tech Stack

- **Framework:** Next.js 15 (App Router) + React + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui; CSS variables for theme/accent
- **Editor:** Tiptap (ProseMirror) — headings, lists, checklists, links, inline images
- **Data/cache:** TanStack Query with optimistic updates
- **Backend:** Supabase — Postgres, Auth (Google + email/password), Storage (images), Realtime, Row-Level Security
- **AI:** Claude API (Anthropic) via server-side Next.js API routes (latest Claude model); key never reaches the client
- **Notifications:** Web Push (service worker) + optional email via Resend; due-reminder firing via Supabase scheduled job (pg_cron)
- **PWA:** service worker for installability + basic offline read cache

## 4. Architecture — Three Layers

### UI layer
Next.js App Router. Responsive component tree (one design, adapts to pointer/touch). Tiptap editor for mixed content. shadcn/ui primitives themed via CSS variables.

### Data / sync layer
Supabase client + TanStack Query for caching and optimistic updates (the "instant" feel). Supabase Realtime subscriptions push changes to other devices for near-real-time sync. Every table is `user_id`-scoped with Row-Level Security — users can only read/write their own rows.

### AI service layer (the agentic seam)
A **separate** module (`/lib/ai`) plus server-side API routes that hold the Claude key. **Tool-based from day one:** a registry of typed tools (`createNote`, `getNotes`, `createTask`, `searchLinks`, `createReminder`, …) that wrap data-layer operations. The v1 in-note assistant invokes these tools; future agents invoke the *same* tools. Cross-cutting rules:

- AI is **disabled by default**; user opts in.
- AI **only activates when explicitly requested** — never automatic.
- Any data-changing action **requires confirm-before-apply**.
- Every AI action writes to `ai_activity_log` — logged, reviewable, transparent, reversible where possible.
- A permission framework gates which tools/features AI may touch.

This delivers the optional assistant now while making agents (Research/Organization/Task/Knowledge/Workflow) an additive future build, not a rewrite.

## 5. Data Model (Postgres + RLS)

All tables carry `user_id` and RLS policies. JSONB used for flexible content/metadata.

| Table | Key fields |
|---|---|
| `profiles` | theme, accent_color, ai_enabled, startup_preference, dashboard_config |
| `categories` | name, color, icon, sort_order |
| `notes` | title, content (JSONB Tiptap doc), category_id, pinned, archived, daily_date (nullable), created_at, updated_at |
| `attachments` | note_id, storage_path, caption, description |
| `links` | url, title, preview (JSONB), note_text, category_id |
| `tasks` | title, body, priority (low/medium/high/critical), status (todo/in_progress/completed/archived), category_id, note_id (nullable), due_at |
| `reminders` | target_type (task/note/event/custom), target_id, schedule_at, recurrence (none/daily/weekly/monthly/yearly/custom), notify_push, notify_email, next_fire_at |
| `ai_activity_log` | action, payload (JSONB), status, reversible, created_at |

## 6. Feature Detail

- **Notes:** create/edit/delete/archive/pin/duplicate/search/sort; rich text, checklists, headings, lists, links, multiple images (upload + drag-drop, caption + description), mixed content (text + images + links + inline tasks). Daily note (one per calendar day).
- **Links:** paste URL, save, attach a note, categorize, search, link preview (title/image/description) fetched server-side.
- **Categories:** create/rename/delete/reorder, color + icon, move notes between, no hard limit.
- **Search:** across note title/content, task names, categories, links, image metadata. Postgres full-text + trigram; fast/responsive.
- **Tasks:** CRUD, complete, archive, priorities (4), statuses (4), assign to categories, link to notes.
- **Reminders:** for tasks/notes/events/custom; date+time scheduling; recurrence; push + optional email; sync across devices.
- **Home/Dashboard:** startup preference (daily note / last opened / selected category / dashboard). Dashboard shows recent notes, pinned notes, upcoming reminders, active tasks, recent links, AI suggestions (if enabled); customizable.

## 7. Design System

- **Default theme:** soft cream background, orange accent (buttons, active states, nav highlights, selection).
- **Accent customization:** orange (default), blue, green, purple, red, teal, pink — implemented as CSS variables so a change applies app-wide instantly.
- **Dark mode:** full dark theme, system detection, manual toggle (Tailwind class strategy).
- **Language:** flat 2D, minimal, clean hierarchy, generous spacing, modern/lightweight; common actions in minimal taps/clicks; accessible.

## 8. Notifications

Web Push via service worker (works as installed PWA, incl. iOS 16.4+; caveats flagged per-platform). Optional email via Resend. Due-reminder firing on a Supabase scheduled job (pg_cron) so reminders fire even when the app is closed. All reminders sync across devices.

## 9. Security & Privacy

Encryption in transit (HTTPS/TLS), Supabase-managed at-rest storage, RLS per-user isolation, AI key server-side only. Users control AI enablement and see what AI can access and do (settings + activity log).

## 10. Build Order (each phase shippable, committed)

1. **Scaffold** — Next.js + Supabase project + design tokens + app shell/nav + theming (light/dark/accent)
2. **Auth** — Google + email/password, profiles, protected routes
3. **Schema + RLS migrations** + Categories CRUD
4. **Notes** — editor (rich text/checklists/links/images), pin/archive/duplicate/search/sort, daily note
5. **Links** — save, preview, attach notes, categorize
6. **Tasks** — priorities, statuses, link to notes/categories
7. **Reminders** — scheduling, recurrence, push/email
8. **Dashboard + home** — startup preferences, customizable dashboard
9. **AI layer** — tool registry, optional in-note assistant, activity log, permission settings
10. **PWA polish** — offline, performance, cross-device sync validation

## 11. Open Items / Dependencies

- Git: initialize repo, commit each phase.
- Supabase project: create, capture URL + anon/service keys in env.
- Claude API key: needed at Phase 9 (not blocking earlier phases).
- Resend key: optional, for email reminders.
- Product name: TBD.
