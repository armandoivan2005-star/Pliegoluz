import "server-only";

import PDFDocument from "pdfkit";

export type BookPdfChapter = {
  number: number;
  title: string;
  content: string;
};

export type BookPdfInput = {
  title: string;
  subtitle: string | null;
  author: string;
  description: string;
  chapters: BookPdfChapter[];
};

const PAGE_SIZE = "A5";
const PAGE_MARGIN = 48;
const INK = "#252620";
const MUTED = "#6f6d66";
const DEEP_GREEN = "#101713";
const GOLD = "#b49355";
const SOURCE_PAGE_MARKER = /^[ \t\u00a0]*(?:-{2,}|–{2,}|—{2,})[ \t\u00a0]*(?:(?:page|página)[ \t\u00a0]+)?\d+[ \t\u00a0]+(?:of|de)[ \t\u00a0]+\d+[ \t\u00a0]*(?:-{2,}|–{2,}|—{2,})[ \t\u00a0]*$/gimu;

function cleanPdfText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(SOURCE_PAGE_MARKER, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[\t\f\v]+/g, " ")
    .trim();
}

function chapterParagraphs(content: string) {
  const cleaned = cleanPdfText(content);
  if (!cleaned) return [];

  return cleaned
    .split(/\n\s*\n/u)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/gu, " ").replace(/ {2,}/g, " ").trim())
    .filter(Boolean);
}

function addCover(doc: PDFKit.PDFDocument, book: BookPdfInput) {
  doc.addPage({ size: PAGE_SIZE, margin: PAGE_MARGIN });
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(DEEP_GREEN);

  const contentWidth = doc.page.width - PAGE_MARGIN * 2;
  doc
    .strokeColor(GOLD)
    .lineWidth(0.8)
    .rect(28, 28, doc.page.width - 56, doc.page.height - 56)
    .stroke();

  doc
    .fillColor(GOLD)
    .font("Times-Roman")
    .fontSize(9)
    .text("PLIEGOLUZ", PAGE_MARGIN, 92, {
      align: "center",
      characterSpacing: 2.2,
      width: contentWidth,
    });

  doc
    .fillColor("#f4ecdc")
    .font("Times-Bold")
    .fontSize(30)
    .text(cleanPdfText(book.title), PAGE_MARGIN, 180, {
      align: "center",
      width: contentWidth,
    });

  if (book.subtitle) {
    doc
      .moveDown(1)
      .fillColor("#c9bfae")
      .font("Times-Italic")
      .fontSize(12)
      .text(cleanPdfText(book.subtitle), PAGE_MARGIN, doc.y, {
        align: "center",
        width: contentWidth,
      });
  }

  doc
    .fillColor(GOLD)
    .font("Times-Roman")
    .fontSize(11)
    .text(cleanPdfText(book.author), PAGE_MARGIN, doc.page.height - 112, {
      align: "center",
      width: contentWidth,
    });
}

function addPublicationPage(doc: PDFKit.PDFDocument, book: BookPdfInput) {
  doc.addPage({ size: PAGE_SIZE, margin: PAGE_MARGIN });
  const contentWidth = doc.page.width - PAGE_MARGIN * 2;

  doc
    .fillColor(INK)
    .font("Times-Bold")
    .fontSize(18)
    .text(cleanPdfText(book.title), { width: contentWidth });

  doc
    .moveDown(0.45)
    .fillColor(MUTED)
    .font("Times-Roman")
    .fontSize(10)
    .text(cleanPdfText(book.author), { width: contentWidth });

  if (book.description.trim()) {
    doc
      .moveDown(2)
      .fillColor(INK)
      .font("Times-Italic")
      .fontSize(10.5)
      .text(cleanPdfText(book.description), {
        align: "left",
        lineGap: 3,
        width: contentWidth,
      });
  }

  doc
    .fillColor(MUTED)
    .font("Times-Roman")
    .fontSize(8.5)
    .text(
      "Edición privada generada desde el panel editorial de Pliegoluz.",
      PAGE_MARGIN,
      doc.page.height - 88,
      { align: "center", lineBreak: false, width: contentWidth },
    );
}

function addChapter(doc: PDFKit.PDFDocument, chapter: BookPdfChapter) {
  doc.addPage({ size: PAGE_SIZE, margin: PAGE_MARGIN });
  const contentWidth = doc.page.width - PAGE_MARGIN * 2;

  doc
    .fillColor(GOLD)
    .font("Times-Bold")
    .fontSize(9)
    .text(`CAPÍTULO ${chapter.number}`, {
      align: "center",
      characterSpacing: 1.8,
      width: contentWidth,
    });

  doc
    .moveDown(1)
    .fillColor(INK)
    .font("Times-Bold")
    .fontSize(21)
    .text(cleanPdfText(chapter.title), {
      align: "center",
      width: contentWidth,
    });

  doc
    .moveDown(1.2)
    .strokeColor(GOLD)
    .lineWidth(0.7)
    .moveTo(doc.page.width / 2 - 28, doc.y)
    .lineTo(doc.page.width / 2 + 28, doc.y)
    .stroke()
    .moveDown(2);

  const paragraphs = chapterParagraphs(chapter.content);
  for (const paragraph of paragraphs) {
    doc.fillColor(INK).font("Times-Roman").fontSize(10.5);

    const textOptions = {
      align: "justify" as const,
      lineGap: 2.2,
      paragraphGap: 8,
      width: contentWidth,
    };
    const paragraphHeight = doc.heightOfString(paragraph, textOptions) + textOptions.paragraphGap;
    const remainingHeight = doc.page.height - doc.page.margins.bottom - doc.y;
    const usablePageHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;

    if (paragraphHeight <= usablePageHeight && paragraphHeight > remainingHeight) {
      doc.addPage({ size: PAGE_SIZE, margin: PAGE_MARGIN });
    }

    doc.text(paragraph, textOptions);
  }
}

function addPageFurniture(doc: PDFKit.PDFDocument, title: string) {
  const range = doc.bufferedPageRange();

  for (let pageIndex = 1; pageIndex < range.count; pageIndex += 1) {
    doc.switchToPage(range.start + pageIndex);
    const contentWidth = doc.page.width - PAGE_MARGIN * 2;
    const previousBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 12;

    doc
      .save()
      .fillColor(MUTED)
      .font("Times-Roman")
      .fontSize(7.5)
      .text(cleanPdfText(title), PAGE_MARGIN, 25, {
        ellipsis: true,
        lineBreak: false,
        width: contentWidth,
      })
      .text(String(pageIndex), PAGE_MARGIN, doc.page.height - 30, {
        align: "center",
        lineBreak: false,
        width: contentWidth,
      })
      .restore();

    doc.page.margins.bottom = previousBottomMargin;
  }
}

export async function createBookPdf(book: BookPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      autoFirstPage: false,
      bufferPages: true,
      compress: true,
      info: {
        Title: cleanPdfText(book.title),
        Author: cleanPdfText(book.author),
        Creator: "Pliegoluz",
        Producer: "Pliegoluz",
      },
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    addCover(doc, book);
    addPublicationPage(doc, book);
    for (const chapter of book.chapters) addChapter(doc, chapter);
    addPageFurniture(doc, book.title);
    doc.end();
  });
}
