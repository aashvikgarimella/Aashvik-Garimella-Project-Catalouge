"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";
import type { Database } from "@/lib/database.types";

/** Supabase client for use inside client components. */
export function createBrowserSupabase() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
