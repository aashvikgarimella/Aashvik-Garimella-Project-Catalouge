"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { SettingsDrawer } from "./settings-drawer";
import { MenuDrawer, type MenuGroup } from "./menu-drawer";
import type { Category } from "@/lib/data/categories";
import type { NoteGrouping } from "@/lib/data/profile";

function FloatingButton({
  onClick,
  label,
  className,
  posStyle,
  children,
}: {
  onClick: () => void;
  label: string;
  className: string;
  posStyle?: React.CSSProperties;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`fixed z-30 grid h-11 w-11 place-items-center rounded-full transition-transform hover:scale-105 ${className}`}
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)", color: "var(--text)", ...posStyle }}
    >
      {children}
    </button>
  );
}

export function AppChrome({
  email,
  categories,
  grouping,
  menuGroups,
  archivedItems,
  aiEnabled,
  aiConfigured,
  aiProvider,
  configuredProviders,
  children,
}: {
  email: string;
  categories: Category[];
  grouping: NoteGrouping;
  menuGroups: MenuGroup[];
  archivedItems: { id: string; title: string }[];
  aiEnabled: boolean;
  aiConfigured: boolean;
  aiProvider: string;
  configuredProviders: string[];
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Floating lynx wordmark, top-left — no background, just there */}
      <Link
        href="/notes"
        className="fixed left-5 z-30 text-lg font-bold tracking-tight"
        style={{ color: "var(--text)", top: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        lynx<span style={{ color: "var(--accent)" }}>.</span>
      </Link>

      {/* Floating menu icon, bottom-left corner */}
      <FloatingButton
        onClick={() => setMenuOpen(true)}
        label="Open menu"
        className="left-6"
        posStyle={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </FloatingButton>

      {/* Floating settings gear, top-right */}
      <FloatingButton
        onClick={() => setSettingsOpen(true)}
        label="Open settings"
        className="right-4"
        posStyle={{ top: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </FloatingButton>

      <main
        className="mx-auto max-w-4xl px-4"
        style={{
          paddingTop: "calc(5rem + env(safe-area-inset-top))",
          paddingBottom: "calc(4rem + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </main>

      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} groups={menuGroups} groupingLabel={grouping} archived={archivedItems} />
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        email={email}
        categories={categories}
        grouping={grouping}
        aiEnabled={aiEnabled}
        aiConfigured={aiConfigured}
        aiProvider={aiProvider}
        configuredProviders={configuredProviders}
      />
    </div>
  );
}
