"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireEditor } from "@/lib/editor-auth";
import type { PublicationStatus, WorkStatus } from "@/lib/editorial";
import { cleanExtractedPdfText } from "@/lib/pdf-text";

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

type EditorSupabase = Awaited<ReturnType<typeof requireEditor>>["supabase"];
type CoverUpload = { bytes: Uint8Array; contentType: string; extension: string };

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

  if (isJpeg) return { bytes, contentType: "image/jpeg", extension: "jpg" };
  if (isPng) return { bytes, contentType: "image/png", extension: "png" };
  if (isWebp) return { bytes, contentType: "image/webp", extension: "webp" };
  formError(errorPath, "La carátula debe ser una imagen JPG, PNG o WebP válida.");
}

async function storeBookCover(supabase: EditorSupabase, bookId: string, cover: CoverUpload, errorPath: string) {
  const bucketName = "book-covers";
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  if (bucketsError) formError(errorPath, "No se pudo acceder al almacenamiento de carátulas.");

  if (!buckets.some((bucket) => bucket.name === bucketName)) {
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
    if (createError) formError(errorPath, "No se pudo preparar el almacenamiento de carátulas.");
  }

  const path = `${bookId}/cover-${Date.now()}.${cover.extension}`;
  const { error } = await supabase.storage.from(bucketName).upload(path, cover.bytes, {
    contentType: cover.contentType,
    cacheControl: "3600",
    upsert: true,
  });
  if (error) formError(errorPath, "No se pudo subir la carátula.");
  return path;
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
  const { supabase } = await requireEditor();
  const bookId = crypto.randomUUID();
  const coverPath = cover ? await storeBookCover(supabase, bookId, cover, errorPath) : null;
  const { data, error } = await supabase
    .from("books")
    .insert({
      id: bookId,
      ...fields,
      cover_path: coverPath,
      published_at: fields.status === "published" ? new Date().toISOString() : null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    if (coverPath) await supabase.storage.from("book-covers").remove([coverPath]);
    formError(errorPath, error?.code === "23505" ? "Ya existe un libro con ese slug." : "No se pudo crear el libro.");
  }

  revalidatePath("/");
  revalidatePath("/biblioteca");
  revalidatePath("/dashboard");
  redirect(`/dashboard/libros/${data.id}?saved=created`);
}

export async function updateBookAction(bookId: string, formData: FormData) {
  const errorPath = `/dashboard/libros/${bookId}`;
  const fields = validateBook(formData, errorPath);
  const cover = await coverUpload(formData, errorPath);
  const { supabase } = await requireEditor();
  const { data: current } = await supabase
    .from("books")
    .select("slug, cover_path, published_at")
    .eq("id", bookId)
    .maybeSingle<{ slug: string; cover_path: string | null; published_at: string | null }>();

  if (!current) formError("/dashboard", "El libro ya no existe.");
  const coverPath = cover ? await storeBookCover(supabase, bookId, cover, errorPath) : null;

  const { error } = await supabase
    .from("books")
    .update({
      ...fields,
      ...(coverPath ? { cover_path: coverPath } : {}),
      published_at: fields.status === "published" ? current.published_at ?? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookId);

  if (error) formError(errorPath, error.code === "23505" ? "Ya existe otro libro con ese slug." : "No se pudieron guardar los cambios.");
  if (coverPath && current.cover_path && current.cover_path !== coverPath) {
    await supabase.storage.from("book-covers").remove([current.cover_path]);
  }

  revalidatePath("/");
  revalidatePath("/biblioteca");
  revalidatePath("/dashboard");
  revalidatePath(errorPath);
  revalidatePath(`/libros/${current.slug}`);
  revalidatePath(`/libros/${fields.slug}`);
  redirect(`${errorPath}?saved=updated`);
}

async function pdfContent(formData: FormData, errorPath: string) {
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

  const content = cleanExtractedPdfText(extractedText);
  if (content.length < 20) formError(errorPath, "No se pudo extraer suficiente texto del PDF.");
  return { content, fileName: file.name };
}

async function validateChapter(formData: FormData, errorPath: string) {
  const number = Number(value(formData, "number"));
  const extractedPdf = await pdfContent(formData, errorPath);
  const title = value(formData, "title") || extractedPdf?.fileName.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() || "";
  const content = extractedPdf?.content ?? String(formData.get("content_markdown") ?? "").trim();
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
  const { supabase } = await requireEditor();
  const { data: book } = await supabase.from("books").select("slug").eq("id", bookId).maybeSingle<{ slug: string }>();
  if (!book) formError("/dashboard", "El libro ya no existe.");

  const { data, error } = await supabase
    .from("chapters")
    .insert({
      ...fields,
      book_id: bookId,
      published_at: fields.status === "published" ? new Date().toISOString() : null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    formError(errorPath, error?.code === "23505" ? `Ya existe el capítulo ${fields.number}.` : "No se pudo crear el capítulo.");
  }

  revalidatePath(`/dashboard/libros/${bookId}`);
  revalidatePath(`/libros/${book.slug}`);
  redirect(`/dashboard/libros/${bookId}/capitulos/${data.id}?saved=created`);
}

export async function updateChapterAction(bookId: string, chapterId: string, formData: FormData) {
  const errorPath = `/dashboard/libros/${bookId}/capitulos/${chapterId}`;
  const fields = await validateChapter(formData, errorPath);
  const { supabase } = await requireEditor();
  const [{ data: book }, { data: current }] = await Promise.all([
    supabase.from("books").select("slug").eq("id", bookId).maybeSingle<{ slug: string }>(),
    supabase.from("chapters").select("published_at, number").eq("id", chapterId).eq("book_id", bookId).maybeSingle<{ published_at: string | null; number: number }>(),
  ]);

  if (!book || !current) formError(`/dashboard/libros/${bookId}`, "El capítulo ya no existe.");

  const { error } = await supabase
    .from("chapters")
    .update({
      ...fields,
      published_at: fields.status === "published" ? current.published_at ?? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", chapterId)
    .eq("book_id", bookId);

  if (error) formError(errorPath, error.code === "23505" ? `Ya existe el capítulo ${fields.number}.` : "No se pudieron guardar los cambios.");

  revalidatePath(`/dashboard/libros/${bookId}`);
  revalidatePath(`/libros/${book.slug}`);
  revalidatePath(`/leer/${book.slug}/${current.number}`);
  revalidatePath(`/leer/${book.slug}/${fields.number}`);
  redirect(`${errorPath}?saved=updated`);
}

export async function bulkUpdateChaptersAction(bookId: string, formData: FormData) {
  const selectedIds = [...new Set(formData.getAll("chapter_ids").map((item) => String(item)))].filter((id) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id),
  );
  const action = value(formData, "bulk_action");
  const returnPath = `/dashboard/libros/${bookId}`;

  if (!selectedIds.length) formError(returnPath, "Selecciona al menos un capítulo.");
  if (!["publish", "draft", "delete"].includes(action)) formError(returnPath, "La acción seleccionada no es válida.");

  const { supabase } = await requireEditor();
  const [{ data: book }, { data: chapters, error: chaptersError }] = await Promise.all([
    supabase.from("books").select("slug").eq("id", bookId).maybeSingle<{ slug: string }>(),
    supabase.from("chapters").select("id, number").eq("book_id", bookId).in("id", selectedIds).returns<Array<{ id: string; number: number }>>(),
  ]);

  if (!book || chaptersError || !chapters?.length) formError(returnPath, "No se encontraron los capítulos seleccionados.");

  const verifiedIds = chapters.map((chapter) => chapter.id);
  const now = new Date().toISOString();
  const { error } = action === "delete"
    ? await supabase.from("chapters").delete().eq("book_id", bookId).in("id", verifiedIds)
    : await supabase
        .from("chapters")
        .update({
          status: action === "publish" ? "published" : "draft",
          published_at: action === "publish" ? now : null,
          updated_at: now,
        })
        .eq("book_id", bookId)
        .in("id", verifiedIds);

  if (error) formError(returnPath, "No se pudo aplicar la acción a los capítulos.");

  revalidatePath("/");
  revalidatePath("/biblioteca");
  revalidatePath(returnPath);
  revalidatePath(`/libros/${book.slug}`);
  for (const chapter of chapters) revalidatePath(`/leer/${book.slug}/${chapter.number}`);
  redirect(`${returnPath}?saved=${action}`);
}
