import type { Metadata } from "next";
import Link from "next/link";
import { BookCover } from "@/components/book-cover";
import { ArrowRightIcon, BookOpenIcon } from "@/components/icons";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublishedBooks } from "@/lib/public-library";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Biblioteca",
  description: "Explora las obras publicadas en Pliegoluz.",
};

export default async function LibraryPage({ searchParams }: PageProps<"/biblioteca">) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = rawQuery?.trim() ?? "";
  const normalizedQuery = query.toLocaleLowerCase("es-MX");
  const publishedBooks = await getPublishedBooks();
  const books = normalizedQuery
    ? publishedBooks.filter((book) => book.title.toLocaleLowerCase("es-MX").includes(normalizedQuery))
    : publishedBooks;

  return (
    <div className="site-theme min-h-screen bg-[#0b0e0d] text-[#f5efe3]">
      <SiteHeader />
      <main>
        <section className="hero-texture border-b border-white/8">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
            <p className="text-xs font-semibold uppercase tracking-[.28em] text-[#aa8c57]">Catálogo editorial</p>
            <h1 className="mt-4 font-serif text-5xl sm:text-6xl">Biblioteca</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#97948c]">Explora todas las obras publicadas. Abre una portada para consultar su sinopsis, estado y capítulos disponibles.</p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          {query && <div className="mb-9 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[#97948c]">Resultados para <span className="text-[#eee8dc]">“{query}”</span>: {books.length}</p><Link href="/biblioteca" className="text-xs font-semibold text-[#c6a86d] hover:text-white">Limpiar búsqueda</Link></div>}
          {books.length ? (
            <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 sm:gap-x-8 lg:grid-cols-4 xl:grid-cols-5">
              {books.map((book) => (
                <Link key={book.slug} href={`/libros/${book.slug}`} className="group min-w-0">
                  <BookCover title={book.title} coverUrl={book.coverUrl} chapterCount={book.chapters.length} className="w-full transition duration-300 group-hover:-translate-y-2 group-hover:shadow-[0_35px_80px_rgba(0,0,0,.55)]" />
                  <div className="mt-5">
                    <h2 className="truncate font-serif text-xl text-[#eee8dc]">{book.title}</h2>
                    <p className="mt-1 truncate text-sm text-[#817f78]">{book.author}</p>
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-[#9d998f]"><span>{book.status} · {book.chapters.length} capítulos</span><ArrowRightIcon className="size-4 shrink-0 text-[#c6a86d] transition group-hover:translate-x-1" /></div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="grid min-h-80 place-items-center rounded-2xl border border-white/8 bg-white/[.02] p-8 text-center">
              <div><BookOpenIcon className="mx-auto size-9 text-[#aa8c57]" /><h2 className="mt-5 font-serif text-2xl">{query ? "No encontramos ese título" : "Todavía no hay libros publicados"}</h2><p className="mt-2 text-sm text-[#817f78]">{query ? "Prueba con otra parte del nombre del libro." : "Las obras aparecerán aquí al cambiar su visibilidad a Publicado."}</p></div>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
