/**
 * Delete Pages page
 */

import { deletePages } from '../services/pdfDeletePages';
import {
  validatePdfFile,
  readFileAsUint8Array,
  formatBytes,
  stripPdfExtension,
} from '../utils/fileUtils';
import { renderThumbnails } from '../utils/pdfUtils';

function svgIcon(paths: string, size = 16): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    width="${size}" height="${size}" aria-hidden="true">${paths}</svg>`;
}

const ICON_BACK = svgIcon(`<polyline points="15 18 9 12 15 6"/>`, 16);
const ICON_UPLOAD = svgIcon(`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>`, 40);
const ICON_DOWNLOAD = svgIcon(`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`, 16);
const ICON_TRASH = svgIcon(`<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>`, 14);
const ICON_X = svgIcon(`<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`, 12);
const ICON_CHECK = svgIcon(`<polyline points="20 6 9 17 4 12"/>`, 20);

export function render(): string {
  return /* html */ `
<div class="tool-page">
  <div class="container">
    <header class="tool-page-header">
      <button class="btn-back" id="btn-back">${ICON_BACK} All Tools</button>
      <h1 class="tool-page-title">Delete Pages</h1>
      <p class="tool-page-desc">Click pages to mark them for deletion, then save the result.</p>
    </header>

    <div class="drop-zone" id="drop-zone" role="button" tabindex="0">
      <div class="drop-zone-icon">${ICON_UPLOAD}</div>
      <p class="drop-zone-text">Drop a PDF here, or <span class="drop-zone-link">choose file</span></p>
      <p class="drop-zone-hint">One PDF file · Max 100 MB</p>
      <input type="file" id="file-input" hidden accept=".pdf,application/pdf">
    </div>

    <div id="work-area" class="hidden">
      <div class="work-area-header">
        <span class="work-area-count" id="work-area-count"></span>
        <button class="btn-add-more" id="btn-change">Change file</button>
      </div>

      <div id="thumb-loading" class="processing-state" style="padding:var(--space-8) 0">
        <div class="spinner" role="status"></div>
        <p class="processing-message">Loading page previews…</p>
      </div>

      <div id="thumb-area" class="hidden">
        <div class="page-selection-header">
          <span id="selection-info" style="font-size:var(--text-sm);color:var(--color-text-muted)">
            Click pages to mark for deletion
          </span>
          <button class="btn btn-secondary" id="btn-deselect-all" style="padding:var(--space-1) var(--space-3);font-size:var(--text-sm)">
            Clear selection
          </button>
        </div>
        <div class="page-grid" id="page-grid" role="list" aria-label="PDF pages — click to mark for deletion"></div>
        <div class="action-row">
          <button class="btn btn-primary" id="btn-delete" style="background:var(--accent-red)" disabled>
            ${ICON_TRASH} Delete Selected Pages
          </button>
        </div>
      </div>
    </div>

    <div id="processing-state" class="processing-state hidden">
      <div class="spinner" role="status"></div>
      <p class="processing-message">Removing selected pages…</p>
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

export function init(): () => void {
  const dropZone = document.getElementById('drop-zone')!;
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const workArea = document.getElementById('work-area')!;
  const countEl = document.getElementById('work-area-count')!;
  const btnDelete = document.getElementById('btn-delete') as HTMLButtonElement;
  const btnChange = document.getElementById('btn-change') as HTMLButtonElement;
  const btnDeselectAll = document.getElementById('btn-deselect-all') as HTMLButtonElement;
  const btnBack = document.getElementById('btn-back') as HTMLButtonElement;
  const thumbLoading = document.getElementById('thumb-loading')!;
  const thumbArea = document.getElementById('thumb-area')!;
  const pageGrid = document.getElementById('page-grid')!;
  const selectionInfo = document.getElementById('selection-info')!;
  const processingState = document.getElementById('processing-state')!;
  const resultPanel = document.getElementById('result-panel')!;
  const resultList = document.getElementById('result-list')!;
  const errorPanel = document.getElementById('error-panel')!;
  const errorMsg = document.getElementById('error-message')!;

  let currentFile: File | null = null;
  let currentBytes: Uint8Array | null = null;
  let numPages = 0;
  let markedForDeletion: Set<number> = new Set(); // 0-indexed
  let resultUrl: string | null = null;

  function show(el: HTMLElement) { el.classList.remove('hidden'); }
  function hide(el: HTMLElement) { el.classList.add('hidden'); }
  function showError(msg: string) { errorMsg.textContent = msg; show(errorPanel); }
  function clearError() { hide(errorPanel); }

  function updateSelectionUI() {
    const n = markedForDeletion.size;
    const remaining = numPages - n;

    if (n === 0) {
      selectionInfo.textContent = 'Click pages to mark for deletion';
    } else {
      selectionInfo.textContent = `${n} page${n !== 1 ? 's' : ''} marked for deletion — ${remaining} will remain`;
    }

    btnDelete.disabled = n === 0;
    if (n >= numPages && numPages > 0) {
      selectionInfo.textContent = `Cannot delete all pages — keep at least 1`;
      btnDelete.disabled = true;
    }

    pageGrid.querySelectorAll<HTMLElement>('.page-thumb').forEach((el) => {
      const p = Number(el.dataset.page); // 0-indexed
      el.classList.toggle('marked-delete', markedForDeletion.has(p));
    });
  }

  function renderGrid(thumbs: string[]) {
    pageGrid.innerHTML = thumbs.map((src, i) => /* html */ `
      <div class="page-thumb" data-page="${i}" role="listitem"
           tabindex="0" aria-label="Page ${i + 1} — click to toggle deletion">
        <img src="${src}" alt="Page ${i + 1}">
        <div class="page-thumb-label">Page ${i + 1}</div>
        <div class="page-thumb-delete-mark">${ICON_X}</div>
      </div>
    `).join('');

    pageGrid.querySelectorAll<HTMLElement>('.page-thumb').forEach((el) => {
      const p = Number(el.dataset.page);
      const toggle = () => {
        if (markedForDeletion.has(p)) markedForDeletion.delete(p);
        else markedForDeletion.add(p);
        updateSelectionUI();
      };
      el.addEventListener('click', toggle);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') toggle(); });
    });
  }

  async function loadFile(file: File) {
    const v = validatePdfFile(file);
    if (!v.valid) { showError(v.error!); return; }

    clearError();
    hide(thumbArea);
    hide(resultPanel);
    markedForDeletion.clear();
    show(workArea);
    show(thumbLoading);

    try {
      currentBytes = await readFileAsUint8Array(file);
      currentFile = file;
      const thumbs = await renderThumbnails(currentBytes, 160);
      numPages = thumbs.length;
      countEl.textContent = `${file.name} · ${formatBytes(file.size)} · ${numPages} pages`;
      renderGrid(thumbs);
      updateSelectionUI();
      hide(thumbLoading);
      show(thumbArea);
    } catch (err) {
      hide(thumbLoading);
      showError(err instanceof Error ? err.message : 'Could not open PDF.');
    }
  }

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const f = e.dataTransfer?.files[0];
    if (f) loadFile(f);
  });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) loadFile(f);
    fileInput.value = '';
  });

  btnChange.addEventListener('click', () => {
    currentFile = null; currentBytes = null; numPages = 0; markedForDeletion.clear();
    hide(workArea); show(dropZone); hide(resultPanel); clearError();
  });
  btnDeselectAll.addEventListener('click', () => { markedForDeletion.clear(); updateSelectionUI(); });
  btnBack.addEventListener('click', () => { window.location.hash = ''; });

  btnDelete.addEventListener('click', async () => {
    if (!currentBytes || !currentFile || markedForDeletion.size === 0) return;

    hide(thumbArea);
    show(processingState);
    hide(resultPanel);
    if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }

    try {
      const toDelete = Array.from(markedForDeletion);
      const result = await deletePages(currentBytes, toDelete);
      const filename = `${stripPdfExtension(currentFile.name)}-edited.pdf`;
      const blob = new Blob([result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength) as ArrayBuffer], { type: "application/pdf" });
      resultUrl = URL.createObjectURL(blob);
      const remaining = numPages - toDelete.length;

      resultList.innerHTML = /* html */ `
        <div class="result-item">
          <div class="result-item-body">
            <div class="result-item-name">${filename}</div>
            <div class="result-item-meta">${remaining} page${remaining !== 1 ? 's' : ''} remaining · ${formatBytes(result.length)}</div>
          </div>
          <a class="btn-download" href="${resultUrl}" download="${filename}">${ICON_DOWNLOAD} Download</a>
        </div>
      `;

      hide(processingState);
      show(resultPanel);
      show(thumbArea);
      show(workArea);
    } catch (err) {
      console.error('Delete pages failed:', err);
      hide(processingState);
      show(thumbArea);
      show(workArea);
      showError(err instanceof Error ? err.message : 'Could not delete pages.');
    }
  });

  return () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  };
}
