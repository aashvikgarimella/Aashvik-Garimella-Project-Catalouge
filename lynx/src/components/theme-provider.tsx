"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { type Mode, type Accent, resolveTheme } from "@/lib/theme";

type ThemeCtx = {
  mode: Mode;
  accent: Accent;
  customAccent: string;
  setMode: (m: Mode) => void;
  setAccent: (a: Accent) => void;
  setCustomAccent: (hex: string) => void;
};

const ThemeContext = createContext<ThemeCtx | null>(null);

function readStored<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  return (localStorage.getItem(key) as T | null) ?? fallback;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => readStored("pkm-mode", "default"));
  const [accent, setAccentState] = useState<Accent>(() => readStored("pkm-accent", "orange"));
  const [customAccent, setCustomAccentState] = useState<string>(() =>
    readStored("pkm-accent-custom", ""),
  );

  // Apply + persist the selected theme (resolving "system" against the OS).
  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", resolveTheme(mode, prefersDark));
    localStorage.setItem("pkm-mode", mode);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      if (mode === "system") {
        document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  // Named accent (via [data-accent]).
  useEffect(() => {
    document.documentElement.setAttribute("data-accent", accent);
    localStorage.setItem("pkm-accent", accent);
  }, [accent]);

  // Custom accent overrides the named one with an inline --accent.
  useEffect(() => {
    const root = document.documentElement;
    if (customAccent) root.style.setProperty("--accent", customAccent);
    else root.style.removeProperty("--accent");
    localStorage.setItem("pkm-accent-custom", customAccent);
  }, [customAccent]);

  function setAccent(a: Accent) {
    setCustomAccentState(""); // picking a preset clears any custom color
    setAccentState(a);
  }

  return (
    <ThemeContext.Provider
      value={{ mode, accent, customAccent, setMode, setAccent, setCustomAccent: setCustomAccentState }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
