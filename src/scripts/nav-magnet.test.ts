import { describe, expect, it } from 'vitest';
import { distanceToBox, nearestBox, roundedDistance, stretchToward } from './nav-magnet';

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

describe('roundedDistance', () => {
  it('is negative inside, positive outside and rounds the corners off', () => {
    expect(roundedDistance(50, 15, boxes[0], 8)).toBeLessThan(0);
    expect(roundedDistance(50, 40, boxes[0], 8)).toBe(10);
    expect(roundedDistance(0, 0, boxes[0], 8)).toBeGreaterThan(0);
  });
});

describe('stretchToward', () => {
  it('runs the leading edge ahead of the trailing one, then settles on the goal', () => {
    const shape = { ...boxes[1] };
    stretchToward(shape, boxes[0], 1);
    expect(boxes[1].left - shape.left).toBeGreaterThan(boxes[1].left + boxes[1].width - shape.left - shape.width);
    for (let i = 0; i < 200; i++) stretchToward(shape, boxes[0], 1);
    expect(shape.left).toBeCloseTo(0);
    expect(shape.width).toBeCloseTo(100);
  });
});
