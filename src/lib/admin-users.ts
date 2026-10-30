import "server-only";

import { cache } from "react";
import { requireAdmin, type UserRole } from "@/lib/editor-auth";

export type ManagedUser = {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  role: UserRole;
  provider: string;
  suspendedAt: string | null;
  createdAt: string;
  lastSignInAt: string | null;
};

type ManagedUserRow = {
  id: string;
  firebase_uid: string;
  email: string | null;
  display_name: string | null;
  role: UserRole;
  provider: string | null;
  suspended_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
};

export const getManagedUsers = cache(async () => {
  const { identity, db } = await requireAdmin();
  const { rows } = await db.query<ManagedUserRow>(
    `select id, firebase_uid, email, display_name, role, provider,
            suspended_at::text, created_at::text, last_sign_in_at::text
       from public.firebase_profiles
      order by created_at desc`,
  );

  return {
    currentProfileId: identity.id,
    users: rows.map((user) => ({
      id: user.id,
      firebaseUid: user.firebase_uid,
      email: user.email ?? "Sin correo",
      displayName: user.display_name ?? user.email ?? "Usuario",
      role: user.role,
      provider: user.provider ?? "unknown",
      suspendedAt: user.suspended_at,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
    })) satisfies ManagedUser[],
  };
});
