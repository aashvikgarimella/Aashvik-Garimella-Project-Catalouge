import { describe, it, expect } from "vitest";
import { THEMES, ACCENTS, resolveTheme } from "./theme";

describe("THEMES", () => {
  it("offers default, light, dark, and system with default first", () => {
    expect(THEMES).toEqual(["default", "light", "dark", "system"]);
  });
});

describe("resolveTheme", () => {
  it("passes explicit themes through", () => {
    expect(resolveTheme("default", true)).toBe("default");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
  it("maps system to dark/light by OS preference", () => {
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
