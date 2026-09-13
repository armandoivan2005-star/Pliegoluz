import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { books as fallbackBooks, getBook, type Book, type Chapter } from "@/lib/library";
import { createClient } from "@/lib/supabase/server";

type BookRow = {
  id: string;
  slug: string;
  title: string;
  cover_path: string | null;
  subtitle: string | null;
  author_name: string;
  description: string;
  genres: string[];
  work_status: "completed" | "publishing" | "paused" | "cancelled";
};

export function publicCoverUrl(path: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!baseUrl) return null;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/storage/v1/object/public/book-covers/${encodedPath}`;
}

type ChapterRow = {
  number: number;
  title: string;
  content_markdown?: string;
  reading_minutes: number;
};

export type PublishedReaderChapter = {
  book: Book;
  chapter: Chapter;
  chapterPosition: number;
  totalChapters: number;
  previousChapterNumber: number | null;
  nextChapterNumber: number | null;
};

export type LatestPublishedChapter = {
  bookSlug: string;
  bookTitle: string;
  number: number;
  roman: string;
  title: string;
  readingMinutes: number;
  publishedAt: string | null;
};

function toRoman(value: number) {
  const pairs: Array<[number, string]> = [
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let rest = value;
  let result = "";

  for (const [amount, numeral] of pairs) {
    while (rest >= amount) {
      result += numeral;
      rest -= amount;
    }
  }

  return result;
}

function mergePublishedBook(book: BookRow, chapters: ChapterRow[], fallback?: Book): Book {
  const statusLabels: Record<BookRow["work_status"], Book["status"]> = {
    completed: "Completo",
    publishing: "En publicación",
    paused: "En pausa",
    cancelled: "Cancelado",
  };

  return {
    slug: book.slug,
    title: book.title,
    coverUrl: publicCoverUrl(book.cover_path),
    subtitle: book.subtitle ?? "",
    author: book.author_name,
    status: statusLabels[book.work_status],
    description: book.description,
    genres: book.genres.length ? book.genres : fallback?.genres ?? ["Novela"],
    views: fallback?.views ?? "—",
    rating: fallback?.rating ?? "—",
    chapters: chapters.map((chapter) => ({
      number: chapter.number,
      roman: toRoman(chapter.number),
      title: chapter.title,
      publishedAt: "Edición canónica",
      readingMinutes: chapter.reading_minutes,
      contentMarkdown: chapter.content_markdown,
    })),
  };
}

function fallbackOrThrow<T>(fallback: T, message: string, caught?: unknown): T {
  if (process.env.NODE_ENV !== "production") {
    console.warn(message, caught instanceof Error ? caught.message : caught ?? "");
    return fallback;
  }

  console.error(message, caught instanceof Error ? { name: caught.name, message: caught.message } : caught);
  throw new Error(message);
}

const getPublishedBookFromDatabase = async (slug: string): Promise<Book | undefined> => {
  const fallback = getBook(slug);

  try {
    const supabase = await createClient();
    if (!supabase) return fallbackOrThrow(fallback, "Supabase no está configurado para la biblioteca pública.");

    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("id, slug, title, cover_path, subtitle, author_name, description, genres, work_status")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle<BookRow>();

    if (bookError) throw bookError;
    if (!book) return undefined;

    const { data: chapters, error: chaptersError } = await supabase
      .from("chapters")
      .select("number, title, reading_minutes")
      .eq("book_id", book.id)
      .eq("status", "published")
      .order("number", { ascending: false })
      .returns<ChapterRow[]>();

    if (chaptersError) throw chaptersError;

    return mergePublishedBook(book, chapters ?? [], fallback);
  } catch (caught) {
    return fallbackOrThrow(fallback, "No se pudo cargar el libro publicado.", caught);
  }
};

const getPublishedBooksFromDatabase = async (): Promise<Book[]> => {
  try {
    const supabase = await createClient();
    if (!supabase) return fallbackOrThrow(fallbackBooks, "Supabase no está configurado para la biblioteca pública.");

    const { data: publishedBooks, error: booksError } = await supabase
      .from("books")
      .select("id, slug, title, cover_path, subtitle, author_name, description, genres, work_status")
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .returns<BookRow[]>();

    if (booksError) throw booksError;
    if (!publishedBooks?.length) return [];

    const bookIds = publishedBooks.map((book) => book.id);
    const { data: chapters, error: chaptersError } = await supabase
      .from("chapters")
      .select("book_id, number, title, reading_minutes")
      .in("book_id", bookIds)
      .eq("status", "published")
      .order("number", { ascending: false })
      .returns<Array<ChapterRow & { book_id: string }>>();

    if (chaptersError) throw chaptersError;
    return publishedBooks.map((book) =>
      mergePublishedBook(book, (chapters ?? []).filter((chapter) => chapter.book_id === book.id), getBook(book.slug)),
    );
  } catch (caught) {
    return fallbackOrThrow(fallbackBooks, "No se pudo cargar la biblioteca pública.", caught);
  }
};

const getPublishedReaderChapterFromDatabase = async (
  slug: string,
  chapterNumber: number,
): Promise<PublishedReaderChapter | undefined> => {
  const book = await getPublishedBook(slug);
  if (!book) return undefined;

  const orderedChapters = [...book.chapters].sort((a, b) => a.number - b.number);
  const chapterPosition = orderedChapters.findIndex((chapter) => chapter.number === chapterNumber);
  if (chapterPosition === -1) return undefined;

  const chapterSummary = orderedChapters[chapterPosition];
  const previewResult: PublishedReaderChapter = {
    book,
    chapter: chapterSummary,
    chapterPosition: chapterPosition + 1,
    totalChapters: orderedChapters.length,
    previousChapterNumber: orderedChapters[chapterPosition - 1]?.number ?? null,
    nextChapterNumber: orderedChapters[chapterPosition + 1]?.number ?? null,
  };

  try {
    const supabase = await createClient();
    if (!supabase) {
      return fallbackOrThrow(previewResult, "Supabase no está configurado para cargar el capítulo.");
    }

    const { data: databaseBook, error: bookError } = await supabase
      .from("books")
      .select("id")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle<{ id: string }>();

    if (bookError) throw bookError;
    if (!databaseBook) return undefined;

    const { data: chapter, error: chapterError } = await supabase
      .from("chapters")
      .select("number, title, content_markdown, reading_minutes")
      .eq("book_id", databaseBook.id)
      .eq("number", chapterNumber)
      .eq("status", "published")
      .maybeSingle<Required<ChapterRow>>();

    if (chapterError) throw chapterError;
    if (!chapter) return undefined;

    return {
      ...previewResult,
      chapter: {
        ...chapterSummary,
        title: chapter.title,
        readingMinutes: chapter.reading_minutes,
        contentMarkdown: chapter.content_markdown,
      },
    };
  } catch (caught) {
    return fallbackOrThrow(previewResult, "No se pudo cargar el capítulo publicado.", caught);
  }
};

const getLatestPublishedChaptersFromDatabase = async (limit = 50): Promise<LatestPublishedChapter[]> => {
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  try {
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase no está configurado.");

    const { data: publishedBooks, error: booksError } = await supabase
      .from("books")
      .select("id, slug, title")
      .eq("status", "published")
      .returns<Array<{ id: string; slug: string; title: string }>>();

    if (booksError) throw booksError;
    if (!publishedBooks?.length) return [];

    const booksById = new Map(publishedBooks.map((book) => [book.id, book]));
    const { data: chapters, error: chaptersError } = await supabase
      .from("chapters")
      .select("book_id, number, title, reading_minutes, published_at, updated_at")
      .in("book_id", publishedBooks.map((book) => book.id))
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(safeLimit)
      .returns<Array<{ book_id: string; number: number; title: string; reading_minutes: number; published_at: string | null }>>();

    if (chaptersError) throw chaptersError;

    return (chapters ?? []).flatMap((chapter) => {
      const book = booksById.get(chapter.book_id);
      return book ? [{
        bookSlug: book.slug,
        bookTitle: book.title,
        number: chapter.number,
        roman: toRoman(chapter.number),
        title: chapter.title,
        readingMinutes: chapter.reading_minutes,
        publishedAt: chapter.published_at,
      }] : [];
    });
  } catch (caught) {
    return fallbackOrThrow(
      fallbackBooks
      .flatMap((book) => book.chapters.map((chapter) => ({
        bookSlug: book.slug,
        bookTitle: book.title,
        number: chapter.number,
        roman: chapter.roman,
        title: chapter.title,
        readingMinutes: chapter.readingMinutes,
        publishedAt: null,
      })))
      .slice(0, safeLimit),
      "No se pudieron cargar los capítulos recientes.",
      caught,
    );
  }
};

const publicCacheOptions = {
  revalidate: 60,
  tags: ["public-library"],
};

export const getPublishedBook = cache(
  unstable_cache(getPublishedBookFromDatabase, ["published-book"], publicCacheOptions),
);

export const getPublishedBooks = cache(
  unstable_cache(getPublishedBooksFromDatabase, ["published-books"], publicCacheOptions),
);

export const getPublishedReaderChapter = cache(
  unstable_cache(getPublishedReaderChapterFromDatabase, ["published-reader-chapter"], publicCacheOptions),
);

export const getLatestPublishedChapters = cache(
  unstable_cache(getLatestPublishedChaptersFromDatabase, ["latest-published-chapters"], publicCacheOptions),
);
