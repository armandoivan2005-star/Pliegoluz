import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReaderShell } from "@/components/reader-shell";
import { getCurrentUserIdentity } from "@/lib/editor-auth";
import { getChapterParagraphs } from "@/lib/library";
import { getPublishedReaderChapter } from "@/lib/public-library";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/leer/[slug]/[chapter]">): Promise<Metadata> {
  const { slug, chapter: rawChapter } = await params;
  const readerChapter = await getPublishedReaderChapter(slug, Number(rawChapter));
  if (!readerChapter) return {};
  return { title: `${readerChapter.chapter.title} — ${readerChapter.book.title}` };
}

export default async function ReaderPage({ params }: PageProps<"/leer/[slug]/[chapter]">) {
  const { slug, chapter: rawChapter } = await params;
  const chapterNumber = Number(rawChapter);
  if (!Number.isInteger(chapterNumber)) notFound();

  const [readerChapter, identity] = await Promise.all([
    getPublishedReaderChapter(slug, chapterNumber),
    getCurrentUserIdentity(),
  ]);
  if (!readerChapter) notFound();

  const { book, chapter } = readerChapter;

  return <ReaderShell bookSlug={book.slug} bookTitle={book.title} chapterNumber={chapter.number} chapterPosition={readerChapter.chapterPosition} chapterRoman={chapter.roman} chapterTitle={chapter.title} paragraphs={getChapterParagraphs(chapter)} totalChapters={readerChapter.totalChapters} previousChapterNumber={readerChapter.previousChapterNumber} nextChapterNumber={readerChapter.nextChapterNumber} isPreview={!chapter.contentMarkdown?.trim()} canSyncProgress={Boolean(identity)} />;
}
