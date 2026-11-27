// A two-step tutorial that follows the mouse: "click", and after a click on empty page "hold", until the visitor has
// charged an explosion, which is praised once and retires it for good. Mounted by the cursor, so touch and reduced
// motion never see it.
import { IMPACT_FROM } from './cursor-math';
import { whenCoverGone } from './page-cover';

const LEARNED_KEY = 'hold-tutorial-done';
const FADE_MS = 200;
/** the praise waits for the blast to open, then stays this long */
const PRAISE_AFTER_MS = 300;
const PRAISE_MS = 2000;
/** where the tag sits from the pointer's tip */
const TAG_X = 18;
const TAG_Y = 20;

export type Step = 'click' | 'hold' | 'done';

export interface Release {
  charge: number;
  /** the press began on something that does its own thing when clicked */
  clickable: boolean;
}

/** where a release leaves the tutorial: a charge big enough to hit the page ends it, a click on empty page moves on */
export function nextStep(step: Step, { charge, clickable }: Release): Step {
  if (step === 'done' || charge >= IMPACT_FROM) return 'done';
  return clickable ? step : 'hold';
}

export interface HoldHint {
  /** `aside` while over something the tag should not cover */
  move(x: number, y: number, aside: boolean): void;
  press(): void;
  /** the button came up, whether or not it made a shockwave */
  up(): void;
  release(release: Release): void;
  leave(): void;
  destroy(): void;
}

function learnedBefore(): boolean {
  try {
    return localStorage.getItem(LEARNED_KEY) === '1';
  } catch {
    return false;
  }
}

function remember(): void {
  try {
    localStorage.setItem(LEARNED_KEY, '1');
  } catch {
    // storage blocked: the tutorial comes back next visit
  }
}

/** "hold" carries three pixels that fill one by one, like a charge building */
const CONTENT = { click: 'click', hold: '<span>hold</span><i></i><i></i><i></i>', praise: 'boom! 🎉' };
type Content = keyof typeof CONTENT;

function createTag(content: Content): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.className = content === 'praise' ? 'hold-hint hold-hint-praise font-mono' : 'hold-hint font-mono';
  el.style.cssText = `position:fixed;left:0;top:0;z-index:9995;padding:4px 8px;background:var(--color-ink);color:#fff;pointer-events:none;opacity:0;transition:opacity ${FADE_MS}ms`;
  el.innerHTML = CONTENT[content];
  return el;
}

export function mountHoldHint(): HoldHint {
  let step: Step = learnedBefore() ? 'done' : 'click';
  let tag: HTMLElement | null = null;
  let tagContent: Content | null = null;
  let praising = false,
    praiseTimer = 0;
  let x = 0,
    y = 0,
    inside = false,
    aside = false,
    pressed = false,
    ready = false;

  const draw = () => {
    // the praise is a reward, not a prompt: it shows over anything
    const content: Content | null = praising ? 'praise' : step === 'done' || aside || pressed ? null : step;
    if (!content || !ready || !inside) {
      if (tag) tag.style.opacity = '0';
      return;
    }
    if (!tag || tagContent !== content) {
      tag?.remove();
      tag = createTag(content);
      tagContent = content;
      document.body.appendChild(tag);
      void tag.offsetWidth;
    }
    // flips to the pointer's other side rather than running off the screen
    const left = x + TAG_X + tag.offsetWidth > innerWidth ? x - tag.offsetWidth - 8 : x + TAG_X;
    const top = y + TAG_Y + tag.offsetHeight > innerHeight ? y - tag.offsetHeight - 8 : y + TAG_Y;
    tag.style.translate = `${Math.round(left)}px ${Math.round(top)}px`;
    tag.style.opacity = '1';
  };

  void whenCoverGone().then(() => {
    ready = true;
    draw();
  });

  return {
    move(nextX, nextY, nextAside) {
      x = nextX;
      y = nextY;
      aside = nextAside;
      inside = true;
      draw();
    },
    press() {
      pressed = true;
      draw();
    },
    up() {
      pressed = false;
      draw();
    },
    release(release) {
      const before = step;
      step = nextStep(step, release);
      if (before !== 'done' && step === 'done') {
        remember();
        praiseTimer = window.setTimeout(() => {
          praising = true;
          draw();
          praiseTimer = window.setTimeout(() => {
            praising = false;
            draw();
          }, PRAISE_MS);
        }, PRAISE_AFTER_MS);
      }
      draw();
    },
    leave() {
      inside = false;
      pressed = false;
      draw();
    },
    destroy() {
      clearTimeout(praiseTimer);
      step = 'done';
      tag?.remove();
    },
  };
}
