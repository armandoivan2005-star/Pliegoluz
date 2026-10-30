import { oneOrNull } from "@/lib/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CoverRow = {
  cover_data: Buffer;
  cover_content_type: string;
  cover_updated_at: string | null;
};

export async function GET(_request: Request, context: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookId)) {
    return new Response(null, { status: 404 });
  }

  const cover = await oneOrNull<CoverRow>(
    `select cover_data, cover_content_type, cover_updated_at::text
       from public.books
      where id = $1 and status = 'published' and cover_data is not null`,
    [bookId],
  );
  if (!cover) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(cover.cover_data), {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "Content-Type": cover.cover_content_type,
      ...(cover.cover_updated_at ? { "Last-Modified": new Date(cover.cover_updated_at).toUTCString() } : {}),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
