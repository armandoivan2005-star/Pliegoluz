import { AdminUserActions } from "@/components/admin-user-actions";
import { EditorNotice } from "@/components/editor-forms";
import { getManagedUsers } from "@/lib/admin-users";

export const dynamic = "force-dynamic";

const roleLabels = { reader: "Lector", author: "Autor", admin: "Admin" } as const;

export default async function UsersPage({ searchParams }: PageProps<"/dashboard/usuarios">) {
  const [params, { users, currentProfileId }] = await Promise.all([searchParams, getManagedUsers()]);
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const formatter = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" });
  return (
    <div className="mx-auto max-w-7xl">
      <div><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#98783f]">Administración</p><h1 className="mt-2 font-serif text-4xl sm:text-5xl">Usuarios</h1><p className="mt-3 text-sm text-black/50">Gestiona roles, acceso y cuentas registradas.</p></div>
      <div className="mt-8"><EditorNotice error={error} /></div>
      <section className="mt-8 overflow-hidden rounded-2xl border border-black/8 bg-white">
        <div className="border-b border-black/8 px-5 py-4 text-sm text-black/50">{users.length} usuarios registrados</div>
        <div className="divide-y divide-black/7">{users.map((user) => <article key={user.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(220px,1fr)_120px_150px_minmax(300px,auto)] lg:items-center">
          <div className="min-w-0"><h2 className="truncate font-medium">{user.displayName}</h2><p className="mt-1 truncate text-xs text-black/45">{user.email}</p></div>
          <span className="w-fit rounded-full bg-black/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.12em]">{roleLabels[user.role]}</span>
          <div className="text-xs text-black/45"><p>{user.suspendedAt ? "Suspendido" : "Activo"}</p><p className="mt-1">Desde {formatter.format(new Date(user.createdAt))}</p></div>
          <AdminUserActions id={user.id} role={user.role} suspended={Boolean(user.suspendedAt)} isCurrent={user.id === currentProfileId} />
        </article>)}</div>
      </section>
    </div>
  );
}
