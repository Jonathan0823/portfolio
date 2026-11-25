import snapshotJson from '../data/github.json';
import { loadGithubStats, parseGithubStats, type GithubStats } from './github';

let cached: Promise<GithubStats> | undefined;

/** The stats the site renders: live when GH_STATS_TOKEN is set, the snapshot otherwise. Fetched once per build. */
export function getGithubStats(): Promise<GithubStats> {
  cached ??= loadGithubStats({
    token: process.env.GH_STATS_TOKEN,
    snapshot: parseGithubStats(snapshotJson),
  });
  return cached;
}
