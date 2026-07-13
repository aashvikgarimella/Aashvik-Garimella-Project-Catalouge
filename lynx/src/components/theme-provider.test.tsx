import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./theme-provider";

function Probe() {
  const { accent, setAccent } = useTheme();
  return <button onClick={() => setAccent("blue")}>accent:{accent}</button>;
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-accent");
  });

  it("defaults to orange and updates the document attribute", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByRole("button").textContent).toBe("accent:orange");
    act(() => {
      screen.getByRole("button").click();
    });
    expect(document.documentElement.getAttribute("data-accent")).toBe("blue");
    expect(localStorage.getItem("pkm-accent")).toBe("blue");
  });
});
