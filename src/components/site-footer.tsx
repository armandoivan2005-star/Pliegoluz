import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/8 bg-[#090b0a]">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-10 text-sm text-[#7f7d76] sm:px-8 md:flex-row md:items-center">
        <p className="font-serif tracking-[0.18em] text-[#d7bb82]">PLIEGOLUZ</p>
        <p>Una biblioteca independiente para historias que merecen quedarse.</p>
        <div className="flex gap-5 md:ml-auto"><Link className="hover:text-white" href="/">Inicio</Link><Link className="hover:text-white" href="/libros/casa-reykov">Casa Reykov</Link></div>
      </div>
    </footer>
  );
}
