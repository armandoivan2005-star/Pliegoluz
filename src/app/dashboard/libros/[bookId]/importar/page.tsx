import Link from "next/link";
import { notFound } from "next/navigation";
import { BulkPdfImport } from "@/components/bulk-pdf-import";
import { ArrowLeftIcon } from "@/components/icons";
import { EditorNotice } from "@/components/editor-forms";
import { getEditorBook } from "@/lib/editorial";

export const dynamic = "force-dynamic";

export default async function ImportBookPage({ params, searchParams }: { params: Promise<{ bookId: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ bookId }, { error }] = await Promise.all([params, searchParams]);
  const { book } = await getEditorBook(bookId);
  if (!book) notFound();

  return (
    <div className="mx-auto max-w-6xl">
      <Link href={`/dashboard/libros/${book.id}`} className="inline-flex items-center gap-2 text-sm text-black/50 hover:text-black"><ArrowLeftIcon className="size-4" />Volver a {book.title}</Link>
      <div className="mt-7"><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#98783f]">{book.title}</p><h1 className="mt-2 font-serif text-4xl sm:text-5xl">Importar libro completo</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-black/50">Sube un PDF, revisa los capítulos detectados y decide si omitir o reemplazar números existentes.</p></div>
      <div className="mt-8"><EditorNotice error={error} /></div>
      <div className="mt-8"><BulkPdfImport bookId={book.id} /></div>
    </div>
  );
}
