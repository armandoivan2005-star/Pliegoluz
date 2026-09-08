"use client";

import { deleteUserAction, setUserSuspensionAction, updateUserRoleAction } from "@/app/dashboard/user-admin-actions";
import type { UserRole } from "@/lib/editor-auth";

export function AdminUserActions({ id, role, suspended, isCurrent }: { id: string; role: UserRole; suspended: boolean; isCurrent: boolean }) {
  if (isCurrent) return <span className="text-xs text-black/40">Cuenta actual</span>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={updateUserRoleAction.bind(null, id)} className="flex items-center gap-2">
        <select name="role" defaultValue={role} className="h-9 rounded-lg border border-black/10 bg-white px-3 text-xs"><option value="reader">Lector</option><option value="author">Autor</option><option value="admin">Admin</option></select>
        <button className="h-9 rounded-lg border border-black/10 px-3 text-xs font-semibold hover:bg-black/5">Guardar rol</button>
      </form>
      <form action={setUserSuspensionAction.bind(null, id)}>
        <input type="hidden" name="suspend" value={suspended ? "false" : "true"} />
        <button className={`h-9 rounded-lg border px-3 text-xs font-semibold ${suspended ? "border-emerald-700/20 bg-emerald-50 text-emerald-700" : "border-amber-700/20 bg-amber-50 text-amber-800"}`}>{suspended ? "Reactivar" : "Suspender"}</button>
      </form>
      <form action={deleteUserAction.bind(null, id)} onSubmit={(event) => { if (!window.confirm("¿Eliminar permanentemente esta cuenta de Firebase y sus datos de Pliegoluz?")) event.preventDefault(); }}>
        <button className="h-9 rounded-lg border border-red-700/20 bg-red-50 px-3 text-xs font-semibold text-red-700">Eliminar</button>
      </form>
    </div>
  );
}
