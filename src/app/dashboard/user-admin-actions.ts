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
  const { data } = await context.supabase
    .from("firebase_profiles")
    .select("id, firebase_uid")
    .eq("id", profileId)
    .maybeSingle<{ id: string; firebase_uid: string }>();
  if (!data) fail("El usuario ya no existe.");
  return { ...context, target: data };
}

export async function updateUserRoleAction(profileId: string, formData: FormData) {
  const role = String(formData.get("role")) as UserRole;
  if (!roles.includes(role)) fail("El rol seleccionado no es válido.");
  const { supabase, target } = await targetUser(profileId);
  const { error } = await supabase.from("firebase_profiles").update({ role, updated_at: new Date().toISOString() }).eq("id", target.id);
  if (error) fail("No se pudo actualizar el rol. Ejecuta la migración de roles en Supabase.");
  revalidatePath(usersPath);
}

export async function setUserSuspensionAction(profileId: string, formData: FormData) {
  const suspend = formData.get("suspend") === "true";
  const { supabase, target } = await targetUser(profileId);
  try {
    const auth = getFirebaseAdminAuth();
    await auth.updateUser(target.firebase_uid, { disabled: suspend });
    if (suspend) await auth.revokeRefreshTokens(target.firebase_uid);
  } catch {
    fail("No se pudo cambiar el estado de la cuenta en Firebase.");
  }
  const { error } = await supabase.from("firebase_profiles").update({ suspended_at: suspend ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", target.id);
  if (error) fail("Firebase se actualizó, pero no se pudo guardar el estado en Supabase.");
  revalidatePath(usersPath);
}

export async function deleteUserAction(profileId: string, formData: FormData) {
  void formData;
  const { supabase, target } = await targetUser(profileId);
  try {
    await getFirebaseAdminAuth().deleteUser(target.firebase_uid);
  } catch (caught) {
    const code = typeof caught === "object" && caught && "code" in caught ? String(caught.code) : "";
    if (code !== "auth/user-not-found") fail("No se pudo eliminar la cuenta de Firebase.");
  }
  const { error } = await supabase.from("firebase_profiles").delete().eq("id", target.id);
  if (error) fail("La cuenta se eliminó de Firebase, pero no de Supabase.");
  revalidatePath(usersPath);
}
