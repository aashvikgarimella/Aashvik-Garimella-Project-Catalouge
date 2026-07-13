import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";
import type { Database } from "@/lib/database.types";

/** Request-scoped Supabase client for server components, actions, and route handlers. */
export async function createServerSupabase() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component without a mutable cookie store —
          // safe to ignore; middleware refreshes the session.
        }
      },
    },
  });
}
