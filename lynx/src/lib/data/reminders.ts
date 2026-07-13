import { createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Reminder = Database["public"]["Tables"]["reminders"]["Row"];

export async function listRemindersForNote(noteId: string): Promise<Reminder[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("note_id", noteId)
    .order("remind_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createReminder(input: {
  noteId: string;
  remindAt: string;
  message?: string;
  recurrence?: string;
}): Promise<Reminder> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("reminders")
    .insert({
      note_id: input.noteId,
      remind_at: input.remindAt,
      message: input.message ?? "",
      recurrence: input.recurrence ?? "none",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteReminder(id: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("reminders").delete().eq("id", id);
  if (error) throw error;
}

/** Upcoming reminders across all notes (for surfacing in the menu later). */
export async function listUpcomingReminders(limit = 20): Promise<Reminder[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("done", false)
    .order("remind_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
