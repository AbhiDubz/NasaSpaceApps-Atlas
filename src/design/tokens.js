/**
 * ATLAS design tokens — Phase 3 design system foundation.
 * CSS custom properties in index.css remain source of truth for runtime;
 * this module exports JS-accessible tokens for components and export UI.
 */
export const colors = {
  bg: '#070b12',
  glass: 'rgba(255, 255, 255, 0.03)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  accent: '#6a9fb2',
  text: '#e6edf5',
  textMuted: '#8b9bb0',
  priority: {
    p1: '#e85a5a',
    p2: '#d4a24a',
    p3: '#5a8fc4',
  },
  dimension: {
    safety: '#E24B4A',
    governance: '#7F77DD',
    economy: '#EF9F27',
    people: '#1D9E75',
    environment: '#7CB342',
    narrative: '#378ADD',
  },
  /* Geolocation precision tiers — the trust layer (SOURCE_GEOLOCATION_REFERENCE.md) */
  tier: {
    a: '#2fd08c',
    b: '#ffaa00',
    c: '#94a3b8',
  },
  derived: '#f0b429',
  report: {
    sitrep: '#1a365d',
    executive: '#c05621',
    ngo: '#276749',
    journalism: '#553c9a',
    general: '#2d3748',
  },
}

export const typography = {
  data: "'JetBrains Mono', ui-monospace, monospace",
  ui: "'Source Sans 3', 'Segoe UI', system-ui, sans-serif",
  hud: "'JetBrains Mono', ui-monospace, monospace",
  wordmark: "'Bebas Neue', sans-serif",
  reportSerif: "'Georgia', 'Times New Roman', serif",
  reportMono: "'JetBrains Mono', ui-monospace, monospace",
}

export const spacing = {
  hudPadding: 16,
  panelGap: 12,
  panelRadius: 4,
  chipRadius: 4,
}

export const motion = {
  fast: '150ms',
  normal: '300ms',
  easeOutExpo: 'cubic-bezier(0.16, 1, 0.3, 1)',
}

export const zIndex = {
  globe: 10,
  ticker: 30,
  hud: 40,
  rail: 45,
  modal: 100,
}

/** Panel chrome class names — use with Panel component */
export const panelChrome = {
  root: 'atlas-panel',
  header: 'atlas-panel__header',
  title: 'atlas-panel__title',
  provenance: 'atlas-panel__provenance',
  body: 'atlas-panel__body',
  footer: 'atlas-panel__footer',
}
