import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";

describe("editor JSON round-trip", () => {
  it("preserves image src through setContent -> getJSON", () => {
    const editor = new Editor({
      extensions: [StarterKit, Image],
      content: {
        type: "doc",
        content: [{ type: "image", attrs: { src: "https://example.com/pic.png" } }],
      },
    });
    const json = JSON.stringify(editor.getJSON());
    editor.destroy();
    expect(json).toContain("https://example.com/pic.png");
  });
});
