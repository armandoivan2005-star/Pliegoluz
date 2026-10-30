import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserIdentity } from "@/lib/editor-auth";
import { getDatabase, oneOrNull } from "@/lib/postgres";
import { isSameOriginRequest } from "@/lib/request-origin";

type ProgressRequest = {
  slug?: string;
  chapterNumber?: number;
  paragraphIndex?: number;
  paragraphOffset?: number;
  progressPercent?: number;
};

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  const identity = await getCurrentUserIdentity();
  if (!identity) return NextResponse.json({ error: "Inicia sesión para guardar tu progreso." }, { status: 401 });

  let body: ProgressRequest;
  try {
    body = (await request.json()) as ProgressRequest;
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const chapterNumber = Number(body.chapterNumber);
  const paragraphIndex = Number(body.paragraphIndex);
  const paragraphOffset = Number(body.paragraphOffset);
  const progressPercent = Number(body.progressPercent);
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    || !Number.isInteger(chapterNumber) || chapterNumber < 1
    || !Number.isInteger(paragraphIndex) || paragraphIndex < 0
    || !Number.isFinite(paragraphOffset) || paragraphOffset < 0 || paragraphOffset > 1
    || !Number.isFinite(progressPercent) || progressPercent < 0 || progressPercent > 100
  ) {
    return NextResponse.json({ error: "La posición de lectura no es válida." }, { status: 400 });
  }

  const target = await oneOrNull<{ book_id: string; chapter_id: string }>(
    `select b.id as book_id, c.id as chapter_id
       from public.books b
       join public.chapters c on c.book_id = b.id
      where b.slug = $1 and b.status = 'published'
        and c.number = $2 and c.status = 'published'`,
    [slug, chapterNumber],
  );
  if (!target) return NextResponse.json({ error: "El capítulo no está disponible." }, { status: 404 });

  try {
    await getDatabase().query(
      `insert into public.reading_progress (
         profile_id, book_id, chapter_id, progress_percent,
         paragraph_index, paragraph_offset, updated_at
       ) values ($1, $2, $3, $4, $5, $6, now())
       on conflict (profile_id, book_id) do update set
         chapter_id = excluded.chapter_id,
         progress_percent = excluded.progress_percent,
         paragraph_index = excluded.paragraph_index,
         paragraph_offset = excluded.paragraph_offset,
         updated_at = now()`,
      [
        identity.id,
        target.book_id,
        target.chapter_id,
        Math.round(progressPercent * 100) / 100,
        paragraphIndex,
        Math.round(paragraphOffset * 100000) / 100000,
      ],
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "unknown";
    console.error("Reading progress persistence failed", { code });
    return NextResponse.json({ error: "No se pudo guardar el progreso." }, { status: 500 });
  }
}
