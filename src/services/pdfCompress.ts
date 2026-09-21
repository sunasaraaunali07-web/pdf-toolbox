/**
 * Compress PDF service
 *
 * Two modes:
 *   'lossless'   — Re-saves the PDF with pdf-lib using object streams + zlib deflate.
 *                  Removes dead objects, uncompressed streams, XRef table overhead.
 *                  No quality loss. Typically 5-40% reduction on unoptimised PDFs.
 *
 *   'aggressive' — Renders each page to a JPEG image (via pdfjs-dist) and embeds them
 *                  in a new PDF. Significant compression (often 60-85%) but the resulting
 *                  PDF is an "image PDF" — text is no longer selectable.
 *
 * Files are processed one at a time to control memory usage.
 * Each file's result is independent — one failure does not cancel others.
 */

import { PDFDocument } from 'pdf-lib';
import { isPdfBytes } from '../utils/fileUtils';
import { loadPdfDocument, renderPageToCanvas } from '../utils/pdfUtils';

export type CompressMode = 'lossless' | 'aggressive';
export type CompressQuality = 'high' | 'medium' | 'low';

const QUALITY_MAP: Record<CompressQuality, number> = {
  high: 0.85,
  medium: 0.70,
  low: 0.50,
};

export interface CompressResult {
  name: string;
  data: Uint8Array;
  originalSize: number;
  compressedSize: number;
}

export interface CompressFileResult {
  name: string;
  result?: CompressResult;
  error?: string;
}

/**
 * Compress a batch of PDFs sequentially.
 * Reports per-file progress via onProgress.
 */
export async function compressBatch(
  files: Array<{ bytes: Uint8Array; name: string }>,
  mode: CompressMode,
  quality: CompressQuality,
  onProgress: (fileIndex: number, total: number, msg: string) => void,
): Promise<CompressFileResult[]> {
  const results: CompressFileResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const { bytes, name } = files[i];
    try {
      onProgress(i, files.length, `Processing "${name}"…`);
      const result = await compressSingle(bytes, name, mode, quality, (msg) => {
        onProgress(i, files.length, msg);
      });
      results.push({ name, result });
    } catch (err) {
      console.error(`Compression failed for "${name}":`, err);
      results.push({
        name,
        error: err instanceof Error ? err.message : 'Unknown error during compression.',
      });
    }
  }

  return results;
}

async function compressSingle(
  bytes: Uint8Array,
  name: string,
  mode: CompressMode,
  quality: CompressQuality,
  onProgress: (msg: string) => void,
): Promise<CompressResult> {
  if (!isPdfBytes(bytes)) {
    throw new Error(`"${name}" does not appear to be a valid PDF file.`);
  }

  const originalSize = bytes.length;
  let compressedBytes: Uint8Array;

  if (mode === 'lossless') {
    compressedBytes = await losslessCompress(bytes, onProgress);
  } else {
    compressedBytes = await aggressiveCompress(bytes, QUALITY_MAP[quality], onProgress);
  }

  return {
    name,
    data: compressedBytes,
    originalSize,
    compressedSize: compressedBytes.length,
  };
}

// ── Lossless ─────────────────────────────────────────────────────────────────

async function losslessCompress(
  bytes: Uint8Array,
  onProgress: (msg: string) => void,
): Promise<Uint8Array> {
  onProgress('Loading PDF…');
  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch {
    throw new Error('Could not open PDF. It may be corrupted or encrypted.');
  }

  onProgress('Optimising PDF structure…');
  // useObjectStreams: true → wraps multiple objects in compressed streams (PDF 1.5+),
  // eliminates cross-reference table overhead, and applies zlib deflate to all streams.
  const saved = await pdfDoc.save({ useObjectStreams: true });
  return saved;
}

// ── Aggressive (image-based) ─────────────────────────────────────────────────

async function aggressiveCompress(
  bytes: Uint8Array,
  jpegQuality: number,
  onProgress: (msg: string) => void,
): Promise<Uint8Array> {
  onProgress('Loading PDF for rendering…');
  let pdfJsDoc: Awaited<ReturnType<typeof loadPdfDocument>>;
  try {
    pdfJsDoc = await loadPdfDocument(bytes);
  } catch {
    throw new Error('Could not open PDF for rendering. It may be corrupted.');
  }

  const numPages = pdfJsDoc.numPages;
  const newPdf = await PDFDocument.create();

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress(`Compressing page ${pageNum} of ${numPages}…`);

    const page = await pdfJsDoc.getPage(pageNum);
    // Render at 1.5× scale ≈ 108 DPI — a good balance of quality vs. file size.
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = await renderPageToCanvas(page, 1.5);
    page.cleanup();

    // Encode canvas as JPEG
    const jpegBlob = await canvasToJpeg(canvas, jpegQuality);
    const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());

    // Embed in new PDF page
    const embeddedImg = await newPdf.embedJpg(jpegBytes);
    // Use the viewport dimensions as the page size (in points: 1pt ≈ 1px at 72 DPI,
    // but we rendered at 1.5×, so page size = viewport / 1.5 for correct dimensions)
    const w = viewport.width / 1.5;
    const h = viewport.height / 1.5;
    const pdfLibPage = newPdf.addPage([w, h]);
    pdfLibPage.drawImage(embeddedImg, { x: 0, y: 0, width: w, height: h });
  }

  await pdfJsDoc.cleanup();
  onProgress('Saving compressed PDF…');
  return newPdf.save();
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to encode page as JPEG.'));
      },
      'image/jpeg',
      quality,
    );
  });
}
