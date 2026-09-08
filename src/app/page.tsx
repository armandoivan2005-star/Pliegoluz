import { HomeBookCarousel, type HomeCarouselBook } from "@/components/home-book-carousel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { featuredBook as fallbackBook } from "@/lib/library";
import { getPublishedBooks } from "@/lib/public-library";

export const dynamic = "force-dynamic";

export default async function Home() {
  const publishedBooks = await getPublishedBooks();
  const availableBooks = publishedBooks.length ? publishedBooks : [fallbackBook];
  const carouselBooks: HomeCarouselBook[] = availableBooks.map((book) => ({
    slug: book.slug,
    title: book.title,
    author: book.author,
    coverUrl: book.coverUrl ?? null,
    chapterCount: book.chapters.length,
  }));

  return (
    <div className="min-h-screen bg-[#0b0e0d] text-[#f5efe3]">
      <SiteHeader />
      <main>
        <section className="hero-texture relative isolate overflow-hidden border-b border-white/8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_30%,rgba(132,34,38,.3),transparent_33%),radial-gradient(circle_at_15%_80%,rgba(170,137,72,.1),transparent_35%)]" />
          <HomeBookCarousel books={carouselBooks} />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
