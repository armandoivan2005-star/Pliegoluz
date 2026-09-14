import { cleanExtractedPdfText } from "@/lib/pdf-text";

export type ImportedChapterDraft = {
  number: number;
  title: string;
  content: string;
};

type ChapterStart = {
  index: number;
  number: number;
  title: string;
};

type RepairableChapter = {
  number: number;
  title: string;
  content: string;
};

const chapterHeading = /^cap[ií]tulo\s+(\d{1,3}|[ivxlcdm]+)(?:\s*(?:[-:—–.]\s*)?(.+))?$/iu;
const MAX_CHAPTERS = 50;
const MAX_TITLE_LENGTH = 180;
const MAX_WRAPPED_TITLE_LINES = 4;
const MAX_TITLE_LINE_LENGTH = 120;

function romanToNumber(roman: string) {
  const values: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  let previous = 0;

  for (const character of [...roman.toUpperCase()].reverse()) {
    const current = values[character] ?? 0;
    total += current < previous ? -current : current;
    previous = Math.max(previous, current);
  }

  return total;
}

function isUppercaseTitleLine(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0
    && trimmed.length <= MAX_TITLE_LINE_LENGTH
    && /\p{L}/u.test(trimmed)
    && trimmed === trimmed.toLocaleUpperCase("es-MX");
}

function appendWrappedTitleLines(lines: string[], end: number, initialTitle: string, startIndex: number) {
  const parts = [initialTitle.trim()];
  let cursor = startIndex;

  if (!isUppercaseTitleLine(parts[0])) return { title: parts[0], bodyStart: cursor };

  while (cursor < end && parts.length < MAX_WRAPPED_TITLE_LINES) {
    const candidate = lines[cursor].trim();
    if (!candidate || !isUppercaseTitleLine(candidate)) break;

    const combined = [...parts, candidate].join(" ").replace(/\s{2,}/g, " ");
    if (combined.length > MAX_TITLE_LENGTH) break;

    parts.push(candidate);
    cursor += 1;
  }

  return {
    title: parts.join(" ").replace(/\s{2,}/g, " "),
    bodyStart: cursor,
  };
}

function chapterTitleAndBodyStart(lines: string[], end: number, start: ChapterStart) {
  let cursor = start.index + 1;

  if (start.title) return appendWrappedTitleLines(lines, end, start.title, cursor);

  while (cursor < end && !lines[cursor].trim()) cursor += 1;
  if (cursor >= end) return { title: `Capítulo ${start.number}`, bodyStart: cursor };

  const firstTitleLine = lines[cursor].trim();
  return appendWrappedTitleLines(lines, end, firstTitleLine, cursor + 1);
}

export function repairImportedChapter<T extends RepairableChapter>(chapter: T): T & { changed: boolean } {
  const originalTitle = chapter.title;
  const originalContent = chapter.content;
  let title = originalTitle.trim();
  let content = cleanExtractedPdfText(originalContent, chapter.number);
  let joinedLines = 0;

  while (joinedLines < MAX_WRAPPED_TITLE_LINES - 1 && isUppercaseTitleLine(title)) {
    const contentLines = content.split("\n");
    const candidate = contentLines[0]?.trim() ?? "";
    if (!candidate || !isUppercaseTitleLine(candidate)) break;

    const combined = `${title} ${candidate}`.replace(/\s{2,}/g, " ");
    if (combined.length > MAX_TITLE_LENGTH) break;

    title = combined;
    content = cleanExtractedPdfText(contentLines.slice(1).join("\n"), chapter.number);
    joinedLines += 1;
  }

  return {
    ...chapter,
    title,
    content,
    changed: title !== originalTitle || content !== originalContent,
  };
}

export function splitImportedBookChapters(text: string): ImportedChapterDraft[] {
  const lines = text.split("\n").map((line) => line.trim());
  const starts: ChapterStart[] = [];

  lines.forEach((line, index) => {
    if (line.length > MAX_TITLE_LENGTH) return;
    const match = line.match(chapterHeading);
    if (!match) return;

    const number = /^\d+$/.test(match[1]) ? Number(match[1]) : romanToNumber(match[1]);
    if (number < 1) return;
    starts.push({ index, number, title: match[2]?.trim() ?? "" });
  });

  if (!starts.length) throw new Error("No se encontraron encabezados como “Capítulo 1” o “Capítulo I”.");

  // Los índices suelen repetir todos los encabezados antes del cuerpo del libro.
  // Conservamos la última aparición de cada número, que normalmente es el capítulo real.
  const uniqueStarts = [...new Map(starts.map((start) => [start.number, start])).values()]
    .sort((a, b) => a.index - b.index);
  if (uniqueStarts.length > MAX_CHAPTERS) throw new Error(`El PDF contiene más de ${MAX_CHAPTERS} capítulos distintos.`);

  const chapters = uniqueStarts.map((start, position) => {
    const end = uniqueStarts[position + 1]?.index ?? lines.length;
    const parsedTitle = chapterTitleAndBodyStart(lines, end, start);
    const content = cleanExtractedPdfText(lines.slice(parsedTitle.bodyStart, end).join("\n"), start.number);

    return {
      number: start.number,
      title: parsedTitle.title.slice(0, MAX_TITLE_LENGTH),
      content,
    };
  });

  if (new Set(chapters.map((chapter) => chapter.number)).size !== chapters.length) {
    throw new Error("Se detectaron números de capítulo duplicados.");
  }

  return chapters.sort((a, b) => a.number - b.number);
}
