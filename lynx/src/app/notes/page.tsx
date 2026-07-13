import { redirect } from "next/navigation";
import { AppShell, prettyDateLabel } from "@/components/app-shell";
import { NoteCard } from "@/components/note-card";
import { newNoteAction } from "./new-actions";
import { listNotes } from "@/lib/data/notes";
import { listCategories } from "@/lib/data/categories";
import { listUpcomingReminders } from "@/lib/data/reminders";
import { getNoteGrouping } from "@/lib/data/profile";
import { groupNotes } from "@/lib/notes/group";
import { createServerSupabase } from "@/lib/supabase/server";

// Named category colors → hex (matches the native app's palette).
const CATEGORY_HEX: Record<string, string> = {
  orange: "#E8772E", red: "#D7263D", amber: "#E2A60B", green: "#2E9E5B",
  blue: "#3B82F6", purple: "#8B5CF6", pink: "#EC4899", gray: "#8C8479",
};

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { q } = await searchParams;
  const [notes, categories, grouping, reminders] = await Promise.all([
    listNotes({ search: q }),
    listCategories(),
    getNoteGrouping(),
    listUpcomingReminders(200),
  ]);
  const groups = groupNotes(notes, grouping, categories);
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const catColor = new Map(categories.map((c) => [c.id, CATEGORY_HEX[c.color] ?? "#8C8479"]));
  // Earliest active reminder per note (reminders are ordered by remind_at asc).
  const remindByNote = new Map<string, string>();
  for (const r of reminders) if (!remindByNote.has(r.note_id)) remindByNote.set(r.note_id, r.remind_at);
  // Show the complementary field on each card: date when grouped by category,
  // category when grouped by date.
  const metaFor = (n: (typeof notes)[number]): string =>
    grouping === "category"
      ? new Date(n.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : n.category_id
        ? (catName.get(n.category_id) ?? "")
        : "Uncategorized";
  const metaColorFor = (n: (typeof notes)[number]): string | undefined =>
    grouping === "date" && n.category_id ? catColor.get(n.category_id) : undefined;

  return (
    <AppShell>
      <div className="mb-7 flex items-center gap-2">
        <form className="flex-1" action="/notes">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search notes…"
            className="w-full rounded-xl border px-4 py-2.5 text-sm"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
          />
        </form>
        <form action={newNoteAction}>
          <button
            type="submit"
            aria-label="New note"
            title="New note"
            className="grid h-11 w-11 place-items-center rounded-full text-xl font-semibold transition-transform hover:-translate-y-0.5"
            style={{ background: "var(--accent)", color: "var(--accent-fg)", boxShadow: "var(--shadow)" }}
          >
            +
          </button>
        </form>
      </div>

      {notes.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>
          {q ? "No notes match your search." : "No notes yet. Create your first one."}
        </p>
      ) : (
        <div className="flex flex-col gap-7">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                {grouping === "date" ? prettyDateLabel(group.label) : group.label}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.notes.map((n) => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    meta={metaFor(n)}
                    metaColor={metaColorFor(n)}
                    reminderAt={remindByNote.get(n.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
