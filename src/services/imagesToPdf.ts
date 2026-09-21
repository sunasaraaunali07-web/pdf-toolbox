/**
 * Images → PDF service
 * Embeds multiple images (JPG/PNG/WebP) into a single PDF, one image per page.
 * Each page is sized exactly to the image dimensions (in points at 72 DPI).
 */

import { PDFDocument } from 'pdf-lib';
import { readFileAsArrayBuffer } from '../utils/fileUtils';

/**
 * Convert an array of image Files into a single PDF.
 * Images are placed in the order of the array.
 * @param files     - Image files (JPG, PNG, WebP)
 * @param onProgress - Called after each image is embedded.
 */
export async function imagesToPdf(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  if (files.length === 0) throw new Error('No images provided.');

  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const bytes = new Uint8Array(arrayBuffer);

    let image;
    const type = file.type.toLowerCase();

    try {
      if (type === 'image/jpeg' || type === 'image/jpg') {
        image = await pdfDoc.embedJpg(bytes);
      } else if (type === 'image/png') {
        image = await pdfDoc.embedPng(bytes);
      } else {
        // WebP or unknown: try to convert via canvas first
        image = await embedViaCanvas(pdfDoc, bytes, file.type);
      }
    } catch {
      throw new Error(`Could not embed "${file.name}". The image may be corrupted or use an unsupported format.`);
    }

    const { width, height } = image;
    // 1 pt = 1/72 inch. pdf-lib uses points. We use the pixel dimensions directly
    // which gives a 72 DPI result — standard for on-screen display.
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });

    onProgress?.(i + 1, files.length);
  }

  return pdfDoc.save();
}

/**
 * Fallback for unsupported formats: draw to a canvas and export as JPEG,
 * then embed as JPEG. Handles WebP and other modern formats.
 */
async function embedViaCanvas(
  pdfDoc: PDFDocument,
  bytes: Uint8Array,
  mimeType: string,
) {
  const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: mimeType });
  const url = URL.createObjectURL(blob);

  try {
    const img = await loadHtmlImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const jpegBlob = await new Promise<Blob>((res, rej) => {
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/jpeg', 0.92);
    });

    const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
    return pdfDoc.embedJpg(jpegBytes);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image.'));
    img.src = src;
  });
}
