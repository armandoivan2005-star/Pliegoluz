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

type EditorBookSummaryRow = Omit<EditorBookSummary, "chapters"> & { chapter_count: number };

function repairEditorChapter(chapter: EditorChapter): EditorChapter {
  const repaired = repairImportedChapter({
    number: chapter.number,
    title: chapter.title,
    content: chapter.content_markdown,
  });
  return { ...chapter, title: repaired.title, content_markdown: repaired.content };
}

export async function getEditorBooks() {
  const { db, identity } = await requireAuthor();
  const values: unknown[] = [];
  const ownership = identity.role === "author" ? "where b.author_profile_id = $1" : "";
  if (identity.role === "author") values.push(identity.id);

  const { rows } = await db.query<EditorBookSummaryRow>(
    `select b.id, b.slug, b.title, b.subtitle, b.author_name, b.status,
            b.updated_at::text,
            count(c.id)::integer as chapter_count
       from public.books b
       left join public.chapters c on c.book_id = b.id
       ${ownership}
      group by b.id
      order by b.updated_at desc`,
    values,
  );

  return rows.map((book) => ({
    id: book.id,
    slug: book.slug,
    title: book.title,
    subtitle: book.subtitle,
    author_name: book.author_name,
    status: book.status,
    updated_at: book.updated_at,
    chapters: [{ count: book.chapter_count }],
  }));
}

export async function getEditorBook(bookId: string) {
  const { db } = await requireBookManager(bookId);
  const [bookResult, chaptersResult] = await Promise.all([
    db.query<EditorBook>(
      `select id, slug, title, subtitle, author_name, description, genres,
              case when cover_data is null then null else 'postgres' end as cover_path,
              status, work_status, published_at::text, updated_at::text
         from public.books where id = $1`,
      [bookId],
    ),
    db.query<EditorChapter>(
      `select id, number, title, content_markdown, status, reading_minutes, updated_at::text
         from public.chapters
        where book_id = $1
        order by number asc`,
      [bookId],
    ),
  ]);

  return {
    book: bookResult.rows[0] ?? null,
    chapters: chaptersResult.rows.map(repairEditorChapter),
  };
}

export async function getEditorChapter(bookId: string, chapterId: string) {
  const { db } = await requireBookManager(bookId);
  const { rows } = await db.query<EditorChapter>(
    `select id, number, title, content_markdown, status, reading_minutes, updated_at::text
       from public.chapters
      where id = $1 and book_id = $2`,
    [chapterId, bookId],
  );
  return rows[0] ? repairEditorChapter(rows[0]) : null;
}
