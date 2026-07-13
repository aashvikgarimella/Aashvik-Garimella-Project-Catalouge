import { vi, describe, it, expect } from "vitest";

// The real node imports a server action; stub it so the module loads in tests.
vi.mock("@/app/notes/[id]/preview-actions", () => ({
  linkPreviewAction: vi.fn(async () => ({
    url: "",
    title: "",
    description: "",
    image: "",
    siteName: "",
  })),
}));

import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { LinkPreview } from "@/components/editor/link-preview-node";

describe("real LinkPreview node", () => {
  it("setLinkPreview puts the url into getJSON", () => {
    const editor = new Editor({ extensions: [StarterKit, LinkPreview] });
    editor.commands.setLinkPreview({ url: "https://youtu.be/abc123" });
    const json = JSON.stringify(editor.getJSON());
    editor.destroy();
    expect(json).toContain("https://youtu.be/abc123");
  });

  it("CHAINED setLinkPreview (as the app calls it) keeps the url", () => {
    const editor = new Editor({ extensions: [StarterKit, LinkPreview] });
    editor.chain().focus().setLinkPreview({ url: "https://youtu.be/chain1" }).run();
    const json = JSON.stringify(editor.getJSON());
    editor.destroy();
    expect(json).toContain("https://youtu.be/chain1");
  });

  it("chained insert AFTER typing with cursor at end keeps the url", () => {
    const editor = new Editor({
      extensions: [StarterKit, LinkPreview],
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hello world " }] }] },
    });
    editor.commands.focus("end");
    editor.chain().focus().setLinkPreview({ url: "https://youtu.be/cursor1" }).run();
    const json = JSON.stringify(editor.getJSON());
    editor.destroy();
    expect(json).toContain("https://youtu.be/cursor1");
  });

  it("url survives a save->load round-trip", () => {
    const e1 = new Editor({ extensions: [StarterKit, LinkPreview] });
    e1.commands.setLinkPreview({ url: "https://youtu.be/abc123" });
    const saved = e1.getJSON();
    e1.destroy();

    const e2 = new Editor({ extensions: [StarterKit, LinkPreview], content: saved });
    const reloaded = JSON.stringify(e2.getJSON());
    e2.destroy();
    expect(reloaded).toContain("https://youtu.be/abc123");
  });
});
