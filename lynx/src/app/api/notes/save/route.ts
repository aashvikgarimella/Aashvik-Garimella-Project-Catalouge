import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { extractText } from "@/lib/editor/text";
import type { Json } from "@/lib/database.types";

export async function POST(req: Request) {
  let body: { id?: string; title?: string; content?: Json };
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }
  const { id, title, content } = body;
  if (!id) return new Response("missing id", { status: 400 });

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { error } = await supabase
    .from("notes")
    .update({
      title: title ?? "",
      content: content ?? { type: "doc", content: [] },
      content_text: extractText(content ?? null),
    })
    .eq("id", id);
  if (error) return new Response("error", { status: 500 });
  revalidatePath("/notes");
  revalidatePath(`/notes/${id}`);
  return new Response("ok");
}
