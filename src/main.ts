/**
 * Main application entry point
 * Composes components and mounts the app.
 */

import './styles/tokens.css';
import './styles/reset.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/utilities.css';

import { renderHeader, initHeader } from './components/Header';
import { renderHero } from './components/Hero';
import { renderToolGrid } from './components/ToolGrid';
import { renderHowItWorks } from './components/HowItWorks';
import { renderFooter } from './components/Footer';

function mount(): void {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app element not found');

  app.innerHTML = [
    renderHeader(),
    '<main id="main-content">',
    renderHero(),
    renderToolGrid(),
    renderHowItWorks(),
    '</main>',
    renderFooter(),
  ].join('\n');

  // Initialise interactive behaviours after DOM is ready
  initHeader();
}

mount();
