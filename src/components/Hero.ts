/**
 * Hero section component
 */

export function renderHero(): string {
  return /* html */ `
    <section class="hero" aria-labelledby="hero-heading">
      <div class="container hero-inner">
        <div class="hero-content">
          <span class="hero-badge">100% client-side · your files never leave your device</span>
          <h1 id="hero-heading" class="hero-title">
            Every PDF tool<br>you'll ever need
          </h1>
          <p class="hero-subtitle">
            Free, fast, and private. All processing happens directly in your browser —
            no file uploads, no cloud, no account required.
          </p>
          <a href="#tools" class="btn btn-primary hero-cta">
            Get started
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                 aria-hidden="true" focusable="false" width="18" height="18">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </a>
        </div>
        <div class="hero-visual" aria-hidden="true">
          <div class="hero-pdf-stack">
            <div class="pdf-card pdf-card--back"></div>
            <div class="pdf-card pdf-card--mid"></div>
            <div class="pdf-card pdf-card--front">
              <div class="pdf-card-lines">
                <span></span><span></span><span></span><span></span><span></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}
