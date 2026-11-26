import { describe, expect, it } from 'vitest';
import { STAT_ICONS, statIcon, type StatIconName } from './stat-icons';

describe('stat icons', () => {
  it.each(Object.keys(STAT_ICONS) as StatIconName[])('%s has frames of one size and only known colours', (name) => {
    const icon = statIcon(name);
    expect(icon.frames.length).toBeGreaterThan(1);
    expect(icon.cells.every((frame) => frame.length > 0)).toBe(true);
  });
});
