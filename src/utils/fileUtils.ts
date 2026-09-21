/**
 * File utilities
 * Shared helpers for file I/O, validation, formatting, and download.
 * No PDF-specific logic here — keep this generic.
 */

// ── Constants ────────────────────────────────────────────────────────────────

export const MAX_COMPRESS_FILES = 10;
export const MAX_COMPRESS_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_SINGLE_FILE_BYTES = 100 * 1024 * 1024;   // 100 MB

const ACCEPTED_PDF_TYPES = ['application/pdf'];
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// ── Validation ───────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePdfFile(file: File): ValidationResult {
  if (!file) return { valid: false, error: 'No file provided.' };
  if (!ACCEPTED_PDF_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: `"${file.name}" is not a PDF file.` };
  }
  if (file.size === 0) {
    return { valid: false, error: `"${file.name}" is empty.` };
  }
  if (file.size > MAX_SINGLE_FILE_BYTES) {
    return { valid: false, error: `"${file.name}" exceeds the 100 MB limit (${formatBytes(file.size)}).` };
  }
  return { valid: true };
}

export function validateImageFile(file: File): ValidationResult {
  if (!file) return { valid: false, error: 'No file provided.' };
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: `"${file.name}" is not a supported image (JPG, PNG, WebP).` };
  }
  if (file.size === 0) {
    return { valid: false, error: `"${file.name}" is empty.` };
  }
  if (file.size > MAX_SINGLE_FILE_BYTES) {
    return { valid: false, error: `"${file.name}" exceeds the 100 MB limit.` };
  }
  return { valid: true };
}

// ── Reading ──────────────────────────────────────────────────────────────────

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target!.result as ArrayBuffer);
    reader.onerror = () => reject(new Error(`Failed to read "${file.name}". The file may be corrupted.`));
    reader.readAsArrayBuffer(file);
  });
}

export async function readFileAsUint8Array(file: File): Promise<Uint8Array> {
  const buf = await readFileAsArrayBuffer(file);
  return new Uint8Array(buf);
}

// ── Downloading ──────────────────────────────────────────────────────────────

/**
 * Triggers a browser download of a Uint8Array as a named file.
 * Automatically revokes the object URL after the click.
 */
export function downloadUint8Array(data: Uint8Array, filename: string, mimeType = 'application/pdf'): void {
  // Slice the underlying buffer to ensure we get a plain ArrayBuffer (not SharedArrayBuffer)
  const blob = new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer], { type: mimeType });
  downloadBlob(blob, filename);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke shortly after to allow the download to start
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ── Naming ───────────────────────────────────────────────────────────────────

/** Strip the .pdf extension from a filename. */
export function stripPdfExtension(name: string): string {
  return name.replace(/\.pdf$/i, '');
}

/** Strip the image extension from a filename. */
export function stripImageExtension(name: string): string {
  return name.replace(/\.(jpe?g|png|webp)$/i, '');
}

// ── Formatting ───────────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function formatCompressionRatio(original: number, compressed: number): string {
  const saved = original - compressed;
  const pct = ((saved / original) * 100).toFixed(0);
  if (saved <= 0) return 'No size reduction';
  return `${formatBytes(saved)} smaller (${pct}% reduced)`;
}

// ── PDF Bytes Validation ─────────────────────────────────────────────────────

/** Quick check: does the buffer start with %PDF- ? */
export function isPdfBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  return (
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d    // -
  );
}
