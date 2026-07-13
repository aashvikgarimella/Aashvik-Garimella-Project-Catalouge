import { createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Category = Database["public"]["Tables"]["categories"]["Row"];

export async function listCategories(): Promise<Category[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createCategory(input: {
  name: string;
  color?: string;
  icon?: string;
}): Promise<Category> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("categories")
    .insert({ name: input.name, color: input.color, icon: input.icon })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateCategory(
  id: string,
  patch: { name?: string; color?: string; icon?: string },
): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("categories").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCategory(id: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderCategories(orderedIds: string[]): Promise<void> {
  const supabase = await createServerSupabase();
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("categories").update({ sort_order: index }).eq("id", id),
    ),
  );
}
