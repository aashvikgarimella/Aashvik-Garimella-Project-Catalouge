import type { Json } from "@/lib/database.types";

/** Flatten a Tiptap JSON document to plain text for search/indexing. */
export function extractText(doc: Json): string {
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.type === "text" && typeof n.text === "string") parts.push(n.text);
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(doc);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
