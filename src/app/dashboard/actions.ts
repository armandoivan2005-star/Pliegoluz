"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { repairImportedChapter } from "@/lib/chapter-import";
import { requireAuthor, requireBookManager } from "@/lib/editor-auth";
import type { PublicationStatus, WorkStatus } from "@/lib/editorial";
import { cleanExtractedPdfText } from "@/lib/pdf-text";
import { postgresErrorCode, withTransaction } from "@/lib/postgres";

const publicationStatuses: PublicationStatus[] = ["draft", "published", "archived"];
const workStatuses: WorkStatus[] = ["completed", "publishing", "paused", "cancelled"];

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function statusValue(formData: FormData): PublicationStatus {
  const status = value(formData, "status") as PublicationStatus;
  return publicationStatuses.includes(status) ? status : "draft";
}

function workStatusValue(formData: FormData): WorkStatus {
  const status = value(formData, "work_status") as WorkStatus;
  return workStatuses.includes(status) ? status : "completed";
}

function genresValue(formData: FormData) {
  return [...new Set(value(formData, "genres").split(",").map((genre) => genre.trim()).filter(Boolean))];
}

function slugFromTitle(title: string) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readingMinutes(content: string) {
  const words = content.split(/\s+/u).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function formError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

type CoverUpload = { bytes: Uint8Array; contentType: string };

async function coverUpload(formData: FormData, errorPath: string): Promise<CoverUpload | null> {
  const file = formData.get("cover_file");
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > 5 * 1024 * 1024) formError(errorPath, "La carátula no puede superar 5 MB.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8 && bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  const isWebp = bytes.length >= 12
    && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF"
    && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";

  if (isJpeg) return { bytes, contentType: "image/jpeg" };
  if (isPng) return { bytes, contentType: "image/png" };
  if (isWebp) return { bytes, contentType: "image/webp" };
  formError(errorPath, "La carátula debe ser una imagen JPG, PNG o WebP válida.");
}

function validateBook(formData: FormData, errorPath: string) {
  const title = value(formData, "title");
  const slug = value(formData, "slug").toLowerCase() || slugFromTitle(title);
  const authorName = value(formData, "author_name");
  const description = value(formData, "description");

  if (title.length < 2 || title.length > 160) formError(errorPath, "El título debe tener entre 2 y 160 caracteres.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) formError(errorPath, "El slug solo puede contener letras minúsculas, números y guiones.");
  if (authorName.length < 2 || authorName.length > 120) formError(errorPath, "Escribe el nombre público del autor.");
  if (description.length < 20) formError(errorPath, "La sinopsis debe tener al menos 20 caracteres.");

  return {
    title,
    slug,
    subtitle: value(formData, "subtitle") || null,
    author_name: authorName,
    description,
    genres: genresValue(formData),
    status: statusValue(formData),
    work_status: workStatusValue(formData),
  };
}

export async function createBookAction(formData: FormData) {
  const errorPath = "/dashboard/libros/nuevo";
  const fields = validateBook(formData, errorPath);
  const cover = await coverUpload(formData, errorPath);
  const { db, identity } = await requireAuthor();
  const bookId = crypto.randomUUID();
  try {
    await db.query(
      `insert into public.books (
         id, author_profile_id, slug, title, subtitle, author_name, description,
         genres, cover_data, cover_content_type, cover_updated_at,
         status, work_status, published_at
       ) values (
         $1, $2, $3, $4, $5, $6, $7, $8,
         $9, $10, case when $9::bytea is null then null else now() end,
         $11, $12, case when $11::public.publication_status = 'published' then now() else null end
       )`,
      [
        bookId, identity.id, fields.slug, fields.title, fields.subtitle, fields.author_name,
        fields.description, fields.genres, cover?.bytes ?? null, cover?.contentType ?? null,
        fields.status, fields.work_status,
      ],
    );
  } catch (error) {
    formError(errorPath, postgresErrorCode(error) === "23505" ? "Ya existe un libro con ese slug." : "No se pudo crear el libro.");
  }

  updateTag("public-library");
  revalidatePath("/");
  revalidatePath("/biblioteca");
  revalidatePath("/dashboard");
  redirect(`/dashboard/libros/${bookId}?saved=created`);
}

export async function updateBookAction(bookId: string, formData: FormData) {
  const errorPath = `/dashboard/libros/${bookId}`;
  const fields = validateBook(formData, errorPath);
  const cover = await coverUpload(formData, errorPath);
  const { db } = await requireBookManager(bookId);
  const currentResult = await db.query<{ slug: string; published_at: string | null }>(
    `select slug, published_at::text from public.books where id = $1`,
    [bookId],
  );
  const current = currentResult.rows[0];

  if (!current) formError("/dashboard", "El libro ya no existe.");
  try {
    await db.query(
      `update public.books
          set slug = $1, title = $2, subtitle = $3, author_name = $4,
              description = $5, genres = $6, status = $7, work_status = $8,
              published_at = case
                when $7::public.publication_status = 'published' then coalesce(published_at, now())
                else null
              end,
              cover_data = case when $9::boolean then $10::bytea else cover_data end,
              cover_content_type = case when $9::boolean then $11 else cover_content_type end,
              cover_updated_at = case when $9::boolean then now() else cover_updated_at end,
              updated_at = now()
        where id = $12`,
      [
        fields.slug, fields.title, fields.subtitle, fields.author_name, fields.description,
        fields.genres, fields.status, fields.work_status, Boolean(cover),
        cover?.bytes ?? null, cover?.contentType ?? null, bookId,
      ],
    );
  } catch (error) {
    formError(errorPath, postgresErrorCode(error) === "23505" ? "Ya existe otro libro con ese slug." : "No se pudieron guardar los cambios.");
  }

  updateTag("public-library");
  revalidatePath("/");
  revalidatePath("/biblioteca");
  revalidatePath("/dashboard");
  revalidatePath(errorPath);
  revalidatePath(`/libros/${current.slug}`);
  revalidatePath(`/libros/${fields.slug}`);
  redirect(`${errorPath}?saved=updated`);
}

async function pdfContent(formData: FormData, errorPath: string, chapterNumber: number) {
  const file = formData.get("pdf_file");
  if (!(file instanceof File) || file.size === 0) return null;

  if (file.size > 10 * 1024 * 1024) formError(errorPath, "El PDF no puede superar 10 MB.");
  if (file.type && file.type !== "application/pdf") formError(errorPath, "El archivo debe ser un PDF.");

  const data = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(data.slice(0, 5)) !== "%PDF-") formError(errorPath, "El archivo no contiene un PDF válido.");

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data });
  let extractedText = "";

  try {
    const result = await parser.getText();
    extractedText = result.text;
  } catch {
    formError(errorPath, "No se pudo leer el PDF. Comprueba que no esté protegido o dañado.");
  } finally {
    await parser.destroy();
  }

  const content = cleanExtractedPdfText(extractedText, chapterNumber);
  if (content.length < 20) formError(errorPath, "No se pudo extraer suficiente texto del PDF.");
  return { content, fileName: file.name };
}

async function validateChapter(formData: FormData, errorPath: string) {
  const number = Number(value(formData, "number"));
  const extractedPdf = await pdfContent(formData, errorPath, number);
  const title = value(formData, "title") || extractedPdf?.fileName.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() || "";
  const content = cleanExtractedPdfText(extractedPdf?.content ?? String(formData.get("content_markdown") ?? ""), number);
  const status = statusValue(formData);

  if (!Number.isInteger(number) || number < 1) formError(errorPath, "El número de capítulo debe ser un entero mayor que cero.");
  if (title.length < 2 || title.length > 180) formError(errorPath, "El título debe tener entre 2 y 180 caracteres.");
  if (status === "published" && content.length < 20) formError(errorPath, "Un capítulo publicado necesita contenido.");

  return {
    number,
    title,
    content_markdown: content,
    status,
    reading_minutes: readingMinutes(content),
  };
}

export async function createChapterAction(bookId: string, formData: FormData) {
  const errorPath = `/dashboard/libros/${bookId}/capitulos/nuevo`;
  const fields = await validateChapter(formData, errorPath);
  const { db } = await requireBookManager(bookId);
  const bookResult = await db.query<{ slug: string }>(`select slug from public.books where id = $1`, [bookId]);
  const book = bookResult.rows[0];
  if (!book) formError("/dashboard", "El libro ya no existe.");

  const chapterId = crypto.randomUUID();
  try {
    await db.query(
      `insert into public.chapters (
         id, book_id, number, title, content_markdown, status, reading_minutes, published_at
       ) values (
         $1, $2, $3, $4, $5, $6, $7,
         case when $6::public.publication_status = 'published' then now() else null end
       )`,
      [chapterId, bookId, fields.number, fields.title, fields.content_markdown, fields.status, fields.reading_minutes],
    );
  } catch (error) {
    formError(errorPath, postgresErrorCode(error) === "23505" ? `Ya existe el capítulo ${fields.number}.` : "No se pudo crear el capítulo.");
  }

  updateTag("public-library");
  revalidatePath(`/dashboard/libros/${bookId}`);
  revalidatePath(`/libros/${book.slug}`);
  redirect(`/dashboard/libros/${bookId}/capitulos/${chapterId}?saved=created`);
}

export async function updateChapterAction(bookId: string, chapterId: string, formData: FormData) {
  const errorPath = `/dashboard/libros/${bookId}/capitulos/${chapterId}`;
  const fields = await validateChapter(formData, errorPath);
  const { db } = await requireBookManager(bookId);
  const [bookResult, currentResult] = await Promise.all([
    db.query<{ slug: string }>(`select slug from public.books where id = $1`, [bookId]),
    db.query<{ published_at: string | null; number: number }>(
      `select published_at::text, number from public.chapters where id = $1 and book_id = $2`,
      [chapterId, bookId],
    ),
  ]);
  const book = bookResult.rows[0];
  const current = currentResult.rows[0];

  if (!book || !current) formError(`/dashboard/libros/${bookId}`, "El capítulo ya no existe.");

  try {
    await db.query(
      `update public.chapters
          set number = $1, title = $2, content_markdown = $3, status = $4,
              reading_minutes = $5,
              published_at = case
                when $4::public.publication_status = 'published' then coalesce(published_at, now())
                else null
              end,
              updated_at = now()
        where id = $6 and book_id = $7`,
      [fields.number, fields.title, fields.content_markdown, fields.status, fields.reading_minutes, chapterId, bookId],
    );
  } catch (error) {
    formError(errorPath, postgresErrorCode(error) === "23505" ? `Ya existe el capítulo ${fields.number}.` : "No se pudieron guardar los cambios.");
  }

  updateTag("public-library");
  revalidatePath(`/dashboard/libros/${bookId}`);
  revalidatePath(`/libros/${book.slug}`);
  revalidatePath(`/leer/${book.slug}/${current.number}`);
  revalidatePath(`/leer/${book.slug}/${fields.number}`);
  redirect(`${errorPath}?saved=updated`);
}

type RepairChapterRow = {
  id: string;
  book_id: string;
  number: number;
  title: string;
  content_markdown: string;
  status: PublicationStatus;
  reading_minutes: number;
  published_at: string | null;
  created_at: string;
};

export async function repairImportedChapterTitlesAction(bookId: string, _formData: FormData) {
  void _formData;
  const returnPath = `/dashboard/libros/${bookId}`;
  const { db } = await requireBookManager(bookId);
  const [bookResult, chaptersResult] = await Promise.all([
    db.query<{ slug: string }>(`select slug from public.books where id = $1`, [bookId]),
    db.query<RepairChapterRow>(
      `select id, book_id, number, title, content_markdown, status, reading_minutes,
              published_at::text, created_at::text
         from public.chapters
        where book_id = $1
        order by number asc
        limit 1001`,
      [bookId],
    ),
  ]);
  const book = bookResult.rows[0];
  const chapters = chaptersResult.rows;

  if (!book) formError(returnPath, "No se pudieron revisar los capítulos.");
  if (chapters.length > 1000) formError(returnPath, "La corrección admite un máximo de 1000 capítulos por libro.");

  const now = new Date().toISOString();
  const repairs = chapters.flatMap((chapter) => {
    const repaired = repairImportedChapter({
      number: chapter.number,
      title: chapter.title,
      content: chapter.content_markdown,
    });

    if (!repaired.changed) return [];
    return [{
      ...chapter,
      title: repaired.title,
      content_markdown: repaired.content,
      reading_minutes: readingMinutes(repaired.content),
      updated_at: now,
    }];
  });

  if (repairs.length) {
    try {
      await withTransaction(async (client) => {
        for (const chapter of repairs) {
          await client.query(
            `update public.chapters
                set title = $1, content_markdown = $2, reading_minutes = $3, updated_at = $4
              where id = $5 and book_id = $6`,
            [chapter.title, chapter.content_markdown, chapter.reading_minutes, chapter.updated_at, chapter.id, bookId],
          );
        }
      });
    } catch {
      formError(returnPath, "No se pudieron corregir los títulos importados.");
    }
  }

  updateTag("public-library");
  revalidatePath("/");
  revalidatePath("/biblioteca");
  revalidatePath("/novedades");
  revalidatePath(returnPath);
  revalidatePath(`/libros/${book.slug}`);
  for (const chapter of repairs) revalidatePath(`/leer/${book.slug}/${chapter.number}`);
  redirect(`${returnPath}?saved=repaired`);
}

export async function bulkUpdateChaptersAction(bookId: string, formData: FormData) {
  const selectedIds = [...new Set(formData.getAll("chapter_ids").map((item) => String(item)))].filter((id) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id),
  );
  const action = value(formData, "bulk_action");
  const returnPath = `/dashboard/libros/${bookId}`;

  if (!selectedIds.length) formError(returnPath, "Selecciona al menos un capítulo.");
  if (!["publish", "draft", "delete"].includes(action)) formError(returnPath, "La acción seleccionada no es válida.");

  const { db } = await requireBookManager(bookId);
  const [bookResult, chaptersResult] = await Promise.all([
    db.query<{ slug: string }>(`select slug from public.books where id = $1`, [bookId]),
    db.query<{ id: string; number: number; content_markdown: string }>(
      `select id, number, content_markdown
         from public.chapters
        where book_id = $1 and id = any($2::uuid[])`,
      [bookId, selectedIds],
    ),
  ]);
  const book = bookResult.rows[0];
  const chapters = chaptersResult.rows;

  if (!book || !chapters.length) formError(returnPath, "No se encontraron los capítulos seleccionados.");
  if (action === "publish" && chapters.some((chapter) => chapter.content_markdown.trim().length < 20)) {
    formError(returnPath, "No se pueden publicar capítulos sin contenido suficiente.");
  }

  const verifiedIds = chapters.map((chapter) => chapter.id);
  try {
    if (action === "delete") {
      await db.query(
        `delete from public.chapters where book_id = $1 and id = any($2::uuid[])`,
        [bookId, verifiedIds],
      );
    } else {
      await db.query(
        `update public.chapters
            set status = $1::public.publication_status,
                published_at = case when $1 = 'published' then now() else null end,
                updated_at = now()
          where book_id = $2 and id = any($3::uuid[])`,
        [action === "publish" ? "published" : "draft", bookId, verifiedIds],
      );
    }
  } catch {
    formError(returnPath, "No se pudo aplicar la acción a los capítulos.");
  }

  updateTag("public-library");
  revalidatePath("/");
  revalidatePath("/biblioteca");
  revalidatePath(returnPath);
  revalidatePath(`/libros/${book.slug}`);
  for (const chapter of chapters) revalidatePath(`/leer/${book.slug}/${chapter.number}`);
  redirect(`${returnPath}?saved=${action}`);
}
