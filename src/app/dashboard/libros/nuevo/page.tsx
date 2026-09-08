import Link from "next/link";
import { createBookAction } from "@/app/dashboard/actions";
import { BookEditorForm, EditorNotice } from "@/components/editor-forms";
import { ArrowLeftIcon } from "@/components/icons";
import { requireAuthor } from "@/lib/editor-auth";

export default async function NewBookPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }] = await Promise.all([searchParams, requireAuthor()]);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-black/50 hover:text-black"><ArrowLeftIcon className="size-4" />Volver a la biblioteca</Link>
      <div className="mt-7"><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#98783f]">Nueva obra</p><h1 className="mt-2 font-serif text-4xl">Crear libro</h1></div>
      <section className="mt-8 rounded-2xl border border-black/8 bg-white p-6 sm:p-8">
        <EditorNotice error={error} />
        <BookEditorForm action={createBookAction} submitLabel="Crear libro" />
      </section>
    </div>
  );
}
