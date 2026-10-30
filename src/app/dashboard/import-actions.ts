"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { splitImportedBookChapters, type ImportedChapterDraft } from "@/lib/chapter-import";
import { requireBookManager } from "@/lib/editor-auth";
import { cleanExtractedPdfText } from "@/lib/pdf-text";
import type { PublicationStatus } from "@/lib/editorial";
import { withTransaction } from "@/lib/postgres";

export type { ImportedChapterDraft };
export type PdfImportState = { error: string; fileName: string; chapters: ImportedChapterDraft[] };

const initialState: PdfImportState = { error: "", fileName: "", chapters: [] };
const statuses: PublicationStatus[] = ["draft", "published", "archived"];

async function extractPdf(file: File) {
  if (file.size === 0) throw new Error("Selecciona un PDF.");
  if (file.size > 10 * 1024 * 1024) throw new Error("El PDF no puede superar 10 MB.");
  if (file.type && file.type !== "application/pdf") throw new Error("El archivo debe ser un PDF.");
  const data = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(data.slice(0, 5)) !== "%PDF-") throw new Error("El archivo no contiene un PDF válido.");
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data });
  try {
    return cleanExtractedPdfText((await parser.getText()).text);
  } finally {
    await parser.destroy();
  }
}

export async function analyzeBookPdfAction(bookId: string, _previous: PdfImportState, formData: FormData): Promise<PdfImportState> {
  await requireBookManager(bookId);
  const file = formData.get("pdf_file");
  if (!(file instanceof File)) return { ...initialState, error: "Selecciona un PDF." };
  try {
    const chapters = splitImportedBookChapters(await extractPdf(file));
    return { error: "", fileName: file.name, chapters };
  } catch (caught) {
    return { ...initialState, fileName: file.name, error: caught instanceof Error ? caught.message : "No se pudo analizar el PDF." };
  }
}

export async function importBookChaptersAction(bookId: string, formData: FormData) {
  const { db } = await requireBookManager(bookId);
  const numbers = formData.getAll("number").map(Number);
  const titles = formData.getAll("title").map((value) => String(value).trim());
  const contents = formData.getAll("content").map((value, index) => cleanExtractedPdfText(String(value), numbers[index]));
  const statusValue = String(formData.get("status") ?? "draft") as PublicationStatus;
  const status = statuses.includes(statusValue) ? statusValue : "draft";
  const conflictMode = formData.get("conflict_mode") === "replace" ? "replace" : "skip";
  const errorPath = `/dashboard/libros/${bookId}/importar`;

  if (!numbers.length || numbers.length > 50 || numbers.length !== titles.length || titles.length !== contents.length) {
    redirect(`${errorPath}?error=${encodeURIComponent("La vista previa no es válida.")}`);
  }
  const chapters = numbers.map((number, index) => ({ number, title: titles[index], content: contents[index] }));
  if (chapters.some((chapter) => !Number.isInteger(chapter.number) || chapter.number < 1 || chapter.title.length < 2 || chapter.title.length > 180 || chapter.content.length < 20)) {
    redirect(`${errorPath}?error=${encodeURIComponent("Revisa números, títulos y contenido antes de importar.")}`);
  }
  if (new Set(numbers).size !== numbers.length) redirect(`${errorPath}?error=${encodeURIComponent("Hay números de capítulo duplicados.")}`);

  let rows = chapters;
  if (conflictMode === "skip") {
    const existing = await db.query<{ number: number }>(
      `select number from public.chapters where book_id = $1 and number = any($2::integer[])`,
      [bookId, numbers],
    );
    const existingNumbers = new Set(existing.rows.map((chapter) => chapter.number));
    rows = chapters.filter((chapter) => !existingNumbers.has(chapter.number));
  }
  if (!rows.length) redirect(`${errorPath}?error=${encodeURIComponent("Todos los capítulos detectados ya existen.")}`);

  const now = new Date().toISOString();
  try {
    await withTransaction(async (client) => {
      for (const chapter of rows) {
        const values = [
          bookId,
          chapter.number,
          chapter.title,
          chapter.content,
          status,
          Math.max(1, Math.ceil(chapter.content.split(/\s+/u).filter(Boolean).length / 220)),
          status === "published" ? now : null,
          now,
        ];
        if (conflictMode === "replace") {
          await client.query(
            `insert into public.chapters (
               book_id, number, title, content_markdown, status,
               reading_minutes, published_at, updated_at
             ) values ($1, $2, $3, $4, $5, $6, $7, $8)
             on conflict (book_id, number) do update set
               title = excluded.title,
               content_markdown = excluded.content_markdown,
               status = excluded.status,
               reading_minutes = excluded.reading_minutes,
               published_at = excluded.published_at,
               updated_at = excluded.updated_at`,
            values,
          );
        } else {
          await client.query(
            `insert into public.chapters (
               book_id, number, title, content_markdown, status,
               reading_minutes, published_at, updated_at
             ) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
            values,
          );
        }
      }
    });
  } catch {
    redirect(`${errorPath}?error=${encodeURIComponent("No se pudieron importar los capítulos.")}`);
  }

  updateTag("public-library");
  revalidatePath("/");
  revalidatePath("/biblioteca");
  revalidatePath("/novedades");
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/libros/${bookId}`);
  redirect(`/dashboard/libros/${bookId}?saved=imported`);
}
