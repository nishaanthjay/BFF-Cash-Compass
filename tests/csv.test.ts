import { describe, expect, it } from 'vitest';
import { CSV_COLUMNS, csvField, responsesToCsv } from '../src/lib/csv';
import type { ResponseRow } from '../src/api/types';
import { answer, attempt } from './fixtures';

describe('csvField', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('l1\nl2')).toBe('"l1\nl2"');
  });
  it('neutralises spreadsheet formulas in text but not negative numbers', () => {
    expect(csvField('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvField(-0.5)).toBe('-0.5');
  });
  it('blank for null/undefined', () => {
    expect(csvField(null)).toBe('');
  });
});

describe('responsesToCsv', () => {
  const a = attempt('sess');
  const rows: ResponseRow[] = [
    { ...answer(a, 'item-a', 200, 100), chapter_code: 'TX014' },
    { ...answer(a, 'item-b', 0, 100), chapter_code: 'TX014' },
    { ...answer(a, 'item-c', 25, 100), chapter_code: 'TX014' },
  ];
  const csv = responsesToCsv(rows, (id) => (id === 'item-a' ? 'investing' : undefined));
  const lines = csv.trim().split('\r\n');

  it('has the documented header and one line per response', () => {
    expect(lines[0]).toBe(CSV_COLUMNS.join(','));
    expect(lines).toHaveLength(4);
  });
  it('includes log error and category; blank log error when undefined', () => {
    const cols = (l: string) => Object.fromEntries(CSV_COLUMNS.map((c, i) => [c, l.split(',')[i]]));
    const first = cols(lines[1]);
    expect(first.deca_category).toBe('investing');
    expect(Number(first.log_error)).toBeCloseTo(Math.log(2), 5);
    expect(first.chapter_code).toBe('TX014');
    expect(cols(lines[2]).log_error).toBe('');
  });
  it('writes negative log errors as plain numbers (not formula-escaped text)', () => {
    const le = lines[3].split(',')[CSV_COLUMNS.indexOf('log_error')];
    expect(le).toBe(String(Number(Math.log(0.25).toFixed(6))));
  });
  it('contains no session type, form or student identifier columns', () => {
    expect(lines[0]).not.toMatch(/session_type|form|name|email|student/);
  });
});
