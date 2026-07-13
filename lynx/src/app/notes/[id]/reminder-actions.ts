"use server";

import { revalidatePath } from "next/cache";
import { createReminder, deleteReminder } from "@/lib/data/reminders";

export async function addReminderAction(noteId: string, formData: FormData) {
  const remindAt = String(formData.get("remind_at") ?? "");
  const message = String(formData.get("message") ?? "");
  if (!remindAt) return;
  // datetime-local gives "YYYY-MM-DDTHH:mm" (local); treat as ISO timestamp.
  const iso = new Date(remindAt).toISOString();
  await createReminder({ noteId, remindAt: iso, message });
  revalidatePath(`/notes/${noteId}`);
}

export async function deleteReminderAction(noteId: string, id: string) {
  await deleteReminder(id);
  revalidatePath(`/notes/${noteId}`);
}
