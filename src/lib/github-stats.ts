import snapshotJson from '../data/github.json';
import { loadGithubStats, parseGithubStats, type GithubStats } from './github';

let cached: Promise<GithubStats> | undefined;

export function getGithubStats(): Promise<GithubStats> {
  cached ??= loadGithubStats({
    token: process.env.GH_STATS_TOKEN,
    snapshot: parseGithubStats(snapshotJson),
  });
  return cached;
}
