import { describe, expect, it } from 'vitest';
import { onScrollbar } from './scrollbar';

const root = { clientWidth: 1000, clientHeight: 600 } as Element;
const body = { matches: () => false } as unknown as Element;
const scroller = (scrollWidth: number) =>
  ({ matches: (s: string) => s === '[data-scroller]', scrollWidth, clientWidth: 600 }) as unknown as Element;
const press = (target: Element, clientX: number, clientY: number) => onScrollbar({ target, clientX, clientY }, root);

describe('onScrollbar', () => {
  it('catches a classic scrollbar outside the content box', () => {
    expect(press(root, 1005, 300)).toBe(true);
    expect(press(root, 500, 605)).toBe(true);
  });

  it('catches an overlay scrollbar over the page edge', () => {
    expect(press(root, 999, 300)).toBe(true);
    expect(press(root, 500, 599)).toBe(true);
  });

  it('leaves presses on the page alone, even at its edge', () => {
    expect(press(body, 999, 300)).toBe(false);
    expect(press(root, 500, 300)).toBe(false);
  });

  it('catches the scrollbar of a sideways scroller only while it overflows', () => {
    expect(press(scroller(1100), 300, 300)).toBe(true);
    expect(press(scroller(600), 300, 300)).toBe(false);
  });
});
