import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'astro/zod';

const githubStatsSchema = z.object({
  publicRepos: z.number().int().nonnegative(),
});

export type GithubStats = z.infer<typeof githubStatsSchema>;

/** Validates the committed GitHub snapshot (src/data/github.json). */
export function parseGithubStats(raw: unknown): GithubStats {
  return githubStatsSchema.parse(raw);
}

/** True when public/cv.pdf exists, so CV links render only once the file does. */
export function cvAvailable(root: string = process.cwd()): boolean {
  return existsSync(join(root, 'public', 'cv.pdf'));
}
