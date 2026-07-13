"use server";

import { fetchPreview, type LinkPreview } from "@/lib/links/fetch-preview";

export async function linkPreviewAction(url: string): Promise<LinkPreview> {
  return fetchPreview(url);
}
