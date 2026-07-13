import { createServerSupabase } from "@/lib/supabase/server";

/** Record an AI action in the transparent, per-user activity log. Never throws. */
export async function logAiActivity(entry: {
  noteId: string | null;
  action: string;
  input: string;
  output: string;
  status?: string;
}): Promise<void> {
  try {
    const supabase = await createServerSupabase();
    await supabase.from("ai_activity_log").insert({
      note_id: entry.noteId,
      action: entry.action,
      input_preview: entry.input.slice(0, 280),
      output_preview: entry.output.slice(0, 280),
      status: entry.status ?? "completed",
    });
  } catch {
    // Logging must never break the assistant response.
  }
}
