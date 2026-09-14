const pdfPageMarker = /^\s*(?:[-–—_=*·•]\s*)*(?:(?:page|página|pagina)\s+)?\d{1,5}\s+(?:of|de)\s+\d{1,5}(?:\s*[-–—_=*·•])*\s*$/i;
const chapterEndLabel = /^[\s\-–—_=*·•]*fin\s+del\s+cap[ií]tulo[\s\-–—_=*·•:.]*$/iu;
const chapterEndWithRoman = /^[\s\-–—_=*·•]*fin\s+del\s+cap[ií]tulo[\s\-–—_=*·•:.]+([ivxlcdm]+)[\s\-–—_=*·•]*$/iu;
const decoratedRoman = /^[\s\-–—_=*·•]*([ivxlcdm]+)[\s\-–—_=*·•]*$/iu;

function numberToRoman(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 3999) return null;
  const numerals: Array<[number, string]> = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"],
    [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let remaining = value;
  let roman = "";
  for (const [amount, numeral] of numerals) {
    while (remaining >= amount) {
      roman += numeral;
      remaining -= amount;
    }
  }
  return roman;
}

function removeMatchingChapterEnding(text: string, chapterNumber?: number) {
  const expectedRoman = chapterNumber === undefined ? null : numberToRoman(chapterNumber);
  if (!expectedRoman) return text;

  const lines = text.split("\n");
  while (lines.length && !lines.at(-1)?.trim()) lines.pop();
  const lastLine = lines.at(-1)?.trim() ?? "";
  const inlineMatch = lastLine.match(chapterEndWithRoman);
  if (inlineMatch?.[1].toUpperCase() === expectedRoman) {
    lines.pop();
    return lines.join("\n").trimEnd();
  }

  const romanMatch = lastLine.match(decoratedRoman);
  if (romanMatch?.[1].toUpperCase() !== expectedRoman) return text;

  let labelIndex = lines.length - 2;
  while (labelIndex >= 0 && !lines[labelIndex].trim()) labelIndex -= 1;
  if (labelIndex < 0 || !chapterEndLabel.test(lines[labelIndex])) return text;

  lines.splice(labelIndex);
  return lines.join("\n").trimEnd();
}

export function isPdfPageMarker(line: string) {
  return pdfPageMarker.test(line);
}

export function cleanExtractedPdfText(text: string, chapterNumber?: number) {
  const cleaned = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => !isPdfPageMarker(line))
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return removeMatchingChapterEnding(cleaned, chapterNumber)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
