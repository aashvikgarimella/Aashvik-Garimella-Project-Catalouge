import { parsePreview, youtubeId } from "./parse-preview";
import { safeFetch } from "@/lib/net/safe-fetch";

export type LinkPreview = {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
};

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Server-only: fetch preview metadata for a URL. Never throws. */
export async function fetchPreview(url: string): Promise<LinkPreview> {
  const base: LinkPreview = {
    url,
    title: "",
    description: "",
    image: "",
    siteName: hostnameOf(url),
  };

  // YouTube: use oEmbed (no scraping/UA blocking) + canonical thumbnail.
  const vid = youtubeId(url);
  if (vid) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
        { signal: controller.signal },
      );
      clearTimeout(t);
      const data = res.ok ? ((await res.json()) as { title?: string; author_name?: string }) : {};
      return {
        url,
        title: data.title ?? "YouTube video",
        description: data.author_name ?? "",
        image: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        siteName: "youtube.com",
      };
    } catch {
      return { ...base, title: "YouTube video", image: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`, siteName: "youtube.com" };
    }
  }

  try {
    // safeFetch blocks private/internal hosts and re-validates every redirect hop (SSRF).
    const res = await safeFetch(url, {
      timeoutMs: 5000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; lynxBot/1.0)" },
    });
    if (!res || !res.ok) return base;
    const html = (await res.text()).slice(0, 200_000);
    const p = parsePreview(html, res.url || url);
    return { url, title: p.title, description: p.description, image: p.image, siteName: hostnameOf(res.url || url) };
  } catch {
    return base;
  }
}
