"use server";

import { revalidatePath } from "next/cache";
import {
  setNoteGrouping,
  setAiEnabled,
  setAiProvider,
  type NoteGrouping,
} from "@/lib/data/profile";

export async function setGroupingAction(grouping: NoteGrouping) {
  await setNoteGrouping(grouping === "category" ? "category" : "date");
  revalidatePath("/notes");
}

export async function setAiEnabledAction(enabled: boolean) {
  await setAiEnabled(enabled);
  revalidatePath("/notes", "layout");
}

export async function setAiProviderAction(provider: string) {
  await setAiProvider(provider);
  revalidatePath("/notes", "layout");
}
