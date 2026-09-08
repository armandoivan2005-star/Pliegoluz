import Link from "next/link";
import { BookSearch } from "@/components/book-search";
import { BookOpenIcon, UserIcon } from "@/components/icons";
import { getCurrentUserIdentity } from "@/lib/editor-auth";

export async function SiteHeader() {
  const user = await getCurrentUserIdentity();

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0b0e0d]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-7xl items-center gap-8 px-5 sm:px-8">
        <Link href="/" className="group flex items-center gap-3" aria-label="Ir al inicio">
          <span className="grid size-9 place-items-center rounded-full border border-[#bf9f63]/45 text-[#d7bb82] transition group-hover:border-[#d7bb82]"><BookOpenIcon className="size-4" /></span>
          <span className="hidden font-serif text-lg tracking-[0.16em] text-[#f5efe3] sm:inline sm:text-xl">PLIEGOLUZ</span>
        </Link>
        <nav className="ml-6 hidden items-center gap-7 text-sm text-[#aca99f] md:flex">
          <Link className="transition hover:text-white" href="/">Inicio</Link>
          <Link className="transition hover:text-white" href="/biblioteca">Biblioteca</Link>
          <Link className="transition hover:text-white" href="/novedades">Novedades</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <BookSearch />
          <Link href={user ? (user.role === "reader" ? "/perfil" : "/dashboard") : "/login"} aria-label={user ? "Ir a mi cuenta" : "Iniciar sesión"} className="flex h-10 items-center gap-2 rounded-full border border-white/12 px-3 text-sm text-[#e8e3d8] transition hover:border-[#bf9f63]/60 sm:px-4"><UserIcon className="size-4" /><span className="hidden sm:inline">{user ? (user.role === "reader" ? "Mi perfil" : "Panel") : "Ingresar"}</span></Link>
        </div>
      </div>
    </header>
  );
}
