import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function cvAvailable(root: string = process.cwd()): boolean {
  return existsSync(join(root, 'public', 'cv.pdf'));
}
