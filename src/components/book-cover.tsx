type BookCoverProps = {
  compact?: boolean;
  className?: string;
};

export function BookCover({ className = "" }: BookCoverProps) {
  return (
    <div
      aria-label="Portada provisional de Casa Reykov"
      className={`book-cover relative isolate aspect-[2/3] overflow-hidden rounded-[3px] text-[#f0e7d3] shadow-[0_30px_70px_rgba(0,0,0,.38)] ${className}`}
    >
      <div className="absolute inset-[7%] border border-[#e0c58c]/40" />
      <div className="absolute left-1/2 top-[17%] h-px w-[58%] -translate-x-1/2 bg-[#d6b978]/60" />
      <div className="absolute left-1/2 top-[13%] h-2 w-2 -translate-x-1/2 rotate-45 border border-[#d6b978]/70" />
      <div className="absolute inset-x-0 top-[27%] text-center">
        <p className="text-[9px] font-semibold uppercase tracking-[0.42em] text-[#d6b978] sm:text-xs">Edición canónica</p>
        <h2 className="mt-4 font-serif text-3xl leading-none tracking-[0.08em] sm:text-5xl">CASA<span className="mt-2 block">REYKOV</span></h2>
      </div>
      <div className="absolute bottom-[15%] left-1/2 grid h-16 w-16 -translate-x-1/2 place-items-center rounded-full border border-[#d6b978]/55 font-serif text-xl text-[#d6b978] sm:h-20 sm:w-20 sm:text-2xl">CR</div>
      <p className="absolute inset-x-0 bottom-[7%] text-center text-[8px] uppercase tracking-[0.34em] text-[#d6b978]/80 sm:text-[10px]">Capítulos I — XLI</p>
    </div>
  );
}
