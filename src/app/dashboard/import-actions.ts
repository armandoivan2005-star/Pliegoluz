"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireBookManager } from "@/lib/editor-auth";
import { cleanExtractedPdfText } from "@/lib/pdf-text";
import type { PublicationStatus } from "@/lib/editorial";

export type ImportedChapterDraft = { number: number; title: string; content: string };
export type PdfImportState = { error: string; fileName: string; chapters: ImportedChapterDraft[] };

const initialState: PdfImportState = { error: "", fileName: "", chapters: [] };
const statuses: PublicationStatus[] = ["draft", "published", "archived"];

function romanToNumber(roman: string) {
  const values: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  let previous = 0;
  for (const character of [...roman.toUpperCase()].reverse()) {
    const current = values[character] ?? 0;
    total += current < previous ? -current : current;
    previous = Math.max(previous, current);
  }
  return total;
}

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

function splitChapters(text: string): ImportedChapterDraft[] {
  const lines = text.split("\n").map((line) => line.trim());
  const heading = /^cap[ií]tulo\s+(\d{1,3}|[ivxlcdm]+)(?:\s*(?:[-:—–.]\s*)?(.+))?$/i;
  const starts: Array<{ index: number; number: number; title: string }> = [];

  lines.forEach((line, index) => {
    if (line.length > 180) return;
    const match = line.match(heading);
    if (!match) return;
    const number = /^\d+$/.test(match[1]) ? Number(match[1]) : romanToNumber(match[1]);
    if (number < 1) return;
    starts.push({ index, number, title: match[2]?.trim() ?? "" });
  });

  if (!starts.length) throw new Error("No se encontraron encabezados como “Capítulo 1” o “Capítulo I”.");

  // Los índices suelen repetir todos los encabezados antes del cuerpo del libro.
  // Conservamos la última aparición de cada número, que normalmente es el capítulo real.
  const uniqueStarts = [...new Map(starts.map((start) => [start.number, start])).values()]
    .sort((a, b) => a.index - b.index);
  if (uniqueStarts.length > 50) throw new Error("El PDF contiene más de 50 capítulos distintos.");

  const chapters = uniqueStarts.map((start, position) => {
    const end = uniqueStarts[position + 1]?.index ?? lines.length;
    let bodyStart = start.index + 1;
    let title = start.title;
    if (!title) {
      while (bodyStart < end && !lines[bodyStart]) bodyStart += 1;
      title = lines[bodyStart] || `Capítulo ${start.number}`;
      bodyStart += 1;
    }
    const content = lines.slice(bodyStart, end).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    return { number: start.number, title: title.slice(0, 180), content };
  });

  if (new Set(chapters.map((chapter) => chapter.number)).size !== chapters.length) {
    throw new Error("Se detectaron números de capítulo duplicados.");
  }
  return chapters.sort((a, b) => a.number - b.number);
}

export async function analyzeBookPdfAction(bookId: string, _previous: PdfImportState, formData: FormData): Promise<PdfImportState> {
  await requireBookManager(bookId);
  const file = formData.get("pdf_file");
  if (!(file instanceof File)) return { ...initialState, error: "Selecciona un PDF." };
  try {
    const chapters = splitChapters(await extractPdf(file));
    return { error: "", fileName: file.name, chapters };
  } catch (caught) {
    return { ...initialState, fileName: file.name, error: caught instanceof Error ? caught.message : "No se pudo analizar el PDF." };
  }
}

export async function importBookChaptersAction(bookId: string, formData: FormData) {
  const { supabase } = await requireBookManager(bookId);
  const numbers = formData.getAll("number").map(Number);
  const titles = formData.getAll("title").map((value) => String(value).trim());
  const contents = formData.getAll("content").map((value) => cleanExtractedPdfText(String(value)));
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
    const { data: existing } = await supabase.from("chapters").select("number").eq("book_id", bookId).in("number", numbers).returns<Array<{ number: number }>>();
    const existingNumbers = new Set((existing ?? []).map((chapter) => chapter.number));
    rows = chapters.filter((chapter) => !existingNumbers.has(chapter.number));
  }
  if (!rows.length) redirect(`${errorPath}?error=${encodeURIComponent("Todos los capítulos detectados ya existen.")}`);

  const now = new Date().toISOString();
  const payload = rows.map((chapter) => ({
    book_id: bookId,
    number: chapter.number,
    title: chapter.title,
    content_markdown: chapter.content,
    status,
    reading_minutes: Math.max(1, Math.ceil(chapter.content.split(/\s+/u).filter(Boolean).length / 220)),
    published_at: status === "published" ? now : null,
    updated_at: now,
  }));
  const query = conflictMode === "replace"
    ? supabase.from("chapters").upsert(payload, { onConflict: "book_id,number" })
    : supabase.from("chapters").insert(payload);
  const { error } = await query;
  if (error) redirect(`${errorPath}?error=${encodeURIComponent("No se pudieron importar los capítulos.")}`);

  updateTag("public-library");
  revalidatePath("/");
  revalidatePath("/biblioteca");
  revalidatePath("/novedades");
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/libros/${bookId}`);
  redirect(`/dashboard/libros/${bookId}?saved=imported`);
}
