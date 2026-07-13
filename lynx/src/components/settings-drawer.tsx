"use client";

import { useTransition } from "react";
import { useTheme } from "./theme-provider";
import { ACCENTS } from "@/lib/theme";
import type { Category } from "@/lib/data/categories";
import type { NoteGrouping } from "@/lib/data/profile";
import { signOut } from "@/app/(auth)/actions";
import {
  setGroupingAction,
  setAiEnabledAction,
  setAiProviderAction,
} from "@/app/notes/settings-actions";

import {
  createCategoryAction,
  renameCategoryAction,
  recolorCategoryAction,
  deleteCategoryAction,
} from "@/app/categories/actions";

const PROVIDER_LABEL: Record<string, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  anthropic: "Claude",
};

const ACCENT_HEX: Record<string, string> = {
  orange: "#e8772e", blue: "#2e7de8", green: "#2ea84f",
  purple: "#7d4ee8", red: "#e83e3e", teal: "#1fa9a0", pink: "#e84e9c",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

export function SettingsDrawer({
  open,
  onClose,
  email,
  categories,
  grouping,
  aiEnabled,
  aiConfigured,
  aiProvider,
  configuredProviders,
}: {
  open: boolean;
  onClose: () => void;
  email: string;
  categories: Category[];
  grouping: NoteGrouping;
  aiEnabled: boolean;
  aiConfigured: boolean;
  aiProvider: string;
  configuredProviders: string[];
}) {
  const { mode, setMode, accent, setAccent, customAccent, setCustomAccent } = useTheme();
  const [pending, start] = useTransition();

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-black/30 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-[min(92vw,380px)] overflow-y-auto p-5 transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
          paddingTop: "calc(1.25rem + env(safe-area-inset-top))",
          paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))",
        }}
      >
        <div className="mb-5 flex items-center justify-between">
          <span className="text-lg font-semibold" style={{ color: "var(--text)" }}>Settings</span>
          <button onClick={onClose} aria-label="Close settings" style={{ color: "var(--muted)" }}>×</button>
        </div>

        <Section title="Account">
          <p className="text-sm" style={{ color: "var(--text)" }}>{email}</p>
          <form action={signOut} className="mt-2">
            <button type="submit" className="text-sm underline" style={{ color: "var(--muted)" }}>Sign out</button>
          </form>
        </Section>

        <Section title="Appearance">
          <label className="mb-2 block text-sm" style={{ color: "var(--text)" }}>Theme</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as never)}
            className="mb-3 w-full rounded-lg border px-2 py-1.5 text-sm"
            style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
          >
            <option value="default">Default</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
          <label className="mb-2 block text-sm" style={{ color: "var(--text)" }}>Accent</label>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a}
                aria-label={`Accent ${a}`}
                onClick={() => setAccent(a)}
                className="h-6 w-6 rounded-full border transition-transform hover:scale-110"
                style={{
                  background: ACCENT_HEX[a],
                  borderColor: "var(--border)",
                  outline: !customAccent && accent === a ? "2px solid var(--text)" : "none",
                  outlineOffset: "1px",
                }}
              />
            ))}
            {/* Custom color wheel — pick any accent, just for fun */}
            <label
              className="relative grid h-6 w-6 cursor-pointer place-items-center overflow-hidden rounded-full border"
              title="Custom color"
              style={{
                borderColor: "var(--border)",
                background:
                  "conic-gradient(red, orange, yellow, lime, cyan, blue, magenta, red)",
                outline: customAccent ? "2px solid var(--text)" : "none",
                outlineOffset: "1px",
              }}
            >
              <input
                type="color"
                value={customAccent || ACCENT_HEX[accent] || "#e8772e"}
                onChange={(e) => setCustomAccent(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Custom accent color"
              />
            </label>
          </div>
        </Section>

        <Section title="Group notes by">
          <div className="flex gap-2">
            {(["date", "category"] as NoteGrouping[]).map((g) => (
              <button
                key={g}
                disabled={pending}
                onClick={() => start(() => void setGroupingAction(g))}
                className="flex-1 rounded-lg border px-3 py-1.5 text-sm capitalize"
                style={
                  grouping === g
                    ? { background: "var(--accent)", color: "var(--accent-fg)", borderColor: "var(--accent)" }
                    : { borderColor: "var(--border)", color: "var(--text)" }
                }
              >
                {g}
              </button>
            ))}
          </div>
        </Section>

        <Section title="AI assistant">
          <label className="flex items-center justify-between text-sm" style={{ color: "var(--text)" }}>
            Enable AI
            <button
              type="button"
              role="switch"
              aria-checked={aiEnabled}
              disabled={pending}
              onClick={() => start(() => void setAiEnabledAction(!aiEnabled))}
              className="relative h-6 w-11 rounded-full transition-colors"
              style={{ background: aiEnabled ? "var(--accent)" : "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              <span
                className="absolute top-0.5 h-4 w-4 rounded-full transition-transform"
                style={{ background: "var(--surface)", left: 2, transform: aiEnabled ? "translateX(20px)" : "none" }}
              />
            </button>
          </label>
          <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
            {aiConfigured
              ? "AI runs only when you ask, and never changes a note without your confirmation."
              : "No API key found. Add GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY to .env.local to use AI features."}
          </p>

          {configuredProviders.length > 1 && (
            <div className="mt-3">
              <span className="mb-1 block text-xs font-medium" style={{ color: "var(--text)" }}>
                Provider
              </span>
              <div className="flex gap-2">
                {configuredProviders.map((p) => {
                  const active = (aiProvider || configuredProviders[0]) === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      disabled={pending}
                      onClick={() => start(() => void setAiProviderAction(p))}
                      className="flex-1 rounded-lg border px-3 py-1.5 text-sm"
                      style={
                        active
                          ? { background: "var(--accent)", color: "var(--accent-fg)", borderColor: "var(--accent)" }
                          : { borderColor: "var(--border)", color: "var(--text)" }
                      }
                    >
                      {PROVIDER_LABEL[p] ?? p}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Section>

        <Section title="Categories">
          <form action={createCategoryAction} className="mb-2 flex gap-2">
            <input
              name="name"
              required
              placeholder="New category…"
              className="flex-1 rounded-lg border px-2 py-1.5 text-sm"
              style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
            />
            <button type="submit" className="rounded-lg px-3 py-1.5 text-sm font-medium"
              style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>Add</button>
          </form>
          <div className="flex flex-col gap-2">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border p-2"
                style={{ borderColor: "var(--border)" }}>
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: ACCENT_HEX[c.color] ?? ACCENT_HEX.orange }} />
                <form action={renameCategoryAction} className="flex-1">
                  <input type="hidden" name="id" value={c.id} />
                  <input name="name" defaultValue={c.name} className="w-full bg-transparent text-sm outline-none"
                    style={{ color: "var(--text)" }} />
                </form>
                <div className="flex gap-1">
                  {ACCENTS.map((col) => (
                    <form action={recolorCategoryAction} key={col}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="color" value={col} />
                      <button type="submit" aria-label={`Color ${col}`} className="h-3 w-3 rounded-full border"
                        style={{ background: ACCENT_HEX[col], borderColor: "var(--border)",
                          outline: c.color === col ? "1.5px solid var(--text)" : "none" }} />
                    </form>
                  ))}
                </div>
                <form action={deleteCategoryAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" aria-label="Delete category" style={{ color: "var(--danger)" }}>×</button>
                </form>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-sm" style={{ color: "var(--muted)" }}>No categories yet.</p>
            )}
          </div>
        </Section>
      </aside>
    </>
  );
}
