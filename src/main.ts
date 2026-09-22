/**
 * Main application entry point
 *
 * Architecture:
 *   - Header and Footer are always mounted (sticky header needs to remain).
 *   - <main id="main-content"> is replaced on every navigation.
 *   - Hash-based router: window.location.hash == '' → home, '#merge' → MergePage, etc.
 *   - Each tool page module exports render(): string and init(): () => void.
 *     The cleanup function returned by init() is called before navigating away.
 */

import './styles/tokens.css';
import './styles/reset.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/utilities.css';
import './styles/tool-page.css';

import { renderHeader, initHeader } from './components/Header';
import { renderHero } from './components/Hero';
import { renderToolGrid } from './components/ToolGrid';
import { renderHowItWorks } from './components/HowItWorks';
import { renderFooter } from './components/Footer';

// Import all tool pages statically (tree-shakeable, no dynamic import needed at this scale)
import * as MergePage       from './pages/MergePage';
import * as CompressPage    from './pages/CompressPage';
import * as SplitPage       from './pages/SplitPage';
import * as PdfToJpgPage    from './pages/PdfToJpgPage';
import * as JpgToPdfPage    from './pages/JpgToPdfPage';
import * as ReorderPage     from './pages/ReorderPage';
import * as DeletePagesPage from './pages/DeletePagesPage';
import * as RotatePagesPage from './pages/RotatePagesPage';

// ── Page registry ─────────────────────────────────────────────────────────────

interface PageModule {
  render: () => string;
  init: () => () => void;
}

const PAGE_MAP: Record<string, PageModule> = {
  'merge':        MergePage,
  'compress':     CompressPage,
  'split':        SplitPage,
  'pdf-to-jpg':   PdfToJpgPage,
  'jpg-to-pdf':   JpgToPdfPage,
  'reorder':      ReorderPage,
  'delete-pages': DeletePagesPage,
  'rotate':       RotatePagesPage,
};

// ── Router ────────────────────────────────────────────────────────────────────

let currentCleanup: (() => void) | null = null;

function getHash(): string {
  // e.g. '#merge' → 'merge', '' → ''
  return window.location.hash.replace(/^#/, '').toLowerCase();
}

function navigate(): void {
  const hash = getHash();

  // Run previous page cleanup
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  const main = document.getElementById('main-content');
  if (!main) return;

  const page = PAGE_MAP[hash];

  if (page) {
    // Render tool page
    main.innerHTML = page.render();
    // Scroll to top of content
    main.scrollIntoView({ behavior: 'instant' });
    // Wire up interactive behaviour
    currentCleanup = page.init();
    // Update document title
    document.title = `${hash.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')} — PDF Toolbox`;
  } else if (hash === 'tools') {
    // Tools selection page — shows only the tool grid (no hero / how-it-works).
    // All tool "Back" buttons navigate here.
    main.innerHTML = renderToolGrid();
    main.scrollIntoView({ behavior: 'instant' });
    document.title = 'PDF Toolbox — All Tools';
  } else {
    // Full home page (hero + tools + how it works)
    main.innerHTML = [
      renderHero(),
      renderToolGrid(),
      renderHowItWorks(),
    ].join('\n');
    document.title = 'PDF Toolbox — Free Online PDF Tools';
  }
}

// ── Mount ─────────────────────────────────────────────────────────────────────

function mount(): void {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app element not found');

  app.innerHTML = [
    renderHeader(),
    '<main id="main-content">',
    // Initial content is injected by navigate() below
    '</main>',
    renderFooter(),
  ].join('\n');

  // Initialise interactive behaviours
  initHeader();

  // Listen for hash changes
  window.addEventListener('hashchange', navigate);

  // Initial render based on current URL hash
  navigate();
}

mount();
