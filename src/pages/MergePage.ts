/**
 * Merge PDF page
 */

import { mergePdfs } from '../services/pdfMerge';
import {
  validatePdfFile,
  readFileAsUint8Array,
  formatBytes,
  stripPdfExtension,
} from '../utils/fileUtils';

// ── Shared icon helpers ──────────────────────────────────────────────────────

function svgIcon(paths: string, size = 16): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    width="${size}" height="${size}" aria-hidden="true">${paths}</svg>`;
}

const ICON_BACK = svgIcon(`<polyline points="15 18 9 12 15 6"/>`, 16);
const ICON_FILE = svgIcon(`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>`, 20);
const ICON_DRAG = svgIcon(`<line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/>`, 16);
const ICON_REMOVE = svgIcon(`<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`, 16);
const ICON_UPLOAD = svgIcon(`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>`, 40);
const ICON_DOWNLOAD = svgIcon(`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`, 16);
const ICON_CHECK = svgIcon(`<polyline points="20 6 9 17 4 12"/>`, 20);

// ── Template ─────────────────────────────────────────────────────────────────

export function render(): string {
  return /* html */ `
<div class="tool-page">
  <div class="container">
    <header class="tool-page-header">
      <button class="btn-back" id="btn-back">${ICON_BACK} All Tools</button>
      <h1 class="tool-page-title">Merge PDF</h1>
      <p class="tool-page-desc">Combine multiple PDF files into one document. Drag files to reorder before merging.</p>
    </header>

    <div class="drop-zone" id="drop-zone" role="button" tabindex="0" aria-label="Drop PDF files here or click to choose">
      <div class="drop-zone-icon">${ICON_UPLOAD}</div>
      <p class="drop-zone-text">Drop PDFs here, or <span class="drop-zone-link">choose files</span></p>
      <p class="drop-zone-hint">Select multiple files at once · Max 100 MB each</p>
      <input type="file" id="file-input" hidden accept=".pdf,application/pdf" multiple>
    </div>

    <div id="work-area" class="hidden">
      <div class="work-area-header">
        <span class="work-area-count" id="work-area-count"></span>
        <button class="btn-add-more" id="btn-add-more">+ Add more PDFs</button>
        <input type="file" id="add-more-input" hidden accept=".pdf,application/pdf" multiple>
      </div>
      <ul class="file-list" id="file-list" aria-label="Selected files"></ul>

      <div class="action-row">
        <button class="btn btn-primary" id="btn-merge">
          ${ICON_FILE} Merge PDFs
        </button>
        <button class="btn btn-secondary" id="btn-clear">Clear all</button>
      </div>
    </div>

    <div id="processing-state" class="processing-state hidden">
      <div class="spinner" role="status" aria-label="Processing"></div>
      <p class="processing-message" id="processing-message">Merging…</p>
    </div>

    <div id="result-panel" class="result-panel hidden">
      <h2 class="result-panel-title">${ICON_CHECK} Done!</h2>
      <div class="result-list" id="result-list"></div>
    </div>

    <div id="error-panel" class="error-panel hidden" role="alert">
      <span id="error-message"></span>
    </div>
  </div>
</div>
  `;
}

// ── State ────────────────────────────────────────────────────────────────────

interface FileEntry {
  id: string;
  file: File;
  pageCount?: number;
}

// ── Init ─────────────────────────────────────────────────────────────────────

export function init(): () => void {
  const dropZone = document.getElementById('drop-zone')!;
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const addMoreInput = document.getElementById('add-more-input') as HTMLInputElement;
  const workArea = document.getElementById('work-area')!;
  const fileListEl = document.getElementById('file-list')!;
  const countEl = document.getElementById('work-area-count')!;
  const btnMerge = document.getElementById('btn-merge') as HTMLButtonElement;
  const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;
  const btnAddMore = document.getElementById('btn-add-more') as HTMLButtonElement;
  const btnBack = document.getElementById('btn-back') as HTMLButtonElement;
  const processingState = document.getElementById('processing-state')!;
  const processingMsg = document.getElementById('processing-message')!;
  const resultPanel = document.getElementById('result-panel')!;
  const resultList = document.getElementById('result-list')!;
  const errorPanel = document.getElementById('error-panel')!;
  const errorMsg = document.getElementById('error-message')!;

  let files: FileEntry[] = [];
  let idCounter = 0;
  let dragSrcId: string | null = null;
  let resultUrl: string | null = null;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function show(el: HTMLElement) { el.classList.remove('hidden'); }
  function hide(el: HTMLElement) { el.classList.add('hidden'); }

  function showError(msg: string) {
    errorMsg.textContent = msg;
    show(errorPanel);
  }
  function clearError() { hide(errorPanel); }

  function updateUI() {
    clearError();
    hide(resultPanel);
    if (files.length === 0) {
      hide(workArea);
      return;
    }
    show(workArea);
    countEl.textContent = `${files.length} file${files.length !== 1 ? 's' : ''} selected`;
    btnMerge.disabled = files.length < 2;
    renderList();
  }

  function renderList() {
    fileListEl.innerHTML = files.map((entry) => /* html */ `
      <li class="file-item" draggable="true" data-id="${entry.id}">
        <span class="file-item-drag-handle" title="Drag to reorder">${ICON_DRAG}</span>
        <span class="file-item-icon">${ICON_FILE}</span>
        <div class="file-item-body">
          <div class="file-item-name">${entry.file.name}</div>
          <div class="file-item-meta">${formatBytes(entry.file.size)}${entry.pageCount != null ? ` · ${entry.pageCount} page${entry.pageCount !== 1 ? 's' : ''}` : ''}</div>
        </div>
        <button class="btn-remove" data-remove="${entry.id}" aria-label="Remove ${entry.file.name}">${ICON_REMOVE}</button>
      </li>
    `).join('');
    attachListHandlers();
  }

  function attachListHandlers() {
    fileListEl.querySelectorAll<HTMLElement>('.file-item').forEach((item) => {
      const id = item.dataset.id!;

      item.addEventListener('dragstart', () => {
        dragSrcId = id;
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        dragSrcId = null;
        fileListEl.querySelectorAll('.file-item').forEach((i) => i.classList.remove('drag-target'));
      });
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (dragSrcId && dragSrcId !== id) item.classList.add('drag-target');
      });
      item.addEventListener('dragleave', () => item.classList.remove('drag-target'));
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drag-target');
        if (!dragSrcId || dragSrcId === id) return;
        // Reorder
        const srcIdx = files.findIndex((f) => f.id === dragSrcId);
        const dstIdx = files.findIndex((f) => f.id === id);
        if (srcIdx === -1 || dstIdx === -1) return;
        const [removed] = files.splice(srcIdx, 1);
        files.splice(dstIdx, 0, removed);
        updateUI();
      });
    });

    fileListEl.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.remove!;
        files = files.filter((f) => f.id !== id);
        updateUI();
      });
    });
  }

  async function addFiles(newFiles: File[]) {
    for (const file of newFiles) {
      const v = validatePdfFile(file);
      if (!v.valid) { showError(v.error!); continue; }
      const entry: FileEntry = { id: String(idCounter++), file };
      files.push(entry);
      // Load page count asynchronously
      try {
        const bytes = await readFileAsUint8Array(file);
        const { PDFDocument } = await import('pdf-lib');
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        entry.pageCount = doc.getPageCount();
      } catch { /* pageCount stays undefined */ }
      updateUI();
    }
    updateUI();
  }

  // ── Drop zone ──────────────────────────────────────────────────────────────

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });

  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const droppedFiles = Array.from(e.dataTransfer?.files ?? []);
    addFiles(droppedFiles);
  });

  fileInput.addEventListener('change', () => {
    addFiles(Array.from(fileInput.files ?? []));
    fileInput.value = '';
  });

  btnAddMore.addEventListener('click', () => addMoreInput.click());
  addMoreInput.addEventListener('change', () => {
    addFiles(Array.from(addMoreInput.files ?? []));
    addMoreInput.value = '';
  });

  // ── Actions ────────────────────────────────────────────────────────────────

  btnClear.addEventListener('click', () => {
    files = [];
    updateUI();
  });

  btnBack.addEventListener('click', () => { window.location.hash = '#tools'; });

  btnMerge.addEventListener('click', async () => {
    if (files.length < 2) return;

    hide(workArea);
    hide(errorPanel);
    show(processingState);
    hide(resultPanel);
    if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }

    try {
      const loaded = await Promise.all(
        files.map(async (entry) => ({
          bytes: await readFileAsUint8Array(entry.file),
          name: entry.file.name,
        })),
      );

      const merged = await mergePdfs(loaded, (msg) => { processingMsg.textContent = msg; });

      // Build output filename from first two files
      const baseName = stripPdfExtension(files[0].file.name);
      const outputName = `${baseName}-merged.pdf`;

      const blob = new Blob([merged.buffer.slice(merged.byteOffset, merged.byteOffset + merged.byteLength) as ArrayBuffer], { type: "application/pdf" });
      resultUrl = URL.createObjectURL(blob);

      resultList.innerHTML = /* html */ `
        <div class="result-item">
          <div class="result-item-body">
            <div class="result-item-name">${outputName}</div>
            <div class="result-item-meta">${formatBytes(merged.length)} · ${files.length} files merged</div>
          </div>
          <a class="btn-download" href="${resultUrl}" download="${outputName}">${ICON_DOWNLOAD} Download</a>
        </div>
      `;

      hide(processingState);
      show(resultPanel);
      show(workArea);
    } catch (err) {
      console.error('Merge failed:', err);
      hide(processingState);
      show(workArea);
      showError(err instanceof Error ? err.message : 'An unexpected error occurred during merging.');
    }
  });

  return () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  };
}
