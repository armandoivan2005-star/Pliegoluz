import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, BookOpenIcon, ClockIcon } from "@/components/icons";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getLatestPublishedChapters } from "@/lib/public-library";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Novedades",
  description: "Consulta los capítulos publicados recientemente en Pliegoluz.",
};

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Mexico_City",
});

export default async function NewsPage() {
  const chapters = await getLatestPublishedChapters();

  return (
    <div className="site-theme min-h-screen bg-[#0b0e0d] text-[#f5efe3]">
      <SiteHeader />
      <main>
        <section className="hero-texture border-b border-white/8">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
            <p className="text-xs font-semibold uppercase tracking-[.28em] text-[#aa8c57]">Recién publicados</p>
            <h1 className="mt-4 font-serif text-5xl sm:text-6xl">Novedades</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#97948c]">Los capítulos más recientes de todas las obras publicadas, reunidos en orden de aparición.</p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          {chapters.length ? (
            <div className="divide-y divide-white/8 border-y border-white/8">
              {chapters.map((chapter) => (
                <Link key={`${chapter.bookSlug}-${chapter.number}`} href={`/leer/${chapter.bookSlug}/${chapter.number}`} className="group grid gap-4 py-5 transition hover:bg-white/[.025] sm:grid-cols-[1fr_auto] sm:items-center sm:px-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="grid size-12 shrink-0 place-items-center rounded-full border border-white/10 font-serif text-[10px] tracking-[-.04em] text-[#c6a86d] transition group-hover:border-[#c6a86d]/50">{chapter.roman}</span>
                    <div className="min-w-0">
                      <h2 className="truncate font-medium text-[#eee8dc]">{chapter.title}</h2>
                      <p className="mt-1 truncate text-sm text-[#77756f]">{chapter.bookTitle} · Capítulo {chapter.number}</p>
                    </div>
                  </div>
                  <div className="ml-16 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#77756f] sm:ml-0 sm:justify-end">
                    {chapter.publishedAt && <time dateTime={chapter.publishedAt}>{dateFormatter.format(new Date(chapter.publishedAt))}</time>}
                    <span className="flex items-center gap-1.5"><ClockIcon className="size-3.5" />{chapter.readingMinutes} min</span>
                    <ArrowRightIcon className="size-4 transition group-hover:translate-x-1 group-hover:text-[#c6a86d]" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="grid min-h-80 place-items-center rounded-2xl border border-white/8 bg-white/[.02] p-8 text-center">
              <div><BookOpenIcon className="mx-auto size-9 text-[#aa8c57]" /><h2 className="mt-5 font-serif text-2xl">Todavía no hay novedades</h2><p className="mt-2 text-sm text-[#817f78]">Los capítulos aparecerán aquí cuando sean publicados.</p></div>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
