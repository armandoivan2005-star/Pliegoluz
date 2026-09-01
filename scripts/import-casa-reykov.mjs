import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const PDF_FILENAME = "Casa_Reykov_Capitulos_I-XLI_Edicion_Canonica.pdf";
const EXPECTED_CHAPTERS = 41;
const DEFAULT_PDF_PATH = path.join(process.env.USERPROFILE ?? "", "Downloads", PDF_FILENAME);
const DEFAULT_OUTPUT_PATH = path.resolve("supabase", "import-casa-reykov.sql");
const STANDARD_FONTS_URL = `${path.resolve("node_modules", "pdfjs-dist", "standard_fonts").replaceAll("\\", "/")}/`;

const pdfPath = path.resolve(process.argv[2] ?? DEFAULT_PDF_PATH);
const outputPath = path.resolve(process.argv[3] ?? DEFAULT_OUTPUT_PATH);

function romanToNumber(roman) {
  const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  let previous = 0;

  for (const character of [...roman.toUpperCase()].reverse()) {
    const value = values[character];
    if (!value) throw new Error(`Número romano inválido: ${roman}`);
    total += value < previous ? -value : value;
    previous = Math.max(previous, value);
  }

  return total;
}

function parseChapterNumber(rawNumber) {
  return /^\d+$/.test(rawNumber) ? Number(rawNumber) : romanToNumber(rawNumber);
}

function textLines(items) {
  const lines = [];
  let currentLine;

  for (const item of items) {
    if (!("str" in item) || !item.str) continue;

    const x = item.transform[4];
    const y = item.transform[5];

    if (!currentLine || Math.abs(currentLine.y - y) > 0.8) {
      currentLine = { x, y, parts: [] };
      lines.push(currentLine);
    }

    currentLine.parts.push(item.str);
  }

  return lines
    .map((line) => ({
      x: line.x,
      y: line.y,
      text: line.parts.join("").replace(/\s+/g, " ").trim(),
    }))
    .filter((line) => line.text);
}

function cleanPageLines(lines, pageNumber) {
  return lines.filter((line) => {
    if (line.text === "CASA REYKOV") return false;
    if (line.text === String(pageNumber)) return false;
    if (/^FIN DEL CAP[IÍ]TULO\s+(?:[IVXLCDM]+|\d+)$/i.test(line.text)) return false;
    return true;
  });
}

function appendLine(chapter, line, context) {
  if (line.text === "◆" || line.text === "u") {
    if (chapter.paragraphs.at(-1) !== "◆") chapter.paragraphs.push("◆");
    context.previousLine = undefined;
    return;
  }

  const previousLine = context.previousLine;
  const verticalGap = previousLine ? previousLine.y - line.y : 0;
  const isIndented = line.x >= 60;
  const hasParagraphGap = previousLine && verticalGap > 14.5;
  const startsNewParagraph =
    chapter.paragraphs.length === 0 ||
    chapter.paragraphs.at(-1) === "◆" ||
    isIndented ||
    hasParagraphGap ||
    (context.isFirstBodyLineOnPage && line.x >= 60);

  if (startsNewParagraph) {
    chapter.paragraphs.push(line.text);
  } else {
    const lastIndex = chapter.paragraphs.length - 1;
    const previousText = chapter.paragraphs[lastIndex];
    const joiner = previousText.endsWith("-") && /^\p{Ll}/u.test(line.text) ? "" : " ";
    chapter.paragraphs[lastIndex] = `${previousText}${joiner}${line.text}`;
  }

  context.previousLine = line;
  context.isFirstBodyLineOnPage = false;
}

function sqlDollarQuote(value, tag) {
  const delimiter = `$${tag}$`;
  if (value.includes(delimiter)) throw new Error(`El texto contiene el delimitador SQL ${delimiter}`);
  return `${delimiter}${value}${delimiter}`;
}

function buildSql(chapters) {
  const rows = chapters.map((chapter) => {
    const content = chapter.paragraphs.join("\n\n").trim();
    const wordCount = content.split(/\s+/u).filter(Boolean).length;
    const readingMinutes = Math.max(1, Math.ceil(wordCount / 220));
    const title = sqlDollarQuote(chapter.title, `title_${chapter.number}`);
    const markdown = sqlDollarQuote(content, `content_${chapter.number}`);
    return `    (${chapter.number}, ${title}, ${markdown}, ${readingMinutes})`;
  });

  return `-- Generado automáticamente desde ${PDF_FILENAME}.
-- Revisa este archivo y ejecútalo en Supabase > SQL Editor.

begin;

with chapter_data (number, title, content_markdown, reading_minutes) as (
  values
${rows.join(",\n")}
)
insert into public.chapters (
  book_id,
  number,
  title,
  content_markdown,
  status,
  reading_minutes,
  published_at
)
select
  books.id,
  chapter_data.number,
  chapter_data.title,
  chapter_data.content_markdown,
  'published',
  chapter_data.reading_minutes,
  now()
from public.books
cross join chapter_data
where books.slug = 'casa-reykov'
on conflict (book_id, number) do update set
  title = excluded.title,
  content_markdown = excluded.content_markdown,
  status = excluded.status,
  reading_minutes = excluded.reading_minutes,
  published_at = excluded.published_at,
  updated_at = now();

do $$
declare
  imported_chapters integer;
begin
  select count(*)
  into imported_chapters
  from public.chapters
  join public.books on books.id = chapters.book_id
  where books.slug = 'casa-reykov'
    and chapters.status = 'published'
    and length(chapters.content_markdown) > 0;

  if imported_chapters <> ${EXPECTED_CHAPTERS} then
    raise exception 'Se esperaban ${EXPECTED_CHAPTERS} capítulos con contenido, pero se encontraron %.', imported_chapters;
  end if;
end $$;

commit;

select
  chapters.number,
  chapters.title,
  length(chapters.content_markdown) as characters,
  chapters.reading_minutes
from public.chapters
join public.books on books.id = chapters.book_id
where books.slug = 'casa-reykov'
order by chapters.number;
`;
}

async function main() {
  await access(pdfPath);

  const data = new Uint8Array(await readFile(pdfPath));
  const document = await pdfjs.getDocument({ data, standardFontDataUrl: STANDARD_FONTS_URL }).promise;
  const chapters = [];
  let currentChapter;
  let context = { isFirstBodyLineOnPage: true, previousLine: undefined };

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines = cleanPageLines(textLines(content.items), pageNumber);
      const headingIndex = lines.findIndex((line) => /^CAP[IÍ]TULO\s+([IVXLCDM]+|\d+)$/i.test(line.text));
      let bodyStart = 0;

      if (headingIndex >= 0) {
        const match = lines[headingIndex].text.match(/^CAP[IÍ]TULO\s+([IVXLCDM]+|\d+)$/i);
        const number = parseChapterNumber(match[1]);
        const titleLine = lines.slice(headingIndex + 1).find((line) => line.text !== "◆");

        if (!titleLine) throw new Error(`No se encontró el título del capítulo ${number}.`);
        if (chapters.some((chapter) => chapter.number === number)) {
          throw new Error(`El capítulo ${number} fue detectado más de una vez.`);
        }

        currentChapter = { number, title: titleLine.text, paragraphs: [] };
        chapters.push(currentChapter);
        bodyStart = lines.indexOf(titleLine) + 1;
        context = { isFirstBodyLineOnPage: true, previousLine: undefined };
      } else if (currentChapter) {
        context.isFirstBodyLineOnPage = true;
        context.previousLine = undefined;
      }

      if (!currentChapter) continue;

      for (const line of lines.slice(bodyStart)) {
        appendLine(currentChapter, line, context);
      }
    }
  } finally {
    await document.destroy();
  }

  chapters.sort((left, right) => left.number - right.number);

  if (chapters.length !== EXPECTED_CHAPTERS) {
    throw new Error(`Se detectaron ${chapters.length} capítulos; se esperaban ${EXPECTED_CHAPTERS}.`);
  }

  for (let index = 0; index < chapters.length; index += 1) {
    const chapter = chapters[index];
    if (chapter.number !== index + 1) throw new Error(`Falta el capítulo ${index + 1}.`);
    if (chapter.paragraphs.join(" ").length < 500) {
      throw new Error(`El capítulo ${chapter.number} parece incompleto.`);
    }
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buildSql(chapters), "utf8");

  const totalCharacters = chapters.reduce(
    (total, chapter) => total + chapter.paragraphs.join("\n\n").length,
    0,
  );

  console.log(`PDF: ${pdfPath}`);
  console.log(`Páginas: ${document.numPages}`);
  console.log(`Capítulos: ${chapters.length}`);
  console.log(`Caracteres importables: ${totalCharacters.toLocaleString("es-MX")}`);
  console.log(`SQL generado: ${outputPath}`);
  console.log("Primer capítulo:", chapters[0].title);
  console.log("Último capítulo:", chapters.at(-1).title);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
