/**
 * Merge PDF service
 * Combines multiple PDF files into one, in the order provided.
 */

import { PDFDocument } from 'pdf-lib';
import { isPdfBytes } from '../utils/fileUtils';

/**
 * Merge multiple PDFs (each as a Uint8Array) in the order given.
 * Returns the merged PDF as a Uint8Array.
 * @throws if any input is not a valid PDF or if merging fails.
 */
export async function mergePdfs(
  files: Array<{ bytes: Uint8Array; name: string }>,
  onProgress?: (msg: string) => void,
): Promise<Uint8Array> {
  if (files.length === 0) throw new Error('No files provided.');
  if (files.length === 1) {
    // Nothing to merge — just return the single file as-is
    return files[0].bytes;
  }

  onProgress?.('Creating merged document…');
  const mergedDoc = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const { bytes, name } = files[i];
    onProgress?.(`Adding "${name}" (${i + 1} / ${files.length})…`);

    if (!isPdfBytes(bytes)) {
      throw new Error(`"${name}" does not appear to be a valid PDF file.`);
    }

    let srcDoc: PDFDocument;
    try {
      srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    } catch {
      throw new Error(`Could not read "${name}". The file may be corrupted or encrypted.`);
    }

    const pageIndices = srcDoc.getPageIndices();
    const copiedPages = await mergedDoc.copyPages(srcDoc, pageIndices);
    copiedPages.forEach((page) => mergedDoc.addPage(page));
  }

  onProgress?.('Saving merged PDF…');
  const saved = await mergedDoc.save();
  return saved;
}
