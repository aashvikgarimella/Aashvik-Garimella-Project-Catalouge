# Lynx — Single-Page Redesign Spec

**Date:** 2026-06-22
**Status:** Building (directed redesign)

## Intent
Collapse Lynx from a multi-tab app into ONE notes-centric surface with minimal floating chrome, plus a polished animated landing page for logged-out visitors.

## Routing
- `/` — if logged **out**: animated landing page (hero, smooth entrance/float animations, cream+orange, rounded floating panels). If logged **in**: redirect to `/notes`.
- `/notes` — the single main app page (grouped notes).
- `/notes/[id]` — note editor (with reminders).
- `/login`, `/signup` — unchanged (Lynx-branded).
- **Removed routes:** `/links`, `/tasks`, `/reminders`, `/categories`, dashboard/home content.

## App chrome (replaces sidebar + top bar)
- **Lynx wordmark** — floating, fixed, top-left.
- **Menu button** — floating icon on the left edge → opens a slide-out drawer listing recent notes, grouped **by category** or **by date** (user's choice, set in Settings). Includes "New note".
- **Settings button** — floating gear icon, top-right → opens a Settings drawer.
- No persistent sidebar; no top bar.

## Settings (drawer, opened by the gear icon)
Absorbs everything from the old top bar plus new prefs:
- Account email + Sign out.
- Theme mode (light/dark/system) + accent color (7 swatches).
- **Note grouping** default: "By date" or "By category" (drives the menu drawer + main page grouping). Stored on `profiles.note_grouping`.
- Category management: create / rename / recolor / delete (categories still exist as the sort dimension; just no dedicated tab).

## Notes
- Main page shows notes grouped by category or date (per preference), with search.
- **Reminders are per-note:** a "Make a reminder" control at the top of each note (date + time + optional message), with a list of that note's reminders and delete. Stored in a `reminders` table linked to `note_id`. (Notification *delivery* scheduler remains a later phase; creation/management ships now.)

## Font
- Primary font **Styrene B** via `--font-ui`, loaded through `@font-face` from `public/fonts/` when present, with a system sans fallback. Licensed files to be dropped in by the user.

## Removed from surface (kept in DB/history, just not navigable)
Links, standalone tasks, reminders tab, categories tab, dashboard.
