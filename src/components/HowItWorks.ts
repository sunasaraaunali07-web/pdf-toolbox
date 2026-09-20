/**
 * HowItWorks section component
 */

interface Step {
  number: string;
  title: string;
  description: string;
  icon: string;
}

const STEPS: Step[] = [
  {
    number: '01',
    title: 'Select a tool',
    description: 'Choose the PDF operation you need from the grid above.',
    icon: `<path d="M15 15l6 6m-11-4a7 7 0 1 1 0-14 7 7 0 0 1 0 14z"/>`,
  },
  {
    number: '02',
    title: 'Upload your file',
    description: 'Drag & drop or pick files directly from your device.',
    icon: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
           <polyline points="17 8 12 3 7 8"/>
           <line x1="12" y1="3" x2="12" y2="15"/>`,
  },
  {
    number: '03',
    title: 'Process & download',
    description: 'Your file is processed locally, then downloaded instantly.',
    icon: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
           <polyline points="7 10 12 15 17 10"/>
           <line x1="12" y1="15" x2="12" y2="3"/>`,
  },
];

export function renderHowItWorks(): string {
  const steps = STEPS.map(
    (step) => /* html */ `
      <li class="step">
        <div class="step__number" aria-hidden="true">${step.number}</div>
        <div class="step__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
               width="26" height="26">
            ${step.icon}
          </svg>
        </div>
        <h3 class="step__title">${step.title}</h3>
        <p class="step__desc">${step.description}</p>
      </li>
    `
  ).join('\n');

  return /* html */ `
    <section id="how-it-works" class="how-section" aria-labelledby="how-heading">
      <div class="container">
        <div class="section-header">
          <h2 id="how-heading" class="section-title">How it works</h2>
          <p class="section-subtitle">Three simple steps, nothing to install.</p>
        </div>
        <ol class="steps-list" role="list">
          ${steps}
        </ol>
      </div>
    </section>
  `;
}
