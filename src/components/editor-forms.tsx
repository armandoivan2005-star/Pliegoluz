import { SubmitButton } from "@/components/submit-button";
import type { EditorBook, EditorChapter, PublicationStatus, WorkStatus } from "@/lib/editorial";

const inputClass = "mt-2 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#242620] outline-none transition placeholder:text-black/30 focus:border-[#9f7f45] focus:ring-2 focus:ring-[#9f7f45]/10";

const statuses: Array<{ value: PublicationStatus; label: string }> = [
  { value: "draft", label: "Borrador" },
  { value: "published", label: "Publicado" },
  { value: "archived", label: "Archivado" },
];

const workStatuses: Array<{ value: WorkStatus; label: string }> = [
  { value: "completed", label: "Completo" },
  { value: "publishing", label: "En publicación" },
  { value: "paused", label: "En pausa" },
  { value: "cancelled", label: "Cancelado" },
];

type BookFormProps = {
  book?: EditorBook;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
};

export function BookEditorForm({ book, action, submitLabel }: BookFormProps) {
  return (
    <form action={action} className="space-y-7">
      <div className={`grid gap-5 ${book ? "sm:grid-cols-2" : ""}`}>
        <label className="text-sm font-medium">Título<input className={inputClass} name="title" required maxLength={160} defaultValue={book?.title} placeholder="Nombre de la obra" /></label>
        {book && <label className="text-sm font-medium">Slug público<input className={inputClass} name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={book.slug} placeholder="nombre-del-libro" /></label>}
      </div>
      {book && <label className="block text-sm font-medium">Subtítulo<input className={inputClass} name="subtitle" maxLength={220} defaultValue={book.subtitle ?? ""} placeholder="Edición, volumen o frase descriptiva" /></label>}
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium">Autor<input className={inputClass} name="author_name" required maxLength={120} defaultValue={book?.author_name} placeholder="Nombre público del autor" /></label>
        <label className="text-sm font-medium">Estado<select className={inputClass} name="status" defaultValue={book?.status ?? "draft"}>{statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
      </div>
      <label className="block text-sm font-medium">Estado de la obra<select className={inputClass} name="work_status" defaultValue={book?.work_status ?? "completed"}>{workStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
      <label className="block text-sm font-medium">Carátula del libro<span className="ml-2 font-normal text-black/45">JPG, PNG o WebP · máximo 5 MB</span><input className={`${inputClass} file:mr-4 file:rounded-lg file:border-0 file:bg-[#20241f] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white`} name="cover_file" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" /></label>
      {book?.cover_path && <p className="-mt-5 text-xs text-emerald-700">Este libro ya tiene una carátula. Selecciona otra imagen para reemplazarla.</p>}
      <label className="block text-sm font-medium">Géneros<span className="ml-2 font-normal text-black/45">Separados por comas</span><input className={inputClass} name="genres" defaultValue={book?.genres.join(", ") ?? ""} placeholder="Novela, Drama, Suspenso" /></label>
      <label className="block text-sm font-medium">Sinopsis<textarea className={`${inputClass} min-h-36 resize-y leading-6`} name="description" required minLength={20} defaultValue={book?.description} placeholder="Descripción que aparecerá en la ficha pública" /></label>
      <div className="flex justify-end border-t border-black/8 pt-6">
        <SubmitButton className="rounded-xl bg-[#20241f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

type ChapterFormProps = {
  chapter?: EditorChapter;
  nextNumber?: number;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
};

export function ChapterEditorForm({ chapter, nextNumber = 1, action, submitLabel }: ChapterFormProps) {
  return (
    <form action={action} className="space-y-7">
      <div className="grid gap-5 sm:grid-cols-[150px_1fr_190px]">
        <label className="text-sm font-medium">Número<input className={inputClass} name="number" type="number" min={1} step={1} required defaultValue={chapter?.number ?? nextNumber} /></label>
        <label className="text-sm font-medium">Título<input className={inputClass} name="title" maxLength={180} defaultValue={chapter?.title} placeholder="Título del capítulo o nombre del PDF" /></label>
        <label className="text-sm font-medium">Estado<select className={inputClass} name="status" defaultValue={chapter?.status ?? "draft"}>{statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
      </div>
      <label className="block text-sm font-medium">PDF del capítulo<span className="ml-2 font-normal text-black/45">Opcional · máximo 10 MB</span><input className={`${inputClass} file:mr-4 file:rounded-lg file:border-0 file:bg-[#20241f] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white`} name="pdf_file" type="file" accept=".pdf,application/pdf" /></label>
      <label className="block text-sm font-medium">Contenido<span className="ml-2 font-normal text-black/45">También puedes escribir o pegar el texto manualmente</span><textarea className={`${inputClass} min-h-[560px] resize-y font-serif text-base leading-7`} name="content_markdown" spellCheck defaultValue={chapter?.content_markdown ?? ""} placeholder="El texto extraído del PDF se guardará aquí al crear el capítulo…" /></label>
      <div className="flex items-center justify-between gap-4 border-t border-black/8 pt-6">
        <p className="text-xs leading-5 text-black/45">El tiempo de lectura se calcula automáticamente al guardar.</p>
        <SubmitButton className="shrink-0 rounded-xl bg-[#20241f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

export function EditorNotice({ error, saved }: { error?: string; saved?: string }) {
  if (error) return <p role="alert" className="mb-6 rounded-xl border border-red-700/15 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>;
  if (saved) return <p className="mb-6 rounded-xl border border-emerald-700/15 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Cambios guardados correctamente.</p>;
  return null;
}
