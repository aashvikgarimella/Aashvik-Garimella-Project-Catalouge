"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  redirect("/login?message=Check%20your%20email%20to%20confirm%2C%20then%20sign%20in.");
}

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
