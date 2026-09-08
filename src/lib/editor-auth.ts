import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { getFirebaseSessionUser } from "@/lib/firebase/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type UserRole = "reader" | "author" | "admin";

export type UserIdentity = {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  photoUrl: string | null;
  role: UserRole;
};

export const getCurrentUserIdentity = cache(async (): Promise<UserIdentity | null> => {
  const sessionUser = await getFirebaseSessionUser();
  if (!sessionUser) return null;

  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data: profile, error } = await supabase
    .from("firebase_profiles")
    .select("id, firebase_uid, display_name, photo_url, role, suspended_at")
    .eq("firebase_uid", sessionUser.uid)
    .maybeSingle<{ id: string; firebase_uid: string; display_name: string | null; photo_url: string | null; role: UserRole; suspended_at: string | null }>();

  if (error || !profile || profile.suspended_at) return null;

  return {
    id: profile.id,
    firebaseUid: profile.firebase_uid,
    email: sessionUser.email,
    displayName: profile.display_name ?? sessionUser.displayName,
    photoUrl: profile.photo_url,
    role: profile.role,
  };
});

export const requireUser = cache(async () => {
  const identity = await getCurrentUserIdentity();
  if (!identity) redirect("/login");
  const supabase = createAdminClient();
  if (!supabase) redirect("/login?error=Supabase Admin no está configurado.");

  return { identity, supabase };
});

export const requireAuthor = cache(async () => {
  const context = await requireUser();
  if (!(["author", "admin"] as UserRole[]).includes(context.identity.role)) {
    redirect("/perfil?error=Tu cuenta no tiene permisos de autor.");
  }
  return context;
});

export const requireAdmin = cache(async () => {
  const context = await requireUser();
  if (context.identity.role !== "admin") redirect("/perfil?error=Se requieren permisos de administrador.");
  return context;
});

export async function requireBookManager(bookId: string) {
  const context = await requireAuthor();
  const { data: book } = await context.supabase
    .from("books")
    .select("id, author_profile_id")
    .eq("id", bookId)
    .maybeSingle<{ id: string; author_profile_id: string | null }>();

  if (!book || (context.identity.role === "author" && book.author_profile_id !== context.identity.id)) {
    redirect("/dashboard?error=No tienes permisos para administrar esa obra.");
  }
  return { ...context, book };
}
