/**
 * Reorder Pages service
 */

import { PDFDocument } from 'pdf-lib';
import { isPdfBytes } from '../utils/fileUtils';

/**
 * Create a new PDF with pages in the specified order.
 * @param bytes    - Source PDF bytes
 * @param newOrder - 0-indexed page indices in desired output order.
 *                   e.g. [2, 0, 1] → page 3 first, then page 1, then page 2.
 */
export async function reorderPages(
  bytes: Uint8Array,
  newOrder: number[],
  onProgress?: (msg: string) => void,
): Promise<Uint8Array> {
  if (!isPdfBytes(bytes)) throw new Error('The file does not appear to be a valid PDF.');

  let srcDoc: PDFDocument;
  try {
    srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch {
    throw new Error('Could not open PDF. It may be corrupted or encrypted.');
  }

  const numPages = srcDoc.getPageCount();
  if (newOrder.length === 0) throw new Error('No page order specified.');
  if (newOrder.some((i) => i < 0 || i >= numPages)) {
    throw new Error('Page order contains out-of-range page indices.');
  }

  onProgress?.('Creating reordered PDF…');
  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(srcDoc, newOrder);
  copiedPages.forEach((page) => newDoc.addPage(page));

  onProgress?.('Saving…');
  return newDoc.save();
}
