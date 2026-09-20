/**
 * Header component
 * Renders the top navigation bar with logo and nav links.
 */

export function renderHeader(): string {
  return /* html */ `
    <header class="site-header" role="banner">
      <div class="container header-inner">
        <a href="/" class="logo" aria-label="PDF Toolbox home">
          <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               aria-hidden="true" focusable="false" width="28" height="28">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <span class="logo-text">PDF<strong>Toolbox</strong></span>
        </a>

        <button class="nav-toggle" id="nav-toggle" aria-expanded="false"
                aria-controls="primary-nav" aria-label="Open navigation menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               aria-hidden="true" focusable="false" width="22" height="22">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        <nav id="primary-nav" class="primary-nav" aria-label="Primary navigation">
          <ul role="list">
            <li><a href="#tools">All Tools</a></li>
            <li><a href="#how-it-works">How it works</a></li>
          </ul>
        </nav>
      </div>
    </header>
  `;
}

/**
 * Wires up the hamburger toggle for mobile nav.
 */
export function initHeader(): void {
  const toggle = document.getElementById('nav-toggle') as HTMLButtonElement;
  const nav = document.getElementById('primary-nav') as HTMLElement;

  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!isOpen));
    nav.classList.toggle('is-open', !isOpen);
  });

  // Close nav when a link inside it is clicked (SPA-style single page)
  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      toggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
    });
  });
}
