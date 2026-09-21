/**
 * PDF utilities
 * Initialises pdfjs-dist (including the Web Worker) and exposes shared helpers
 * for loading and rendering PDF pages.
 *
 * Import this module once; the GlobalWorkerOptions are set as a side-effect.
 */

import * as pdfjsLib from 'pdfjs-dist';
// The ?url suffix tells Vite to emit the worker file to the assets directory
// and give us the resolved URL — works correctly in both dev and production.
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

// Configure the worker exactly once.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// Re-export for consumers that also need the library.
export { pdfjsLib };
export type { PDFDocumentProxy, PDFPageProxy };

// ── Loading ──────────────────────────────────────────────────────────────────

/**
 * Load a PDF document from a Uint8Array via pdfjs-dist.
 * Pass a *copy* of the bytes so pdfjs can transfer the buffer to its worker.
 */
export async function loadPdfDocument(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  // pdfjs transfers the ArrayBuffer to the worker — we slice to avoid
  // the caller's buffer becoming detached.
  const data = bytes.slice();
  const loadingTask = pdfjsLib.getDocument({ data });
  return loadingTask.promise;
}

/**
 * Get the page count of a PDF without keeping the document open.
 */
export async function getPdfPageCount(bytes: Uint8Array): Promise<number> {
  const doc = await loadPdfDocument(bytes);
  const count = doc.numPages;
  await doc.cleanup();
  return count;
}

// ── Rendering ────────────────────────────────────────────────────────────────

/**
 * Render a single pdfjs page to a canvas at the given scale.
 * Returns the canvas. The caller is responsible for calling page.cleanup()
 * when no longer needed.
 */
export async function renderPageToCanvas(
  page: PDFPageProxy,
  scale: number,
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context.');

  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas;
}

/**
 * Render a page to a canvas and return a JPEG Blob.
 * Cleans up the pdfjs page object after rendering.
 */
export async function renderPageToJpegBlob(
  page: PDFPageProxy,
  scale: number,
  quality = 0.92,
): Promise<Blob> {
  const canvas = await renderPageToCanvas(page, scale);
  page.cleanup();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed.'));
      },
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Render all pages of a PDF as small thumbnail data-URLs.
 * thumbnailHeight controls the rendered height in px (width scales proportionally).
 */
export async function renderThumbnails(
  bytes: Uint8Array,
  thumbnailHeight = 160,
  onPageDone?: (pageNum: number, total: number) => void,
): Promise<string[]> {
  const doc = await loadPdfDocument(bytes);
  const numPages = doc.numPages;
  const thumbs: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const nativeViewport = page.getViewport({ scale: 1 });
    const scale = thumbnailHeight / nativeViewport.height;
    const canvas = await renderPageToCanvas(page, scale);
    page.cleanup();
    thumbs.push(canvas.toDataURL('image/jpeg', 0.75));
    onPageDone?.(i, numPages);
  }

  await doc.cleanup();
  return thumbs;
}

