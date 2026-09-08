import Link from "next/link";
import { notFound } from "next/navigation";
import { updateBookAction } from "@/app/dashboard/actions";
import { ChapterBulkList } from "@/components/chapter-bulk-list";
import { BookEditorForm, EditorNotice } from "@/components/editor-forms";
import { ArrowLeftIcon, BookOpenIcon } from "@/components/icons";
import { getEditorBook, type PublicationStatus } from "@/lib/editorial";

export const dynamic = "force-dynamic";

const statusLabels: Record<PublicationStatus, string> = { draft: "Borrador", published: "Publicado", archived: "Archivado" };

export default async function EditBookPage({ params, searchParams }: { params: Promise<{ bookId: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const [{ bookId }, messages] = await Promise.all([params, searchParams]);
  const { book, chapters } = await getEditorBook(bookId);
  if (!book) notFound();
  const updateBook = updateBookAction.bind(null, book.id);

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-black/50 hover:text-black"><ArrowLeftIcon className="size-4" />Volver a la biblioteca</Link>
      <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#98783f]">Editar obra</p><h1 className="mt-2 font-serif text-4xl sm:text-5xl">{book.title}</h1><p className="mt-2 text-sm text-black/45">/{book.slug} · {statusLabels[book.status]}</p></div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/dashboard/libros/${book.id}/importar`} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#20241f] px-4 text-sm font-semibold text-white">Importar PDF completo</Link>
          {book.status === "published" && <Link href={`/libros/${book.slug}`} target="_blank" className="inline-flex h-11 items-center justify-center rounded-xl border border-black/10 bg-white px-4 text-sm">Ver publicación ↗</Link>}
        </div>
      </div>

      <div className="mt-8"><EditorNotice error={messages.error} saved={messages.saved} /></div>

      <section className="mt-8 rounded-2xl border border-black/8 bg-white p-6 sm:p-8">
        <div className="mb-7 border-b border-black/8 pb-5"><h2 className="font-serif text-2xl">Información del libro</h2><p className="mt-1 text-sm text-black/45">Título, autor, sinopsis, géneros y visibilidad pública.</p></div>
        <BookEditorForm book={book} action={updateBook} submitLabel="Guardar cambios" />
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-black/8 bg-white">
        <div className="flex flex-col gap-4 border-b border-black/8 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><h2 className="font-serif text-2xl">Capítulos</h2><p className="mt-1 text-sm text-black/45">{chapters.length} capítulos en esta obra.</p></div><Link href={`/dashboard/libros/${book.id}/capitulos/nuevo`} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#20241f] px-4 text-sm font-semibold text-white"><BookOpenIcon className="size-4" />Agregar capítulo</Link></div>
        {chapters.length ? (
          <ChapterBulkList bookId={book.id} chapters={chapters} />
        ) : <div className="px-6 py-14 text-center text-sm text-black/45">Esta obra todavía no tiene capítulos.</div>}
      </section>
    </div>
  );
}
