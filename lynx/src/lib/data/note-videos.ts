"use client";

import { createBrowserSupabase } from "@/lib/supabase/client";

/**
 * Video attachments for a note. Unlike images (embedded in the Tiptap doc),
 * videos live only as `attachments` rows + files in the private `note-images`
 * bucket — the same model the iOS app uses, so videos sync across app and web.
 */

export type NoteVideo = { id: string; path: string; url: string };

export const VIDEO_EXTS = new Set(["mp4", "mov", "webm", "mkv", "avi", "m4v", "mpg", "mpeg"]);
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // matches the iOS client cap

export function videoMime(ext: string): string {
  switch (ext.toLowerCase()) {
    case "mov": return "video/quicktime";
    case "webm": return "video/webm";
    case "m4v": return "video/x-m4v";
    case "mkv": return "video/x-matroska";
    case "avi": return "video/x-msvideo";
    case "mpg":
    case "mpeg": return "video/mpeg";
    default: return "video/mp4";
  }
}

function extOf(path: string): string {
  return path.split(".").pop()?.toLowerCase() ?? "";
}

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* not available */ }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Signed URLs are bearer tokens; keep them short-lived. Video URLs are minted
// fresh on every page load (not persisted in the doc), so 1 hour is plenty.
const SIGNED_TTL = 60 * 60;

/** Upload a video to the user's folder, record the attachment, return it for display. */
export async function uploadNoteVideo(noteId: string, file: File): Promise<NoteVideo> {
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error("That video is too large — keep it under 200 MB.");
  }
  const supabase = createBrowserSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const ext = VIDEO_EXTS.has(extOf(file.name)) ? extOf(file.name) : "mp4";
  const path = `${uid}/${randomId()}.${ext}`;

  const up = await supabase.storage.from("note-images").upload(path, file, {
    contentType: file.type || videoMime(ext),
  });
  if (up.error) throw up.error;

  const { data: row, error: insErr } = await supabase
    .from("attachments")
    .insert({ note_id: noteId, storage_path: path })
    .select()
    .single();
  if (insErr) throw insErr;

  const { data: signed, error } = await supabase.storage
    .from("note-images")
    .createSignedUrl(path, SIGNED_TTL);
  if (error) throw error;
  return { id: row.id, path, url: signed.signedUrl };
}

/** The note's video attachments (oldest first) with fresh signed URLs. */
export async function listNoteVideos(noteId: string): Promise<NoteVideo[]> {
  const supabase = createBrowserSupabase();
  const { data: rows } = await supabase
    .from("attachments")
    .select("id, storage_path")
    .eq("note_id", noteId)
    .order("created_at", { ascending: true });
  const videos = (rows ?? []).filter((r) => VIDEO_EXTS.has(extOf(r.storage_path)));
  const out: NoteVideo[] = [];
  for (const v of videos) {
    const { data: signed } = await supabase.storage
      .from("note-images")
      .createSignedUrl(v.storage_path, SIGNED_TTL);
    if (signed) out.push({ id: v.id, path: v.storage_path, url: signed.signedUrl });
  }
  return out;
}

/** Delete a video: storage object + attachments row. */
export async function deleteNoteVideo(video: NoteVideo): Promise<void> {
  const supabase = createBrowserSupabase();
  await supabase.storage.from("note-images").remove([video.path]);
  await supabase.from("attachments").delete().eq("id", video.id);
}
