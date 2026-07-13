import type { Note } from "@/lib/data/notes";
import type { Category } from "@/lib/data/categories";
import type { NoteGrouping } from "@/lib/data/profile";

export type NoteGroup = { key: string; label: string; notes: Note[] };

/**
 * Group notes for display. Input notes are assumed pre-sorted; group order
 * follows first appearance, preserving that sort.
 * - "date": grouped by the calendar date of `updated_at` (label = ISO date).
 * - "category": grouped by category; uncategorized last.
 */
export function groupNotes(
  notes: Note[],
  grouping: NoteGrouping,
  categories: Category[],
): NoteGroup[] {
  const groups: NoteGroup[] = [];
  const index = new Map<string, NoteGroup>();
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  for (const note of notes) {
    let key: string;
    let label: string;
    if (grouping === "category") {
      key = note.category_id ?? "__none__";
      label = note.category_id ? catName.get(note.category_id) ?? "Category" : "Uncategorized";
    } else {
      key = note.updated_at.slice(0, 10);
      label = key;
    }
    let group = index.get(key);
    if (!group) {
      group = { key, label, notes: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.notes.push(note);
  }

  if (grouping === "category") {
    // Push the uncategorized group to the end.
    const i = groups.findIndex((g) => g.key === "__none__");
    if (i >= 0 && i < groups.length - 1) groups.push(groups.splice(i, 1)[0]);
  }
  return groups;
}
