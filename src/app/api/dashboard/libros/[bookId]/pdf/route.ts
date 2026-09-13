import { getCurrentUserIdentity } from "@/lib/editor-auth";
import { createBookPdf } from "@/lib/book-pdf";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_EXPORT_CHAPTERS = 500;
const MAX_EXPORT_CHARACTERS = 10_000_000;

type ExportBookRow = {
  id: string;
  author_profile_id: string | null;
  slug: string;
  title: string;
  subtitle: string | null;
  author_name: string;
  description: string;
};

type ExportChapterRow = {
  number: number;
  title: string;
  content_markdown: string;
};

function errorResponse(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "private, no-store" } });
}

function safeFileName(slug: string) {
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safeSlug || "libro"}.pdf`;
}

export async function GET(_request: Request, context: RouteContext<"/api/dashboard/libros/[bookId]/pdf">) {
  const { bookId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookId)) {
    return errorResponse("El identificador del libro no es válido.", 400);
  }

  const identity = await getCurrentUserIdentity();
  if (!identity) return errorResponse("Inicia sesión para descargar este libro.", 401);
  if (identity.role !== "author" && identity.role !== "admin") {
    return errorResponse("No tienes permisos para descargar libros desde el panel editorial.", 403);
  }

  const supabase = createAdminClient();
  if (!supabase) return errorResponse("Supabase Admin no está configurado.", 503);

  let bookQuery = supabase
    .from("books")
    .select("id, author_profile_id, slug, title, subtitle, author_name, description")
    .eq("id", bookId);
  if (identity.role === "author") bookQuery = bookQuery.eq("author_profile_id", identity.id);

  const { data: book, error: bookError } = await bookQuery.maybeSingle<ExportBookRow>();
  if (bookError) {
    console.error("Book PDF query failed", { code: bookError.code });
    return errorResponse("No se pudo cargar el libro.", 500);
  }
  if (!book) return errorResponse("El libro no existe o no puedes administrarlo.", 404);

  const { data: chapterRows, error: chaptersError } = await supabase
    .from("chapters")
    .select("number, title, content_markdown")
    .eq("book_id", book.id)
    .neq("status", "archived")
    .order("number", { ascending: true })
    .limit(MAX_EXPORT_CHAPTERS + 1)
    .returns<ExportChapterRow[]>();

  if (chaptersError) {
    console.error("Book PDF chapters query failed", { code: chaptersError.code });
    return errorResponse("No se pudieron cargar los capítulos.", 500);
  }

  const chapters = (chapterRows ?? [])
    .filter((chapter) => chapter.content_markdown.trim())
    .map((chapter) => ({
      number: chapter.number,
      title: chapter.title,
      content: chapter.content_markdown,
    }));

  if (!chapters.length) return errorResponse("El libro todavía no tiene capítulos con contenido.", 409);
  if ((chapterRows?.length ?? 0) > MAX_EXPORT_CHAPTERS) {
    return errorResponse(`La descarga admite un máximo de ${MAX_EXPORT_CHAPTERS} capítulos.`, 413);
  }

  const totalCharacters = chapters.reduce((total, chapter) => total + chapter.content.length, 0);
  if (totalCharacters > MAX_EXPORT_CHARACTERS) {
    return errorResponse("El contenido del libro es demasiado grande para generar un PDF en línea.", 413);
  }

  try {
    const pdf = await createBookPdf({
      title: book.title,
      subtitle: book.subtitle,
      author: book.author_name,
      description: book.description,
      chapters,
    });
    const fileName = safeFileName(book.slug);

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(pdf.byteLength),
        "Content-Type": "application/pdf",
      },
    });
  } catch (caught) {
    console.error("Book PDF generation failed", {
      name: caught instanceof Error ? caught.name : "UnknownError",
    });
    return errorResponse("No se pudo generar el PDF del libro.", 500);
  }
}
