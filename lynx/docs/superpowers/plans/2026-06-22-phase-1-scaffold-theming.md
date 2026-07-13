# Phase 1 — Scaffold, Design System & Theming — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a running Next.js + TypeScript + Tailwind PWA shell with the full theming system (cream/orange default, dark mode, system detection, manual toggle, swappable accent color) and base app navigation.

**Architecture:** Next.js 15 App Router single codebase. Theme state lives in a React context backed by `localStorage` and applied via a `data-theme` attribute + CSS variables on `:root`, so light/dark and accent changes take effect app-wide instantly without a reload. A server-rendered inline script applies the saved theme before first paint to avoid flash.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, Vitest + Testing Library for unit tests.

## Global Constraints

- Framework: Next.js 15 App Router; TypeScript everywhere; no `any` in committed code.
- Styling: Tailwind CSS; all theme colors via CSS variables — no hard-coded hex in components.
- Default theme: soft cream background (`--bg`), orange accent (`--accent`).
- Accent options: orange (default), blue, green, purple, red, teal, pink — applied app-wide.
- Dark mode: full dark theme + system detection + manual toggle.
- Design language: flat 2D, minimal, generous spacing, accessible.
- Commit after every task with a `feat:`/`chore:`/`test:` prefixed message.

---

### Task 1: Scaffold Next.js app

**Files:**
- Create: project root files via `create-next-app` (package.json, tsconfig.json, next.config.ts, app/, etc.)

**Interfaces:**
- Produces: a runnable Next.js app at repo root; `npm run dev` serves on :3000.

- [ ] **Step 1: Scaffold into the existing repo**

Run (from repo root; the repo already has `.git`, `docs/`, `.gitignore`, and `the big site.pdf` — scaffold into a temp dir then move to avoid create-next-app refusing a non-empty dir):

```bash
npx create-next-app@latest .pkm-tmp --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
# move generated files into repo root without clobbering existing docs/.git/pdf
rsync -a .pkm-tmp/ ./
rm -rf .pkm-tmp
```

- [ ] **Step 2: Verify it runs**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + TS + Tailwind app"
```

---

### Task 2: Test tooling

**Files:**
- Create: `vitest.config.ts`, `src/test/setup.ts`
- Modify: `package.json` (add `test` script + devDeps)

**Interfaces:**
- Produces: `npm test` runs Vitest with jsdom + Testing Library matchers.

- [ ] **Step 1: Install deps**

```bash
npm i -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Add `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", globals: true, setupFiles: ["./src/test/setup.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

Also install the react plugin: `npm i -D @vitejs/plugin-react`

- [ ] **Step 3: Add `src/test/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add test script to `package.json`**

```json
"scripts": { "test": "vitest run", "test:watch": "vitest" }
```

- [ ] **Step 5: Verify**

Run: `npm test`
Expected: "No test files found" exit 0 (or passes once tests exist).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: add Vitest + Testing Library"
```

---

### Task 3: Theme tokens (CSS variables)

**Files:**
- Create: `src/styles/themes.css`
- Modify: `src/app/globals.css` (import themes, set base body styles)

**Interfaces:**
- Produces: CSS variables `--bg`, `--surface`, `--text`, `--muted`, `--border`, `--accent`, `--accent-fg` defined for `[data-theme="light"]` and `[data-theme="dark"]`, with accent overridden by `[data-accent="..."]`.

- [ ] **Step 1: Write `src/styles/themes.css`**

```css
:root, [data-theme="light"] {
  --bg: #f6f1e7;        /* soft cream */
  --surface: #fffdf8;
  --text: #2b2b2b;
  --muted: #6b6b6b;
  --border: #e6dfd2;
  --accent: #e8772e;    /* orange */
  --accent-fg: #ffffff;
}
[data-theme="dark"] {
  --bg: #1b1a17;
  --surface: #232120;
  --text: #ece7df;
  --muted: #a39c90;
  --border: #34312c;
  --accent: #e8772e;
  --accent-fg: #ffffff;
}
[data-accent="blue"]   { --accent: #2e7de8; }
[data-accent="green"]  { --accent: #2ea84f; }
[data-accent="purple"] { --accent: #7d4ee8; }
[data-accent="red"]    { --accent: #e83e3e; }
[data-accent="teal"]   { --accent: #1fa9a0; }
[data-accent="pink"]   { --accent: #e84e9c; }
```

- [ ] **Step 2: Import + base styles in `src/app/globals.css`**

Add at top (keep Tailwind directives) :

```css
@import "../styles/themes.css";
body { background: var(--bg); color: var(--text); }
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add theme + accent CSS variables"
```

---

### Task 4: Theme logic (pure, tested)

**Files:**
- Create: `src/lib/theme.ts`
- Test: `src/lib/theme.test.ts`

**Interfaces:**
- Produces:
  - `type Mode = "light" | "dark" | "system"`
  - `type Accent = "orange" | "blue" | "green" | "purple" | "red" | "teal" | "pink"`
  - `resolveTheme(mode: Mode, prefersDark: boolean): "light" | "dark"`
  - `ACCENTS: Accent[]` (ordered, orange first)

- [ ] **Step 1: Write failing test `src/lib/theme.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { resolveTheme, ACCENTS } from "./theme";

describe("resolveTheme", () => {
  it("returns explicit mode unchanged", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
  it("follows system preference when mode is system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("ACCENTS", () => {
  it("lists orange first and has 7 options", () => {
    expect(ACCENTS[0]).toBe("orange");
    expect(ACCENTS).toHaveLength(7);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm test`
Expected: FAIL — cannot find `./theme`.

- [ ] **Step 3: Implement `src/lib/theme.ts`**

```ts
export type Mode = "light" | "dark" | "system";
export type Accent = "orange" | "blue" | "green" | "purple" | "red" | "teal" | "pink";

export const ACCENTS: Accent[] = ["orange", "blue", "green", "purple", "red", "teal", "pink"];

export function resolveTheme(mode: Mode, prefersDark: boolean): "light" | "dark" {
  if (mode === "system") return prefersDark ? "dark" : "light";
  return mode;
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add tested theme resolution logic"
```

---

### Task 5: ThemeProvider + no-flash script

**Files:**
- Create: `src/components/theme-provider.tsx`
- Modify: `src/app/layout.tsx` (wrap children, add pre-paint script, set `lang`)
- Test: `src/components/theme-provider.test.tsx`

**Interfaces:**
- Consumes: `Mode`, `Accent`, `resolveTheme` from `@/lib/theme`.
- Produces:
  - `ThemeProvider` (client component) wrapping the app.
  - `useTheme()` → `{ mode, accent, setMode, setAccent }`, persisted to `localStorage` keys `pkm-mode` / `pkm-accent`, applied to `document.documentElement` as `data-theme` / `data-accent`.

- [ ] **Step 1: Write failing test `src/components/theme-provider.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./theme-provider";

function Probe() {
  const { accent, setAccent } = useTheme();
  return <button onClick={() => setAccent("blue")}>accent:{accent}</button>;
}

describe("ThemeProvider", () => {
  it("defaults to orange and updates the document attribute", () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByRole("button").textContent).toBe("accent:orange");
    act(() => { screen.getByRole("button").click(); });
    expect(document.documentElement.getAttribute("data-accent")).toBe("blue");
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm test`
Expected: FAIL — cannot find `./theme-provider`.

- [ ] **Step 3: Implement `src/components/theme-provider.tsx`**

```tsx
"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Mode, Accent, resolveTheme } from "@/lib/theme";

type Ctx = { mode: Mode; accent: Accent; setMode: (m: Mode) => void; setAccent: (a: Accent) => void };
const ThemeContext = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("system");
  const [accent, setAccent] = useState<Accent>("orange");

  useEffect(() => {
    const m = (localStorage.getItem("pkm-mode") as Mode) || "system";
    const a = (localStorage.getItem("pkm-accent") as Accent) || "orange";
    setMode(m); setAccent(a);
  }, []);

  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", resolveTheme(mode, prefersDark));
    localStorage.setItem("pkm-mode", mode);
  }, [mode]);

  useEffect(() => {
    document.documentElement.setAttribute("data-accent", accent);
    localStorage.setItem("pkm-accent", accent);
  }, [accent]);

  return <ThemeContext.Provider value={{ mode, accent, setMode, setAccent }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const c = useContext(ThemeContext);
  if (!c) throw new Error("useTheme must be used within ThemeProvider");
  return c;
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Wire into `src/app/layout.tsx`**

Wrap `{children}` in `<ThemeProvider>`, and add a pre-paint inline script in `<head>` to apply saved theme before first paint:

```tsx
<script
  dangerouslySetInnerHTML={{
    __html: `(function(){try{var m=localStorage.getItem('pkm-mode')||'system';var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=m==='system'?(d?'dark':'light'):m;document.documentElement.setAttribute('data-theme',t);document.documentElement.setAttribute('data-accent',localStorage.getItem('pkm-accent')||'orange');}catch(e){}})();`,
  }}
/>
```

- [ ] **Step 6: Verify build + tests**

Run: `npm run build && npm test`
Expected: both succeed.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add ThemeProvider with persistence and no-flash script"
```

---

### Task 6: App shell + navigation + theme controls

**Files:**
- Create: `src/components/app-shell.tsx`, `src/components/theme-controls.tsx`
- Modify: `src/app/page.tsx` (render shell with placeholder nav: Dashboard, Notes, Links, Tasks, Reminders, Settings)

**Interfaces:**
- Consumes: `useTheme`, `ACCENTS`.
- Produces: `AppShell` with a sidebar (desktop) / bottom nav (mobile) using `--accent` for active state; `ThemeControls` with a light/dark/system selector and accent swatches.

- [ ] **Step 1: Write `src/components/theme-controls.tsx`**

```tsx
"use client";
import { useTheme } from "./theme-provider";
import { ACCENTS } from "@/lib/theme";

export function ThemeControls() {
  const { mode, setMode, accent, setAccent } = useTheme();
  return (
    <div className="flex items-center gap-3">
      <select aria-label="Theme mode" value={mode} onChange={(e) => setMode(e.target.value as never)}
        className="rounded-md border px-2 py-1" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      <div className="flex gap-1">
        {ACCENTS.map((a) => (
          <button key={a} aria-label={`Accent ${a}`} onClick={() => setAccent(a)}
            data-accent={a}
            className="h-5 w-5 rounded-full border"
            style={{ background: "var(--accent)", outline: accent === a ? "2px solid var(--text)" : "none" }} />
        ))}
      </div>
    </div>
  );
}
```

Note: each swatch sets its own `data-accent` so `var(--accent)` resolves to that swatch's color.

- [ ] **Step 2: Write `src/components/app-shell.tsx`**

```tsx
"use client";
import { ReactNode } from "react";
import { ThemeControls } from "./theme-controls";

const NAV = ["Dashboard", "Notes", "Links", "Tasks", "Reminders", "Settings"];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <nav className="md:w-56 border-b md:border-b-0 md:border-r p-4 flex md:flex-col gap-2 overflow-x-auto"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="font-semibold mb-2 hidden md:block">Second Brain</div>
        {NAV.map((item) => (
          <a key={item} href="#" className="rounded-md px-3 py-2 text-sm whitespace-nowrap"
            style={{ color: "var(--text)" }}>{item}</a>
        ))}
      </nav>
      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--border)" }}>
          <span style={{ color: "var(--muted)" }}>Welcome</span>
          <ThemeControls />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Render in `src/app/page.tsx`**

```tsx
import { AppShell } from "@/components/app-shell";

export default function Home() {
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold mb-2">Your second brain</h1>
      <p style={{ color: "var(--muted)" }}>
        Notes, links, tasks, and reminders — synced across your devices.
      </p>
      <button className="mt-4 rounded-md px-4 py-2"
        style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
        Get started
      </button>
    </AppShell>
  );
}
```

- [ ] **Step 4: Verify build + run**

Run: `npm run build`
Expected: success. Then `npm run dev` and confirm at http://localhost:3000 the cream theme, orange button, working mode selector + accent swatches.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add app shell, navigation, and theme controls"
```

---

### Task 7: PWA manifest

**Files:**
- Create: `src/app/manifest.ts`
- Modify: `src/app/layout.tsx` (theme-color meta via metadata)

**Interfaces:**
- Produces: a web manifest at `/manifest.webmanifest` making the app installable.

- [ ] **Step 1: Create `src/app/manifest.ts`**

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Second Brain",
    short_name: "SecondBrain",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f1e7",
    theme_color: "#e8772e",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
```

- [ ] **Step 2: Add a placeholder `public/icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#e8772e"/><text x="32" y="42" font-size="34" text-anchor="middle" fill="#fff" font-family="sans-serif">B</text></svg>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: success; `/manifest.webmanifest` generated.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add PWA manifest and app icon"
```

---

## Self-Review

**Spec coverage (Phase 1 portion):** scaffold ✓ (T1), test tooling ✓ (T2), design tokens cream+orange ✓ (T3), accent swap 7 colors ✓ (T3/T4/T6), dark mode + system detection + manual toggle ✓ (T4/T5/T6), no-flash ✓ (T5), app shell + nav ✓ (T6), PWA installable ✓ (T7). Auth/data/notes/etc. are later phases by design.

**Placeholder scan:** none — every code step contains full content.

**Type consistency:** `Mode`/`Accent`/`resolveTheme`/`ACCENTS` defined in T4 and consumed consistently in T5/T6. `useTheme()` shape `{mode,accent,setMode,setAccent}` defined T5, consumed T6.
