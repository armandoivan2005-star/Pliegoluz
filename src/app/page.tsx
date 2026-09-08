import Link from "next/link";
import { BookCover } from "@/components/book-cover";
import { ArrowRightIcon, BookOpenIcon, SparkleIcon, StarIcon } from "@/components/icons";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { featuredBook as fallbackBook } from "@/lib/library";
import { getPublishedBook } from "@/lib/public-library";

export const dynamic = "force-dynamic";

export default async function Home() {
  const featuredBook = (await getPublishedBook("casa-reykov")) ?? fallbackBook;
  return (
    <div className="min-h-screen bg-[#0b0e0d] text-[#f5efe3]">
      <SiteHeader />
      <main>
        <section className="hero-texture relative isolate overflow-hidden border-b border-white/8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_30%,rgba(132,34,38,.3),transparent_33%),radial-gradient(circle_at_15%_80%,rgba(170,137,72,.1),transparent_35%)]" />
          <div className="relative mx-auto grid min-h-[680px] max-w-7xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[1.15fr_.85fr] lg:py-24">
            <div className="max-w-2xl">
              <div className="mb-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-[#d6b978]">
                <span className="h-px w-10 bg-[#d6b978]/60" /><SparkleIcon className="size-4" />Selección destacada
              </div>
              <h1 className="text-balance font-serif text-5xl leading-[.98] tracking-[-.035em] sm:text-7xl lg:text-[92px]">
                Historias para leer<span className="block italic text-[#c6a86d]">sin prisa.</span>
              </h1>
              <p className="mt-7 max-w-xl text-pretty text-base leading-7 text-[#aaa79e] sm:text-lg sm:leading-8">
                Una biblioteca digital construida alrededor del texto: capítulos ordenados, progreso automático y una experiencia serena en cualquier pantalla.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/leer/casa-reykov/1" className="group inline-flex h-13 items-center justify-center gap-3 rounded-full bg-[#e8ddc6] px-6 text-sm font-semibold text-[#171816] transition hover:bg-white">
                  <BookOpenIcon className="size-4" />Comenzar a leer<ArrowRightIcon className="size-4 transition group-hover:translate-x-1" />
                </Link>
                <Link href="/libros/casa-reykov" className="inline-flex h-13 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-medium text-[#e7e0d4] transition hover:border-[#c6a86d]/60 hover:bg-white/4">Ver detalles</Link>
              </div>
              <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-sm text-[#817f78]">
                <span>{featuredBook.chapters.length} capítulos</span>
                <span className="flex items-center gap-1.5"><StarIcon className="size-4 text-[#c6a86d]" />{featuredBook.rating} valoración</span>
                <span>Lectura adaptable</span>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-[360px] lg:mr-10">
              <div className="absolute -inset-12 -z-10 rounded-full bg-[#7c2025]/20 blur-3xl" />
              <div className="absolute -right-9 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-3 text-[9px] uppercase tracking-[.35em] text-[#7e7564] sm:flex"><span className="h-16 w-px bg-[#c6a86d]/30" />Edición 2026</div>
              <BookCover title={featuredBook.title} coverUrl={featuredBook.coverUrl} chapterCount={featuredBook.chapters.length} />
            </div>
          </div>
        </section>

        <section id="biblioteca" className="border-y border-white/8 bg-[#101311]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
            <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[.25em] text-[#aa8c57]">Biblioteca</p>
                <h2 className="max-w-md font-serif text-4xl leading-tight sm:text-5xl">Tu obra, organizada para perdurar.</h2>
                <p className="mt-5 max-w-lg leading-7 text-[#97948c]">Comenzamos con Casa Reykov y una estructura preparada para sumar nuevas obras, ediciones y autores cuando llegue el momento.</p>
              </div>
              <Link href="/libros/casa-reykov" className="group grid overflow-hidden rounded-2xl border border-white/10 bg-[#151816] transition hover:-translate-y-1 hover:border-[#b99a61]/40 lg:grid-cols-[190px_1fr]">
                <div className="bg-[#0c0f0d] p-6"><BookCover compact title={featuredBook.title} coverUrl={featuredBook.coverUrl} chapterCount={featuredBook.chapters.length} className="mx-auto w-[138px]" /></div>
                <div className="flex flex-col justify-center p-7 sm:p-9">
                  <div className="mb-4 flex flex-wrap gap-2">{featuredBook.genres.map((genre) => <span key={genre} className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[.18em] text-[#918d83]">{genre}</span>)}</div>
                  <h3 className="font-serif text-3xl">{featuredBook.title}</h3><p className="mt-2 text-sm text-[#918d83]">{featuredBook.subtitle}</p>
                  <div className="mt-7 flex items-center gap-3 text-sm font-medium text-[#cfb479]">Explorar obra<ArrowRightIcon className="size-4 transition group-hover:translate-x-1" /></div>
                </div>
              </Link>
              <Link href="/biblioteca" className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-[#cfb479] lg:col-start-2">Ver todos los libros<ArrowRightIcon className="size-4" /></Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              ["01", "Lee a tu manera", "Ajusta tipografía, ancho, tamaño y tema sin perder tu lugar."],
              ["02", "Continúa donde estabas", "El progreso queda guardado automáticamente en cada dispositivo."],
              ["03", "Una edición cuidada", "Capítulos ordenados, metadatos claros y publicación editorial."],
            ].map(([number, title, description]) => <article key={number} className="rounded-2xl border border-white/8 p-7"><span className="font-serif text-sm text-[#9a7f4d]">{number}</span><h3 className="mt-8 font-serif text-2xl">{title}</h3><p className="mt-3 text-sm leading-6 text-[#87847c]">{description}</p></article>)}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
