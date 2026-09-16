"use client";

import { useActionState } from "react";
import {
  analyzeBookPdfAction,
  importBookChaptersAction,
  type PdfImportState,
} from "@/app/dashboard/import-actions";
import { SubmitButton } from "@/components/submit-button";

const initialState: PdfImportState = { error: "", fileName: "", chapters: [] };
const inputClass = "mt-2 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#242620] outline-none focus:border-[#9f7f45]";
const pdfRequirements = [
  "Archivo PDF válido, sin contraseña y con un tamaño máximo de 10 MB.",
  "El texto debe poder seleccionarse; un PDF formado únicamente por imágenes escaneadas no se puede importar.",
  "Cada capítulo debe comenzar en una línea propia con “Capítulo 1” o “Capítulo I”.",
  "Coloca el título justo después del encabezado. Si ocupa varias líneas, escríbelas en mayúsculas para poder unirlas.",
  "Cada título debe tener entre 2 y 180 caracteres y cada capítulo al menos 20 caracteres de contenido.",
  "El archivo puede contener hasta 50 capítulos distintos y no debe repetir números de capítulo.",
];

export function BulkPdfImport({ bookId }: { bookId: string }) {
  const analyze = analyzeBookPdfAction.bind(null, bookId);
  const importChapters = importBookChaptersAction.bind(null, bookId);
  const [state, analyzeAction, analyzing] = useActionState(analyze, initialState);

  return (
    <div className="space-y-8">
      <form action={analyzeAction} className="rounded-2xl border border-black/8 bg-white p-6 sm:p-8">
        <h2 className="font-serif text-2xl">Seleccionar PDF</h2>
        <p className="mt-2 text-sm leading-6 text-black/50">Comprueba estas condiciones antes de analizar el archivo para que los capítulos se detecten correctamente.</p>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <section aria-labelledby="pdf-requirements-title" className="rounded-xl border border-black/8 bg-[#faf9f6] p-5">
            <h3 id="pdf-requirements-title" className="text-sm font-semibold">Requisitos del PDF</h3>
            <ul className="mt-4 space-y-3">
              {pdfRequirements.map((requirement, index) => (
                <li key={requirement} className="flex gap-3 text-sm leading-5 text-[color:var(--editor-muted)]">
                  <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-[color:var(--editor-border)] text-xs font-semibold text-[color:var(--editor-accent)]">{index + 1}</span>
                  <span>{requirement}</span>
                </li>
              ))}
            </ul>
          </section>

          <aside className="rounded-xl border border-black/10 bg-[#faf9f6] p-5">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[color:var(--editor-accent)]">Formato recomendado</p>
            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-lg border border-black/8 bg-white p-4 font-serif text-sm leading-6 text-[#242620]">{`CAPÍTULO XXXVII
REY O COMANDANTE, ¿POR QUÉ
NO AMBOS?

El amanecer encontró a Darian...`}</pre>
            <p className="mt-3 text-xs leading-5 text-[color:var(--editor-muted)]">Los indicadores de página como “-- 2 of 226 --” y el cierre “FIN DEL CAPÍTULO” se eliminan automáticamente.</p>
          </aside>
        </div>

        {state.error && <p role="alert" className="mt-5 rounded-xl border border-red-700/15 bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-sm font-medium">Archivo PDF<input className={`${inputClass} file:mr-4 file:rounded-lg file:border-0 file:bg-[#20241f] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white`} name="pdf_file" type="file" accept=".pdf,application/pdf" required /></label>
          <button type="submit" disabled={analyzing} className="h-12 rounded-xl bg-[#20241f] px-6 text-sm font-semibold text-white disabled:opacity-60">{analyzing ? "Analizando…" : "Analizar PDF"}</button>
        </div>
      </form>

      {state.chapters.length > 0 && (
        <form action={importChapters} className="rounded-2xl border border-black/8 bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#98783f]">Vista previa</p><h2 className="mt-2 font-serif text-2xl">{state.chapters.length} capítulos detectados</h2><p className="mt-1 text-sm text-black/45">{state.fileName}</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium">Estado inicial<select className={inputClass} name="status" defaultValue="draft"><option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option></select></label>
              <label className="text-xs font-medium">Si ya existe<select className={inputClass} name="conflict_mode" defaultValue="skip"><option value="skip">Omitir capítulo</option><option value="replace">Reemplazar contenido</option></select></label>
            </div>
          </div>

          <div className="mt-7 space-y-3">
            {state.chapters.map((chapter, index) => (
              <details key={`${chapter.number}-${index}`} className="rounded-xl border border-black/8 bg-[#faf9f6] p-4" open={index === 0}>
                <summary className="cursor-pointer text-sm font-semibold">Capítulo {chapter.number}: {chapter.title}</summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-[130px_1fr]">
                  <label className="text-xs font-medium">Número<input className={inputClass} name="number" type="number" min={1} step={1} required defaultValue={chapter.number} /></label>
                  <label className="text-xs font-medium">Título<input className={inputClass} name="title" required minLength={2} maxLength={180} defaultValue={chapter.title} /></label>
                </div>
                <label className="mt-4 block text-xs font-medium">Contenido<textarea className={`${inputClass} min-h-40 resize-y font-serif leading-6`} name="content" required minLength={20} defaultValue={chapter.content} /></label>
              </details>
            ))}
          </div>

          <div className="mt-7 flex justify-end border-t border-black/8 pt-6">
            <SubmitButton pendingLabel="Importando…" className="rounded-xl bg-[#20241f] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">Importar capítulos</SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
