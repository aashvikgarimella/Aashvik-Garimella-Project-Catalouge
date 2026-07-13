"use server";

import { revalidatePath } from "next/cache";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/data/categories";

export async function createCategoryAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await createCategory({ name });
  revalidatePath("/notes");
}

export async function renameCategoryAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;
  await updateCategory(id, { name });
  revalidatePath("/notes");
}

export async function recolorCategoryAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const color = String(formData.get("color") ?? "");
  if (!id || !color) return;
  await updateCategory(id, { color });
  revalidatePath("/notes");
}

export async function deleteCategoryAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteCategory(id);
  revalidatePath("/notes");
}
