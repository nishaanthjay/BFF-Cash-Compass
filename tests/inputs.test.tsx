// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { CurveDraw } from '../src/inputs/CurveDraw';
import { Dial } from '../src/inputs/Dial';
import { NumberLineInput } from '../src/inputs/NumberLineInput';
import { StackCards } from '../src/inputs/StackCards';
import { TapChoice } from '../src/inputs/Choice';
import { EMPTY_VALUE, type OnValue, type StepValue } from '../src/inputs/types';
import { isAnswered } from '../src/inputs/StepInput';
import { getProblem } from '../src/items';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
});
afterEach(cleanup);

/** Minimal controlled host that also records every (value, method) the component emits. */
function host(render_: (v: StepValue, on: OnValue) => React.ReactElement) {
  const events: [StepValue, string | null][] = [];
  function Host() {
    const [v, setV] = useState<StepValue>(EMPTY_VALUE);
    return render_(v, (nv, m) => {
      events.push([nv, m]);
      setV(nv);
    });
  }
  render(<Host />);
  return events;
}

describe('no default answers', () => {
  it('dial starts with nothing selected', () => {
    host((v, on) => <Dial value={v} onChange={on} label="x" />);
    expect(screen.getAllByRole('radio').every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
  });
  it('number line starts empty with a typed box available', () => {
    host((v, on) => <NumberLineInput axis={{ min: 0, max: 60, scale: 'linear', unit: 'usd' }} value={v} onChange={on} label="x" />);
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toBe('No answer yet');
    expect(screen.getByRole('textbox', { name: /or type it/i })).toBeTruthy();
  });
  it('tap choice starts with nothing chosen', () => {
    host((v, on) => <TapChoice options={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} value={v} onChange={on} label="x" />);
    expect(screen.getAllByRole('radio').every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
  });
});

describe('typed box is always an equal alternative', () => {
  it('typing on the number line sets the value and logs method "typed"', () => {
    const ev = host((v, on) => <NumberLineInput axis={{ min: 0, max: 60, scale: 'linear', unit: 'usd' }} value={v} onChange={on} label="x" />);
    fireEvent.change(screen.getByRole('textbox', { name: /or type it/i }), { target: { value: '36' } });
    expect(ev.at(-1)![0].raw).toBe(36);
    expect(ev.at(-1)![1]).toBe('typed');
    expect(screen.getByRole('slider').getAttribute('aria-valuenow')).toBe('36');
  });
  it('typing the year-10 value on the curve works without touching the graph', () => {
    const ev = host((v, on) => <CurveDraw spec={{ xMax: 10, yMax: 1000, start: 200, midX: 5, unit: 'usd' }} value={v} onChange={on} label="x" />);
    fireEvent.change(screen.getByRole('textbox', { name: /type the year 10 value/i }), { target: { value: '432' } });
    expect(ev.at(-1)![0]).toMatchObject({ raw: 432, extra: { y10: 432, y5: null } });
  });
});

describe('keyboard operation', () => {
  it('dial: arrow keys move the choice', () => {
    const ev = host((v, on) => <Dial value={v} onChange={on} label="x" />);
    const first = screen.getAllByRole('radio')[0];
    fireEvent.click(first);
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(ev.at(-1)![0].raw).toBe(2);
  });
  it('curve: picking the year-5 point routes keyboard changes to it', () => {
    const ev = host((v, on) => <CurveDraw spec={{ xMax: 10, yMax: 1000, start: 200, midX: 5, unit: 'usd' }} value={v} onChange={on} label="x" />);
    fireEvent.change(screen.getByRole('textbox', { name: /type the year 10 value/i }), { target: { value: '432' } });
    fireEvent.click(screen.getByRole('button', { name: /year 5 point/i }));
    expect(screen.getByRole('button', { name: /year 5 point/i }).getAttribute('aria-pressed')).toBe('true');
    // no y5 yet, so the arrow key does nothing (no default thumb)
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowUp' });
    expect(ev.at(-1)![0].extra).toMatchObject({ y5: null, y10: 432 });
  });
});

describe('stack cards (C4)', () => {
  const cards = [
    { id: 'a', label: 'Alpha', amount: '$1' },
    { id: 'b', label: 'Beta', amount: '$2' },
    { id: 'c', label: 'Gamma', distractor: true },
  ];
  it('tapping adds cards in order and records them; remove takes one back', () => {
    const ev = host((v, on) => <StackCards cards={cards} poolLabel="Cards" areaLabel="Counts" value={v} onChange={on} label="x" />);
    fireEvent.click(screen.getByRole('button', { name: /add to the stack: beta/i }));
    fireEvent.click(screen.getByRole('button', { name: /add to the stack: alpha/i }));
    expect(ev.at(-1)![0].choice).toEqual(['b', 'a']);
    expect(ev.at(-1)![1]).toBe('tapped');
    fireEvent.click(screen.getByRole('button', { name: /remove from the stack: beta/i }));
    expect(ev.at(-1)![0].choice).toEqual(['a']);
  });
  it('shows no running total or verdict', () => {
    host((v, on) => <StackCards cards={cards} poolLabel="Cards" areaLabel="Counts" value={v} onChange={on} label="x" />);
    fireEvent.click(screen.getByRole('button', { name: /add to the stack: alpha/i }));
    expect(document.body.textContent).not.toMatch(/total|correct|wrong|distractor/i);
  });
});

describe('lock gating', () => {
  it('a stack needs ≥1 card; optional text can be skipped; numbers need a value', () => {
    const stack = getProblem('F1')!.steps.find((s) => s.id === 's4a')!;
    const text = getProblem('F1')!.steps.find((s) => s.id === 's2t')!;
    const num = getProblem('F1')!.steps.find((s) => s.id === 's3')!;
    expect(isAnswered(stack, EMPTY_VALUE)).toBe(false);
    expect(isAnswered(stack, { raw: null, choice: ['repairs'] })).toBe(true);
    expect(isAnswered(text, EMPTY_VALUE)).toBe(true);
    expect(isAnswered(num, EMPTY_VALUE)).toBe(false);
    expect(isAnswered(num, { raw: 0 })).toBe(true);
  });
});

void vi;
