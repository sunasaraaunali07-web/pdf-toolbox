/**
 * Compress PDF page
 */

import { compressBatch, type CompressMode, type CompressQuality } from '../services/pdfCompress';
import {
  validatePdfFile,
  readFileAsUint8Array,
  formatBytes,
  formatCompressionRatio,
  stripPdfExtension,
  MAX_COMPRESS_FILES,
  MAX_COMPRESS_TOTAL_BYTES,
} from '../utils/fileUtils';

function svgIcon(paths: string, size = 16): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    width="${size}" height="${size}" aria-hidden="true">${paths}</svg>`;
}

const ICON_BACK = svgIcon(`<polyline points="15 18 9 12 15 6"/>`, 16);
const ICON_UPLOAD = svgIcon(`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>`, 40);
const ICON_FILE = svgIcon(`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>`, 18);
const ICON_REMOVE = svgIcon(`<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`, 16);
const ICON_DOWNLOAD = svgIcon(`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`, 16);
const ICON_CHECK = svgIcon(`<polyline points="20 6 9 17 4 12"/>`, 20);
const ICON_WARN = svgIcon(`<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`, 16);

export function render(): string {
  return /* html */ `
<div class="tool-page">
  <div class="container">
    <header class="tool-page-header">
      <button class="btn-back" id="btn-back">${ICON_BACK} All Tools</button>
      <h1 class="tool-page-title">Compress PDF</h1>
      <p class="tool-page-desc">Reduce PDF file size. Process up to ${MAX_COMPRESS_FILES} files at once. All processing happens locally in your browser.</p>
    </header>

    <div class="drop-zone" id="drop-zone" role="button" tabindex="0">
      <div class="drop-zone-icon">${ICON_UPLOAD}</div>
      <p class="drop-zone-text">Drop PDFs here, or <span class="drop-zone-link">choose files</span></p>
      <p class="drop-zone-hint">Up to ${MAX_COMPRESS_FILES} files · 50 MB total · Max 100 MB each</p>
      <input type="file" id="file-input" hidden accept=".pdf,application/pdf" multiple>
    </div>

    <div id="work-area" class="hidden">
      <div class="work-area-header">
        <span class="work-area-count" id="work-area-count"></span>
        <button class="btn-add-more" id="btn-add-more">+ Add more PDFs</button>
        <input type="file" id="add-more-input" hidden accept=".pdf,application/pdf" multiple>
      </div>
      <ul class="file-list" id="file-list"></ul>

      <div class="compress-options">
        <div class="compress-mode-group">
          <span class="compress-mode-label">Compression mode</span>
          <div class="compress-mode-options">
            <input type="radio" name="compress-mode" id="mode-lossless" class="compress-radio" value="lossless" checked>
            <label for="mode-lossless" class="compress-radio-label">
              <span class="compress-radio-title">Lossless Optimise</span>
              <span class="compress-radio-desc">Removes redundant data. No quality loss. Works on all PDFs.</span>
            </label>
            <input type="radio" name="compress-mode" id="mode-aggressive" class="compress-radio" value="aggressive">
            <label for="mode-aggressive" class="compress-radio-label">
              <span class="compress-radio-title">Aggressive (Image)</span>
              <span class="compress-radio-desc">Renders pages as images. Larger size reduction, but text becomes non-selectable.</span>
            </label>
          </div>
        </div>

        <div class="quality-group" id="quality-group" style="display:none">
          <span class="quality-group-label">Image quality</span>
          <div class="quality-options">
            <button class="quality-btn" data-quality="high">High (85%)</button>
            <button class="quality-btn active" data-quality="medium">Medium (70%)</button>
            <button class="quality-btn" data-quality="low">Low (50%)</button>
          </div>
        </div>
      </div>

      <div class="info-note" id="aggressive-note" style="display:none">
        ${ICON_WARN} In Aggressive mode the output is an image-based PDF — text will not be selectable or searchable.
      </div>

      <div class="action-row">
        <button class="btn btn-primary" id="btn-compress">Compress All</button>
        <button class="btn btn-secondary" id="btn-clear">Clear all</button>
      </div>
    </div>

    <div id="processing-state" class="processing-state hidden">
      <div class="spinner" role="status"></div>
      <p class="processing-message" id="processing-message">Processing…</p>
      <div class="progress-wrap"><div class="progress-bar" id="progress-bar" style="width:0%"></div></div>
    </div>

    <div id="result-panel" class="result-panel hidden">
      <h2 class="result-panel-title">${ICON_CHECK} Compression complete</h2>
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
  const addMoreInput = document.getElementById('add-more-input') as HTMLInputElement;
  const workArea = document.getElementById('work-area')!;
  const fileListEl = document.getElementById('file-list')!;
  const countEl = document.getElementById('work-area-count')!;
  const btnCompress = document.getElementById('btn-compress') as HTMLButtonElement;
  const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;
  const btnAddMore = document.getElementById('btn-add-more') as HTMLButtonElement;
  const btnBack = document.getElementById('btn-back') as HTMLButtonElement;
  const processingState = document.getElementById('processing-state')!;
  const processingMsg = document.getElementById('processing-message')!;
  const progressBar = document.getElementById('progress-bar') as HTMLElement;
  const resultPanel = document.getElementById('result-panel')!;
  const resultList = document.getElementById('result-list')!;
  const errorPanel = document.getElementById('error-panel')!;
  const errorMsg = document.getElementById('error-message')!;
  const qualityGroup = document.getElementById('quality-group') as HTMLElement;
  const aggressiveNote = document.getElementById('aggressive-note') as HTMLElement;

  let files: File[] = [];
  let selectedQuality: CompressQuality = 'medium';
  const resultUrls: string[] = [];

  function show(el: HTMLElement) { el.classList.remove('hidden'); }
  function hide(el: HTMLElement) { el.classList.add('hidden'); }
  function showError(msg: string) { errorMsg.textContent = msg; show(errorPanel); }
  function clearError() { hide(errorPanel); }

  function getMode(): CompressMode {
    return (document.querySelector<HTMLInputElement>('input[name="compress-mode"]:checked')?.value ?? 'lossless') as CompressMode;
  }

  function updateModeUI() {
    const isAggressive = getMode() === 'aggressive';
    qualityGroup.style.display = isAggressive ? '' : 'none';
    aggressiveNote.style.display = isAggressive ? '' : 'none';
  }

  document.querySelectorAll<HTMLInputElement>('input[name="compress-mode"]').forEach((r) => {
    r.addEventListener('change', updateModeUI);
  });

  document.querySelectorAll<HTMLButtonElement>('.quality-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.quality-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedQuality = btn.dataset.quality as CompressQuality;
    });
  });

  function updateUI() {
    clearError();
    hide(resultPanel);
    if (files.length === 0) { hide(workArea); return; }
    show(workArea);
    countEl.textContent = `${files.length} file${files.length !== 1 ? 's' : ''}`;
    renderList();
  }

  function renderList() {
    fileListEl.innerHTML = files.map((file, i) => /* html */ `
      <li class="file-item">
        <span class="file-item-icon">${ICON_FILE}</span>
        <div class="file-item-body">
          <div class="file-item-name">${file.name}</div>
          <div class="file-item-meta">${formatBytes(file.size)}</div>
        </div>
        <button class="btn-remove" data-remove="${i}" aria-label="Remove ${file.name}">${ICON_REMOVE}</button>
      </li>
    `).join('');

    fileListEl.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        files.splice(Number(btn.dataset.remove), 1);
        updateUI();
      });
    });
  }

  function addFiles(newFiles: File[]) {
    for (const file of newFiles) {
      if (files.length >= MAX_COMPRESS_FILES) {
        showError(`Maximum ${MAX_COMPRESS_FILES} files allowed.`);
        break;
      }
      const totalSize = files.reduce((s, f) => s + f.size, 0) + file.size;
      if (totalSize > MAX_COMPRESS_TOTAL_BYTES) {
        showError(`Total size exceeds 50 MB limit.`);
        break;
      }
      const v = validatePdfFile(file);
      if (!v.valid) { showError(v.error!); continue; }
      files.push(file);
    }
    updateUI();
  }

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    addFiles(Array.from(e.dataTransfer?.files ?? []));
  });

  fileInput.addEventListener('change', () => { addFiles(Array.from(fileInput.files ?? [])); fileInput.value = ''; });
  btnAddMore.addEventListener('click', () => addMoreInput.click());
  addMoreInput.addEventListener('change', () => { addFiles(Array.from(addMoreInput.files ?? [])); addMoreInput.value = ''; });
  btnClear.addEventListener('click', () => { files = []; updateUI(); });
  btnBack.addEventListener('click', () => { window.location.hash = ''; });

  btnCompress.addEventListener('click', async () => {
    if (files.length === 0) return;

    hide(workArea);
    hide(errorPanel);
    show(processingState);
    hide(resultPanel);
    resultUrls.forEach((u) => URL.revokeObjectURL(u));
    resultUrls.length = 0;

    const mode = getMode();

    try {
      const fileEntries = await Promise.all(
        files.map(async (f) => ({ bytes: await readFileAsUint8Array(f), name: f.name })),
      );

      const results = await compressBatch(
        fileEntries,
        mode,
        selectedQuality,
        (fileIndex, total, msg) => {
          processingMsg.textContent = msg;
          progressBar.style.width = `${((fileIndex / total) * 100).toFixed(0)}%`;
        },
      );

      progressBar.style.width = '100%';

      resultList.innerHTML = results.map((r) => {
        if (r.result) {
          const baseName = stripPdfExtension(r.name);
          const filename = `${baseName}-compressed.pdf`;
          const url = URL.createObjectURL(new Blob([r.result.data.buffer.slice(r.result.data.byteOffset, r.result.data.byteOffset + r.result.data.byteLength) as ArrayBuffer], { type: "application/pdf" }));
          resultUrls.push(url);
          const ratio = formatCompressionRatio(r.result.originalSize, r.result.compressedSize);
          return /* html */ `
            <div class="result-item">
              <div class="result-item-body">
                <div class="result-item-name">${filename}</div>
                <div class="result-item-meta">${formatBytes(r.result.originalSize)} → ${formatBytes(r.result.compressedSize)}</div>
                <div class="result-item-meta ${r.result.compressedSize < r.result.originalSize ? 'saved' : ''}">${ratio}</div>
              </div>
              <a class="btn-download" href="${url}" download="${filename}">${ICON_DOWNLOAD} Download</a>
            </div>
          `;
        } else {
          return /* html */ `
            <div class="result-item">
              <div class="result-item-body">
                <div class="result-item-name">${r.name}</div>
                <div class="result-item-error">${ICON_WARN} ${r.error ?? 'Processing failed.'}</div>
              </div>
            </div>
          `;
        }
      }).join('');

      hide(processingState);
      show(resultPanel);
      show(workArea);
    } catch (err) {
      console.error('Compression batch failed:', err);
      hide(processingState);
      show(workArea);
      showError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    }
  });

  return () => {
    resultUrls.forEach((u) => URL.revokeObjectURL(u));
  };
}
