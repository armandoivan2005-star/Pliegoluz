import Link from "next/link";
import { notFound } from "next/navigation";
import { updateChapterAction } from "@/app/dashboard/actions";
import { ChapterEditorForm, EditorNotice } from "@/components/editor-forms";
import { ArrowLeftIcon } from "@/components/icons";
import { getEditorBook, getEditorChapter } from "@/lib/editorial";

export const dynamic = "force-dynamic";

export default async function EditChapterPage({ params, searchParams }: { params: Promise<{ bookId: string; chapterId: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const [{ bookId, chapterId }, messages] = await Promise.all([params, searchParams]);
  const [{ book }, chapter] = await Promise.all([getEditorBook(bookId), getEditorChapter(bookId, chapterId)]);
  if (!book || !chapter) notFound();
  const updateChapter = updateChapterAction.bind(null, book.id, chapter.id);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/dashboard/libros/${book.id}`} className="inline-flex items-center gap-2 text-sm text-black/50 hover:text-black"><ArrowLeftIcon className="size-4" />Volver a {book.title}</Link>
      <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#98783f]">Capítulo {chapter.number}</p><h1 className="mt-2 font-serif text-4xl">{chapter.title}</h1></div>{book.status === "published" && chapter.status === "published" && <Link href={`/leer/${book.slug}/${chapter.number}`} target="_blank" className="inline-flex h-10 items-center justify-center rounded-xl border border-black/10 bg-white px-4 text-sm">Ver capítulo ↗</Link>}</div>
      <div className="mt-8"><EditorNotice error={messages.error} saved={messages.saved} /></div>
      <section className="mt-8 rounded-2xl border border-black/8 bg-white p-6 sm:p-8">
        <ChapterEditorForm chapter={chapter} action={updateChapter} submitLabel="Guardar capítulo" />
      </section>
    </div>
  );
}
