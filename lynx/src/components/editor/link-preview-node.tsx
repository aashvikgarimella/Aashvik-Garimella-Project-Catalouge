"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { linkPreviewAction } from "@/app/notes/[id]/preview-actions";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    linkPreview: {
      setLinkPreview: (attrs: { url: string }) => ReturnType;
    };
  }
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

type Preview = { title: string; description: string; image: string; siteName: string };

function LinkPreviewCard({ node, selected }: NodeViewProps) {
  const url = (node.attrs.url as string) || "";
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(!!url);
  const fetched = useRef("");

  // Always re-fetch fresh for the current url (the doc only stores the url).
  useEffect(() => {
    if (!url || fetched.current === url) return;
    fetched.current = url;
    setLoading(true);
    linkPreviewAction(url)
      .then((p) => setPreview(p))
      .finally(() => setLoading(false));
  }, [url]);

  const title = preview?.title || hostnameOf(url);
  const description = preview?.description || "";
  const image = preview?.image || "";
  const siteName = preview?.siteName || hostnameOf(url);

  return (
    <NodeViewWrapper
      className="my-2"
      style={{ outline: selected ? "2px solid var(--accent)" : "none", borderRadius: "var(--radius-sm)" }}
    >
      <a
        href={url || "#"}
        target="_blank"
        rel="noopener noreferrer"
        contentEditable={false}
        onClick={(e) => {
          e.preventDefault();
          if (url) window.open(url, "_blank", "noopener,noreferrer");
        }}
        className="flex cursor-pointer overflow-hidden rounded-xl border no-underline"
        style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow)" }}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote preview host
          <img src={image} alt="" className="h-24 w-32 shrink-0 object-cover" style={{ background: "var(--surface-2)" }} />
        ) : null}
        <div className="min-w-0 flex-1 p-3">
          <div className="truncate text-sm font-semibold" style={{ color: "var(--text)" }}>
            {loading ? "Loading preview…" : title || url || "Link"}
          </div>
          {description ? (
            <div className="mt-0.5 line-clamp-2 text-xs" style={{ color: "var(--muted)" }}>
              {description}
            </div>
          ) : null}
          <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{siteName}</div>
        </div>
      </a>
    </NodeViewWrapper>
  );
}

export const LinkPreview = Node.create({
  name: "linkPreview",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      url: {
        default: "",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-url") ?? "",
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.url ? { "data-url": String(attrs.url) } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-link-preview]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-link-preview": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LinkPreviewCard);
  },

  addCommands() {
    return {
      setLinkPreview:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { url: attrs.url } }),
    };
  },
});
