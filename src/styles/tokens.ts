/**
 * Design tokens: the single source of truth (DESIGN.md).
 * This is the ONLY file allowed to contain raw hex values or font sizes.
 * Everything else consumes these through CSS custom properties (var(--…))
 * or, for JS-only consumers like Recharts/SVG, through the exported objects.
 */

export const color = {
  background: '#FFFDF5',
  foreground: '#1E293B',
  muted: '#F1F5F9',
  /** DESIGN.md slate-500. Passes AA on cream/white only; see mutedStrong. */
  mutedForeground: '#64748B',
  /** Darker muted text for use on the `muted` surface (slate-500 is 4.34:1 there). */
  mutedStrong: '#475569',
  primary: '#0077B5',
  primaryForeground: '#FFFFFF',
  /** Pressed / hover-darker primary, used for text links on cream. */
  primaryDeep: '#005A8A',
  tertiary: '#FECE66',
  tertiaryForeground: '#1E293B',
  /** Decorative only: never a background for white text. */
  secondary: '#F472B6',
  quaternary: '#34D399',
  border: '#E2E8F0',
  input: '#CBD5E1',
  card: '#FFFFFF',
  ring: '#0077B5',
  /** Error text (paired with an icon, never colour alone). */
  danger: '#B42318',
  dangerSurface: '#FEF3F2',
  /** Soft tints for decoration fills. */
  tertiarySoft: '#FFF1CC',
  secondarySoft: '#FDE2F0',
  quaternarySoft: '#D1FAE5',
  primarySoft: '#E0F0FA',
} as const;

export type ColorToken = keyof typeof color;

export const font = {
  heading: "'Outfit', system-ui, sans-serif",
  body: "'Plus Jakarta Sans', system-ui, sans-serif",
} as const;

/** Modular scale, ratio 1.25, base 16px. `xs` is for uppercase labels/captions only. */
const BASE = 16;
const RATIO = 1.25;
const step = (n: number) => `${(BASE * RATIO ** n / 16).toFixed(3)}rem`;
export const fontSize = {
  xs: step(-1), // 12.8px – labels, chart ticks
  base: step(0), // 16px – minimum body size
  lg: step(1), // 20px
  xl: step(2), // 25px
  '2xl': step(3), // 31.25px
  '3xl': step(4), // 39px
  '4xl': step(5), // 48.8px
  '5xl': step(6), // 61px
  '6xl': step(7), // 76.3px
  /** "$" / unit affix relative to the big estimate number */
  affix: '0.6em',
} as const;

/** Numeric font sizes for SVG/Recharts which need numbers, not rem strings. */
export const fontPx = {
  xs: 12.8,
  sm: 14,
  base: 16,
  lg: 20,
  xl: 25,
  /** "$" glyph inside the 100-unit coin graphic viewBox */
  coinGlyph: 40,
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;

export const radius = {
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  full: '9999px',
} as const;

export const borderWidth = '2px';

export const shadow = {
  pop: `4px 4px 0 ${color.foreground}`,
  hover: `6px 6px 0 ${color.foreground}`,
  active: `2px 2px 0 ${color.foreground}`,
  popMobile: `2px 2px 0 ${color.foreground}`,
  card: `6px 6px 0 ${color.border}`,
  cardFeatured: `6px 6px 0 ${color.secondary}`,
  cardMint: `6px 6px 0 ${color.quaternary}`,
  focus: `4px 4px 0 ${color.ring}`,
} as const;

export const space = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
} as const;

export const layout = {
  studentMax: '480px',
  pageMax: '72rem', // max-w-6xl
  tapMin: '48px',
} as const;

export const motion = {
  /** DESIGN.md spring "pop" */
  springCurve: [0.34, 1.56, 0.64, 1] as const,
  springCss: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  fast: 0.18,
  /** Item-to-item transition must be < 300ms */
  itemTransition: 0.24,
  countUp: 0.9,
} as const;

/** Chart series styling (bars always carry a dark sticker stroke for ≥3:1 non-text contrast). */
export const chart = {
  /**
   * Answer classes (spec §5.3): one colour for correct, one for named wrong patterns,
   * gray for unclassified. Validated with the dataviz CVD checker (adjacent ΔE ≥ 11.9);
   * shapes (circle / diamond / hollow) and labels carry the meaning too.
   */
  correct: color.primary,
  wrong: '#DB2777',
  unk: '#94A3B8',
  /** Neutral magnitude bars. */
  bar: color.primary,
  axis: color.mutedForeground,
  grid: color.border,
  band: '#FCE7F3',
  bandCorrect: '#E0F0FA',
  highlight: color.tertiary,
} as const;

function kebab(s: string) {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** Build the :root custom-property block from the tokens above. */
export function cssVariables(): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(color)) lines.push(`--color-${kebab(k)}: ${v};`);
  lines.push(`--font-heading: ${font.heading};`, `--font-body: ${font.body};`);
  for (const [k, v] of Object.entries(fontSize)) lines.push(`--text-${k}: ${v};`);
  for (const [k, v] of Object.entries(fontWeight)) lines.push(`--weight-${k}: ${v};`);
  for (const [k, v] of Object.entries(radius)) lines.push(`--radius-${k}: ${v};`);
  lines.push(`--border-width: ${borderWidth};`);
  for (const [k, v] of Object.entries(shadow)) lines.push(`--shadow-${kebab(k)}: ${v};`);
  for (const [k, v] of Object.entries(space)) lines.push(`--space-${k}: ${v};`);
  for (const [k, v] of Object.entries(layout)) lines.push(`--layout-${kebab(k)}: ${v};`);
  for (const [k, v] of Object.entries(chart)) lines.push(`--chart-${kebab(k)}: ${v};`);
  lines.push(`--ease-spring: ${motion.springCss};`);
  return `:root{${lines.join('')}}`;
}

/** Inject tokens as CSS variables. Called once before first render. */
export function injectCssVars(doc: Document = document) {
  const id = 'design-tokens';
  if (doc.getElementById(id)) return;
  const el = doc.createElement('style');
  el.id = id;
  el.textContent = cssVariables();
  doc.head.prepend(el);
}
