/**
 * ToolGrid component
 * Renders tool cards from the registry. Fully driven by registry.ts — no changes
 * required here when adding a new tool.
 */

import { TOOLS, type ToolDefinition } from '../tools/registry';

function renderToolCard(tool: ToolDefinition): string {
  const isComingSoon = tool.status === 'coming-soon';

  return /* html */ `
    <li class="tool-card-wrapper">
      <a
        href="${isComingSoon ? 'javascript:void(0)' : tool.href}"
        class="tool-card${isComingSoon ? ' tool-card--disabled' : ''}"
        data-tool-id="${tool.id}"
        data-accent="${tool.accentColor ?? ''}"
        ${isComingSoon ? 'aria-disabled="true" tabindex="0"' : ''}
        aria-label="${tool.title}${isComingSoon ? ' (coming soon)' : ''}"
      >
        <div class="tool-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
               width="28" height="28">
            ${tool.icon}
          </svg>
        </div>
        <div class="tool-card__body">
          <h3 class="tool-card__title">${tool.title}</h3>
          <p class="tool-card__desc">${tool.description}</p>
        </div>
        ${isComingSoon ? '<span class="badge badge--soon">Soon</span>' : ''}
      </a>
    </li>
  `;
}

export function renderToolGrid(): string {
  const cards = TOOLS.map(renderToolCard).join('\n');

  return /* html */ `
    <section id="tools" class="tools-section" aria-labelledby="tools-heading">
      <div class="container">
        <div class="section-header">
          <h2 id="tools-heading" class="section-title">All Tools</h2>
          <p class="section-subtitle">Pick a tool to get started. Everything runs in your browser.</p>
        </div>
        <ul class="tool-grid" role="list">
          ${cards}
        </ul>
      </div>
    </section>
  `;
}
