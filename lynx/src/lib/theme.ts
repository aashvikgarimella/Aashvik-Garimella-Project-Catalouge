export type Mode = "default" | "light" | "dark" | "system";
export type Accent =
  | "orange"
  | "blue"
  | "green"
  | "purple"
  | "red"
  | "teal"
  | "pink";

/** Selectable themes. "default" is the beige experience; "system" follows the OS. */
export const THEMES: Mode[] = ["default", "light", "dark", "system"];

/** Resolve the concrete theme to apply. "system" maps to light (white) or dark. */
export function resolveTheme(
  mode: Mode,
  prefersDark: boolean,
): "default" | "light" | "dark" {
  if (mode === "system") return prefersDark ? "dark" : "light";
  return mode;
}

/** Ordered accent options; orange is the default and must be first. */
export const ACCENTS: Accent[] = [
  "orange",
  "blue",
  "green",
  "purple",
  "red",
  "teal",
  "pink",
];
