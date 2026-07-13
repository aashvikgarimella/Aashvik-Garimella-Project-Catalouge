import { createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type NoteGrouping = "date" | "category";

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getNoteGrouping(): Promise<NoteGrouping> {
  const profile = await getProfile();
  return profile?.note_grouping === "category" ? "category" : "date";
}

export async function setNoteGrouping(grouping: NoteGrouping): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("profiles")
    .update({ note_grouping: grouping })
    .eq("id", user.id);
  if (error) throw error;
}

export async function setAiEnabled(enabled: boolean): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("profiles")
    .update({ ai_enabled: enabled })
    .eq("id", user.id);
  if (error) throw error;
}

export async function setAiProvider(provider: string): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const value =
    provider === "gemini" || provider === "openai" || provider === "anthropic"
      ? provider
      : "";
  const { error } = await supabase
    .from("profiles")
    .update({ ai_provider: value })
    .eq("id", user.id);
  if (error) throw error;
}
