import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookCover } from "@/components/book-cover";
import { BookInteractions } from "@/components/book-interactions";
import { ArrowRightIcon, BookOpenIcon, ClockIcon } from "@/components/icons";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublishedBook } from "@/lib/public-library";
import { getReadingPosition } from "@/lib/user-library";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/libros/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const book = await getPublishedBook(slug);
  if (!book) return {};
  return { title: `${book.title} | Pliegoluz`, description: book.description };
}

export default async function BookPage({ params, searchParams }: PageProps<"/libros/[slug]">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [book, readingPosition] = await Promise.all([getPublishedBook(slug), getReadingPosition(slug)]);
  if (!book) notFound();
  const chapterOrder = query.orden === "desc" ? "desc" : "asc";
  const orderedChapters = [...book.chapters].sort((a, b) =>
    chapterOrder === "asc" ? a.number - b.number : b.number - a.number,
  );

  return (
    <div className="min-h-screen bg-[#0b0e0d] text-[#f5efe3]">
      <SiteHeader />
      <main>
        <section className="hero-texture border-b border-white/8">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-[260px_1fr] md:py-20 lg:gap-16">
            <BookCover title={book.title} coverUrl={book.coverUrl} chapterCount={book.chapters.length} className="mx-auto w-full max-w-[250px]" />
            <div className="self-center">
              <div className="mb-5 flex flex-wrap gap-2">
                {book.genres.map((genre) => <span key={genre} className="rounded-full border border-[#c6a86d]/25 px-3 py-1 text-[10px] uppercase tracking-[.18em] text-[#c6a86d]">{genre}</span>)}
              </div>
              <h1 className="font-serif text-5xl leading-none sm:text-6xl">{book.title}</h1>
              <p className="mt-4 text-sm uppercase tracking-[.18em] text-[#827f78]">{book.subtitle}</p>
              <p className="mt-7 max-w-2xl text-base leading-7 text-[#aaa79f] sm:text-lg sm:leading-8">{book.description}</p>
              <div className="mt-7 flex flex-wrap gap-x-7 gap-y-3 text-sm text-[#89867e]">
                <span>{book.author}</span><span>{book.status}</span><span>{book.chapters.length} capítulos</span>
              </div>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href={`/leer/${book.slug}/1`} className="group inline-flex h-13 items-center justify-center gap-3 rounded-full bg-[#e8ddc6] px-6 text-sm font-semibold text-[#171816] transition hover:bg-white"><BookOpenIcon className="size-4" />Leer desde el inicio<ArrowRightIcon className="size-4 transition group-hover:translate-x-1" /></Link>
                {readingPosition && (
                  <Link href={`/leer/${book.slug}/${readingPosition.chapterNumber}?pos=${readingPosition.paragraphIndex}&offset=${readingPosition.paragraphOffset.toFixed(5)}`} className="group inline-flex h-13 items-center justify-center gap-3 rounded-full border border-[#c6a86d]/45 px-6 text-sm font-semibold text-[#dfc88f] transition hover:border-[#c6a86d] hover:bg-[#c6a86d]/8">
                    Continuar donde te quedaste<ArrowRightIcon className="size-4 transition group-hover:translate-x-1" />
                  </Link>
                )}
              </div>
              <BookInteractions slug={book.slug} />
            </div>
          </div>
        </section>

        <section id="capitulos" className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="mb-9 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="mb-3 text-xs font-semibold uppercase tracking-[.25em] text-[#aa8c57]">Índice canónico</p><h2 className="font-serif text-3xl sm:text-4xl">Capítulos</h2></div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="mr-1 text-sm text-[#77746d]">{book.chapters.length} en total</span>
              <div className="flex rounded-full border border-white/10 bg-white/[.02] p-1 text-xs">
                <Link href={`/libros/${book.slug}?orden=asc#capitulos`} aria-current={chapterOrder === "asc" ? "true" : undefined} className={`rounded-full px-3 py-2 transition ${chapterOrder === "asc" ? "bg-[#c6a86d] text-[#171816]" : "text-[#8f8c84] hover:text-white"}`}>Primero al último</Link>
                <Link href={`/libros/${book.slug}?orden=desc#capitulos`} aria-current={chapterOrder === "desc" ? "true" : undefined} className={`rounded-full px-3 py-2 transition ${chapterOrder === "desc" ? "bg-[#c6a86d] text-[#171816]" : "text-[#8f8c84] hover:text-white"}`}>Último al primero</Link>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {orderedChapters.map((chapter) => (
              <Link key={chapter.number} href={`/leer/${book.slug}/${chapter.number}`} className="group flex items-center gap-4 rounded-xl border border-white/8 bg-white/[.018] p-4 transition hover:border-[#b99a61]/35 hover:bg-white/[.035]">
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#171a18] font-serif text-sm text-[#c6a86d]">{chapter.roman}</span>
                <div className="min-w-0"><h3 className="truncate text-sm font-medium text-[#e7e1d6]">{chapter.title}</h3><p className="mt-1 flex items-center gap-1.5 text-xs text-[#77746d]"><ClockIcon className="size-3" />{chapter.readingMinutes} min · {chapter.publishedAt}</p></div>
                <ArrowRightIcon className="ml-auto size-4 shrink-0 text-[#6f6d67] transition group-hover:translate-x-1 group-hover:text-[#c6a86d]" />
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
