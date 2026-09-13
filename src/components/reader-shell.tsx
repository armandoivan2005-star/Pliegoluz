"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, BookmarkIcon, ListIcon, MoonIcon, TypeIcon } from "@/components/icons";

type Theme = "paper" | "sepia" | "night";

type ReaderShellProps = {
  bookSlug: string;
  bookTitle: string;
  chapterNumber: number;
  chapterPosition: number;
  chapterRoman: string;
  chapterTitle: string;
  paragraphs: string[];
  totalChapters: number;
  previousChapterNumber: number | null;
  nextChapterNumber: number | null;
  isPreview: boolean;
  canSyncProgress: boolean;
};

const themeClasses: Record<Theme, string> = {
  paper: "bg-[#f7f4ed] text-[#2a2926]",
  sepia: "bg-[#eee3ce] text-[#3b3328]",
  night: "bg-[#111412] text-[#dcd8cf]",
};

export function ReaderShell(props: ReaderShellProps) {
  const { bookSlug, bookTitle, chapterNumber, chapterPosition, chapterRoman, chapterTitle, paragraphs, totalChapters, previousChapterNumber, nextChapterNumber, isPreview, canSyncProgress } = props;
  const firstTextParagraph = 0;
  const [fontSize, setFontSize] = useState(20);
  const [wide, setWide] = useState(false);
  const [theme, setTheme] = useState<Theme>("paper");
  const [bookmarked, setBookmarked] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      const raw = localStorage.getItem("pliegoluz:reader-preferences");
      if (raw) {
        try {
          const saved = JSON.parse(raw) as { fontSize?: number; wide?: boolean; theme?: Theme };
          if (saved.fontSize) setFontSize(saved.fontSize);
          if (typeof saved.wide === "boolean") setWide(saved.wide);
          if (saved.theme && themeClasses[saved.theme]) setTheme(saved.theme);
        } catch {
          localStorage.removeItem("pliegoluz:reader-preferences");
        }
      }
      setBookmarked(localStorage.getItem(`pliegoluz:bookmark:${bookSlug}:${chapterNumber}`) === "true");
      localStorage.setItem("pliegoluz:last-read", JSON.stringify({ bookSlug, chapterNumber }));
      setPreferencesReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [bookSlug, chapterNumber]);

  useEffect(() => {
    if (!preferencesReady) return;
    localStorage.setItem("pliegoluz:reader-preferences", JSON.stringify({ fontSize, wide, theme }));
  }, [fontSize, wide, theme, preferencesReady]);

  useEffect(() => {
    if (!preferencesReady) return;
    const paragraphNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reader-paragraph]"));
    if (!paragraphNodes.length) return;

    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let hasMeasured = false;
    let latest = { paragraphIndex: 0, paragraphOffset: 0, progressPercent: 0 };

    const sendProgress = (keepalive = false) => {
      localStorage.setItem("pliegoluz:last-read", JSON.stringify({ bookSlug, chapterNumber, ...latest }));
      if (!canSyncProgress) return;
      fetch("/api/reading-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: bookSlug, chapterNumber, ...latest }),
        keepalive,
      }).catch(() => undefined);
    };

    const measureProgress = () => {
      const marker = window.scrollY + window.innerHeight * 0.35;
      let paragraphIndex = 0;
      let paragraphTop = paragraphNodes[0].getBoundingClientRect().top + window.scrollY;

      for (let index = 0; index < paragraphNodes.length; index += 1) {
        const top = paragraphNodes[index].getBoundingClientRect().top + window.scrollY;
        if (top > marker) break;
        paragraphIndex = index;
        paragraphTop = top;
      }

      const paragraphHeight = Math.max(1, paragraphNodes[paragraphIndex].offsetHeight);
      const paragraphOffset = Math.min(1, Math.max(0, (marker - paragraphTop) / paragraphHeight));
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      latest = {
        paragraphIndex,
        paragraphOffset,
        progressPercent: Math.min(100, Math.max(0, (window.scrollY / maxScroll) * 100)),
      };
      hasMeasured = true;
      localStorage.setItem("pliegoluz:last-read", JSON.stringify({ bookSlug, chapterNumber, ...latest }));

      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => sendProgress(), 1200);
    };

    const restorePosition = () => {
      const query = new URLSearchParams(window.location.search);
      const paragraphIndex = Number(query.get("pos"));
      const paragraphOffset = Number(query.get("offset"));
      if (!Number.isInteger(paragraphIndex) || paragraphIndex < 0 || paragraphIndex >= paragraphNodes.length || !Number.isFinite(paragraphOffset)) {
        measureProgress();
        return;
      }

      const paragraph = paragraphNodes[paragraphIndex];
      const top = paragraph.getBoundingClientRect().top + window.scrollY;
      const target = top + paragraph.offsetHeight * Math.min(1, Math.max(0, paragraphOffset)) - window.innerHeight * 0.35;
      window.scrollTo({ top: Math.max(0, target), behavior: "auto" });
      measureProgress();
    };

    const firstFrame = requestAnimationFrame(() => requestAnimationFrame(restorePosition));
    const onPageHide = () => {
      measureProgress();
      if (saveTimer) clearTimeout(saveTimer);
      sendProgress(true);
    };
    window.addEventListener("scroll", measureProgress, { passive: true });
    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelAnimationFrame(firstFrame);
      window.removeEventListener("scroll", measureProgress);
      window.removeEventListener("pagehide", onPageHide);
      if (saveTimer) clearTimeout(saveTimer);
      if (hasMeasured) sendProgress(true);
    };
  }, [bookSlug, canSyncProgress, chapterNumber, paragraphs.length, preferencesReady]);

  function toggleBookmark() {
    const next = !bookmarked;
    setBookmarked(next);
    localStorage.setItem(`pliegoluz:bookmark:${bookSlug}:${chapterNumber}`, String(next));
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${themeClasses[theme]}`}>
      <div className="fixed inset-x-0 top-0 z-50 h-1 bg-black/8"><div className="h-full bg-[#a77b38]" style={{ width: `${(chapterPosition / totalChapters) * 100}%` }} /></div>
      <header className="sticky top-0 z-40 border-b border-current/10 bg-[color:inherit] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6">
          <Link href={`/libros/${bookSlug}`} aria-label="Volver al libro" className="grid size-10 place-items-center rounded-full transition hover:bg-black/6"><ArrowLeftIcon className="size-5" /></Link>
          <div className="ml-2 min-w-0"><p className="truncate text-xs opacity-55">{bookTitle}</p><p className="truncate text-sm font-medium">{chapterTitle}</p></div>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" aria-label="Opciones de lectura" onClick={() => setPanelOpen((value) => !value)} className="grid size-10 place-items-center rounded-full transition hover:bg-black/6"><TypeIcon className="size-5" /></button>
            <button type="button" aria-label="Cambiar tema" onClick={() => setTheme((value) => value === "paper" ? "sepia" : value === "sepia" ? "night" : "paper")} className="grid size-10 place-items-center rounded-full transition hover:bg-black/6"><MoonIcon className="size-5" /></button>
            <button type="button" aria-label="Guardar marcador" aria-pressed={bookmarked} onClick={toggleBookmark} className={`grid size-10 place-items-center rounded-full transition hover:bg-black/6 ${bookmarked ? "text-[#a77b38]" : ""}`}><BookmarkIcon className={`size-5 ${bookmarked ? "fill-current" : ""}`} /></button>
            <Link href={`/libros/${bookSlug}#capitulos`} aria-label="Ver índice" className="grid size-10 place-items-center rounded-full transition hover:bg-black/6"><ListIcon className="size-5" /></Link>
          </div>
        </div>
      </header>

      {panelOpen && (
        <aside className="fixed right-4 top-20 z-40 w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-current/10 bg-[color:inherit] p-5 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[.18em] opacity-55">Apariencia</p>
          <div className="mt-5 flex items-center justify-between"><span className="text-sm">Tamaño del texto</span><div className="flex items-center gap-2"><button type="button" onClick={() => setFontSize((size) => Math.max(17, size - 1))} className="grid size-8 place-items-center rounded-full border border-current/15 text-sm">A−</button><span className="w-8 text-center text-xs opacity-60">{fontSize}</span><button type="button" onClick={() => setFontSize((size) => Math.min(27, size + 1))} className="grid size-8 place-items-center rounded-full border border-current/15 text-sm">A+</button></div></div>
          <button type="button" onClick={() => setWide((value) => !value)} className="mt-5 flex w-full items-center justify-between border-t border-current/10 pt-5 text-sm"><span>Ancho de lectura</span><span className="opacity-60">{wide ? "Amplio" : "Cómodo"}</span></button>
          <div className="mt-5 flex gap-2 border-t border-current/10 pt-5">{(["paper", "sepia", "night"] as Theme[]).map((value) => <button key={value} type="button" onClick={() => setTheme(value)} aria-label={`Tema ${value}`} className={`h-9 flex-1 rounded-lg border ${theme === value ? "border-[#a77b38]" : "border-current/10"} ${themeClasses[value]}`} />)}</div>
        </aside>
      )}

      <main className={`mx-auto px-5 pb-24 pt-18 transition-[max-width] sm:px-8 ${wide ? "max-w-4xl" : "max-w-3xl"}`}>
        <article>
          <header className="mb-14 text-center">
            <p className="text-xs font-semibold uppercase tracking-[.3em] text-[#a77b38]">Capítulo {chapterRoman}</p>
            <h1 className="mt-5 font-serif text-4xl sm:text-5xl">{chapterTitle}</h1>
            <div className="mx-auto mt-8 h-px w-20 bg-[#a77b38]/45" />
          </header>
          <div className="reader-copy font-serif" style={{ fontSize: `${fontSize}px` }}>
            {paragraphs.map((paragraph, index) => (
              <p
                key={`${chapterNumber}:${index}`}
                id={`paragraph-${index}`}
                data-reader-paragraph
                className={index === firstTextParagraph ? "first-paragraph" : ""}
              >
                {paragraph}
              </p>
            ))}
          </div>
          {isPreview && <div className="mt-16 rounded-2xl border border-[#a77b38]/25 bg-[#a77b38]/6 p-5 text-sm leading-6"><strong className="font-semibold">Vista previa técnica.</strong> El texto canónico aún no ha sido importado desde el PDF.</div>}
        </article>

        <nav className="mt-20 grid gap-3 border-t border-current/10 pt-8 sm:grid-cols-2">
          {previousChapterNumber !== null ? <Link href={`/leer/${bookSlug}/${previousChapterNumber}`} className="group flex items-center gap-3 rounded-xl border border-current/10 p-4 transition hover:border-[#a77b38]/50"><ArrowLeftIcon className="size-5" /><div><p className="text-xs opacity-50">Anterior</p><p className="mt-1 text-sm">Capítulo {previousChapterNumber}</p></div></Link> : <div />}
          {nextChapterNumber !== null && <Link href={`/leer/${bookSlug}/${nextChapterNumber}`} className="group flex items-center justify-end gap-3 rounded-xl border border-current/10 p-4 text-right transition hover:border-[#a77b38]/50"><div><p className="text-xs opacity-50">Siguiente</p><p className="mt-1 text-sm">Capítulo {nextChapterNumber}</p></div><ArrowRightIcon className="size-5" /></Link>}
        </nav>
      </main>
    </div>
  );
}
