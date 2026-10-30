import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { repairImportedChapter } from "@/lib/chapter-import";
import { books as fallbackBooks, getBook, type Book, type Chapter } from "@/lib/library";
import { isDatabaseConfigured, oneOrNull, query } from "@/lib/postgres";

type BookRow = {
  id: string;
  slug: string;
  title: string;
  has_cover: boolean;
  subtitle: string | null;
  author_name: string;
  description: string;
  genres: string[];
  work_status: "completed" | "publishing" | "paused" | "cancelled";
};

type ChapterRow = {
  number: number;
  title: string;
  content_markdown?: string;
  reading_minutes: number;
};

export function publicCoverUrl(bookId: string, hasCover: boolean) {
  return hasCover ? `/api/book-covers/${encodeURIComponent(bookId)}` : null;
}

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
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
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
    coverUrl: publicCoverUrl(book.id, book.has_cover),
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

const bookColumns = `id, slug, title, (cover_data is not null) as has_cover,
  subtitle, author_name, description, genres, work_status`;

const getPublishedBookFromDatabase = async (slug: string): Promise<Book | undefined> => {
  const fallback = getBook(slug);
  try {
    if (!isDatabaseConfigured()) {
      return fallbackOrThrow(fallback, "PostgreSQL no está configurado para la biblioteca pública.");
    }
    const book = await oneOrNull<BookRow>(
      `select ${bookColumns} from public.books where slug = $1 and status = 'published'`,
      [slug],
    );
    if (!book) return undefined;

    const chapters = await query<ChapterRow>(
      `select number, title, reading_minutes
         from public.chapters
        where book_id = $1 and status = 'published'
        order by number desc`,
      [book.id],
    );
    return mergePublishedBook(book, chapters, fallback);
  } catch (caught) {
    return fallbackOrThrow(fallback, "No se pudo cargar el libro publicado.", caught);
  }
};

const getPublishedBooksFromDatabase = async (): Promise<Book[]> => {
  try {
    if (!isDatabaseConfigured()) {
      return fallbackOrThrow(fallbackBooks, "PostgreSQL no está configurado para la biblioteca pública.");
    }
    const publishedBooks = await query<BookRow>(
      `select ${bookColumns}
         from public.books
        where status = 'published'
        order by updated_at desc`,
    );
    if (!publishedBooks.length) return [];

    const chapters = await query<ChapterRow & { book_id: string }>(
      `select book_id, number, title, reading_minutes
         from public.chapters
        where book_id = any($1::uuid[]) and status = 'published'
        order by number desc`,
      [publishedBooks.map((book) => book.id)],
    );

    const chaptersByBook = new Map<string, Array<ChapterRow & { book_id: string }>>();
    for (const chapter of chapters) {
      const list = chaptersByBook.get(chapter.book_id) ?? [];
      list.push(chapter);
      chaptersByBook.set(chapter.book_id, list);
    }
    return publishedBooks.map((book) =>
      mergePublishedBook(book, chaptersByBook.get(book.id) ?? [], getBook(book.slug)),
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
  const chapterIndex = orderedChapters.findIndex((chapter) => chapter.number === chapterNumber);
  if (chapterIndex === -1) return undefined;

  const chapterSummary = orderedChapters[chapterIndex];
  const previewResult: PublishedReaderChapter = {
    book,
    chapter: chapterSummary,
    chapterPosition: chapterIndex + 1,
    totalChapters: orderedChapters.length,
    previousChapterNumber: orderedChapters[chapterIndex - 1]?.number ?? null,
    nextChapterNumber: orderedChapters[chapterIndex + 1]?.number ?? null,
  };

  try {
    if (!isDatabaseConfigured()) {
      return fallbackOrThrow(previewResult, "PostgreSQL no está configurado para cargar el capítulo.");
    }
    const chapter = await oneOrNull<Required<ChapterRow>>(
      `select c.number, c.title, c.content_markdown, c.reading_minutes
         from public.chapters c
         join public.books b on b.id = c.book_id
        where b.slug = $1 and b.status = 'published'
          and c.number = $2 and c.status = 'published'`,
      [slug, chapterNumber],
    );
    if (!chapter) return undefined;

    const repaired = repairImportedChapter({
      number: chapter.number,
      title: chapter.title,
      content: chapter.content_markdown,
    });
    return {
      ...previewResult,
      chapter: {
        ...chapterSummary,
        title: repaired.title,
        readingMinutes: chapter.reading_minutes,
        contentMarkdown: repaired.content,
      },
    };
  } catch (caught) {
    return fallbackOrThrow(previewResult, "No se pudo cargar el capítulo publicado.", caught);
  }
};

const getLatestPublishedChaptersFromDatabase = async (limit = 50): Promise<LatestPublishedChapter[]> => {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  try {
    if (!isDatabaseConfigured()) throw new Error("PostgreSQL no está configurado.");
    const chapters = await query<{
      book_slug: string;
      book_title: string;
      number: number;
      title: string;
      reading_minutes: number;
      published_at: string | null;
    }>(
      `select b.slug as book_slug, b.title as book_title, c.number, c.title,
              c.reading_minutes, c.published_at::text
         from public.chapters c
         join public.books b on b.id = c.book_id and b.status = 'published'
        where c.status = 'published'
        order by c.published_at desc nulls last, c.updated_at desc
        limit $1`,
      [safeLimit],
    );
    return chapters.map((chapter) => ({
      bookSlug: chapter.book_slug,
      bookTitle: chapter.book_title,
      number: chapter.number,
      roman: toRoman(chapter.number),
      title: chapter.title,
      readingMinutes: chapter.reading_minutes,
      publishedAt: chapter.published_at,
    }));
  } catch (caught) {
    return fallbackOrThrow(
      fallbackBooks.flatMap((book) => book.chapters.map((chapter) => ({
        bookSlug: book.slug,
        bookTitle: book.title,
        number: chapter.number,
        roman: chapter.roman,
        title: chapter.title,
        readingMinutes: chapter.readingMinutes,
        publishedAt: null,
      }))).slice(0, safeLimit),
      "No se pudieron cargar los capítulos recientes.",
      caught,
    );
  }
};

const publicCacheOptions = { revalidate: 60, tags: ["public-library"] };

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
