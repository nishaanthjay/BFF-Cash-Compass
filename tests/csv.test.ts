import { describe, expect, it } from 'vitest';
import { CSV_COLUMNS, csvField, responsesToCsv } from '../src/lib/csv';
import { answer, resp, student } from './fixtures';

describe('csvField', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
  });
  it('neutralises formulas in text but not negative numbers', () => {
    expect(csvField('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvField(-0.5)).toBe('-0.5');
  });
});

describe('responsesToCsv', () => {
  const st = student();
  const rows = [
    resp(answer(st, 'S1', 's1', 23, ['PAD'], { correct_value: 36, input_method: 'dragged', value: { fraction: 0.5 } })),
    resp(answer(st, 'F2', 'gut', 4)),
    resp(answer(st, 'F2', 'why', null, [], { free_text: 'They lost, "obviously"' })),
  ];
  const csv = responsesToCsv(rows, [{ answer_id: rows[0].answer_id, codes: ['DEC'], tag: null, coded_at: '' }]);
  const lines = csv.trim().split('\r\n');
  const col = (line: string, name: (typeof CSV_COLUMNS)[number]) => line.split(',')[CSV_COLUMNS.indexOf(name)];

  it('has the data-model header and one row per step', () => {
    expect(lines[0]).toBe(CSV_COLUMNS.join(','));
    expect(lines).toHaveLength(4);
  });
  it('computes signed error, APE and log ratio', () => {
    expect(Number(col(lines[1], 'signed_error'))).toBe(-13);
    expect(Number(col(lines[1], 'log_ratio'))).toBeCloseTo(Math.log(23 / 36), 5);
  });
  it('manual codes replace auto codes but both are kept', () => {
    expect(col(lines[1], 'strategy_code')).toBe('DEC');
    expect(col(lines[1], 'auto_strategy_code')).toBe('PAD');
    expect(col(lines[1], 'manually_coded')).toBe('1');
  });
  it('ratings land in rating_gut; free text is escaped', () => {
    expect(col(lines[2], 'rating_gut')).toBe('4');
    expect(lines[3]).toContain('"They lost, ""obviously"""');
  });
  it('has no identifying columns', () => {
    expect(lines[0]).not.toMatch(/name|email|school|birth|ip_/);
  });
});
