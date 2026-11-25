import { describe, expect, it } from 'vitest';
import { formatDuration, formatMonth, formatRange, monthOf, monthsOfYear, resolveEnd, roleSquares, wholeYearsSince, yearOf, type RoleEntry } from './role-timeline';

const role = (start: string, end: string, months: string[] = []): RoleEntry => ({
  id: 'r',
  data: {
    title: 'T',
    org: 'O',
    start,
    end,
    kind: 'work',
    achievements: months.map((month, i) => ({ id: 'a' + i, month, text: 'Did 1 thing.', tags: [] })),
  },
});

describe('roleSquares', () => {
  it('gives one square per month of the role, ends included', () => {
    const sq = roleSquares(role('2024-11', '2025-06'), '2026-11');
    expect(sq.map((s) => s.month)).toEqual([
      '2024-11', '2024-12', '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06',
    ]);
  });

  it('marks only months that have an Achievement', () => {
    const sq = roleSquares(role('2025-07', '2025-10', ['2025-08', '2025-10', '2025-10']), '2026-11');
    expect(sq.filter((s) => s.hasAchievement).map((s) => s.month)).toEqual(['2025-08', '2025-10']);
  });

  it('runs a present role up to the given current month', () => {
    const sq = roleSquares(role('2025-07', 'present'), '2026-11');
    expect(sq).toHaveLength(17);
    expect(sq.at(-1)?.month).toBe('2026-11');
  });

  it('labels each square with its month name', () => {
    expect(roleSquares(role('2025-07', '2025-07'), '2026-11')[0].label).toBe('Jul 2025');
  });
});

describe('formatting', () => {
  it('formats a month', () => expect(formatMonth('2023-09')).toBe('Sep 2023'));
  it('formats a finished range', () =>
    expect(formatRange('2024-11', '2025-06')).toBe('Nov 2024 – Jun 2025'));
  it('formats an open range with "now"', () =>
    expect(formatRange('2025-07', 'present')).toBe('Jul 2025 – now'));
  it('formats durations', () => {
    expect(formatDuration(8)).toBe('8 mo');
    expect(formatDuration(17)).toBe('1 yr 5 mo');
    expect(formatDuration(12)).toBe('1 yr');
    expect(formatDuration(36)).toBe('3 yrs');
  });
});
