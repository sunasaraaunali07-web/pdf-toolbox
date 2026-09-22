/**
 * JPG → PDF page
 */

import { imagesToPdf } from '../services/imagesToPdf';
import { validateImageFile, formatBytes } from '../utils/fileUtils';

function svgIcon(paths: string, size = 16): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    width="${size}" height="${size}" aria-hidden="true">${paths}</svg>`;
}

const ICON_BACK = svgIcon(`<polyline points="15 18 9 12 15 6"/>`, 16);
const ICON_UPLOAD = svgIcon(`<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>`, 40);
const ICON_DRAG = svgIcon(`<line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/>`, 14);
const ICON_REMOVE = svgIcon(`<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`, 14);
const ICON_DOWNLOAD = svgIcon(`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`, 16);
const ICON_CHECK = svgIcon(`<polyline points="20 6 9 17 4 12"/>`, 20);

export function render(): string {
  return /* html */ `
<div class="tool-page">
  <div class="container">
    <header class="tool-page-header">
      <button class="btn-back" id="btn-back">${ICON_BACK} All Tools</button>
      <h1 class="tool-page-title">JPG to PDF</h1>
      <p class="tool-page-desc">Convert JPG, PNG, or WebP images into a single PDF. Drag to reorder.</p>
    </header>

    <div class="drop-zone" id="drop-zone" role="button" tabindex="0">
      <div class="drop-zone-icon">${ICON_UPLOAD}</div>
      <p class="drop-zone-text">Drop images here, or <span class="drop-zone-link">choose files</span></p>
      <p class="drop-zone-hint">JPG, PNG, WebP · Multiple files allowed</p>
      <input type="file" id="file-input" hidden accept="image/jpeg,image/jpg,image/png,image/webp" multiple>
    </div>

    <div id="work-area" class="hidden">
      <div class="work-area-header">
        <span class="work-area-count" id="work-area-count"></span>
        <button class="btn-add-more" id="btn-add-more">+ Add more images</button>
        <input type="file" id="add-more-input" hidden accept="image/jpeg,image/jpg,image/png,image/webp" multiple>
      </div>

      <ul class="file-list" id="file-list" aria-label="Selected images"></ul>

      <div class="action-row">
        <button class="btn btn-primary" id="btn-convert">Convert to PDF</button>
        <button class="btn btn-secondary" id="btn-clear">Clear all</button>
      </div>
    </div>

    <div id="processing-state" class="processing-state hidden">
      <div class="spinner" role="status"></div>
      <p class="processing-message" id="processing-message">Creating PDF…</p>
      <div class="progress-wrap"><div class="progress-bar" id="progress-bar" style="width:0%"></div></div>
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

interface ImageEntry {
  id: string;
  file: File;
  previewUrl: string;
}

export function init(): () => void {
  const dropZone = document.getElementById('drop-zone')!;
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const addMoreInput = document.getElementById('add-more-input') as HTMLInputElement;
  const workArea = document.getElementById('work-area')!;
  const fileListEl = document.getElementById('file-list')!;
  const countEl = document.getElementById('work-area-count')!;
  const btnConvert = document.getElementById('btn-convert') as HTMLButtonElement;
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

  let images: ImageEntry[] = [];
  let idCounter = 0;
  let dragSrcId: string | null = null;
  let resultUrl: string | null = null;

  function show(el: HTMLElement) { el.classList.remove('hidden'); }
  function hide(el: HTMLElement) { el.classList.add('hidden'); }
  function showError(msg: string) { errorMsg.textContent = msg; show(errorPanel); }
  function clearError() { hide(errorPanel); }

  function updateUI() {
    clearError();
    hide(resultPanel);
    if (images.length === 0) { hide(workArea); return; }
    show(workArea);
    countEl.textContent = `${images.length} image${images.length !== 1 ? 's' : ''}`;
    renderList();
  }

  function renderList() {
    fileListEl.innerHTML = images.map((entry) => /* html */ `
      <li class="file-item" draggable="true" data-id="${entry.id}">
        <span class="file-item-drag-handle">${ICON_DRAG}</span>
        <img src="${entry.previewUrl}" alt="${entry.file.name}"
          style="width:40px;height:40px;object-fit:cover;border-radius:var(--radius-sm);flex-shrink:0">
        <div class="file-item-body">
          <div class="file-item-name">${entry.file.name}</div>
          <div class="file-item-meta">${formatBytes(entry.file.size)}</div>
        </div>
        <button class="btn-remove" data-remove="${entry.id}">${ICON_REMOVE}</button>
      </li>
    `).join('');

    fileListEl.querySelectorAll<HTMLElement>('.file-item').forEach((item) => {
      const id = item.dataset.id!;
      item.addEventListener('dragstart', () => { dragSrcId = id; item.classList.add('dragging'); });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        dragSrcId = null;
        fileListEl.querySelectorAll('.file-item').forEach((i) => i.classList.remove('drag-target'));
      });
      item.addEventListener('dragover', (e) => { e.preventDefault(); if (dragSrcId && dragSrcId !== id) item.classList.add('drag-target'); });
      item.addEventListener('dragleave', () => item.classList.remove('drag-target'));
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drag-target');
        if (!dragSrcId || dragSrcId === id) return;
        const si = images.findIndex((img) => img.id === dragSrcId);
        const di = images.findIndex((img) => img.id === id);
        if (si < 0 || di < 0) return;
        const [rem] = images.splice(si, 1);
        images.splice(di, 0, rem);
        updateUI();
      });
    });

    fileListEl.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.remove!;
        const entry = images.find((img) => img.id === id);
        if (entry) URL.revokeObjectURL(entry.previewUrl);
        images = images.filter((img) => img.id !== id);
        updateUI();
      });
    });
  }

  function addImages(files: File[]) {
    for (const file of files) {
      const v = validateImageFile(file);
      if (!v.valid) { showError(v.error!); continue; }
      const previewUrl = URL.createObjectURL(file);
      images.push({ id: String(idCounter++), file, previewUrl });
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
    addImages(Array.from(e.dataTransfer?.files ?? []));
  });

  fileInput.addEventListener('change', () => { addImages(Array.from(fileInput.files ?? [])); fileInput.value = ''; });
  btnAddMore.addEventListener('click', () => addMoreInput.click());
  addMoreInput.addEventListener('change', () => { addImages(Array.from(addMoreInput.files ?? [])); addMoreInput.value = ''; });
  btnClear.addEventListener('click', () => {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    images = [];
    updateUI();
  });
  btnBack.addEventListener('click', () => { window.location.hash = '#tools'; });

  btnConvert.addEventListener('click', async () => {
    if (images.length === 0) return;
    hide(workArea);
    show(processingState);
    hide(resultPanel);
    if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }

    try {
      const orderedFiles = images.map((img) => img.file);
      const pdfBytes = await imagesToPdf(orderedFiles, (done, total) => {
        processingMsg.textContent = `Embedding image ${done} of ${total}…`;
        progressBar.style.width = `${(done / total * 100).toFixed(0)}%`;
      });

      const filename = 'images-converted.pdf';
      const blob = new Blob([pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer], { type: "application/pdf" });
      resultUrl = URL.createObjectURL(blob);

      resultList.innerHTML = /* html */ `
        <div class="result-item">
          <div class="result-item-body">
            <div class="result-item-name">${filename}</div>
            <div class="result-item-meta">${formatBytes(pdfBytes.length)} · ${images.length} image${images.length !== 1 ? 's' : ''}</div>
          </div>
          <a class="btn-download" href="${resultUrl}" download="${filename}">${ICON_DOWNLOAD} Download PDF</a>
        </div>
      `;

      hide(processingState);
      show(resultPanel);
      show(workArea);
    } catch (err) {
      console.error('JPG→PDF failed:', err);
      hide(processingState);
      show(workArea);
      showError(err instanceof Error ? err.message : 'Conversion failed.');
    }
  });

  return () => {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  };
}
