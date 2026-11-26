// Hero hint: tells desktop visitors that the contact links spill a pixel logo on hover.
// Once per session, a beat after the headline's caret starts blinking, the GitHub logo spills by itself and retracts.
// Any real hover, focus or touch of a link ends it: the visitor has found it.
import { FINE_POINTER_QUERY, prefersReducedMotion } from './motion';
import type { GlyphSpill } from './glyph-spill';

/** the hint spills this long after the caret starts blinking: one focal point at a time */
const AFTER_CARET_MS = 500;
/** the logo stands this long before it retracts */
const SHOW_MS = 3500;
const DONE_KEY = 'px-hint-done';
/** styled in global.css: accent colour and a stepped underline */
const LIT_CLASS = 'hint-lit';

export function shouldPlayHint(o: { fine: boolean; reduced: boolean; seen: boolean }): boolean {
  return o.fine && !o.reduced && !o.seen;
}

/** storage can be denied: then skip the hint, as the intro does, since "once per session" can't be kept */
export function hintSeen(): boolean {
  try {
    return !!sessionStorage.getItem(DONE_KEY);
  } catch {
    return true;
  }
}

export function markHintSeen(): void {
  try {
    sessionStorage.setItem(DONE_KEY, '1');
  } catch {}
}

/**
 * `spill` is read late: the glyph spill mounts on idle and remounts when motion preferences change. `ready`
 * resolves when the hero's life has settled (the caret blinks); the hint plays a beat after it.
 */
export function mountHeroHint(spill: () => GlyphSpill | null, ready: Promise<void>): void {
  const fine = window.matchMedia(FINE_POINTER_QUERY).matches;
  if (!shouldPlayHint({ fine, reduced: prefersReducedMotion(), seen: hintSeen() })) return;
  const links = [...document.querySelectorAll<HTMLElement>('a[data-glyph-for]')];
  const github = links.find((link) => link.dataset.glyphFor === 'git');
  if (!github) return;

  let over = false,
    shown = false,
    timer = 0;
  const end = () => {
    if (over) return;
    over = true;
    markHintSeen();
    clearTimeout(timer);
    github.classList.remove(LIT_CLASS);
    for (const link of links) {
      link.removeEventListener('mouseenter', found);
      link.removeEventListener('focus', found);
      link.removeEventListener('touchstart', found);
    }
  };
  // a real hover drives the spill itself, so the hint only has to get out of the way
  const found = () => end();
  for (const link of links) {
    link.addEventListener('mouseenter', found);
    link.addEventListener('focus', found);
    link.addEventListener('touchstart', found, { passive: true });
  }

  void ready.then(() => {
    if (over) return;
    timer = window.setTimeout(() => {
      const glyph = spill();
      if (over || !glyph) return;
      // the motion preference or pointer may have changed while the page settled
      const fineNow = window.matchMedia(FINE_POINTER_QUERY).matches;
      if (!shouldPlayHint({ fine: fineNow, reduced: prefersReducedMotion(), seen: false })) return;
      // scrolled away already: an off-screen demo teaches nothing, so keep it for a later visit
      const box = github.getBoundingClientRect();
      if (box.bottom < 0 || box.top > window.innerHeight) return;
      shown = true;
      github.classList.add(LIT_CLASS);
      glyph.show('git');
      timer = window.setTimeout(() => {
        if (shown && !over) glyph.hide();
        end();
      }, SHOW_MS);
    }, AFTER_CARET_MS);
  });
}
