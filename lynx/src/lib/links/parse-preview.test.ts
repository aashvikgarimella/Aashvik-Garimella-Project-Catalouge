import { describe, it, expect } from "vitest";
import { parsePreview, youtubeId } from "./parse-preview";

describe("parsePreview", () => {
  it("prefers OpenGraph tags", () => {
    const html = `<meta property="og:title" content="OG Title" />
      <meta property="og:description" content="OG Desc" />
      <meta property="og:image" content="https://x.com/img.png" /><title>Fallback</title>`;
    expect(parsePreview(html, "https://x.com")).toEqual({
      title: "OG Title", description: "OG Desc", image: "https://x.com/img.png",
    });
  });
  it("falls back to <title> and meta description", () => {
    const html = `<title>Plain Title</title><meta name="description" content="Plain desc">`;
    const r = parsePreview(html, "https://x.com");
    expect(r.title).toBe("Plain Title");
    expect(r.description).toBe("Plain desc");
  });
  it("resolves relative og:image against base url", () => {
    const html = `<meta property="og:image" content="/cover.jpg">`;
    expect(parsePreview(html, "https://x.com/page").image).toBe("https://x.com/cover.jpg");
  });
});

describe("youtubeId", () => {
  it("parses watch, short, and youtu.be URLs", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("returns null for non-youtube urls", () => {
    expect(youtubeId("https://example.com")).toBeNull();
  });
});
