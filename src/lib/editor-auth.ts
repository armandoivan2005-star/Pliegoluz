import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { getFirebaseSessionUser } from "@/lib/firebase/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type EditorRole = "editor" | "admin";

export type EditorIdentity = {
  id: string;
  email: string;
  displayName: string;
  role: EditorRole;
};

export const requireEditor = cache(async () => {
  const sessionUser = await getFirebaseSessionUser();
  if (!sessionUser) redirect("/login");

  const supabase = createAdminClient();
  if (!supabase) redirect("/login?error=Supabase Admin no está configurado.");

  const { data: profile, error: profileError } = await supabase
    .from("firebase_profiles")
    .select("id, display_name, role")
    .eq("firebase_uid", sessionUser.uid)
    .maybeSingle<{ id: string; display_name: string | null; role: "reader" | EditorRole }>();

  if (profileError || !profile || !["editor", "admin"].includes(profile.role)) {
    redirect("/login?error=Tu cuenta no tiene permisos editoriales.");
  }

  return {
    supabase,
    identity: {
      id: profile.id,
      email: sessionUser.email,
      displayName: profile.display_name ?? sessionUser.displayName,
      role: profile.role as EditorRole,
    } satisfies EditorIdentity,
  };
});
