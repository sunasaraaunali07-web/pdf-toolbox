/**
 * Delete Pages service
 */

import { PDFDocument } from 'pdf-lib';
import { isPdfBytes } from '../utils/fileUtils';

/**
 * Create a new PDF with the specified pages removed.
 * @param bytes         - Source PDF bytes
 * @param pagesToDelete - 0-indexed page numbers to remove
 */
export async function deletePages(
  bytes: Uint8Array,
  pagesToDelete: number[],
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
  if (pagesToDelete.length === 0) throw new Error('No pages selected for deletion.');
  if (pagesToDelete.length >= numPages) {
    throw new Error('Cannot delete all pages — the resulting PDF would be empty.');
  }

  const deleteSet = new Set(pagesToDelete);
  const keepIndices = Array.from({ length: numPages }, (_, i) => i).filter((i) => !deleteSet.has(i));

  onProgress?.('Creating PDF without selected pages…');
  const newDoc = await PDFDocument.create();
  const copied = await newDoc.copyPages(srcDoc, keepIndices);
  copied.forEach((page) => newDoc.addPage(page));

  onProgress?.('Saving…');
  return newDoc.save();
}
