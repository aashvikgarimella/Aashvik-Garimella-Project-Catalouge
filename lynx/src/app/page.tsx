import { redirect } from "next/navigation";
import { Landing } from "@/components/landing";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/notes");
  return <Landing />;
}
