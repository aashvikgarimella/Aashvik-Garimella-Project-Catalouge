import { describe, it, expect, afterEach } from "vitest";
import { getSupabaseEnv } from "./env";

const ORIG = { ...process.env };
afterEach(() => {
  process.env = { ...ORIG };
});

describe("getSupabaseEnv", () => {
  it("returns url and anonKey when set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_abc";
    expect(getSupabaseEnv()).toEqual({
      url: "https://x.supabase.co",
      anonKey: "sb_publishable_abc",
    });
  });
  it("throws when url missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_abc";
    expect(() => getSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
