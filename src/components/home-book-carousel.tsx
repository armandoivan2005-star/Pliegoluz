"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookCover } from "@/components/book-cover";

export type HomeCarouselBook = {
  slug: string;
  title: string;
  author: string;
  coverUrl: string | null;
  chapterCount: number;
};

export function HomeBookCarousel({ books }: { books: HomeCarouselBook[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const activeBook = books[activeIndex];
  const hasMultipleBooks = books.length > 1;

  useEffect(() => {
    if (!hasMultipleBooks || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % books.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [activeIndex, books.length, hasMultipleBooks, paused]);

  return (
    <div className="relative mx-auto grid min-h-[680px] max-w-7xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[1.15fr_.85fr] lg:py-24" role="region" aria-roledescription="carrusel" aria-label="Libros disponibles" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="max-w-2xl">
        <h1 className="text-balance font-serif text-5xl leading-[.98] tracking-[-.035em] sm:text-7xl lg:text-[92px]">
          Historias para leer<span className="block italic text-[#c6a86d]">sin prisa.</span>
        </h1>
        <p className="mt-7 max-w-xl text-pretty text-base leading-7 text-[#aaa79e] sm:text-lg sm:leading-8">
          Una biblioteca digital construida alrededor del texto: capítulos ordenados, progreso automático y una experiencia serena en cualquier pantalla.
        </p>
      </div>

      <div className="relative mx-auto w-full max-w-[360px]">
        <div className="absolute -inset-12 -z-10 rounded-full bg-[#7c2025]/20 blur-3xl" />
        <div aria-live={paused ? "polite" : "off"}>
          <Link href={`/libros/${activeBook.slug}`} aria-label={`Abrir ${activeBook.title}`} className="group block">
            <BookCover key={activeBook.slug} title={activeBook.title} coverUrl={activeBook.coverUrl} chapterCount={activeBook.chapterCount} className="transition duration-300 group-hover:-translate-y-2 group-hover:shadow-[0_40px_90px_rgba(0,0,0,.6)]" />
          </Link>
          <div className="mt-5 min-w-0 text-center">
            <p className="truncate font-serif text-xl text-[#eee8dc]">{activeBook.title}</p>
            <p className="mt-1 truncate text-xs text-[#817f78]">{activeBook.author}</p>
          </div>
        </div>

        {hasMultipleBooks && (
          <div className="mt-5 flex items-center justify-center">
            <div className="flex items-center gap-2" aria-label={`${activeIndex + 1} de ${books.length}`}>
              {books.map((book, index) => <button key={book.slug} type="button" onClick={() => setActiveIndex(index)} aria-label={`Mostrar ${book.title}`} aria-current={index === activeIndex ? "true" : undefined} className={`h-1.5 rounded-full transition-all ${index === activeIndex ? "w-7 bg-[#c6a86d]" : "w-1.5 bg-white/25 hover:bg-white/50"}`} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
