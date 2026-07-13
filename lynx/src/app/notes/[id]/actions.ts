"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  updateNote,
  setPinned,
  setArchived,
  duplicateNote,
  deleteNote,
} from "@/lib/data/notes";
import { createCategory } from "@/lib/data/categories";
import { extractText } from "@/lib/editor/text";
import type { Json } from "@/lib/database.types";

export async function createAndAssignCategoryAction(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const cat = await createCategory({ name: trimmed });
  await updateNote(id, { category_id: cat.id });
  revalidatePath(`/notes/${id}`);
  revalidatePath("/notes");
}

export async function saveNoteAction(
  id: string,
  payload: { title: string; content: Json },
) {
  await updateNote(id, {
    title: payload.title,
    content: payload.content,
    content_text: extractText(payload.content),
  });
  revalidatePath(`/notes/${id}`);
}

export async function assignCategoryAction(id: string, categoryId: string | null) {
  await updateNote(id, { category_id: categoryId });
  revalidatePath(`/notes/${id}`);
  revalidatePath("/notes");
}

export async function pinNoteAction(id: string, pinned: boolean) {
  await setPinned(id, pinned);
  revalidatePath(`/notes/${id}`);
  revalidatePath("/notes");
}

export async function archiveNoteAction(id: string, archived: boolean) {
  await setArchived(id, archived);
  revalidatePath("/notes");
  redirect("/notes");
}

export async function duplicateNoteAction(id: string) {
  const n = await duplicateNote(id);
  redirect(`/notes/${n.id}`);
}

export async function deleteNoteAction(id: string) {
  await deleteNote(id);
  redirect("/notes");
}
