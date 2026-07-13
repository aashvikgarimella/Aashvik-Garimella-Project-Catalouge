import { describe, it, expect } from "vitest";
import { groupNotes } from "./group";
import type { Note } from "@/lib/data/notes";
import type { Category } from "@/lib/data/categories";

function note(p: Partial<Note>): Note {
  return {
    id: "n", user_id: "u", title: "", content: {}, content_text: "",
    category_id: null, pinned: false, archived: false, daily_date: null,
    created_at: "2026-06-22T00:00:00Z", updated_at: "2026-06-22T00:00:00Z",
    ...p,
  } as Note;
}
const cats: Category[] = [
  { id: "c1", user_id: "u", name: "Work", color: "blue", icon: "folder", sort_order: 0, created_at: "" },
];

describe("groupNotes", () => {
  it("groups by date using updated_at day", () => {
    const groups = groupNotes(
      [note({ id: "a", updated_at: "2026-06-22T10:00:00Z" }), note({ id: "b", updated_at: "2026-06-21T10:00:00Z" })],
      "date",
      cats,
    );
    expect(groups.map((g) => g.label)).toEqual(["2026-06-22", "2026-06-21"]);
  });

  it("groups by category with uncategorized last", () => {
    const groups = groupNotes(
      [note({ id: "a", category_id: null }), note({ id: "b", category_id: "c1" })],
      "category",
      cats,
    );
    expect(groups.map((g) => g.label)).toEqual(["Work", "Uncategorized"]);
  });
});
