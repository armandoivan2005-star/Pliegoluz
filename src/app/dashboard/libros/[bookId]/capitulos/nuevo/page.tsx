import Link from "next/link";
import { notFound } from "next/navigation";
import { createChapterAction } from "@/app/dashboard/actions";
import { ChapterEditorForm, EditorNotice } from "@/components/editor-forms";
import { ArrowLeftIcon } from "@/components/icons";
import { getEditorBook } from "@/lib/editorial";

export const dynamic = "force-dynamic";

export default async function NewChapterPage({ params, searchParams }: { params: Promise<{ bookId: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ bookId }, { error }] = await Promise.all([params, searchParams]);
  const { book, chapters } = await getEditorBook(bookId);
  if (!book) notFound();
  const nextNumber = chapters.reduce((maximum, chapter) => Math.max(maximum, chapter.number), 0) + 1;
  const createChapter = createChapterAction.bind(null, book.id);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/dashboard/libros/${book.id}`} className="inline-flex items-center gap-2 text-sm text-black/50 hover:text-black"><ArrowLeftIcon className="size-4" />Volver a {book.title}</Link>
      <div className="mt-7"><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#98783f]">{book.title}</p><h1 className="mt-2 font-serif text-4xl">Agregar capítulo</h1></div>
      <section className="mt-8 rounded-2xl border border-black/8 bg-white p-6 sm:p-8">
        <EditorNotice error={error} />
        <ChapterEditorForm action={createChapter} nextNumber={nextNumber} submitLabel="Crear capítulo" />
      </section>
    </div>
  );
}
