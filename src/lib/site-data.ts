import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** True when public/cv.pdf exists, so CV links render only once the file does. */
export function cvAvailable(root: string = process.cwd()): boolean {
  return existsSync(join(root, 'public', 'cv.pdf'));
}
