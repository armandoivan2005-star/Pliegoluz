import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReaderShell } from "@/components/reader-shell";
import { getCurrentUserIdentity } from "@/lib/editor-auth";
import { getChapter, getChapterParagraphs } from "@/lib/library";
import { getPublishedBook } from "@/lib/public-library";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/leer/[slug]/[chapter]">): Promise<Metadata> {
  const { slug, chapter: rawChapter } = await params;
  const book = await getPublishedBook(slug);
  const chapter = book ? getChapter(book, Number(rawChapter)) : undefined;
  if (!book || !chapter) return {};
  return { title: `${chapter.title} — ${book.title}` };
}

export default async function ReaderPage({ params }: PageProps<"/leer/[slug]/[chapter]">) {
  const { slug, chapter: rawChapter } = await params;
  const [book, identity] = await Promise.all([getPublishedBook(slug), getCurrentUserIdentity()]);
  const chapterNumber = Number(rawChapter);
  const chapter = book ? getChapter(book, chapterNumber) : undefined;
  if (!book || !chapter || !Number.isInteger(chapterNumber)) notFound();

  return <ReaderShell bookSlug={book.slug} bookTitle={book.title} chapterNumber={chapter.number} chapterRoman={chapter.roman} chapterTitle={chapter.title} paragraphs={getChapterParagraphs(chapter)} totalChapters={book.chapters.length} isPreview={!chapter.contentMarkdown?.trim()} canSyncProgress={Boolean(identity)} />;
}
