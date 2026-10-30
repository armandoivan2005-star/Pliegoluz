import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { getFirebaseSessionUser } from "@/lib/firebase/session";
import { getDatabase, isDatabaseConfigured, oneOrNull } from "@/lib/postgres";

export type UserRole = "reader" | "author" | "admin";

export type UserIdentity = {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  photoUrl: string | null;
  role: UserRole;
};

type ProfileRow = {
  id: string;
  firebase_uid: string;
  display_name: string | null;
  photo_url: string | null;
  role: UserRole;
  suspended_at: Date | null;
};

export const getCurrentUserIdentity = cache(async (): Promise<UserIdentity | null> => {
  const sessionUser = await getFirebaseSessionUser();
  if (!sessionUser || !isDatabaseConfigured()) return null;

  const profile = await oneOrNull<ProfileRow>(
    `select id, firebase_uid, display_name, photo_url, role, suspended_at
       from public.firebase_profiles
      where firebase_uid = $1`,
    [sessionUser.uid],
  );
  if (!profile || profile.suspended_at) return null;

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
  if (!isDatabaseConfigured()) redirect("/login?error=PostgreSQL no está configurado.");
  return { identity, db: getDatabase() };
});

export const requireAuthor = cache(async () => {
  const context = await requireUser();
  if (!(context.identity.role === "author" || context.identity.role === "admin")) {
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
  const result = await context.db.query<{ id: string; author_profile_id: string | null }>(
    `select id, author_profile_id from public.books where id = $1`,
    [bookId],
  );
  const book = result.rows[0] ?? null;

  if (!book || (context.identity.role === "author" && book.author_profile_id !== context.identity.id)) {
    redirect("/dashboard?error=No tienes permisos para administrar esa obra.");
  }
  return { ...context, book };
}
