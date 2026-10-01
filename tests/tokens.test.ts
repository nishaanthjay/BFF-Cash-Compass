import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../src/lib/contrast';
import { PAIRS, color } from '../scripts/contrastPairs';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const SRC = join(__dirname, '..', 'src');
const files = walk(SRC).filter((f) => /\.(tsx?|css)$/.test(f) && !f.endsWith(join('styles', 'tokens.ts')));

describe('design tokens are the single source of truth', () => {
  it('no raw hex colours outside tokens.ts', () => {
    const offenders = files.filter((f) => /#[0-9a-fA-F]{3,8}\b/.test(readFileSync(f, 'utf8').replace(/url\(#[\w-]+\)/g, '')));
    expect(offenders).toEqual([]);
  });
  it('no literal font sizes outside tokens.ts', () => {
    const literal = /font-size:\s*[\d.]|fontSize[=:]\s*["'{]?\s*[\d.]/;
    const offenders = files.filter((f) => literal.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

describe('WCAG AA', () => {
  it.each(PAIRS)('$use ($fg on $bg) ≥ $min', ({ fg, bg, min }) => {
    expect(contrastRatio(color[fg], color[bg])).toBeGreaterThanOrEqual(min);
  });
});
