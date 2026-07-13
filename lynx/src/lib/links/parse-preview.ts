function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function meta(html: string, patterns: RegExp[]): string {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decode(m[1].trim());
  }
  return "";
}

export function parsePreview(
  html: string,
  baseUrl: string,
): { title: string; description: string; image: string } {
  const title =
    meta(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
    ]) || meta(html, [/<title[^>]*>([^<]+)<\/title>/i]);

  const description = meta(html, [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
  ]);

  let image = meta(html, [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  ]);
  if (image && !/^https?:\/\//i.test(image)) {
    try {
      image = new URL(image, baseUrl).toString();
    } catch {
      image = "";
    }
  }

  return { title, description, image };
}

/** Extract a YouTube video id from common URL shapes, or null. */
export function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return m ? m[1] : null;
}
