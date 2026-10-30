"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, type UserRole } from "@/lib/editor-auth";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";

const roles: UserRole[] = ["reader", "author", "admin"];
const usersPath = "/dashboard/usuarios";

function fail(message: string): never {
  redirect(`${usersPath}?error=${encodeURIComponent(message)}`);
}

async function targetUser(profileId: string) {
  const context = await requireAdmin();
  if (profileId === context.identity.id) fail("No puedes modificar tu propia cuenta desde este panel.");
  const { rows } = await context.db.query<{ id: string; firebase_uid: string }>(
    `select id, firebase_uid from public.firebase_profiles where id = $1`,
    [profileId],
  );
  if (!rows[0]) fail("El usuario ya no existe.");
  return { ...context, target: rows[0] };
}

export async function updateUserRoleAction(profileId: string, formData: FormData) {
  const role = String(formData.get("role")) as UserRole;
  if (!roles.includes(role)) fail("El rol seleccionado no es válido.");
  const { db, target } = await targetUser(profileId);
  await db.query(
    `update public.firebase_profiles set role = $1, updated_at = now() where id = $2`,
    [role, target.id],
  );
  revalidatePath(usersPath);
}

export async function setUserSuspensionAction(profileId: string, formData: FormData) {
  const suspend = formData.get("suspend") === "true";
  const { db, target } = await targetUser(profileId);
  try {
    const auth = getFirebaseAdminAuth();
    await auth.updateUser(target.firebase_uid, { disabled: suspend });
    if (suspend) await auth.revokeRefreshTokens(target.firebase_uid);
  } catch {
    fail("No se pudo cambiar el estado de la cuenta en Firebase.");
  }
  await db.query(
    `update public.firebase_profiles
        set suspended_at = case when $1::boolean then now() else null end,
            updated_at = now()
      where id = $2`,
    [suspend, target.id],
  );
  revalidatePath(usersPath);
}

export async function deleteUserAction(profileId: string, formData: FormData) {
  void formData;
  const { db, target } = await targetUser(profileId);
  try {
    await getFirebaseAdminAuth().deleteUser(target.firebase_uid);
  } catch (caught) {
    const code = typeof caught === "object" && caught && "code" in caught ? String(caught.code) : "";
    if (code !== "auth/user-not-found") fail("No se pudo eliminar la cuenta de Firebase.");
  }
  await db.query(`delete from public.firebase_profiles where id = $1`, [target.id]);
  revalidatePath(usersPath);
}
