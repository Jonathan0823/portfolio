import { describe, expect, it } from 'vitest';
import { distanceToBox, nearestBox, stepSlosh } from './nav-magnet';
import { frameScale } from './timing';

const boxes = [
  { left: 0, top: 0, width: 100, height: 30 },
  { left: 104, top: 0, width: 60, height: 30 },
];

describe('distanceToBox', () => {
  it('is zero inside and measured from the nearest edge outside', () => {
    expect(distanceToBox(50, 15, boxes[0])).toBe(0);
    expect(distanceToBox(50, 40, boxes[0])).toBe(10);
  });
});

describe('nearestBox', () => {
  it('picks the item under or nearest the pointer', () => {
    expect(nearestBox(99, 15, boxes)).toBe(0);
    expect(nearestBox(103, 15, boxes)).toBe(1);
  });
  it('lets go outside the zone', () => {
    expect(nearestBox(50, 90, boxes)).toBe(-1);
  });
});

describe('stepSlosh', () => {
  it('settles even when every frame is as slow as frameScale allows', () => {
    let s = { position: 0, velocity: 0.42 };
    for (let i = 0; i < 20; i++) {
      s = stepSlosh(s.position, s.velocity, frameScale(1000));
      expect(Math.abs(s.position)).toBeLessThan(2);
    }
    expect(Math.abs(s.position)).toBeLessThan(0.05);
  });
});
