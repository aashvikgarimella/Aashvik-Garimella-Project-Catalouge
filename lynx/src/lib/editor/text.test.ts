import { describe, it, expect } from "vitest";
import { extractText } from "./text";

describe("extractText", () => {
  it("concatenates text nodes with spaces", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
        { type: "paragraph", content: [{ type: "text", text: "world" }] },
      ],
    };
    expect(extractText(doc)).toBe("Hello world");
  });
  it("returns empty string for empty doc", () => {
    expect(extractText({ type: "doc", content: [] })).toBe("");
  });
  it("handles nested marks and lists", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "milk" }] },
              ],
            },
          ],
        },
      ],
    };
    expect(extractText(doc)).toBe("milk");
  });
});
