import { z } from 'astro/zod';

export const GITHUB_LOGIN = 'Jonathan0823';

const dayList = z.array(z.object({ date: z.string(), count: z.number().int().nonnegative() }));

const githubStatsSchema = z.object({
  publicRepos: z.number().int().nonnegative(),
  calendar: z.object({
    total: z.number().int().nonnegative(),
    weeks: z.array(z.object({ days: dayList })),
  }),
});

export type GithubStats = z.infer<typeof githubStatsSchema>;

/** Validates the committed snapshot (src/data/github.json). */
export function parseGithubStats(raw: unknown): GithubStats {
  return githubStatsSchema.parse(raw);
}

const responseSchema = z.object({
  data: z.object({
    user: z.object({
      repositories: z.object({ totalCount: z.number() }),
      contributionsCollection: z.object({
        contributionCalendar: z.object({
          totalContributions: z.number(),
          weeks: z.array(
            z.object({
              contributionDays: z.array(z.object({ date: z.string(), contributionCount: z.number() })),
            }),
          ),
        }),
      }),
    }),
  }),
});

/** Maps the GraphQL payload to the stats shape; throws on errors or an unexpected shape. */
export function parseGithubResponse(body: unknown): GithubStats {
  const { user } = responseSchema.parse(body).data;
  const cal = user.contributionsCollection.contributionCalendar;
  return {
    publicRepos: user.repositories.totalCount,
    calendar: {
      total: cal.totalContributions,
      weeks: cal.weeks.map((w) => ({
        days: w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount })),
      })),
    },
  };
}

const QUERY = `query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    repositories(privacy: PUBLIC, ownerAffiliations: OWNER) { totalCount }
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

export type LoadOptions = {
  token: string | undefined;
  snapshot: GithubStats;
  fetchFn?: (url: string, init: RequestInit) => Promise<Response>;
  warn?: (message: string) => void;
  now?: Date;
};

/** Fetches live stats at build time; falls back to the snapshot and never throws. */
export async function loadGithubStats(opts: LoadOptions): Promise<GithubStats> {
  const { token, snapshot, fetchFn = fetch, warn = console.warn, now = new Date() } = opts;
  if (!token) {
    warn('[github] GH_STATS_TOKEN is not set; using the committed snapshot.');
    return snapshot;
  }
  try {
    const from = new Date(now);
    from.setUTCFullYear(from.getUTCFullYear() - 1);
    const res = await fetchFn('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'portfolio-build',
      },
      body: JSON.stringify({
        query: QUERY,
        variables: { login: GITHUB_LOGIN, from: from.toISOString(), to: now.toISOString() },
      }),
    });
    if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
    return parseGithubResponse(await res.json());
  } catch (err) {
    warn(`[github] live fetch failed (${err instanceof Error ? err.message : 'unknown'}); using the committed snapshot.`);
    return snapshot;
  }
}

/** The heat palette, dark to hot. */
export const COL = ['#1E1B4B', '#4338CA', '#7C5CFA', '#E5484D', '#FF7A28', '#FFC43C'] as const;

/** -1 for an empty day, then 0..5 using fixed thresholds. */
export function contributionLevel(count: number): number {
  if (count <= 0) return -1;
  if (count < 3) return 0;
  if (count < 6) return 1;
  if (count < 10) return 2;
  if (count < 14) return 3;
  if (count < 18) return 4;
  return 5;
}

/** Grid position of a day: column = week index, row = weekday with Sunday at the top. */
export function cellPosition(date: string, weekIndex: number): { col: number; row: number } {
  return { col: weekIndex, row: new Date(`${date}T00:00:00Z`).getUTCDay() };
}

export function dayTooltip(date: string, count: number): string {
  const label = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const tail = count === 0 ? 'nothing pushed' : `${count} contribution${count === 1 ? '' : 's'}`;
  return `${label} · ${tail}`;
}

export function calendarLabel(total: number): string {
  return `${total.toLocaleString('en-US')} contributions in the last year`;
}
