"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/editor-auth";

async function publishedBookId(slug: string) {
  const context = await requireUser();
  const { rows } = await context.db.query<{ id: string }>(
    `select id from public.books where slug = $1 and status = 'published'`,
    [slug],
  );
  return { ...context, bookId: rows[0]?.id ?? null };
}

export async function toggleFavoriteAction(slug: string, formData: FormData) {
  void formData;
  const { identity, db, bookId } = await publishedBookId(slug);
  if (!bookId) return;

  const deleted = await db.query(
    `delete from public.book_favorites
      where profile_id = $1 and book_id = $2
      returning book_id`,
    [identity.id, bookId],
  );
  if (!deleted.rowCount) {
    await db.query(
      `insert into public.book_favorites (profile_id, book_id)
       values ($1, $2)
       on conflict (profile_id, book_id) do nothing`,
      [identity.id, bookId],
    );
  }
  revalidatePath(`/libros/${slug}`);
  revalidatePath("/perfil");
}

export async function rateBookAction(slug: string, formData: FormData) {
  const rating = Number(formData.get("rating"));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return;
  const { identity, db, bookId } = await publishedBookId(slug);
  if (!bookId) return;

  await db.query(
    `insert into public.book_ratings (profile_id, book_id, rating)
     values ($1, $2, $3)
     on conflict (profile_id, book_id)
     do update set rating = excluded.rating, updated_at = now()`,
    [identity.id, bookId, rating],
  );
  revalidatePath(`/libros/${slug}`);
}
