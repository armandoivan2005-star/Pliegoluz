const pdfPageMarker = /^\s*(?:[-–—_=*·•]\s*)*(?:(?:page|página|pagina)\s+)?\d{1,5}\s+(?:of|de)\s+\d{1,5}(?:\s*[-–—_=*·•])*\s*$/i;

export function isPdfPageMarker(line: string) {
  return pdfPageMarker.test(line);
}

export function cleanExtractedPdfText(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => !isPdfPageMarker(line))
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
