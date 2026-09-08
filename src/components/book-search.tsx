import { SearchIcon } from "@/components/icons";

export function BookSearch() {
  return (
    <form action="/biblioteca" method="get" role="search" className="flex h-11 w-40 items-center rounded-full border border-[#c6a86d]/45 bg-[#101311] pl-4 pr-1 sm:w-56 lg:w-96">
      <label htmlFor="book-search" className="sr-only">Buscar por título</label>
      <input
        id="book-search"
        name="q"
        type="search"
        autoComplete="off"
        placeholder="Buscar título…"
        className="min-w-0 flex-1 bg-transparent text-sm text-[#eee8dc] outline-none placeholder:text-[#6f6d67]"
      />
      <button type="submit" aria-label="Buscar" className="grid size-9 shrink-0 place-items-center rounded-full text-[#d6b978] transition hover:bg-white/6">
        <SearchIcon className="size-5" />
      </button>
    </form>
  );
}
