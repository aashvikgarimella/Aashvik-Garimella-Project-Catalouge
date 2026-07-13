import { redirect, notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { NoteEditor } from "@/components/note-editor";
import { NoteActionBar } from "@/components/note-action-bar";
import { getNote } from "@/lib/data/notes";
import { listCategories } from "@/lib/data/categories";
import { listRemindersForNote } from "@/lib/data/reminders";
import { getProfile } from "@/lib/data/profile";
import { isAiConfigured } from "@/lib/ai/config";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const note = await getNote(id);
  if (!note) notFound();
  const [categories, reminders, profile] = await Promise.all([
    listCategories(),
    listRemindersForNote(note.id),
    getProfile(),
  ]);
  const aiEnabled = (profile?.ai_enabled ?? false) && isAiConfigured();

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <NoteActionBar
          id={note.id}
          pinned={note.pinned}
          archived={note.archived}
          categoryId={note.category_id}
          categories={categories}
          reminders={reminders}
        />
        <NoteEditor
          id={note.id}
          initialTitle={note.title}
          initialContent={note.content}
          aiEnabled={aiEnabled}
        />
      </div>
    </AppShell>
  );
}
