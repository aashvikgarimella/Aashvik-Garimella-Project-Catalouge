"use server";

import { revalidatePath } from "next/cache";
import { deleteNote } from "@/lib/data/notes";

export async function deleteNoteListAction(id: string) {
  await deleteNote(id);
  revalidatePath("/notes");
}
