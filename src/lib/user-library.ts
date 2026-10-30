import "server-only";

import { cache } from "react";
import { getCurrentUserIdentity, requireUser } from "@/lib/editor-auth";
import { oneOrNull, query } from "@/lib/postgres";
import { publicCoverUrl } from "@/lib/public-library";

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

type FavoriteBookRow = {
  id: string;
  slug: string;
  title: string;
  author_name: string;
  has_cover: boolean;
  chapter_count: number;
};

export const getProfileLibrary = cache(async () => {
  const { identity, db } = await requireUser();
  const { rows } = await db.query<FavoriteBookRow>(
    `select b.id, b.slug, b.title, b.author_name,
            (b.cover_data is not null) as has_cover,
            count(c.id)::integer as chapter_count
       from public.book_favorites f
       join public.books b on b.id = f.book_id and b.status = 'published'
       left join public.chapters c on c.book_id = b.id and c.status = 'published'
      where f.profile_id = $1
      group by b.id, f.created_at
      order by f.created_at desc`,
    [identity.id],
  );

  return {
    identity,
    books: rows.map((book) => ({
      id: book.id,
      slug: book.slug,
      title: book.title,
      author: book.author_name,
      coverUrl: publicCoverUrl(book.id, book.has_cover),
      chapters: book.chapter_count,
    })) satisfies FavoriteBook[],
  };
});

export const getBookInteraction = cache(async (slug: string) => {
  const identity = await getCurrentUserIdentity();
  if (!identity) return { identity: null, bookId: null, favorite: false, rating: null };

  const book = await oneOrNull<{ id: string }>(
    `select id from public.books where slug = $1 and status = 'published'`,
    [slug],
  );
  if (!book) return { identity, bookId: null, favorite: false, rating: null };

  const [rating, favorite] = await Promise.all([
    oneOrNull<{ rating: number }>(
      `select rating from public.book_ratings where profile_id = $1 and book_id = $2`,
      [identity.id, book.id],
    ),
    oneOrNull<{ book_id: string }>(
      `select book_id from public.book_favorites where profile_id = $1 and book_id = $2`,
      [identity.id, book.id],
    ),
  ]);

  return {
    identity,
    bookId: book.id,
    favorite: Boolean(favorite),
    rating: rating?.rating ?? null,
  };
});

export const getReadingPosition = cache(async (slug: string): Promise<ReadingPosition | null> => {
  const identity = await getCurrentUserIdentity();
  if (!identity) return null;

  const rows = await query<{
    chapter_number: number;
    paragraph_index: number;
    paragraph_offset: string | number;
  }>(
    `select c.number as chapter_number, rp.paragraph_index, rp.paragraph_offset
       from public.reading_progress rp
       join public.books b on b.id = rp.book_id and b.status = 'published'
       join public.chapters c on c.id = rp.chapter_id
                             and c.book_id = b.id
                             and c.status = 'published'
      where rp.profile_id = $1 and b.slug = $2`,
    [identity.id, slug],
  );
  const progress = rows[0];
  if (!progress) return null;

  return {
    chapterNumber: progress.chapter_number,
    paragraphIndex: Math.max(0, progress.paragraph_index),
    paragraphOffset: Math.min(1, Math.max(0, Number(progress.paragraph_offset))),
  };
});
