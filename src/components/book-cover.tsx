type BookCoverProps = {
  compact?: boolean;
  className?: string;
  title?: string;
  chapterCount?: number;
  coverUrl?: string | null;
};

export function BookCover({ className = "", title = "Casa Reykov", chapterCount = 41, coverUrl }: BookCoverProps) {
  const initials = title.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

  return (
    <div
      aria-label={`Portada de ${title}`}
      className={`book-cover relative isolate aspect-[2/3] overflow-hidden rounded-[3px] text-[#f0e7d3] shadow-[0_30px_70px_rgba(0,0,0,.38)] ${className}`}
    >
      {coverUrl ? (
        // Supabase entrega esta imagen desde el bucket público de portadas.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt={`Portada de ${title}`} className="absolute inset-0 size-full object-cover" loading="lazy" />
      ) : (
        <>
          <div className="absolute inset-[7%] border border-[#e0c58c]/40" />
          <div className="absolute left-1/2 top-[17%] h-px w-[58%] -translate-x-1/2 bg-[#d6b978]/60" />
          <div className="absolute left-1/2 top-[13%] h-2 w-2 -translate-x-1/2 rotate-45 border border-[#d6b978]/70" />
          <div className="absolute inset-x-0 top-[27%] text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.42em] text-[#d6b978] sm:text-xs">Edición canónica</p>
            <h2 className="mx-auto mt-4 max-w-[82%] text-balance font-serif text-2xl leading-tight tracking-[0.05em] sm:text-4xl">{title.toUpperCase()}</h2>
          </div>
          <div className="absolute bottom-[15%] left-1/2 grid h-16 w-16 -translate-x-1/2 place-items-center rounded-full border border-[#d6b978]/55 font-serif text-xl text-[#d6b978] sm:h-20 sm:w-20 sm:text-2xl">{initials}</div>
          <p className="absolute inset-x-0 bottom-[7%] text-center text-[8px] uppercase tracking-[0.28em] text-[#d6b978]/80 sm:text-[10px]">{chapterCount} capítulos</p>
        </>
      )}
    </div>
  );
}
