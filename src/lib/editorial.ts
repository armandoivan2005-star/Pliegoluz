import "server-only";

import { repairImportedChapter } from "@/lib/chapter-import";
import { requireAuthor, requireBookManager } from "@/lib/editor-auth";

export type PublicationStatus = "draft" | "published" | "archived";
export type WorkStatus = "completed" | "publishing" | "paused" | "cancelled";

export type EditorBookSummary = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  author_name: string;
  status: PublicationStatus;
  updated_at: string;
  chapters: Array<{ count: number }>;
};

export type EditorChapter = {
  id: string;
  number: number;
  title: string;
  content_markdown: string;
  status: PublicationStatus;
  reading_minutes: number;
  updated_at: string;
};

export type EditorBook = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  author_name: string;
  description: string;
  genres: string[];
  cover_path: string | null;
  status: PublicationStatus;
  work_status: WorkStatus;
  published_at: string | null;
  updated_at: string;
};

function repairEditorChapter(chapter: EditorChapter): EditorChapter {
  const repaired = repairImportedChapter({
    number: chapter.number,
    title: chapter.title,
    content: chapter.content_markdown,
  });

  return {
    ...chapter,
    title: repaired.title,
    content_markdown: repaired.content,
  };
}

export async function getEditorBooks() {
  const { supabase, identity } = await requireAuthor();
  let query = supabase
    .from("books")
    .select("id, slug, title, subtitle, author_name, status, updated_at, chapters(count)")
    .order("updated_at", { ascending: false });
  if (identity.role === "author") query = query.eq("author_profile_id", identity.id);
  const { data, error } = await query.returns<EditorBookSummary[]>();

  if (error) throw new Error("No se pudieron cargar los libros. Ejecuta las migraciones de Supabase pendientes.");
  return data ?? [];
}

export async function getEditorBook(bookId: string) {
  const { supabase } = await requireBookManager(bookId);
  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("id, slug, title, subtitle, author_name, description, genres, cover_path, status, work_status, published_at, updated_at")
    .eq("id", bookId)
    .maybeSingle<EditorBook>();
  const { data: chapters, error: chaptersError } = await supabase
    .from("chapters")
    .select("id, number, title, content_markdown, status, reading_minutes, updated_at")
    .eq("book_id", bookId)
    .order("number", { ascending: true })
    .returns<EditorChapter[]>();

  if (bookError || chaptersError) throw new Error("No se pudo cargar la obra editorial.");
  return { book, chapters: (chapters ?? []).map(repairEditorChapter) };
}

export async function getEditorChapter(bookId: string, chapterId: string) {
  const { supabase } = await requireBookManager(bookId);
  const { data, error } = await supabase
    .from("chapters")
    .select("id, number, title, content_markdown, status, reading_minutes, updated_at")
    .eq("id", chapterId)
    .eq("book_id", bookId)
    .maybeSingle<EditorChapter>();

  if (error) throw new Error("No se pudo cargar el capítulo.");
  return data ? repairEditorChapter(data) : null;
}
