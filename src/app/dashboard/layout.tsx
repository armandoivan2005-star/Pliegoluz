import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import { BookOpenIcon, ListIcon, UserIcon } from "@/components/icons";
import { requireEditor } from "@/lib/editor-auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { identity } = await requireEditor();

  return (
    <div className="min-h-screen bg-[#f3f1eb] text-[#242620] lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-white/8 bg-[#0d100e] px-5 py-5 text-[#f4eee2] lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:px-6 lg:py-7">
        <div className="flex items-center justify-between lg:block">
          <Link href="/dashboard" className="font-serif text-xl tracking-[.2em] text-[#d5bd87]">PLIEGOLUZ</Link>
          <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[.16em] text-[#8f8c84]">{identity.role}</span>
        </div>

        <nav className="mt-6 flex gap-2 lg:mt-12 lg:block lg:space-y-2">
          <Link href="/dashboard" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#d9d3c8] transition hover:bg-white/6"><ListIcon className="size-4" />Libros</Link>
          <Link href="/dashboard/libros/nuevo" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#d9d3c8] transition hover:bg-white/6"><BookOpenIcon className="size-4" />Nueva obra</Link>
          <Link href="/" target="_blank" className="hidden items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#8f8c84] transition hover:bg-white/6 hover:text-white lg:flex">Ver sitio público ↗</Link>
        </nav>

        <div className="mt-6 border-t border-white/8 pt-5 lg:absolute lg:inset-x-6 lg:bottom-7">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-white/7 text-[#c6a86d]"><UserIcon className="size-4" /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm">{identity.displayName}</p><p className="truncate text-xs text-[#77756f]">{identity.email}</p></div>
          </div>
          <form action={logoutAction} className="mt-4"><button className="w-full rounded-xl border border-white/10 px-3 py-2 text-left text-xs text-[#918e86] transition hover:border-white/20 hover:text-white">Cerrar sesión</button></form>
        </div>
      </aside>
      <main className="min-w-0 px-5 py-8 sm:px-8 lg:px-12 lg:py-10">{children}</main>
    </div>
  );
}
