import { type ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppChrome } from "./app-chrome";
import { createServerSupabase } from "@/lib/supabase/server";
import { listNotes } from "@/lib/data/notes";
import { listCategories } from "@/lib/data/categories";
import { getProfile, type NoteGrouping } from "@/lib/data/profile";
import { isAiConfigured, getConfiguredProviders } from "@/lib/ai/config";
import { groupNotes } from "@/lib/notes/group";

export function prettyDateLabel(iso: string): string {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const yesterday = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
  if (iso === todayKey) return "Today";
  if (iso === yesterday) return "Yesterday";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export async function AppShell({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [notes, archivedNotes, categories, profile] = await Promise.all([
    listNotes(),
    listNotes({ archived: true }),
    listCategories(),
    getProfile(),
  ]);
  const archivedItems = archivedNotes.map((n) => ({ id: n.id, title: n.title }));
  const grouping: NoteGrouping = profile?.note_grouping === "category" ? "category" : "date";
  const aiEnabled = profile?.ai_enabled ?? false;

  const groups = groupNotes(notes, grouping, categories);
  const menuGroups = groups.map((g) => ({
    label: grouping === "date" ? prettyDateLabel(g.label) : g.label,
    items: g.notes.map((n) => ({ id: n.id, title: n.title })),
  }));

  return (
    <AppChrome
      email={user.email ?? ""}
      categories={categories}
      grouping={grouping}
      menuGroups={menuGroups}
      archivedItems={archivedItems}
      aiEnabled={aiEnabled}
      aiConfigured={isAiConfigured()}
      aiProvider={profile?.ai_provider ?? ""}
      configuredProviders={getConfiguredProviders()}
    >
      {children}
    </AppChrome>
  );
}
