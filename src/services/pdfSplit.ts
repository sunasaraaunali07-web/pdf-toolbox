/**
 * Split PDF service
 */

import { PDFDocument } from 'pdf-lib';
import { isPdfBytes } from '../utils/fileUtils';

export interface PageRange {
  /** Display label, e.g. "1-3" or "5" */
  label: string;
  /** 0-indexed start page */
  start: number;
  /** 0-indexed end page (inclusive) */
  end: number;
}

/**
 * Parse a comma-separated range string like "1-3, 5, 7-10" (1-indexed).
 * Returns an array of validated PageRange objects.
 * @throws a user-friendly error if parsing or validation fails.
 */
export function parsePageRanges(input: string, pageCount: number): PageRange[] {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Please enter at least one page range.');

  const parts = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  const ranges: PageRange[] = [];

  for (const part of parts) {
    const rangeParts = part.split('-').map((s) => s.trim());
    if (rangeParts.length === 1) {
      // Single page
      const n = parseInt(rangeParts[0], 10);
      if (isNaN(n) || n < 1) throw new Error(`"${part}" is not a valid page number.`);
      if (n > pageCount) throw new Error(`Page ${n} does not exist. This PDF has ${pageCount} pages.`);
      ranges.push({ label: String(n), start: n - 1, end: n - 1 });
    } else if (rangeParts.length === 2) {
      const start = parseInt(rangeParts[0], 10);
      const end = parseInt(rangeParts[1], 10);
      if (isNaN(start) || isNaN(end)) throw new Error(`"${part}" is not a valid range.`);
      if (start < 1) throw new Error(`Range "${part}": start page must be at least 1.`);
      if (start > end) throw new Error(`Range "${part}": start must be ≤ end.`);
      if (end > pageCount) throw new Error(`Page ${end} does not exist. This PDF has ${pageCount} pages.`);
      ranges.push({ label: `${start}-${end}`, start: start - 1, end: end - 1 });
    } else {
      throw new Error(`"${part}" is not a valid page range. Use formats like: 1, 2-5, 7.`);
    }
  }

  if (ranges.length === 0) throw new Error('No valid page ranges found.');
  return ranges;
}

/**
 * Split a PDF into multiple PDFs, one per PageRange.
 * Returns the resulting PDFs in the same order as the ranges array.
 */
export async function splitPdf(
  bytes: Uint8Array,
  ranges: PageRange[],
  onProgress?: (msg: string) => void,
): Promise<Uint8Array[]> {
  if (!isPdfBytes(bytes)) throw new Error('The file does not appear to be a valid PDF.');

  let srcDoc: PDFDocument;
  try {
    srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch {
    throw new Error('Could not open PDF. It may be corrupted or encrypted.');
  }

  const results: Uint8Array[] = [];

  for (let i = 0; i < ranges.length; i++) {
    const { label, start, end } = ranges[i];
    onProgress?.(`Creating split ${i + 1} / ${ranges.length}: pages ${label}…`);

    const newDoc = await PDFDocument.create();
    const indices: number[] = [];
    for (let p = start; p <= end; p++) indices.push(p);

    const copied = await newDoc.copyPages(srcDoc, indices);
    copied.forEach((page) => newDoc.addPage(page));

    results.push(await newDoc.save());
  }

  return results;
}
