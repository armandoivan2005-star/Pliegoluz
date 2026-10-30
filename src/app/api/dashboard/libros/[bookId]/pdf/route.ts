import { getCurrentUserIdentity } from "@/lib/editor-auth";
import { createBookPdf } from "@/lib/book-pdf";
import { repairImportedChapter } from "@/lib/chapter-import";
import { getDatabase } from "@/lib/postgres";

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

  const db = getDatabase();
  let book: ExportBookRow | undefined;
  try {
    const bookResult = await db.query<ExportBookRow>(
      `select id, author_profile_id, slug, title, subtitle, author_name, description
         from public.books
        where id = $1
          and ($2::boolean = false or author_profile_id = $3)`,
      [bookId, identity.role === "author", identity.id],
    );
    book = bookResult.rows[0];
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "unknown";
    console.error("Book PDF query failed", { code });
    return errorResponse("No se pudo cargar el libro.", 500);
  }
  if (!book) return errorResponse("El libro no existe o no puedes administrarlo.", 404);

  let chapterRows: ExportChapterRow[];
  try {
    const chaptersResult = await db.query<ExportChapterRow>(
      `select number, title, content_markdown
         from public.chapters
        where book_id = $1 and status <> 'archived'
        order by number asc
        limit $2`,
      [book.id, MAX_EXPORT_CHAPTERS + 1],
    );
    chapterRows = chaptersResult.rows;
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "unknown";
    console.error("Book PDF chapters query failed", { code });
    return errorResponse("No se pudieron cargar los capítulos.", 500);
  }

  const chapters = chapterRows
    .filter((chapter) => chapter.content_markdown.trim())
    .map((chapter) => {
      const repaired = repairImportedChapter({
        number: chapter.number,
        title: chapter.title,
        content: chapter.content_markdown,
      });

      return {
        number: repaired.number,
        title: repaired.title,
        content: repaired.content,
      };
    });

  if (!chapters.length) return errorResponse("El libro todavía no tiene capítulos con contenido.", 409);
  if (chapterRows.length > MAX_EXPORT_CHAPTERS) {
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
