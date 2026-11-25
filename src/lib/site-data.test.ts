import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cvAvailable } from './site-data';

describe('cvAvailable', () => {
  it('is true only when public/cv.pdf exists under the root', () => {
    const root = mkdtempSync(join(tmpdir(), 'cv-'));
    expect(cvAvailable(root)).toBe(false);
    mkdirSync(join(root, 'public'));
    writeFileSync(join(root, 'public', 'cv.pdf'), 'x');
    expect(cvAvailable(root)).toBe(true);
  });
});
