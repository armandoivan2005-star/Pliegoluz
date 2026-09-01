"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireEditor } from "@/lib/editor-auth";
import type { PublicationStatus } from "@/lib/editorial";

const publicationStatuses: PublicationStatus[] = ["draft", "published", "archived"];

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function statusValue(formData: FormData): PublicationStatus {
  const status = value(formData, "status") as PublicationStatus;
  return publicationStatuses.includes(status) ? status : "draft";
}

function genresValue(formData: FormData) {
  return [...new Set(value(formData, "genres").split(",").map((genre) => genre.trim()).filter(Boolean))];
}

function readingMinutes(content: string) {
  const words = content.split(/\s+/u).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function formError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function validateBook(formData: FormData, errorPath: string) {
  const title = value(formData, "title");
  const slug = value(formData, "slug").toLowerCase();
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
  };
}

export async function createBookAction(formData: FormData) {
  const errorPath = "/dashboard/libros/nuevo";
  const fields = validateBook(formData, errorPath);
  const { supabase } = await requireEditor();
  const { data, error } = await supabase
    .from("books")
    .insert({
      ...fields,
      published_at: fields.status === "published" ? new Date().toISOString() : null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    formError(errorPath, error?.code === "23505" ? "Ya existe un libro con ese slug." : "No se pudo crear el libro.");
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/libros/${data.id}?saved=created`);
}

export async function updateBookAction(bookId: string, formData: FormData) {
  const errorPath = `/dashboard/libros/${bookId}`;
  const fields = validateBook(formData, errorPath);
  const { supabase } = await requireEditor();
  const { data: current } = await supabase
    .from("books")
    .select("slug, published_at")
    .eq("id", bookId)
    .maybeSingle<{ slug: string; published_at: string | null }>();

  if (!current) formError("/dashboard", "El libro ya no existe.");

  const { error } = await supabase
    .from("books")
    .update({
      ...fields,
      published_at: fields.status === "published" ? current.published_at ?? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookId);

  if (error) formError(errorPath, error.code === "23505" ? "Ya existe otro libro con ese slug." : "No se pudieron guardar los cambios.");

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath(errorPath);
  revalidatePath(`/libros/${current.slug}`);
  revalidatePath(`/libros/${fields.slug}`);
  redirect(`${errorPath}?saved=updated`);
}

function validateChapter(formData: FormData, errorPath: string) {
  const number = Number(value(formData, "number"));
  const title = value(formData, "title");
  const content = String(formData.get("content_markdown") ?? "").trim();
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
  const fields = validateChapter(formData, errorPath);
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
  const fields = validateChapter(formData, errorPath);
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
