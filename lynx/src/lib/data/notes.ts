import { createServerSupabase } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/database.types";

export type Note = Database["public"]["Tables"]["notes"]["Row"];

export async function listNotes(
  opts: {
    search?: string;
    categoryId?: string;
    archived?: boolean;
    sort?: "updated" | "created" | "title";
  } = {},
): Promise<Note[]> {
  const supabase = await createServerSupabase();
  let q = supabase
    .from("notes")
    .select("*")
    .eq("archived", opts.archived ?? false);
  if (opts.categoryId) q = q.eq("category_id", opts.categoryId);
  if (opts.search) {
    // Strip every character PostgREST's filter grammar treats specially, so the
    // term can't inject operators or break out of the or() group.
    const term = opts.search.replace(/[%_,().\\:*]/g, " ").trim();
    if (term) q = q.or(`title.ilike.%${term}%,content_text.ilike.%${term}%`);
  }
  const col =
    opts.sort === "created" ? "created_at" : opts.sort === "title" ? "title" : "updated_at";
  q = q
    .order("pinned", { ascending: false })
    .order(col, { ascending: opts.sort === "title" });
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getNote(id: string): Promise<Note | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createNote(
  input: { title?: string; categoryId?: string } = {},
): Promise<Note> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("notes")
    .insert({ title: input.title ?? "", category_id: input.categoryId ?? null })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateNote(
  id: string,
  patch: {
    title?: string;
    content?: Json;
    content_text?: string;
    category_id?: string | null;
  },
): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("notes").update(patch).eq("id", id);
  if (error) throw error;
}

export async function setPinned(id: string, pinned: boolean): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("notes").update({ pinned }).eq("id", id);
  if (error) throw error;
}

export async function setArchived(id: string, archived: boolean): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("notes").update({ archived }).eq("id", id);
  if (error) throw error;
}

export async function duplicateNote(id: string): Promise<Note> {
  const supabase = await createServerSupabase();
  const original = await getNote(id);
  if (!original) throw new Error("Note not found");
  const { data, error } = await supabase
    .from("notes")
    .insert({
      title: original.title ? `${original.title} (copy)` : "Untitled (copy)",
      content: original.content,
      content_text: original.content_text,
      category_id: original.category_id,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNote(id: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}

export async function getOrCreateDailyNote(isoDate: string): Promise<Note> {
  const supabase = await createServerSupabase();
  const existing = await supabase
    .from("notes")
    .select("*")
    .eq("daily_date", isoDate)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;
  const { data, error } = await supabase
    .from("notes")
    .insert({ title: isoDate, daily_date: isoDate })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
