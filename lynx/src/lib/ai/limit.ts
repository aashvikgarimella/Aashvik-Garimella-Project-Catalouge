import { createServerSupabase } from "@/lib/supabase/server";

// Per-user ceiling on AI requests per hour, shared by every AI route. Counted
// from the per-user activity log (RLS-scoped), so it needs no extra
// infrastructure and survives restarts.
const HOURLY_LIMIT = 100;

export async function overHourlyLimit(): Promise<boolean> {
  try {
    const supabase = await createServerSupabase();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("ai_activity_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", oneHourAgo);
    return (count ?? 0) >= HOURLY_LIMIT;
  } catch {
    return false; // counting must never take the assistant down
  }
}
