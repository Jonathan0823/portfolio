// The pointer over the hero in the hero's own coordinates: where it is, presses on it, and how long one has been held.

export interface HeroPointer {
  /** where the pointer last was, far off-screen until it has moved */
  readonly ptr: { x: number; y: number };
  /** ms the pointer has been held down on the hero at `now`, or null when it is not */
  heldMs(now: number): number | null;
  stop(): void;
}

interface Handlers {
  /** any press on the hero, at once */
  press(x: number, y: number): void;
  /** a hold on the hero let go */
  release(x: number, y: number, heldMs: number): void;
}

const INTERACTIVE = 'a,button,input,textarea,summary,select';

export function mountHeroPointer(area: HTMLElement, on: Handlers): HeroPointer {
  const ptr = { x: -1e4, y: -1e4 };
  let downAt: number | null = null;
  /** the pointer that started the hold; others tapping elsewhere must not end it */
  let holdId: number | null = null;
  const track = (e: PointerEvent) => {
    const r = area.getBoundingClientRect();
    ptr.x = e.clientX - r.left;
    ptr.y = e.clientY - r.top;
    return r;
  };
  const onMove = (e: PointerEvent) => void track(e);
  const onDown = (e: PointerEvent) => {
    const r = track(e);
    // a press on the page's scrollbar lands outside the content box: it is a drag to scroll, not a hold
    const root = document.documentElement;
    if (e.clientX >= root.clientWidth || e.clientY >= root.clientHeight) return;
    on.press(ptr.x, ptr.y);
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement | null)?.closest?.(INTERACTIVE)) return;
    if (ptr.x < 0 || ptr.y < 0 || ptr.x > r.width || ptr.y > r.height) return;
    if (downAt !== null) return;
    downAt = performance.now();
    holdId = e.pointerId;
  };
  const onUp = (e: PointerEvent) => {
    if (downAt === null || e.pointerId !== holdId) return;
    const held = performance.now() - downAt;
    downAt = null;
    track(e);
    on.release(ptr.x, ptr.y, held);
  };
  const onCancel = (e: PointerEvent) => {
    if (e.pointerId === holdId) downAt = null;
  };
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onDown);
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onCancel);
  return {
    ptr,
    heldMs: (now) => (downAt === null ? null : now - downAt),
    stop() {
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerdown', onDown);
      removeEventListener('pointerup', onUp);
      removeEventListener('pointercancel', onCancel);
    },
  };
}
