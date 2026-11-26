// Guide cursor: tells desktop visitors that the hero's contact links spill a pixel logo on hover.
// A second after load the cursor morphs into a pixel arrow. Moving, it points at the nearest link;
// resting, it hops across all three. It ends for the session on the first real hover of a link.
import { FINE_POINTER_QUERY, prefersReducedMotion } from './motion';
import { setCursorGuide } from './cursor-trail';

/** the guide hops email → GitHub → LinkedIn so all three read as one set */
const HOP_MS = 1100;
/** how long the pointer rests before the guide starts hopping */
const REST_MS = 700;
/** the cursor stays a normal blob this long after load, then morphs into the arrow */
const GUIDE_AFTER_MS = 1000;
const DISCOVERED_KEY = 'px-guide-done';

export function mountHeroHint(): void {
  if (!window.matchMedia(FINE_POINTER_QUERY).matches || prefersReducedMotion()) return;
  if (sessionStorage.getItem(DISCOVERED_KEY)) return;
  const links = [...document.querySelectorAll<HTMLElement>('[data-glyph-for]')];
  const section = links[0]?.closest('section');
  if (!section) return;

  let done = false,
    armed = false,
    guided: HTMLElement | null = null,
    hopTimer = 0,
    restTimer = 0,
    px = -1,
    py = -1;

  const aimAt = (link: HTMLElement) => {
    if (guided === link) return;
    guided = link;
    setCursorGuide(link);
  };
  const stopGuide = () => {
    clearInterval(hopTimer);
    clearTimeout(restTimer);
    if (!guided) return;
    guided = null;
    setCursorGuide(null);
  };
  const inHero = () => {
    if (px < 0) return false;
    const r = section.getBoundingClientRect();
    return px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;
  };
  const nearest = () => {
    let best = links[0],
      bestD = Infinity;
    for (const link of links) {
      const r = link.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - px, r.top + r.height / 2 - py);
      if (d < bestD) [best, bestD] = [link, d];
    }
    return best;
  };

  const update = () => {
    if (done || !armed) return;
    if (!inHero()) return stopGuide();
    // moving: the arrow points at the nearest link; resting: it hops across all three
    clearInterval(hopTimer);
    clearTimeout(restTimer);
    aimAt(nearest());
    restTimer = window.setTimeout(() => {
      let index = links.indexOf(guided!);
      hopTimer = window.setInterval(() => {
        index = (index + 1) % links.length;
        aimAt(links[index]);
      }, HOP_MS);
    }, REST_MS);
  };
  const onMove = (e: MouseEvent) => {
    px = e.clientX;
    py = e.clientY;
    update();
  };
  const onScroll = () => {
    if (guided && !inHero()) stopGuide();
  };
  const finish = (e: Event) => {
    // the spill's own auto-cycle dispatches synthetic hovers; only a real one counts as found
    if (!e.isTrusted || done) return;
    done = true;
    sessionStorage.setItem(DISCOVERED_KEY, '1');
    stopGuide();
    document.removeEventListener('mousemove', onMove);
    window.removeEventListener('scroll', onScroll);
  };

  links.forEach((link) => link.addEventListener('mouseenter', finish));
  document.addEventListener('mousemove', onMove);
  window.addEventListener('scroll', onScroll, { passive: true });
  setTimeout(() => {
    armed = true;
    update();
  }, GUIDE_AFTER_MS);
}
