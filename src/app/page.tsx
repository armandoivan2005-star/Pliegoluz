import { HomeBookCarousel, type HomeCarouselBook } from "@/components/home-book-carousel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublishedBooks } from "@/lib/public-library";

export const dynamic = "force-dynamic";

export default async function Home() {
  const publishedBooks = await getPublishedBooks();
  const carouselBooks: HomeCarouselBook[] = publishedBooks.map((book) => ({
    slug: book.slug,
    title: book.title,
    author: book.author,
    coverUrl: book.coverUrl ?? null,
    chapterCount: book.chapters.length,
  }));

  return (
    <div className="site-theme min-h-screen bg-[#0b0e0d] text-[#f5efe3]">
      <SiteHeader />
      <main>
        <section className="hero-texture relative isolate overflow-hidden border-b border-white/8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_30%,rgba(132,34,38,.3),transparent_33%),radial-gradient(circle_at_15%_80%,rgba(170,137,72,.1),transparent_35%)]" />
          {carouselBooks.length ? (
            <HomeBookCarousel books={carouselBooks} />
          ) : (
            <div className="relative mx-auto grid min-h-[680px] max-w-7xl place-items-center px-5 py-20 text-center sm:px-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.28em] text-[#aa8c57]">Biblioteca digital</p>
                <h1 className="mt-5 font-serif text-5xl sm:text-7xl">Próximamente nuevas historias</h1>
                <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#aaa79e]">Las obras aparecerán aquí cuando estén publicadas y tengan capítulos disponibles.</p>
              </div>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
