import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserIdentity } from "@/lib/editor-auth";
import { isSameOriginRequest } from "@/lib/request-origin";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 500 });

  const { data: book } = await supabase
    .from("books")
    .select("id")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle<{ id: string }>();
  if (!book) return NextResponse.json({ error: "El libro no está disponible." }, { status: 404 });

  const { data: chapter } = await supabase
    .from("chapters")
    .select("id")
    .eq("book_id", book.id)
    .eq("number", chapterNumber)
    .eq("status", "published")
    .maybeSingle<{ id: string }>();
  if (!chapter) return NextResponse.json({ error: "El capítulo no está disponible." }, { status: 404 });

  const payload = {
    chapter_id: chapter.id,
    progress_percent: Math.round(progressPercent * 100) / 100,
    paragraph_index: paragraphIndex,
    paragraph_offset: Math.round(paragraphOffset * 100000) / 100000,
    updated_at: new Date().toISOString(),
  };
  const target = supabase
    .from("reading_progress")
    .update(payload)
    .eq("profile_id", identity.id)
    .eq("book_id", book.id)
    .select("profile_id")
    .maybeSingle<{ profile_id: string }>();
  const updateResult = await target;
  let persistenceError = updateResult.error;

  if (!persistenceError && !updateResult.data) {
    const insertResult = await supabase
      .from("reading_progress")
      .insert({ profile_id: identity.id, book_id: book.id, ...payload });

    if (insertResult.error?.code === "23505") {
      // Otra solicitud pudo insertar la primera posición al mismo tiempo.
      const retryResult = await supabase
        .from("reading_progress")
        .update(payload)
        .eq("profile_id", identity.id)
        .eq("book_id", book.id);
      persistenceError = retryResult.error;
    } else {
      persistenceError = insertResult.error;
    }
  }

  if (persistenceError) {
    console.error("Reading progress persistence failed", { code: persistenceError.code });
    return NextResponse.json({ error: "No se pudo guardar el progreso." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
