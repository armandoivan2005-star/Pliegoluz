import Link from "next/link";
import { rateBookAction, toggleFavoriteAction } from "@/app/user-actions";
import { BookmarkIcon, StarIcon } from "@/components/icons";
import { getBookInteraction } from "@/lib/user-library";

export async function BookInteractions({ slug }: { slug: string }) {
  const state = await getBookInteraction(slug);
  if (!state.identity) {
    return <Link href="/login" className="inline-flex h-13 items-center justify-center rounded-full border border-white/15 px-6 text-sm text-[#ddd6ca] transition hover:border-[#c6a86d]/50">Inicia sesión para guardar y calificar</Link>;
  }

  const toggleFavorite = toggleFavoriteAction.bind(null, slug);
  const rateBook = rateBookAction.bind(null, slug);

  return (
    <div className="flex items-center gap-3">
      <form action={toggleFavorite}>
        <button
          aria-label={state.favorite ? "Quitar de mi biblioteca" : "Añadir a mi biblioteca"}
          aria-pressed={state.favorite}
          title={state.favorite ? "Quitar de mi biblioteca" : "Añadir a mi biblioteca"}
          className={`grid size-11 place-items-center rounded-full border transition ${state.favorite ? "border-[#c6a86d]/60 bg-[#c6a86d]/10 text-[#e1c68d]" : "border-white/15 text-[#ddd6ca] hover:border-[#c6a86d]/50"}`}
        >
          <BookmarkIcon className={`size-4 ${state.favorite ? "fill-current" : ""}`} />
        </button>
      </form>

      <form action={rateBook} className="flex items-center gap-1" aria-label="Calificar libro">
        {[1, 2, 3, 4, 5].map((rating) => {
          const selected = rating <= (state.rating ?? 0);
          return (
            <button
              key={rating}
              type="submit"
              name="rating"
              value={rating}
              aria-label={`${rating} estrella${rating === 1 ? "" : "s"}`}
              title={`${rating} estrella${rating === 1 ? "" : "s"}`}
              className={`grid size-10 place-items-center rounded-full transition hover:scale-110 hover:text-[#e1c68d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c6a86d] ${selected ? "text-[#d6b978]" : "text-[#5f605b]"}`}
            >
              <StarIcon className={`size-5 ${selected ? "fill-current" : ""}`} />
            </button>
          );
        })}
      </form>
    </div>
  );
}
