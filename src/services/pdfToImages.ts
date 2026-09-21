/**
 * PDF → Images service
 * Renders individual PDF pages to JPEG blobs using pdfjs-dist.
 * Pages are rendered one at a time to avoid memory pressure.
 */

import { loadPdfDocument, renderPageToJpegBlob } from '../utils/pdfUtils';
import { isPdfBytes } from '../utils/fileUtils';

export interface PageImageResult {
  /** 1-indexed page number */
  pageNumber: number;
  blob: Blob;
}

/**
 * Convert selected pages of a PDF to JPEG blobs.
 * @param bytes     - PDF file bytes
 * @param pageNums  - 1-indexed page numbers to convert; pass empty array to convert all
 * @param scale     - Rendering scale (1 = 72 DPI; 2 = 144 DPI). Default 2.
 * @param quality   - JPEG quality 0-1. Default 0.92.
 * @param onProgress - Called after each page is rendered.
 */
export async function pdfToJpeg(
  bytes: Uint8Array,
  pageNums: number[],
  scale = 2,
  quality = 0.92,
  onProgress?: (done: number, total: number) => void,
): Promise<PageImageResult[]> {
  if (!isPdfBytes(bytes)) throw new Error('The file does not appear to be a valid PDF.');

  let doc;
  try {
    doc = await loadPdfDocument(bytes);
  } catch {
    throw new Error('Could not open PDF. It may be corrupted or password-protected.');
  }

  const numPages = doc.numPages;
  const targets = pageNums.length > 0
    ? pageNums.filter((n) => n >= 1 && n <= numPages)
    : Array.from({ length: numPages }, (_, i) => i + 1);

  if (targets.length === 0) {
    throw new Error('No valid pages selected.');
  }

  const results: PageImageResult[] = [];

  for (let i = 0; i < targets.length; i++) {
    const pageNum = targets[i];
    const page = await doc.getPage(pageNum);
    const blob = await renderPageToJpegBlob(page, scale, quality);
    results.push({ pageNumber: pageNum, blob });
    onProgress?.(i + 1, targets.length);
  }

  await doc.cleanup();
  return results;
}
