import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cvAvailable, parseGithubStats } from './site-data';

describe('parseGithubStats', () => {
  it('accepts a snapshot with a public repo count', () => {
    expect(parseGithubStats({ publicRepos: 76 }).publicRepos).toBe(76);
  });

  it('rejects a missing or negative count', () => {
    expect(() => parseGithubStats({})).toThrow();
    expect(() => parseGithubStats({ publicRepos: -1 })).toThrow();
  });
});

describe('cvAvailable', () => {
  it('is true only when public/cv.pdf exists under the root', () => {
    const root = mkdtempSync(join(tmpdir(), 'cv-'));
    expect(cvAvailable(root)).toBe(false);
    mkdirSync(join(root, 'public'));
    writeFileSync(join(root, 'public', 'cv.pdf'), 'x');
    expect(cvAvailable(root)).toBe(true);
  });
});
