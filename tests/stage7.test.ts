import { describe, expect, it } from 'vitest';
import { buildSeed } from '../src/api/seed';
import type { ExportData } from '../src/api/types';
import { isSampleId, mergeSample, realResponses, sampleToExport } from '../src/lib/sample';
import { responsesToCsv } from '../src/lib/csv';
import { answer, dataset, resp, student } from './fixtures';

const seed = buildSeed(Date.UTC(2026, 9, 1));
const sample = sampleToExport(seed as never);
const A = student('real-session', 'AAA222', 9);
const real: ExportData = dataset([resp(answer(A, 'S1', 's1', 36, ['CORR']))], [A]);

describe('sample data', () => {
  it('is a big, varied showcase set', () => {
    expect(sample.sessions.length).toBeGreaterThanOrEqual(12);
    expect(sample.students.length).toBeGreaterThanOrEqual(250);
    expect(sample.responses.length).toBeGreaterThan(8000);
    expect(Math.min(...sample.sessions.map((s) => sample.students.filter((x) => x.session_id === s.id).length))).toBeLessThan(5);
  });
  it('prefixes every id and labels every workshop SAMPLE, all closed', () => {
    expect(sample.sessions.every((s) => isSampleId(s.id) && s.cohort_label?.startsWith('SAMPLE · ') && s.status === 'closed')).toBe(true);
    expect(sample.students.every((s) => isSampleId(s.session_id))).toBe(true);
    expect(sample.responses.every((r) => isSampleId(r.answer_id) && isSampleId(r.session_id))).toBe(true);
    expect(sample.recodes.every((r) => isSampleId(r.answer_id))).toBe(true);
    const ids = new Set(sample.responses.map((r) => r.answer_id));
    expect(ids.size).toBe(sample.responses.length);
  });
  it('merges by mode without touching real rows', () => {
    expect(mergeSample(real, sample, 'real')).toBe(real);
    expect(mergeSample(real, null, 'both')).toBe(real);
    expect(mergeSample(real, sample, 'sample')).toBe(sample);
    const both = mergeSample(real, sample, 'both');
    expect(both.responses).toHaveLength(real.responses.length + sample.responses.length);
    expect(realResponses(both.responses)).toHaveLength(real.responses.length);
  });
  it('the CSV export never contains sample rows', () => {
    const both = mergeSample(real, sample, 'both');
    const csv = responsesToCsv(realResponses(both.responses), both.recodes);
    expect(csv.includes('sample-')).toBe(false);
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(1 + real.responses.length);
  });
  it('is deterministic apart from dates', () => {
    const again = sampleToExport(buildSeed(Date.UTC(2026, 9, 1)) as never);
    expect(again.responses.map((r) => r.raw_value)).toEqual(sample.responses.map((r) => r.raw_value));
  });
});
