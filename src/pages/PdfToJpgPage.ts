/**
 * PDF → JPG page
 */

import { pdfToJpeg } from '../services/pdfToImages';
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
const ICON_CHECK = svgIcon(`<polyline points="20 6 9 17 4 12"/>`, 14);

export function render(): string {
  return /* html */ `
<div class="tool-page">
  <div class="container">
    <header class="tool-page-header">
      <button class="btn-back" id="btn-back">${ICON_BACK} All Tools</button>
      <h1 class="tool-page-title">PDF to JPG</h1>
      <p class="tool-page-desc">Convert PDF pages to high-quality JPG images. Select all or individual pages.</p>
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
        <p class="processing-message">Generating page previews…</p>
      </div>

      <div id="thumb-area" class="hidden">
        <div class="page-selection-header">
          <span style="font-size:var(--text-sm);font-weight:var(--weight-semibold)" id="selection-count"></span>
          <div class="page-selection-actions">
            <button class="btn btn-secondary btn-select-all" id="btn-select-all" style="padding:var(--space-1) var(--space-3)">Select all</button>
            <button class="btn btn-secondary btn-deselect-all" id="btn-deselect-all" style="padding:var(--space-1) var(--space-3)">Deselect all</button>
          </div>
        </div>
        <div class="page-grid" id="page-grid" role="list" aria-label="PDF pages"></div>
      </div>

      <div class="action-row" id="action-row" style="display:none">
        <button class="btn btn-primary" id="btn-convert">Convert Selected to JPG</button>
      </div>
    </div>

    <div id="processing-state" class="processing-state hidden">
      <div class="spinner" role="status"></div>
      <p class="processing-message" id="processing-message">Converting…</p>
      <div class="progress-wrap"><div class="progress-bar" id="progress-bar" style="width:0%"></div></div>
    </div>

    <div id="result-panel" class="result-panel hidden">
      <h2 class="result-panel-title">${ICON_CHECK} Conversion complete</h2>
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
  const btnConvert = document.getElementById('btn-convert') as HTMLButtonElement;
  const btnChange = document.getElementById('btn-change') as HTMLButtonElement;
  const btnSelectAll = document.getElementById('btn-select-all') as HTMLButtonElement;
  const btnDeselectAll = document.getElementById('btn-deselect-all') as HTMLButtonElement;
  const btnBack = document.getElementById('btn-back') as HTMLButtonElement;
  const thumbLoading = document.getElementById('thumb-loading')!;
  const thumbArea = document.getElementById('thumb-area')!;
  const pageGrid = document.getElementById('page-grid')!;
  const actionRow = document.getElementById('action-row') as HTMLElement;
  const selectionCount = document.getElementById('selection-count')!;
  const processingState = document.getElementById('processing-state')!;
  const processingMsg = document.getElementById('processing-message')!;
  const progressBar = document.getElementById('progress-bar') as HTMLElement;
  const resultPanel = document.getElementById('result-panel')!;
  const resultList = document.getElementById('result-list')!;
  const errorPanel = document.getElementById('error-panel')!;
  const errorMsg = document.getElementById('error-message')!;

  let currentFile: File | null = null;
  let currentBytes: Uint8Array | null = null;
  let numPages = 0;
  let selectedPages: Set<number> = new Set();
  const resultUrls: string[] = [];

  function show(el: HTMLElement) { el.classList.remove('hidden'); }
  function hide(el: HTMLElement) { el.classList.add('hidden'); }
  function showError(msg: string) { errorMsg.textContent = msg; show(errorPanel); }
  function clearError() { hide(errorPanel); }

  function updateSelectionUI() {
    const n = selectedPages.size;
    selectionCount.textContent = n === 0
      ? 'No pages selected'
      : `${n} page${n !== 1 ? 's' : ''} selected`;
    actionRow.style.display = n > 0 ? '' : 'none';
    btnConvert.textContent = `Convert ${n} Page${n !== 1 ? 's' : ''} to JPG`;

    pageGrid.querySelectorAll<HTMLElement>('.page-thumb').forEach((el) => {
      const p = Number(el.dataset.page);
      el.classList.toggle('selected', selectedPages.has(p));
    });
  }

  async function loadFile(file: File) {
    const v = validatePdfFile(file);
    if (!v.valid) { showError(v.error!); return; }

    clearError();
    hide(thumbArea);
    hide(resultPanel);
    actionRow.style.display = 'none';
    show(workArea);
    show(thumbLoading);
    selectedPages = new Set();

    try {
      currentBytes = await readFileAsUint8Array(file);
      currentFile = file;

      const thumbs = await renderThumbnails(currentBytes, 160, (_done, total) => {
        numPages = total;
        countEl.textContent = `${file.name} · ${formatBytes(file.size)} · ${total} pages`;
        // Select all pages by default
        for (let i = 1; i <= total; i++) selectedPages.add(i);

        pageGrid.innerHTML = thumbs.map((src, i) => /* html */ `
          <div class="page-thumb ${selectedPages.has(i + 1) ? 'selected' : ''}" data-page="${i + 1}"
               role="listitem" aria-label="Page ${i + 1}" tabindex="0">
            <img src="${src}" alt="Page ${i + 1}" loading="lazy">
            <div class="page-thumb-label">Page ${i + 1}</div>
            <div class="page-thumb-check">${ICON_CHECK}</div>
          </div>
        `).join('');

        attachThumbHandlers();
        hide(thumbLoading);
        show(thumbArea);
        updateSelectionUI();
      });

      // Update after all thumbs are done
      numPages = thumbs.length;
      pageGrid.innerHTML = thumbs.map((src, i) => /* html */ `
        <div class="page-thumb ${selectedPages.has(i + 1) ? 'selected' : ''}" data-page="${i + 1}"
             role="listitem" aria-label="Page ${i + 1}" tabindex="0">
          <img src="${src}" alt="Page ${i + 1}" loading="lazy">
          <div class="page-thumb-label">Page ${i + 1}</div>
          <div class="page-thumb-check">${ICON_CHECK}</div>
        </div>
      `).join('');
      attachThumbHandlers();
      hide(thumbLoading);
      show(thumbArea);
      updateSelectionUI();
    } catch (err) {
      hide(thumbLoading);
      showError(err instanceof Error ? err.message : 'Could not open PDF.');
    }
  }

  function attachThumbHandlers() {
    pageGrid.querySelectorAll<HTMLElement>('.page-thumb').forEach((el) => {
      const page = Number(el.dataset.page);
      const toggle = () => {
        if (selectedPages.has(page)) selectedPages.delete(page);
        else selectedPages.add(page);
        updateSelectionUI();
      };
      el.addEventListener('click', toggle);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') toggle(); });
    });
  }

  btnSelectAll.addEventListener('click', () => {
    for (let i = 1; i <= numPages; i++) selectedPages.add(i);
    updateSelectionUI();
  });
  btnDeselectAll.addEventListener('click', () => { selectedPages.clear(); updateSelectionUI(); });

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
    currentFile = null;
    currentBytes = null;
    selectedPages.clear();
    hide(workArea);
    show(dropZone);
    hide(resultPanel);
    clearError();
  });

  btnBack.addEventListener('click', () => { window.location.hash = ''; });

  btnConvert.addEventListener('click', async () => {
    if (!currentBytes || !currentFile || selectedPages.size === 0) return;

    hide(workArea);
    show(processingState);
    hide(resultPanel);
    resultUrls.forEach((u) => URL.revokeObjectURL(u));
    resultUrls.length = 0;

    try {
      const pageNums = Array.from(selectedPages).sort((a, b) => a - b);
      const images = await pdfToJpeg(currentBytes, pageNums, 2, 0.92, (done, total) => {
        processingMsg.textContent = `Converting page ${done} of ${total}…`;
        progressBar.style.width = `${(done / total * 100).toFixed(0)}%`;
      });

      const baseName = stripPdfExtension(currentFile.name);
      resultList.innerHTML = images.map(({ pageNumber, blob }) => {
        const filename = `${baseName}-page-${String(pageNumber).padStart(2, '0')}.jpg`;
        const url = URL.createObjectURL(blob);
        resultUrls.push(url);
        return /* html */ `
          <div class="result-item">
            <div class="result-item-body">
              <div class="result-item-name">${filename}</div>
              <div class="result-item-meta">Page ${pageNumber} · ${formatBytes(blob.size)}</div>
            </div>
            <a class="btn-download" href="${url}" download="${filename}">${ICON_DOWNLOAD} Download</a>
          </div>
        `;
      }).join('');

      hide(processingState);
      show(resultPanel);
      show(workArea);
    } catch (err) {
      console.error('Conversion failed:', err);
      hide(processingState);
      show(workArea);
      showError(err instanceof Error ? err.message : 'Conversion failed.');
    }
  });

  return () => {
    resultUrls.forEach((u) => URL.revokeObjectURL(u));
  };
}
