export type Chapter = {
  number: number;
  roman: string;
  title: string;
  publishedAt: string;
  readingMinutes: number;
  contentMarkdown?: string;
};

export type Book = {
  slug: string;
  title: string;
  coverUrl?: string | null;
  subtitle: string;
  author: string;
  status: "Completo" | "En publicación" | "En pausa" | "Cancelado";
  description: string;
  genres: string[];
  views: string;
  rating: string;
  chapters: Chapter[];
};

function toRoman(value: number) {
  const pairs: Array<[number, string]> = [
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];

  let rest = value;
  let result = "";

  for (const [amount, numeral] of pairs) {
    while (rest >= amount) {
      result += numeral;
      rest -= amount;
    }
  }

  return result;
}

const chapters: Chapter[] = Array.from({ length: 41 }, (_, index) => {
  const number = index + 1;
  return {
    number,
    roman: toRoman(number),
    title: `Capítulo ${toRoman(number)}`,
    publishedAt: number > 38 ? "Edición canónica" : "Archivo canónico",
    readingMinutes: 11 + (number % 7),
  };
}).reverse();

export const books: Book[] = [
  {
    slug: "casa-reykov",
    title: "Casa Reykov",
    coverUrl: null,
    subtitle: "Capítulos I–XLI · Edición canónica",
    author: "Autor por confirmar",
    status: "Completo",
    description:
      "La historia de Santiago Mijáilovich Volkov Reyes, reunida en una edición canónica concebida para una lectura continua, íntima y sin distracciones.",
    genres: ["Novela", "Drama", "Edición canónica"],
    views: "1.2K",
    rating: "4.9",
    chapters,
  },
];

export const featuredBook = books[0];

export function getBook(slug: string) {
  return books.find((book) => book.slug === slug);
}

export function getChapter(book: Book, number: number) {
  return book.chapters.find((chapter) => chapter.number === number);
}

export const readerPreview = [
  "Esta vista previa sirve para validar la experiencia de lectura antes de importar el texto de la edición canónica.",
  "El contenido definitivo conservará los párrafos, separadores y énfasis del manuscrito. También podrá revisarse capítulo por capítulo desde el panel editorial antes de publicarlo.",
  "Mientras tanto, puedes probar el tamaño de letra, el ancho de página y los temas claro, sepia y oscuro. Las preferencias y el avance se guardan automáticamente en este dispositivo.",
];

export function getChapterParagraphs(chapter: Chapter) {
  const paragraphs = cleanExtractedPdfText(chapter.contentMarkdown ?? "", chapter.number)
    ?.split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph && paragraph !== "u" && paragraph !== "◆");

  return paragraphs?.length ? paragraphs : readerPreview;
}
import { cleanExtractedPdfText } from "@/lib/pdf-text";
