import "server-only";

import { cache } from "react";
import { books as fallbackBooks, getBook, type Book } from "@/lib/library";
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

function publicCoverUrl(path: string | null) {
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
  content_markdown: string;
  reading_minutes: number;
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

export const getPublishedBook = cache(async (slug: string): Promise<Book | undefined> => {
  const fallback = getBook(slug);

  try {
    const supabase = await createClient();
    if (!supabase) return fallback;

    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("id, slug, title, cover_path, subtitle, author_name, description, genres, work_status")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle<BookRow>();

    if (bookError || !book) return fallback;

    const { data: chapters, error: chaptersError } = await supabase
      .from("chapters")
      .select("number, title, content_markdown, reading_minutes")
      .eq("book_id", book.id)
      .eq("status", "published")
      .order("number", { ascending: false })
      .returns<ChapterRow[]>();

    if (chaptersError) return fallback;

    return mergePublishedBook(book, chapters ?? [], fallback);
  } catch {
    return fallback;
  }
});

export const getPublishedBooks = cache(async (): Promise<Book[]> => {
  try {
    const supabase = await createClient();
    if (!supabase) return fallbackBooks;

    const { data: publishedBooks, error: booksError } = await supabase
      .from("books")
      .select("id, slug, title, cover_path, subtitle, author_name, description, genres, work_status")
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .returns<BookRow[]>();

    if (booksError) return fallbackBooks;
    if (!publishedBooks?.length) return [];

    const bookIds = publishedBooks.map((book) => book.id);
    const { data: chapters, error: chaptersError } = await supabase
      .from("chapters")
      .select("book_id, number, title, content_markdown, reading_minutes")
      .in("book_id", bookIds)
      .eq("status", "published")
      .order("number", { ascending: false })
      .returns<Array<ChapterRow & { book_id: string }>>();

    if (chaptersError) return fallbackBooks;
    return publishedBooks.map((book) =>
      mergePublishedBook(book, (chapters ?? []).filter((chapter) => chapter.book_id === book.id), getBook(book.slug)),
    );
  } catch {
    return fallbackBooks;
  }
});

export const getLatestPublishedChapters = cache(async (limit = 50): Promise<LatestPublishedChapter[]> => {
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
  } catch {
    return fallbackBooks
      .flatMap((book) => book.chapters.map((chapter) => ({
        bookSlug: book.slug,
        bookTitle: book.title,
        number: chapter.number,
        roman: chapter.roman,
        title: chapter.title,
        readingMinutes: chapter.readingMinutes,
        publishedAt: null,
      })))
      .slice(0, safeLimit);
  }
});
