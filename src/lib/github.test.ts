import { describe, expect, it, vi } from 'vitest';
import {
  calendarLabel,
  cellPosition,
  contributionLevel,
  levelThresholds,
  relativeLevel,
  dayTooltip,
  loadGithubStats,
  parseGithubResponse,
  type GithubStats,
} from './github';

const live = {
  data: {
    user: {
      repositories: { totalCount: 80 },
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: 5,
          weeks: [
            {
              contributionDays: [
                { date: '2026-11-22', contributionCount: 0 },
                { date: '2026-11-23', contributionCount: 2 },
              ],
            },
            { contributionDays: [{ date: '2026-11-29', contributionCount: 3 }] },
          ],
        },
      },
    },
  },
};

const snapshot: GithubStats = {
  publicRepos: 76,
  calendar: { total: 9, weeks: [{ days: [{ date: '2026-01-04', count: 9 }] }] },
};

const okFetch = (body: unknown) =>
  vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify(body)));

describe('parseGithubResponse', () => {
  it('maps the GraphQL payload to stats', () => {
    expect(parseGithubResponse(live)).toEqual({
      publicRepos: 80,
      calendar: {
        total: 5,
        weeks: [
          { days: [{ date: '2026-11-22', count: 0 }, { date: '2026-11-23', count: 2 }] },
          { days: [{ date: '2026-11-29', count: 3 }] },
        ],
      },
    });
  });

  it('throws on an error payload', () => {
    expect(() => parseGithubResponse({ errors: [{ message: 'Bad credentials' }] })).toThrow();
  });
});

describe('loadGithubStats', () => {
  it('uses the snapshot and warns when there is no token', async () => {
    const fetchFn = vi.fn(async () => new Response('{}'));
    const warn = vi.fn();
    const stats = await loadGithubStats({ token: undefined, snapshot, fetchFn, warn });
    expect(stats).toBe(snapshot);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('returns live numbers and sends the token as a bearer header', async () => {
    const fetchFn = okFetch(live);
    const stats = await loadGithubStats({ token: 't0k', snapshot, fetchFn, warn: vi.fn() });
    expect(stats.publicRepos).toBe(80);
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t0k');
  });

  it('falls back to the snapshot on a failed request without leaking the token', async () => {
    const warn = vi.fn();
    const fetchFn = vi.fn(async () => new Response('no', { status: 401 }));
    const stats = await loadGithubStats({ token: 'sekrit', snapshot, fetchFn, warn });
    expect(stats).toBe(snapshot);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('sekrit');
  });

  it('falls back when the request throws or the payload is malformed', async () => {
    const boom = vi.fn(async () => {
      throw new Error('offline');
    });
    expect(await loadGithubStats({ token: 't', snapshot, fetchFn: boom, warn: vi.fn() })).toBe(snapshot);
    expect(
      await loadGithubStats({ token: 't', snapshot, fetchFn: okFetch({ data: {} }), warn: vi.fn() }),
    ).toBe(snapshot);
  });
});

describe('calendar presentation', () => {
  it('buckets counts into levels like the original design', () => {
    expect([0, 1, 2, 3, 5, 6, 9, 10, 13, 14, 17, 18, 40].map(contributionLevel)).toEqual([
      -1, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5,
    ]);
  });

  it('puts a day in the row of its weekday (Sunday = 0)', () => {
    expect(cellPosition('2026-11-22', 0)).toEqual({ col: 0, row: 0 });
    expect(cellPosition('2026-11-28', 3)).toEqual({ col: 3, row: 6 });
  });

  it('writes the tooltip and the aria summary', () => {
    expect(dayTooltip('2026-11-23', 2)).toBe('Mon, 23 Nov 2026 · 2 contributions');
    expect(dayTooltip('2026-11-23', 1)).toBe('Mon, 23 Nov 2026 · 1 contribution');
    expect(dayTooltip('2026-11-24', 0)).toBe('Tue, 24 Nov 2026 · nothing pushed');
    expect(calendarLabel(1234)).toBe('1,234 contributions in the last 12 months');
  });
});

describe('relative levels', () => {
  it('spreads a busy year across every level', () => {
    const counts = Array.from({ length: 100 }, (_, i) => 20 + i);
    const t = levelThresholds(counts);
    const levels = new Set(counts.map((c) => relativeLevel(c, t)));
    expect([...levels].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it('keeps empty days empty', () => {
    expect(relativeLevel(0, levelThresholds([5, 9]))).toBe(-1);
  });
  it('falls back when nothing was pushed', () => {
    expect(levelThresholds([0, 0])).toEqual([1, 2, 3, 4, 5]);
  });
});
