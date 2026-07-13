"use client";

import { createBrowserSupabase } from "@/lib/supabase/client";

// crypto.randomUUID() only exists in secure contexts (HTTPS/localhost). The native
// iOS shell loads over plain http on the LAN, so fall back to a manual UUID there.
function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* not available */
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Upload an image for a note to private storage under the user's own folder,
 * record an attachments row, and return a long-lived signed URL for display.
 */
export async function uploadNoteImage(noteId: string, file: File): Promise<string> {
  const supabase = createBrowserSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${uid}/${randomId()}.${ext}`;

  const up = await supabase.storage.from("note-images").upload(path, file, {
    contentType: file.type || undefined,
  });
  if (up.error) throw up.error;

  await supabase.from("attachments").insert({ note_id: noteId, storage_path: path });

  const { data: signed, error } = await supabase.storage
    .from("note-images")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (error) throw error;
  return signed.signedUrl;
}
