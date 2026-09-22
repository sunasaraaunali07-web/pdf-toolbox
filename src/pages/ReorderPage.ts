/**
 * Reorder Pages page
 */

import { reorderPages } from '../services/pdfReorder';
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
const ICON_CHECK = svgIcon(`<polyline points="20 6 9 17 4 12"/>`, 20);
const ICON_UP = svgIcon(`<polyline points="18 15 12 9 6 15"/>`, 14);
const ICON_DOWN = svgIcon(`<polyline points="6 9 12 15 18 9"/>`, 14);

export function render(): string {
  return /* html */ `
<div class="tool-page">
  <div class="container">
    <header class="tool-page-header">
      <button class="btn-back" id="btn-back">${ICON_BACK} All Tools</button>
      <h1 class="tool-page-title">Reorder Pages</h1>
      <p class="tool-page-desc">Drag and drop page thumbnails to rearrange them into any order.</p>
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
        <p style="font-size:var(--text-sm);color:var(--color-text-muted);margin-bottom:var(--space-3)">
          Drag thumbnails to reorder · Use ↑↓ buttons for keyboard/touch control
        </p>
        <div class="page-grid" id="page-grid" role="list" aria-label="PDF pages — drag to reorder"></div>
        <div class="action-row">
          <button class="btn btn-primary" id="btn-save">${ICON_DOWNLOAD} Save Reordered PDF</button>
        </div>
      </div>
    </div>

    <div id="processing-state" class="processing-state hidden">
      <div class="spinner" role="status"></div>
      <p class="processing-message" id="processing-message">Creating reordered PDF…</p>
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
  const btnSave = document.getElementById('btn-save') as HTMLButtonElement;
  const btnChange = document.getElementById('btn-change') as HTMLButtonElement;
  const btnBack = document.getElementById('btn-back') as HTMLButtonElement;
  const thumbLoading = document.getElementById('thumb-loading')!;
  const thumbArea = document.getElementById('thumb-area')!;
  const pageGrid = document.getElementById('page-grid')!;
  const processingState = document.getElementById('processing-state')!;
  const processingMsg = document.getElementById('processing-message')!;
  const resultPanel = document.getElementById('result-panel')!;
  const resultList = document.getElementById('result-list')!;
  const errorPanel = document.getElementById('error-panel')!;
  const errorMsg = document.getElementById('error-message')!;

  let currentFile: File | null = null;
  let currentBytes: Uint8Array | null = null;
  // pageOrder[i] = original 0-indexed page number that is now at position i
  let pageOrder: number[] = [];
  let thumbSrcs: string[] = [];
  let resultUrl: string | null = null;
  let dragSrcIndex = -1;

  function show(el: HTMLElement) { el.classList.remove('hidden'); }
  function hide(el: HTMLElement) { el.classList.add('hidden'); }
  function showError(msg: string) { errorMsg.textContent = msg; show(errorPanel); }
  function clearError() { hide(errorPanel); }

  function renderGrid() {
    pageGrid.innerHTML = pageOrder.map((origPage, i) => /* html */ `
      <div class="page-thumb" draggable="true" data-index="${i}"
           role="listitem" tabindex="0" aria-label="Page ${origPage + 1} — position ${i + 1}">
        <img src="${thumbSrcs[origPage]}" alt="Page ${origPage + 1}">
        <div class="page-thumb-label">Page ${origPage + 1}</div>
        <div class="page-thumb-rotation" style="bottom:var(--space-1)">
          <button class="btn-rotate-page" data-move-up="${i}" title="Move left" ${i === 0 ? 'disabled' : ''}>${ICON_UP}</button>
          <button class="btn-rotate-page" data-move-down="${i}" title="Move right" ${i === pageOrder.length - 1 ? 'disabled' : ''}>${ICON_DOWN}</button>
        </div>
      </div>
    `).join('');

    pageGrid.querySelectorAll<HTMLElement>('.page-thumb').forEach((el) => {
      const index = Number(el.dataset.index);

      el.addEventListener('dragstart', (e) => {
        dragSrcIndex = index;
        el.classList.add('dragging-page');
        e.dataTransfer!.effectAllowed = 'move';
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('dragging-page');
        pageGrid.querySelectorAll('.page-thumb').forEach((t) => t.classList.remove('drag-over-page'));
      });
      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (dragSrcIndex !== index) el.classList.add('drag-over-page');
      });
      el.addEventListener('dragleave', () => el.classList.remove('drag-over-page'));
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('drag-over-page');
        if (dragSrcIndex < 0 || dragSrcIndex === index) return;
        const [moved] = pageOrder.splice(dragSrcIndex, 1);
        pageOrder.splice(index, 0, moved);
        dragSrcIndex = -1;
        renderGrid();
      });
    });

    pageGrid.querySelectorAll<HTMLButtonElement>('[data-move-up]').forEach((btn) => {
      const i = Number(btn.dataset.moveUp);
      btn.addEventListener('click', () => {
        if (i <= 0) return;
        [pageOrder[i - 1], pageOrder[i]] = [pageOrder[i], pageOrder[i - 1]];
        renderGrid();
      });
    });

    pageGrid.querySelectorAll<HTMLButtonElement>('[data-move-down]').forEach((btn) => {
      const i = Number(btn.dataset.moveDown);
      btn.addEventListener('click', () => {
        if (i >= pageOrder.length - 1) return;
        [pageOrder[i], pageOrder[i + 1]] = [pageOrder[i + 1], pageOrder[i]];
        renderGrid();
      });
    });
  }

  async function loadFile(file: File) {
    const v = validatePdfFile(file);
    if (!v.valid) { showError(v.error!); return; }

    clearError();
    hide(thumbArea);
    hide(resultPanel);
    show(workArea);
    show(thumbLoading);

    try {
      currentBytes = await readFileAsUint8Array(file);
      currentFile = file;
      thumbSrcs = await renderThumbnails(currentBytes, 160);
      pageOrder = thumbSrcs.map((_, i) => i);
      countEl.textContent = `${file.name} · ${formatBytes(file.size)} · ${thumbSrcs.length} pages`;
      renderGrid();
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
    currentFile = null; currentBytes = null; pageOrder = []; thumbSrcs = [];
    hide(workArea); show(dropZone); hide(resultPanel); clearError();
  });
  btnBack.addEventListener('click', () => { window.location.hash = '#tools'; });

  btnSave.addEventListener('click', async () => {
    if (!currentBytes || !currentFile) return;

    hide(thumbArea);
    show(processingState);
    hide(resultPanel);
    if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }

    try {
      const result = await reorderPages(currentBytes, pageOrder, (msg) => { processingMsg.textContent = msg; });
      const filename = `${stripPdfExtension(currentFile.name)}-reordered.pdf`;
      const blob = new Blob([result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength) as ArrayBuffer], { type: "application/pdf" });
      resultUrl = URL.createObjectURL(blob);

      resultList.innerHTML = /* html */ `
        <div class="result-item">
          <div class="result-item-body">
            <div class="result-item-name">${filename}</div>
            <div class="result-item-meta">${formatBytes(result.length)}</div>
          </div>
          <a class="btn-download" href="${resultUrl}" download="${filename}">${ICON_DOWNLOAD} Download</a>
        </div>
      `;

      hide(processingState);
      show(resultPanel);
      show(thumbArea);
      show(workArea);
    } catch (err) {
      console.error('Reorder failed:', err);
      hide(processingState);
      show(thumbArea);
      show(workArea);
      showError(err instanceof Error ? err.message : 'Could not create reordered PDF.');
    }
  });

  return () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  };
}
