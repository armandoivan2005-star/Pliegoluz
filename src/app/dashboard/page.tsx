import Link from "next/link";
import { ArrowRightIcon, BookOpenIcon } from "@/components/icons";
import { EditorNotice } from "@/components/editor-forms";
import { getEditorBooks, type PublicationStatus } from "@/lib/editorial";

export const dynamic = "force-dynamic";

const statusLabels: Record<PublicationStatus, string> = { draft: "Borrador", published: "Publicado", archived: "Archivado" };
const statusClasses: Record<PublicationStatus, string> = { draft: "bg-amber-50 text-amber-800", published: "bg-emerald-50 text-emerald-800", archived: "bg-slate-100 text-slate-600" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, books] = await Promise.all([searchParams, getEditorBooks()]);
  const published = books.filter((book) => book.status === "published").length;
  const drafts = books.filter((book) => book.status === "draft").length;
  const chapters = books.reduce((total, book) => total + (book.chapters[0]?.count ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#98783f]">Panel editorial</p><h1 className="mt-2 font-serif text-4xl sm:text-5xl">Biblioteca</h1><p className="mt-3 text-sm text-black/50">Administra obras, metadatos y capítulos desde un solo lugar.</p></div>
        <Link href="/dashboard/libros/nuevo" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#20241f] px-5 text-sm font-semibold text-white"><BookOpenIcon className="size-4" />Nueva obra</Link>
      </div>

      <div className="mt-8"><EditorNotice error={error} /></div>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {[['Obras', books.length], ['Publicadas', published], ['Capítulos', chapters]].map(([label, number]) => <article key={label} className="rounded-2xl border border-black/8 bg-white p-5"><p className="text-xs uppercase tracking-[.16em] text-black/40">{label}</p><p className="mt-3 font-serif text-4xl">{number}</p></article>)}
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-black/8 bg-white">
        <div className="flex items-center justify-between border-b border-black/8 px-5 py-4 sm:px-6"><h2 className="font-serif text-2xl">Todos los libros</h2><span className="text-xs text-black/40">{drafts} borradores</span></div>
        {books.length ? (
          <div className="divide-y divide-black/7">
            {books.map((book) => (
              <Link key={book.id} href={`/dashboard/libros/${book.id}`} className="group grid gap-4 px-5 py-5 transition hover:bg-[#faf8f3] sm:grid-cols-[1fr_auto] sm:items-center sm:px-6">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h3 className="truncate font-medium">{book.title}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.12em] ${statusClasses[book.status]}`}>{statusLabels[book.status]}</span></div><p className="mt-1 text-sm text-black/45">{book.author_name} · {book.chapters[0]?.count ?? 0} capítulos</p></div>
                <div className="flex items-center gap-4 text-xs text-black/40"><span>Actualizado {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(book.updated_at))}</span><ArrowRightIcon className="size-4 transition group-hover:translate-x-1 group-hover:text-[#98783f]" /></div>
              </Link>
            ))}
          </div>
        ) : <div className="grid place-items-center px-6 py-20 text-center"><div><BookOpenIcon className="mx-auto size-8 text-black/25" /><p className="mt-4 text-sm text-black/50">Todavía no hay libros.</p></div></div>}
      </section>
    </div>
  );
}
