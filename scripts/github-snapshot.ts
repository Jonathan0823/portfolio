// Rewrites src/data/github.json from the live GitHub API. Usage: GH_STATS_TOKEN=... pnpm stats:snapshot
import { writeFileSync } from 'node:fs';
import { GITHUB_LOGIN, loadGithubStats } from '../src/lib/github.ts';

const token = process.env.GH_STATS_TOKEN;
if (!token) {
  console.error('Set GH_STATS_TOKEN to refresh the snapshot.');
  process.exit(1);
}
const empty = { publicRepos: 0, calendar: { total: 0, weeks: [] } };
let failed = false;
const stats = await loadGithubStats({
  token,
  snapshot: empty,
  warn: (m) => {
    failed = true;
    console.error(m);
  },
});
if (failed) process.exit(1);
writeFileSync(new URL('../src/data/github.json', import.meta.url), JSON.stringify(stats) + '\n');
console.log(`Snapshot for ${GITHUB_LOGIN}: ${stats.publicRepos} repos, ${stats.calendar.total} contributions.`);
