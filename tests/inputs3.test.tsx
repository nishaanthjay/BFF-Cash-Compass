// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Calendar } from '../src/inputs/Calendar';
import { ChoiceTimeline } from '../src/inputs/ChoiceTimeline';
import { DotGrid } from '../src/inputs/DotGrid';
import { RankCards } from '../src/inputs/RankCards';
import { isAnswered } from '../src/inputs/StepInput';
import { EMPTY_VALUE, type OnValue, type StepValue } from '../src/inputs/types';
import { getProblem } from '../src/items';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
});
afterEach(cleanup);

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

describe('dot grid (C5)', () => {
  it('starts empty; keyboard and typed box both set the count', () => {
    const ev = host((v, on) => <DotGrid total={100} columns={10} itemWord="phone" value={v} onChange={on} label="x" />);
    const grid = screen.getByRole('slider');
    expect(grid.getAttribute('aria-valuetext')).toBe('None filled yet');
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    expect(ev.at(-1)![0].raw).toBe(1);
    fireEvent.keyDown(grid, { key: 'ArrowDown' }); // one row = 10
    expect(ev.at(-1)![0].raw).toBe(11);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '10' } });
    expect(ev.at(-1)![0].raw).toBe(10);
    expect(ev.at(-1)![1]).toBe('typed');
  });
  it('clamps to the grid size and clears when the typed box is emptied', () => {
    const ev = host((v, on) => <DotGrid total={10} columns={10} itemWord="item" value={v} onChange={on} label="x" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '99' } });
    expect(ev.at(-1)![0].raw).toBe(10);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
    expect(ev.at(-1)![0].raw).toBeNull();
  });
});

const spec = (mode: 'single' | 'multi' | 'count', extra = {}) => ({ mode, cells: 12, columns: 4, cellWord: 'Month', unit: 'count' as const, ...extra });

describe('calendar (C6)', () => {
  it('single: tapping picks one month; typing is an equal alternative', () => {
    const ev = host((v, on) => <Calendar spec={spec('single')} value={v} onChange={on} label="x" />);
    fireEvent.click(screen.getByRole('button', { name: 'Month 5' }));
    expect(ev.at(-1)![0]).toMatchObject({ raw: 5, extra: { cells: [5] } });
    fireEvent.click(screen.getByRole('button', { name: 'Month 7' }));
    expect(ev.at(-1)![0].raw).toBe(7);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '9' } });
    expect(ev.at(-1)![0]).toMatchObject({ raw: 9, extra: { cells: [9] } });
    expect(ev.at(-1)![1]).toBe('typed');
  });
  it('multi: toggles cells and reports how many', () => {
    const ev = host((v, on) => <Calendar spec={spec('multi')} value={v} onChange={on} label="x" />);
    fireEvent.click(screen.getByRole('button', { name: 'Month 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Month 3' }));
    expect(ev.at(-1)![0]).toMatchObject({ raw: 2, extra: { cells: [2, 3] } });
    fireEvent.click(screen.getByRole('button', { name: 'Month 2' }));
    expect(ev.at(-1)![0]).toMatchObject({ raw: 1, extra: { cells: [3] } });
  });
  it('count: each tap adds one, wraps to zero after the max, and revenue = lawns × price', () => {
    const ev = host((v, on) => <Calendar spec={spec('count', { cellWord: 'Day', maxPerCell: 2, countWord: 'lawn' })} value={v} onChange={on} label="x" unitPrice={40} />);
    const day = () => screen.getByRole('button', { name: /^Day 1,/ });
    fireEvent.click(day());
    fireEvent.click(day());
    expect(ev.at(-1)![0]).toMatchObject({ raw: 80, extra: { lawns: 2, counts: { '1': 2 } } });
    fireEvent.click(day()); // wraps
    expect(ev.at(-1)![0]).toMatchObject({ raw: 0, extra: { lawns: 0 } });
  });
  it('long strips page by group and keep every cell reachable', () => {
    const ev = host((v, on) => <Calendar spec={spec('single', { cells: 120, group: { size: 12, word: 'Year' } })} value={v} onChange={on} label="x" />);
    expect(screen.queryByRole('button', { name: /^Month 74/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Year 7' }));
    fireEvent.click(screen.getByRole('button', { name: /^Month 74/ }));
    expect(ev.at(-1)![0].raw).toBe(74);
  });
});

describe('choice timeline (C8)', () => {
  const opts = [{ id: 'soon', label: 'Today', amount: '$25', weeks: 0 }, { id: 'later', label: 'In 4 weeks', amount: '$30', weeks: 4 }];
  it('nothing preselected; tapping chooses; shows no interest or percent', () => {
    const ev = host((v, on) => <ChoiceTimeline options={opts} maxWeeks={8} value={v} onChange={on} label="x" />);
    expect(screen.getAllByRole('radio').every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
    fireEvent.click(screen.getAllByRole('radio')[1]);
    expect(ev.at(-1)![0].choice).toEqual(['later']);
    expect(document.body.textContent).not.toMatch(/%|interest/i);
  });
});

describe('rank cards (F8)', () => {
  const cards = ['a', 'b', 'c'].map((id) => ({ id, label: `Claim ${id.toUpperCase()}` }));
  it('records the starting order and the move; arrows reorder', () => {
    const ev = host((v, on) => <RankCards cards={cards} topLabel="Most" bottomLabel="Least" shown={['b', 'a', 'c']} value={v} onChange={on} label="x" />);
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('Claim B')]));
    fireEvent.click(screen.getByRole('button', { name: 'Move down: Claim B' }));
    expect(ev.at(-1)![0].choice).toEqual(['a', 'b', 'c']);
    expect(ev.at(-1)![0].extra).toMatchObject({ shown: ['b', 'a', 'c'], moves: 1 });
    expect(screen.getByRole('button', { name: 'Move up: Claim A' }).hasAttribute('disabled')).toBe(true);
  });
});

describe('lock gating for the Stage 3 inputs', () => {
  it('rankings can be locked unchanged; calendars and dot grids need an answer', () => {
    expect(isAnswered(getProblem('F8')!.steps.find((s) => s.id === 's1')!, EMPTY_VALUE)).toBe(true);
    const cal = getProblem('F6')!.steps.find((s) => s.id === 's3')!;
    expect(isAnswered(cal, EMPTY_VALUE)).toBe(false);
    expect(isAnswered(cal, { raw: 0, extra: { counts: {} } })).toBe(false);
    expect(isAnswered(cal, { raw: 120, extra: { counts: { '1': 3 } } })).toBe(true);
    const grid = getProblem('S15')!.steps.find((s) => s.id === 's1a')!;
    expect(isAnswered(grid, EMPTY_VALUE)).toBe(false);
    expect(isAnswered(grid, { raw: 0 })).toBe(true);
  });
});
