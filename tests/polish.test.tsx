import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { ProblemDots } from '../src/components/ProblemDots';
import { iconFor } from '../src/components/ProblemIcon';
import { ALL_PROBLEMS } from '../src/items';
import { gapLevel } from '../src/lib/crossItem';
import { CALM_LINES, calmLine } from '../src/lib/microcopy';
import { TIPS, tipFor } from '../src/lib/tips';
import { Landing } from '../src/screens/Landing';

afterEach(cleanup);

describe('per-problem pictures', () => {
  it('every problem has its own icon (not the fallback)', () => {
    const fallback = iconFor('NOPE');
    for (const p of ALL_PROBLEMS) expect(iconFor(p.id).icon, p.id).not.toBe(fallback.icon);
  });
});

describe('progress dots', () => {
  it('marks finished, current and to-come problems in words as well as colour', () => {
    render(<ProblemDots current={1} total={3} />);
    const list = screen.getByRole('list', { name: 'Problem 2 of 3' });
    expect(list.textContent).toBe('finishedcurrentto come');
  });
  it('is hidden for a single problem', () => {
    const { container } = render(<ProblemDots current={0} total={1} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('calm microcopy and tips never give feedback', () => {
  const feedback = /correct|right answer|wrong|nice job|well done|great job|too (low|high)|score/i;
  it('lines under the Lock button', () => {
    for (const l of CALM_LINES) expect(feedback.test(l), l).toBe(false);
    expect(calmLine(0, 1)).not.toBe(calmLine(0, 2));
  });
  it('money tips are general habits', () => {
    for (const list of Object.values(TIPS)) for (const t of list) expect(feedback.test(t), t).toBe(false);
  });
  it('a student sees the same tip every time, matched to a topic they worked on', () => {
    const a = tipFor(['investing'], 'ABC234');
    expect(tipFor(['investing'], 'ABC234')).toEqual(a);
    expect(TIPS.investing).toContain(a.text);
    expect(tipFor([], 'ABC234').text.length).toBeGreaterThan(10);
  });
});

describe('gap levels for the Teach first bars', () => {
  it('big at 60%+, some at 30%+, small below', () => {
    expect(gapLevel(0.9)).toBe('big');
    expect(gapLevel(0.6)).toBe('big');
    expect(gapLevel(0.59)).toBe('some');
    expect(gapLevel(0.3)).toBe('some');
    expect(gapLevel(0.29)).toBe('small');
  });
});

describe('home page', () => {
  it('has the hero picture, the workshop organizer wording, the 8-minute promise and three feature cards', () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );
    expect(screen.getByRole('img', { name: /compass/i })).toBeTruthy();
    expect(screen.getByText(/workshop organizer/)).toBeTruthy();
    expect(screen.queryByText(/chapter leader/i)).toBeNull();
    expect(screen.getByText(/About 8 minutes/)).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
  });
});
