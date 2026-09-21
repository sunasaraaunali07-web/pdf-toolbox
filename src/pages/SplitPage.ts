/**
 * Split PDF page
 */

import { parsePageRanges, splitPdf } from '../services/pdfSplit';
import {
  validatePdfFile,
  readFileAsUint8Array,
  formatBytes,
  stripPdfExtension,
} from '../utils/fileUtils';
import { getPdfPageCount } from '../utils/pdfUtils';

function svgIcon(paths: string, size = 16): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    width="${size}" height="${size}" aria-hidden="true">${paths}</svg>`;
}

const ICON_BACK = svgIcon(`<polyline points="15 18 9 12 15 6"/>`, 16);
const ICON_UPLOAD = svgIcon(`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>`, 40);
const ICON_DOWNLOAD = svgIcon(`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`, 16);
const ICON_ADD = svgIcon(`<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`, 16);
const ICON_REMOVE = svgIcon(`<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`, 14);
const ICON_CHECK = svgIcon(`<polyline points="20 6 9 17 4 12"/>`, 20);

export function render(): string {
  return /* html */ `
<div class="tool-page">
  <div class="container">
    <header class="tool-page-header">
      <button class="btn-back" id="btn-back">${ICON_BACK} All Tools</button>
      <h1 class="tool-page-title">Split PDF</h1>
      <p class="tool-page-desc">Extract specific pages or ranges from a PDF into separate files.</p>
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

      <div class="split-ranges">
        <p style="font-size:var(--text-sm);font-weight:var(--weight-semibold);margin-bottom:var(--space-1)">
          Page ranges <span style="font-weight:var(--weight-normal);color:var(--color-text-muted)">(e.g. 1-3, 5, 7-10)</span>
        </p>
        <div id="ranges-list"></div>
        <button class="btn btn-secondary" id="btn-add-range" style="width:fit-content;margin-top:var(--space-2)">
          ${ICON_ADD} Add range
        </button>
      </div>

      <div id="range-error" class="error-panel hidden" role="alert"></div>

      <div class="action-row">
        <button class="btn btn-primary" id="btn-split">Split PDF</button>
        <button class="btn btn-secondary" id="btn-clear">Clear</button>
      </div>
    </div>

    <div id="processing-state" class="processing-state hidden">
      <div class="spinner" role="status"></div>
      <p class="processing-message" id="processing-message">Splitting…</p>
    </div>

    <div id="result-panel" class="result-panel hidden">
      <h2 class="result-panel-title">${ICON_CHECK} Split complete</h2>
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
  const btnSplit = document.getElementById('btn-split') as HTMLButtonElement;
  const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;
  const btnChange = document.getElementById('btn-change') as HTMLButtonElement;
  const btnAddRange = document.getElementById('btn-add-range') as HTMLButtonElement;
  const btnBack = document.getElementById('btn-back') as HTMLButtonElement;
  const rangesList = document.getElementById('ranges-list')!;
  const rangeError = document.getElementById('range-error')!;
  const processingState = document.getElementById('processing-state')!;
  const processingMsg = document.getElementById('processing-message')!;
  const resultPanel = document.getElementById('result-panel')!;
  const resultList = document.getElementById('result-list')!;
  const errorPanel = document.getElementById('error-panel')!;
  const errorMsg = document.getElementById('error-message')!;

  let currentFile: File | null = null;
  let currentBytes: Uint8Array | null = null;
  let pageCount = 0;
  let rangeIdCounter = 0;
  const resultUrls: string[] = [];

  function show(el: HTMLElement) { el.classList.remove('hidden'); }
  function hide(el: HTMLElement) { el.classList.add('hidden'); }
  function showError(msg: string) { errorMsg.textContent = msg; show(errorPanel); }
  function clearError() { hide(errorPanel); rangeError.classList.add('hidden'); }

  function addRangeRow(value = '') {
    const id = `range-${rangeIdCounter++}`;
    const div = document.createElement('div');
    div.className = 'split-range-input';
    div.dataset.rangeId = id;
    div.innerHTML = /* html */ `
      <input type="text" class="range-text-input" placeholder="e.g. 1-3" value="${value}" aria-label="Page range">
      <button class="btn-remove" data-range-id="${id}" title="Remove range">${ICON_REMOVE}</button>
    `;
    div.querySelector<HTMLButtonElement>('[data-range-id]')!.addEventListener('click', () => {
      if (rangesList.children.length > 1) div.remove();
    });
    rangesList.appendChild(div);
  }

  function getRangeInputs(): string[] {
    return Array.from(rangesList.querySelectorAll<HTMLInputElement>('.range-text-input'))
      .map((i) => i.value.trim())
      .filter(Boolean);
  }

  addRangeRow();

  btnAddRange.addEventListener('click', () => addRangeRow());

  async function loadFile(file: File) {
    const v = validatePdfFile(file);
    if (!v.valid) { showError(v.error!); return; }

    clearError();
    try {
      currentBytes = await readFileAsUint8Array(file);
      pageCount = await getPdfPageCount(currentBytes);
      currentFile = file;
      countEl.textContent = `${file.name} · ${formatBytes(file.size)} · ${pageCount} pages`;
      hide(dropZone);
      show(workArea);
    } catch (err) {
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
    currentFile = null;
    currentBytes = null;
    pageCount = 0;
    show(dropZone);
    hide(workArea);
    hide(resultPanel);
    clearError();
  });

  btnClear.addEventListener('click', () => {
    rangesList.innerHTML = '';
    addRangeRow();
    clearError();
    hide(resultPanel);
  });

  btnBack.addEventListener('click', () => { window.location.hash = ''; });

  btnSplit.addEventListener('click', async () => {
    if (!currentBytes || !currentFile) return;

    const inputRanges = getRangeInputs();
    if (inputRanges.length === 0) {
      rangeError.textContent = 'Please add at least one page range.';
      rangeError.classList.remove('hidden');
      return;
    }

    let ranges;
    try {
      ranges = parsePageRanges(inputRanges.join(', '), pageCount);
    } catch (err) {
      rangeError.textContent = err instanceof Error ? err.message : 'Invalid range.';
      rangeError.classList.remove('hidden');
      return;
    }

    rangeError.classList.add('hidden');
    hide(workArea);
    show(processingState);
    hide(resultPanel);
    resultUrls.forEach((u) => URL.revokeObjectURL(u));
    resultUrls.length = 0;

    try {
      const splitResults = await splitPdf(currentBytes, ranges, (msg) => {
        processingMsg.textContent = msg;
      });

      const baseName = stripPdfExtension(currentFile.name);
      resultList.innerHTML = splitResults.map((data, i) => {
        const label = ranges[i].label;
        const filename = `${baseName}-pages-${label}.pdf`;
        const url = URL.createObjectURL(new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer], { type: "application/pdf" }));
        resultUrls.push(url);
        const rangePages = ranges[i].end - ranges[i].start + 1;
        return /* html */ `
          <div class="result-item">
            <div class="result-item-body">
              <div class="result-item-name">${filename}</div>
              <div class="result-item-meta">${rangePages} page${rangePages !== 1 ? 's' : ''} · ${formatBytes(data.length)}</div>
            </div>
            <a class="btn-download" href="${url}" download="${filename}">${ICON_DOWNLOAD} Download</a>
          </div>
        `;
      }).join('');

      hide(processingState);
      show(resultPanel);
      show(workArea);
    } catch (err) {
      console.error('Split failed:', err);
      hide(processingState);
      show(workArea);
      showError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    }
  });

  return () => {
    resultUrls.forEach((u) => URL.revokeObjectURL(u));
  };
}
