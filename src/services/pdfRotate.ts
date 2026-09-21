/**
 * Rotate Pages service
 */

import { PDFDocument, degrees } from 'pdf-lib';
import { isPdfBytes } from '../utils/fileUtils';

/**
 * Apply rotations to specific pages and save.
 * @param bytes     - Source PDF bytes
 * @param rotations - Map from 0-indexed page number → degrees to rotate (90 | 180 | 270).
 *                    Pages not in the map are kept at their current rotation.
 */
export async function rotatePages(
  bytes: Uint8Array,
  rotations: Map<number, number>,
  onProgress?: (msg: string) => void,
): Promise<Uint8Array> {
  if (!isPdfBytes(bytes)) throw new Error('The file does not appear to be a valid PDF.');
  if (rotations.size === 0) throw new Error('No rotations specified.');

  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch {
    throw new Error('Could not open PDF. It may be corrupted or encrypted.');
  }

  onProgress?.('Applying rotations…');
  const pages = pdfDoc.getPages();

  for (const [pageIndex, rotateDeg] of rotations) {
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page = pages[pageIndex];
    const currentRotation = page.getRotation().angle;
    const newRotation = (currentRotation + rotateDeg) % 360;
    page.setRotation(degrees(newRotation));
  }

  onProgress?.('Saving…');
  return pdfDoc.save();
}
