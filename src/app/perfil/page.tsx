import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import { BookCover } from "@/components/book-cover";
import { ArrowRightIcon, BookOpenIcon, UserIcon } from "@/components/icons";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { getProfileLibrary } from "@/lib/user-library";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mi perfil", description: "Tu biblioteca personal en Pliegoluz." };

const roleLabels = { reader: "Lector", author: "Autor", admin: "Administrador" } as const;

export default async function ProfilePage({ searchParams }: PageProps<"/perfil">) {
  const [params, { identity, books }] = await Promise.all([searchParams, getProfileLibrary()]);
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  return (
    <div className="site-theme min-h-screen bg-[#0b0e0d] text-[#f5efe3]">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        {error && <p className="mb-6 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}
        <section className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-white/[.025] p-6 sm:flex-row sm:items-center sm:p-8">
          <span className="grid size-16 place-items-center rounded-full border border-[#c6a86d]/35 bg-[#151816] text-[#d6b978]"><UserIcon className="size-7" /></span>
          <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#aa8c57]">{roleLabels[identity.role]}</p><h1 className="mt-2 truncate font-serif text-3xl">{identity.displayName}</h1><p className="mt-1 text-sm text-[#817f78]">{identity.email}</p></div>
          <div className="flex flex-wrap gap-3 sm:ml-auto"><ThemeToggle />{identity.role !== "reader" && <Link href="/dashboard" className="rounded-full bg-[#e8ddc6] px-5 py-3 text-sm font-semibold text-[#171816]">Panel editorial</Link>}<form action={logoutAction}><button className="h-12 rounded-full border border-white/15 px-5 text-sm text-[#ddd6ca]">Cerrar sesión</button></form></div>
        </section>

        <section className="mt-14">
          <div><p className="text-xs font-semibold uppercase tracking-[.24em] text-[#aa8c57]">Colección personal</p><h2 className="mt-3 font-serif text-4xl">Mis libros guardados</h2></div>
          {books.length ? <div className="mt-9 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">{books.map((book) => <Link key={book.id} href={`/libros/${book.slug}`} className="group min-w-0"><BookCover title={book.title} coverUrl={book.coverUrl} chapterCount={book.chapters} className="w-full transition group-hover:-translate-y-2" /><h3 className="mt-4 truncate font-serif text-xl">{book.title}</h3><p className="mt-1 truncate text-sm text-[#817f78]">{book.author}</p><span className="mt-3 flex items-center gap-2 text-xs text-[#c6a86d]">Ver libro<ArrowRightIcon className="size-4" /></span></Link>)}</div> : <div className="mt-9 grid min-h-64 place-items-center rounded-2xl border border-white/8 bg-white/[.02] p-8 text-center"><div><BookOpenIcon className="mx-auto size-9 text-[#aa8c57]" /><p className="mt-4 text-[#aaa79f]">Todavía no has guardado ningún libro.</p><Link href="/biblioteca" className="mt-4 inline-block text-sm text-[#d6b978]">Explorar biblioteca</Link></div></div>}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
