/**
 * Rotate Pages page
 */

import { rotatePages } from '../services/pdfRotate';
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
const ICON_ROT_CW  = svgIcon(`<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.41"/>`, 14);
const ICON_ROT_CCW = svgIcon(`<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-3.41"/>`, 14);
const ICON_CHECK = svgIcon(`<polyline points="20 6 9 17 4 12"/>`, 20);

export function render(): string {
  return /* html */ `
<div class="tool-page">
  <div class="container">
    <header class="tool-page-header">
      <button class="btn-back" id="btn-back">${ICON_BACK} All Tools</button>
      <h1 class="tool-page-title">Rotate Pages</h1>
      <p class="tool-page-desc">Rotate individual pages or all pages at once, then download the result.</p>
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
          <span style="font-size:var(--text-sm);color:var(--color-text-muted)">
            Use ↺ ↻ on each page, or rotate all at once below
          </span>
          <div style="display:flex;gap:var(--space-2)">
            <button class="btn btn-secondary" id="btn-rotate-all-ccw" style="padding:var(--space-1) var(--space-3);font-size:var(--text-sm);display:flex;align-items:center;gap:4px">
              ${ICON_ROT_CCW} All CCW
            </button>
            <button class="btn btn-secondary" id="btn-rotate-all-cw" style="padding:var(--space-1) var(--space-3);font-size:var(--text-sm);display:flex;align-items:center;gap:4px">
              ${ICON_ROT_CW} All CW
            </button>
          </div>
        </div>

        <div class="page-grid" id="page-grid" role="list" aria-label="PDF pages"></div>

        <div class="action-row">
          <button class="btn btn-primary" id="btn-apply">${ICON_DOWNLOAD} Apply & Download</button>
          <button class="btn btn-secondary" id="btn-reset">Reset rotations</button>
        </div>
      </div>
    </div>

    <div id="processing-state" class="processing-state hidden">
      <div class="spinner" role="status"></div>
      <p class="processing-message">Applying rotations…</p>
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
  const btnApply = document.getElementById('btn-apply') as HTMLButtonElement;
  const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;
  const btnChange = document.getElementById('btn-change') as HTMLButtonElement;
  const btnRotateAllCw = document.getElementById('btn-rotate-all-cw') as HTMLButtonElement;
  const btnRotateAllCcw = document.getElementById('btn-rotate-all-ccw') as HTMLButtonElement;
  const btnBack = document.getElementById('btn-back') as HTMLButtonElement;
  const thumbLoading = document.getElementById('thumb-loading')!;
  const thumbArea = document.getElementById('thumb-area')!;
  const pageGrid = document.getElementById('page-grid')!;
  const processingState = document.getElementById('processing-state')!;
  const resultPanel = document.getElementById('result-panel')!;
  const resultList = document.getElementById('result-list')!;
  const errorPanel = document.getElementById('error-panel')!;
  const errorMsg = document.getElementById('error-message')!;

  let currentFile: File | null = null;
  let currentBytes: Uint8Array | null = null;
  // rotations[i] = cumulative additional rotation in degrees (0, 90, 180, 270)
  let rotations: number[] = [];
  let thumbSrcs: string[] = [];
  let resultUrl: string | null = null;

  function show(el: HTMLElement) { el.classList.remove('hidden'); }
  function hide(el: HTMLElement) { el.classList.add('hidden'); }
  function showError(msg: string) { errorMsg.textContent = msg; show(errorPanel); }
  function clearError() { hide(errorPanel); }

  function renderGrid() {
    pageGrid.innerHTML = thumbSrcs.map((src, i) => {
      const rot = rotations[i];
      const hasRotation = rot !== 0;
      return /* html */ `
        <div class="page-thumb" data-page="${i}" role="listitem" style="overflow:visible">
          <div style="transform:rotate(${rot}deg);transition:transform 0.2s;transform-origin:center;display:flex;align-items:center;justify-content:center;aspect-ratio:0.707">
            <img src="${src}" alt="Page ${i + 1}" style="width:100%;height:100%;object-fit:contain">
          </div>
          <div class="page-thumb-label">Page ${i + 1}</div>
          ${hasRotation ? `<div class="page-thumb-rotation-badge">${rot}°</div>` : ''}
          <div class="page-thumb-rotation">
            <button class="btn-rotate-page" data-rotate-ccw="${i}" title="Rotate 90° counter-clockwise">${ICON_ROT_CCW}</button>
            <button class="btn-rotate-page" data-rotate-cw="${i}" title="Rotate 90° clockwise">${ICON_ROT_CW}</button>
          </div>
        </div>
      `;
    }).join('');

    pageGrid.querySelectorAll<HTMLButtonElement>('[data-rotate-cw]').forEach((btn) => {
      const i = Number(btn.dataset.rotateCw);
      btn.addEventListener('click', () => {
        rotations[i] = (rotations[i] + 90) % 360;
        renderGrid();
      });
    });

    pageGrid.querySelectorAll<HTMLButtonElement>('[data-rotate-ccw]').forEach((btn) => {
      const i = Number(btn.dataset.rotateCcw);
      btn.addEventListener('click', () => {
        rotations[i] = (rotations[i] + 270) % 360; // +270 = -90 mod 360
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
      rotations = thumbSrcs.map(() => 0);
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
    currentFile = null; currentBytes = null; rotations = []; thumbSrcs = [];
    hide(workArea); show(dropZone); hide(resultPanel); clearError();
  });
  btnReset.addEventListener('click', () => { rotations = rotations.map(() => 0); renderGrid(); });
  btnRotateAllCw.addEventListener('click', () => {
    rotations = rotations.map((r) => (r + 90) % 360); renderGrid();
  });
  btnRotateAllCcw.addEventListener('click', () => {
    rotations = rotations.map((r) => (r + 270) % 360); renderGrid();
  });
  btnBack.addEventListener('click', () => { window.location.hash = '#tools'; });

  btnApply.addEventListener('click', async () => {
    if (!currentBytes || !currentFile) return;

    const rotationMap = new Map<number, number>();
    rotations.forEach((deg, i) => { if (deg !== 0) rotationMap.set(i, deg); });

    if (rotationMap.size === 0) {
      showError('No rotations applied. Use the ↺ ↻ buttons to rotate pages first.');
      return;
    }

    hide(thumbArea);
    show(processingState);
    hide(resultPanel);
    if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }

    try {
      const result = await rotatePages(currentBytes, rotationMap);
      const filename = `${stripPdfExtension(currentFile.name)}-rotated.pdf`;
      const blob = new Blob([result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength) as ArrayBuffer], { type: "application/pdf" });
      resultUrl = URL.createObjectURL(blob);

      resultList.innerHTML = /* html */ `
        <div class="result-item">
          <div class="result-item-body">
            <div class="result-item-name">${filename}</div>
            <div class="result-item-meta">${rotationMap.size} page${rotationMap.size !== 1 ? 's' : ''} rotated · ${formatBytes(result.length)}</div>
          </div>
          <a class="btn-download" href="${resultUrl}" download="${filename}">${ICON_DOWNLOAD} Download</a>
        </div>
      `;

      hide(processingState);
      show(resultPanel);
      show(thumbArea);
      show(workArea);
    } catch (err) {
      console.error('Rotate failed:', err);
      hide(processingState);
      show(thumbArea);
      show(workArea);
      showError(err instanceof Error ? err.message : 'Could not apply rotations.');
    }
  });

  return () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  };
}
