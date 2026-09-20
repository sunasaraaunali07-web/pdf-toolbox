/**
 * Footer component
 */

export function renderFooter(): string {
  return /* html */ `
    <footer class="site-footer" role="contentinfo">
      <div class="container footer-inner">
        <a href="/" class="logo logo--footer" aria-label="PDF Toolbox home">
          <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               aria-hidden="true" focusable="false" width="22" height="22">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span class="logo-text">PDF<strong>Toolbox</strong></span>
        </a>
        <p class="footer-tagline">Fast, free &amp; private PDF tools — right in your browser.</p>
        <p class="footer-copy">&copy; ${new Date().getFullYear()} PDFToolbox. All rights reserved.</p>
      </div>
    </footer>
  `;
}
