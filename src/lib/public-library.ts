import "server-only";

import { cache } from "react";
import { getBook, type Book } from "@/lib/library";
import { createClient } from "@/lib/supabase/server";

type BookRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  author_name: string;
  description: string;
  genres: string[];
};

type ChapterRow = {
  number: number;
  title: string;
  content_markdown: string;
  reading_minutes: number;
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
  return {
    slug: book.slug,
    title: book.title,
    subtitle: book.subtitle ?? "",
    author: book.author_name,
    status: "Completo",
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
      .select("id, slug, title, subtitle, author_name, description, genres")
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

    if (chaptersError || !chapters?.length) return fallback;

    return mergePublishedBook(book, chapters, fallback);
  } catch {
    return fallback;
  }
});
