"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { bulkUpdateChaptersAction } from "@/app/dashboard/actions";
import { ArrowRightIcon, ClockIcon } from "@/components/icons";
import type { EditorChapter, PublicationStatus } from "@/lib/editorial";

const statusLabels: Record<PublicationStatus, string> = { draft: "Borrador", published: "Publicado", archived: "Archivado" };

function ActionButton({ value, children, destructive = false, disabled = false }: { value: string; children: React.ReactNode; destructive?: boolean; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" name="bulk_action" value={value} disabled={pending || disabled} className={`rounded-lg px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${destructive ? "border border-red-700/20 bg-red-50 text-red-700 hover:bg-red-100" : "border border-black/10 bg-white text-[#242620] hover:bg-[#f3f1eb]"}`}>{children}</button>;
}

export function ChapterBulkList({ bookId, chapters }: { bookId: string; chapters: EditorChapter[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const action = bulkUpdateChaptersAction.bind(null, bookId);
  const allSelected = chapters.length > 0 && selected.size === chapters.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(chapters.map((chapter) => chapter.id)));
  }

  function toggleChapter(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function confirmAction(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "delete" && !window.confirm(`¿Eliminar permanentemente ${selected.size} capítulo${selected.size === 1 ? "" : "s"}? Esta acción no se puede deshacer.`)) {
      event.preventDefault();
    }
  }

  return (
    <form action={action} onSubmit={confirmAction}>
      <div className="flex flex-col gap-3 border-b border-black/8 bg-[#faf9f6] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <label className="flex cursor-pointer items-center gap-3 text-sm font-medium"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="size-4 accent-[#98783f]" />Seleccionar todos <span className="font-normal text-black/40">({selected.size} seleccionados)</span></label>
        <div className="flex flex-wrap gap-2">
          <ActionButton value="publish" disabled={!selected.size}>Publicar</ActionButton>
          <ActionButton value="draft" disabled={!selected.size}>Pasar a borrador</ActionButton>
          <ActionButton value="delete" destructive disabled={!selected.size}>Eliminar</ActionButton>
        </div>
      </div>
      <div className="divide-y divide-black/7">
        {chapters.map((chapter) => (
          <div key={chapter.id} className={`grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 transition sm:px-6 ${selected.has(chapter.id) ? "bg-amber-50/60" : "hover:bg-[#faf8f3]"}`}>
            <input name="chapter_ids" value={chapter.id} type="checkbox" checked={selected.has(chapter.id)} onChange={() => toggleChapter(chapter.id)} aria-label={`Seleccionar capítulo ${chapter.number}`} className="size-4 accent-[#98783f]" />
            <Link href={`/dashboard/libros/${bookId}/capitulos/${chapter.id}`} className="group grid min-w-0 gap-3 sm:grid-cols-[70px_1fr] sm:items-center">
              <span className="text-xs font-semibold uppercase tracking-[.16em] text-[#98783f]">Cap. {chapter.number}</span>
              <div className="min-w-0"><h3 className="truncate text-sm font-medium">{chapter.title}</h3><p className="mt-1 flex items-center gap-1.5 text-xs text-black/40"><ClockIcon className="size-3" />{chapter.reading_minutes} min · {statusLabels[chapter.status]}</p></div>
            </Link>
            <Link href={`/dashboard/libros/${bookId}/capitulos/${chapter.id}`} aria-label={`Editar capítulo ${chapter.number}`}><ArrowRightIcon className="size-4 text-black/30" /></Link>
          </div>
        ))}
      </div>
    </form>
  );
}
