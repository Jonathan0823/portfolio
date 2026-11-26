import { describe, expect, it } from 'vitest';
import { achievementMonths, assertContentIntegrity, sortRoles, type RoleEntry } from './content-logic';

const mkRole = (id: string, start: string, ids: [string, string][] = []): RoleEntry => ({
  id,
  body: '',
  data: {
    title: id,
    org: 'Acme',
    start,
    end: 'present',
    kind: 'work',
    achievements: ids.map(([aid, month]) => ({ id: aid, month, text: 'Did 1 thing.', tags: [] })),
  },
});
const mkProject = (id: string, extra: Record<string, unknown> = {}, body = 'A project.') => ({
  id,
  body,
  data: {
    name: id,
    order: 1,
    month: '2025-08',
    result: 'It works.',
    repo: 'https://example.com/r',
    tags: [],
    extraRepos: [],
    visual: { kind: 'diagram' as const, label: 'x' },
    ...extra,
  },
});

describe('sortRoles', () => {
  it('puts the newest start first without mutating the input', () => {
    const input = [mkRole('old', '2024-11'), mkRole('new', '2025-07')];
    expect(sortRoles(input).map((r) => r.id)).toEqual(['new', 'old']);
    expect(input[0].id).toBe('old');
  });
});

describe('achievementMonths', () => {
  it('lists the distinct months that have an achievement', () => {
    const r = mkRole('r', '2025-07', [
      ['a', '2025-10'],
      ['b', '2025-08'],
      ['c', '2025-10'],
    ]);
    expect(achievementMonths(r)).toEqual(['2025-08', '2025-10']);
  });
});

describe('assertContentIntegrity', () => {
  const roles = [mkRole('r', '2025-07', [['gw', '2025-08']])];

  it('passes for consistent content', () => {
    expect(() =>
      assertContentIntegrity({
        roles,
        projects: [mkProject('nexusbus', { fromAchievement: 'gw' })],
        milestones: [],
      }),
    ).not.toThrow();
  });
  it('fails when fromAchievement points at a missing id', () => {
    expect(() =>
      assertContentIntegrity({
        roles,
        projects: [mkProject('nexusbus', { fromAchievement: 'nope' })],
        milestones: [],
      }),
    ).toThrow(/nexusbus.*fromAchievement.*nope/s);
  });
  it('fails on duplicate achievement ids', () => {
    expect(() =>
      assertContentIntegrity({
        roles: [mkRole('a', '2025-07', [['x', '2025-08']]), mkRole('b', '2024-07', [['x', '2024-08']])],
        projects: [],
        milestones: [],
      }),
    ).toThrow(/duplicate achievement id.*x/i);
  });
  it('fails on a milestone ref to a missing project', () => {
    expect(() =>
      assertContentIntegrity({
        roles,
        projects: [],
        milestones: [
          {
            id: 'm',
            body: 'Story.',
            data: { date: '2025-08', label: 'Work', title: 'T', tags: [], refs: [{ kind: 'project', id: 'ghost' }] },
          },
        ],
      }),
    ).toThrow(/ghost/);
  });
  it('fails on bracket placeholder text in a body', () => {
    expect(() =>
      assertContentIntegrity({
        roles,
        projects: [mkProject('p', {}, 'Intro [todo] here')],
        milestones: [],
      }),
    ).toThrow(/\[todo\]/);
  });
  it('allows markdown links in a body', () => {
    expect(() =>
      assertContentIntegrity({
        roles,
        projects: [mkProject('p', {}, 'See [the repo](https://example.com).')],
        milestones: [],
      }),
    ).not.toThrow();
  });
});
