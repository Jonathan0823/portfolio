// Hero hint: tells desktop visitors that the contact links spill a pixel logo on hover.
// Once per session, after the intro settles, the GitHub logo spills by itself and retracts.
// Any real hover, focus or touch of a link ends it: the visitor has found it.
import { FINE_POINTER_QUERY, prefersReducedMotion } from './motion';
import type { GlyphSpill } from './glyph-spill';

/** the hero settles this long after the page cover lifts before it asks for attention */
const SETTLE_MS = 1200;
const SHOW_MS = 1400;
const DONE_KEY = 'px-hint-done';
/** styled in global.css: accent colour and a stepped underline */
const LIT_CLASS = 'hint-lit';

export function shouldPlayHint(o: { fine: boolean; reduced: boolean; seen: boolean }): boolean {
  return o.fine && !o.reduced && !o.seen;
}

/** Resolves once the page cover is gone (it always lifts within 2.5s of load). */
function whenUncovered(root: HTMLElement): Promise<void> {
  if (!root.classList.contains('px-covered')) return Promise.resolve();
  return new Promise((resolve) => {
    const watch = new MutationObserver(() => {
      if (root.classList.contains('px-covered')) return;
      watch.disconnect();
      resolve();
    });
    watch.observe(root, { attributes: true, attributeFilter: ['class'] });
  });
}

/** `spill` is read late: the glyph spill mounts on idle and remounts when motion preferences change. */
export function mountHeroHint(spill: () => GlyphSpill | null): void {
  const fine = window.matchMedia(FINE_POINTER_QUERY).matches;
  if (!shouldPlayHint({ fine, reduced: prefersReducedMotion(), seen: !!sessionStorage.getItem(DONE_KEY) })) return;
  const links = [...document.querySelectorAll<HTMLElement>('a[data-glyph-for]')];
  const github = links.find((link) => link.dataset.glyphFor === 'git');
  if (!github) return;

  let over = false,
    shown = false,
    timer = 0;
  const end = () => {
    if (over) return;
    over = true;
    sessionStorage.setItem(DONE_KEY, '1');
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

  void whenUncovered(document.documentElement).then(() => {
    timer = window.setTimeout(() => {
      const glyph = spill();
      if (over || !glyph) return;
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
    }, SETTLE_MS);
  });
}
