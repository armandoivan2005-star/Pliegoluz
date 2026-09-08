import "server-only";

import { cache } from "react";
import { getCurrentUserIdentity, requireUser } from "@/lib/editor-auth";
import { publicCoverUrl } from "@/lib/public-library";
import { createAdminClient } from "@/lib/supabase/admin";

export type FavoriteBook = {
  id: string;
  slug: string;
  title: string;
  author: string;
  coverUrl: string | null;
  chapters: number;
};

export type ReadingPosition = {
  chapterNumber: number;
  paragraphIndex: number;
  paragraphOffset: number;
};

export const getProfileLibrary = cache(async () => {
  const { identity, supabase } = await requireUser();
  const { data: favorites } = await supabase
    .from("book_favorites")
    .select("book_id, created_at")
    .eq("profile_id", identity.id)
    .order("created_at", { ascending: false })
    .returns<Array<{ book_id: string; created_at: string }>>();

  const favoriteIds = (favorites ?? []).map((favorite) => favorite.book_id);
  if (!favoriteIds.length) return { identity, books: [] as FavoriteBook[] };

  const { data: books } = await supabase
    .from("books")
    .select("id, slug, title, author_name, cover_path, chapters(count)")
    .in("id", favoriteIds)
    .eq("status", "published")
    .eq("chapters.status", "published")
    .returns<Array<{ id: string; slug: string; title: string; author_name: string; cover_path: string | null; chapters: Array<{ count: number }> }>>();

  const order = new Map(favoriteIds.map((id, index) => [id, index]));
  const mapped = (books ?? []).map((book) => ({
    id: book.id,
    slug: book.slug,
    title: book.title,
    author: book.author_name,
    coverUrl: publicCoverUrl(book.cover_path),
    chapters: book.chapters[0]?.count ?? 0,
  })).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return { identity, books: mapped };
});

export const getBookInteraction = cache(async (slug: string) => {
  const identity = await getCurrentUserIdentity();
  const supabase = createAdminClient();
  if (!supabase) return { identity, bookId: null, favorite: false, rating: null, average: null, ratingCount: 0 };

  const { data: book } = await supabase
    .from("books")
    .select("id")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle<{ id: string }>();
  if (!book) return { identity, bookId: null, favorite: false, rating: null, average: null, ratingCount: 0 };

  const { data: ratings } = await supabase
    .from("book_ratings")
    .select("profile_id, rating")
    .eq("book_id", book.id)
    .returns<Array<{ profile_id: string; rating: number }>>();
  const values = ratings ?? [];
  const ownRating = identity ? values.find((item) => item.profile_id === identity.id)?.rating ?? null : null;
  let favorite = false;
  if (identity) {
    const { data } = await supabase
      .from("book_favorites")
      .select("book_id")
      .eq("profile_id", identity.id)
      .eq("book_id", book.id)
      .maybeSingle();
    favorite = Boolean(data);
  }

  return {
    identity,
    bookId: book.id,
    favorite,
    rating: ownRating,
    average: values.length ? values.reduce((sum, item) => sum + item.rating, 0) / values.length : null,
    ratingCount: values.length,
  };
});

export const getReadingPosition = cache(async (slug: string): Promise<ReadingPosition | null> => {
  const identity = await getCurrentUserIdentity();
  const supabase = createAdminClient();
  if (!identity || !supabase) return null;

  const { data: book } = await supabase
    .from("books")
    .select("id")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle<{ id: string }>();
  if (!book) return null;

  const { data: progress, error } = await supabase
    .from("reading_progress")
    .select("chapter_id, paragraph_index, paragraph_offset")
    .eq("profile_id", identity.id)
    .eq("book_id", book.id)
    .maybeSingle<{ chapter_id: string; paragraph_index: number; paragraph_offset: number | string }>();
  if (error || !progress) return null;

  const { data: chapter } = await supabase
    .from("chapters")
    .select("number")
    .eq("id", progress.chapter_id)
    .eq("book_id", book.id)
    .eq("status", "published")
    .maybeSingle<{ number: number }>();
  if (!chapter) return null;

  return {
    chapterNumber: chapter.number,
    paragraphIndex: Math.max(0, progress.paragraph_index),
    paragraphOffset: Math.min(1, Math.max(0, Number(progress.paragraph_offset))),
  };
});
