"use server";

import { redirect } from "next/navigation";
import { createNote, getOrCreateDailyNote } from "@/lib/data/notes";

export async function newNoteAction() {
  const note = await createNote();
  redirect(`/notes/${note.id}`);
}

export async function openDailyNoteAction() {
  const today = new Date().toISOString().slice(0, 10);
  const note = await getOrCreateDailyNote(today);
  redirect(`/notes/${note.id}`);
}
