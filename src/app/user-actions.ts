"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/editor-auth";

async function publishedBookId(slug: string) {
  const context = await requireUser();
  const { data: book } = await context.supabase
    .from("books")
    .select("id")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle<{ id: string }>();
  return { ...context, bookId: book?.id ?? null };
}

export async function toggleFavoriteAction(slug: string, formData: FormData) {
  void formData;
  const { identity, supabase, bookId } = await publishedBookId(slug);
  if (!bookId) return;
  const { data: current } = await supabase
    .from("book_favorites")
    .select("book_id")
    .eq("profile_id", identity.id)
    .eq("book_id", bookId)
    .maybeSingle();

  if (current) {
    await supabase.from("book_favorites").delete().eq("profile_id", identity.id).eq("book_id", bookId);
  } else {
    await supabase.from("book_favorites").insert({ profile_id: identity.id, book_id: bookId });
  }
  revalidatePath(`/libros/${slug}`);
  revalidatePath("/perfil");
}

export async function rateBookAction(slug: string, formData: FormData) {
  const rating = Number(formData.get("rating"));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return;
  const { identity, supabase, bookId } = await publishedBookId(slug);
  if (!bookId) return;
  await supabase.from("book_ratings").upsert({
    profile_id: identity.id,
    book_id: bookId,
    rating,
    updated_at: new Date().toISOString(),
  }, { onConflict: "profile_id,book_id" });
  revalidatePath(`/libros/${slug}`);
}
