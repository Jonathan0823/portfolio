import { describe, expect, it } from 'vitest';
import { groupMilestonesByYear, type MilestoneEntry } from './content-logic';

const mk = (id: string, date: string, label = 'Work'): MilestoneEntry => ({
  id,
  body: '',
  data: { date, label, title: id, tags: [], refs: [] },
});
const years = [
  { year: '2024', subtitle: 'Year A', meta: 'Meta A' },
  { year: '2025', subtitle: 'Year B' },
  { year: 'now', subtitle: 'Looking ahead' },
];

describe('groupMilestonesByYear', () => {
  it('groups milestones by year, oldest year first, each year in date order', () => {
    const groups = groupMilestonesByYear(
      [mk('c', '2025-03'), mk('b', '2024-11'), mk('a', '2024-02'), mk('d', '2025-01')],
      years,
    );
    expect(groups.map((g) => g.year)).toEqual(['2024', '2025']);
    expect(groups[0]!.milestones.map((m) => m.id)).toEqual(['a', 'b']);
    expect(groups[1]!.milestones.map((m) => m.id)).toEqual(['d', 'c']);
  });

  it('takes the subtitle and meta from the year data, not the milestones', () => {
    const [g] = groupMilestonesByYear([mk('a', '2024-02')], years);
    expect(g!.subtitle).toBe('Year A');
    expect(g!.meta).toBe('Meta A');
  });

  it('lists twelve months per year and marks the ones that have a milestone', () => {
    const [g] = groupMilestonesByYear([mk('a', '2024-02'), mk('b', '2024-02'), mk('c', '2024-11')], years);
    expect(g!.months).toHaveLength(12);
    expect(g!.months[0]).toEqual({ month: '2024-01', count: 0 });
    expect(g!.months[1]).toEqual({ month: '2024-02', count: 2 });
    expect(g!.months[10]).toEqual({ month: '2024-11', count: 1 });
  });

  it('puts milestones labelled Now in a closing group', () => {
    const groups = groupMilestonesByYear([mk('x', '2025-05'), mk('n', '2025-12', 'Now')], years);
    expect(groups.map((g) => g.year)).toEqual(['2025', 'now']);
    expect(groups[1]!.milestones.map((m) => m.id)).toEqual(['n']);
    expect(groups[1]!.subtitle).toBe('Looking ahead');
  });

  it('throws when a year has milestones but no subtitle', () => {
    expect(() => groupMilestonesByYear([mk('a', '2030-01')], years)).toThrow(/2030/);
  });
});
