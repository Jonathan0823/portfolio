// Entry point for the decorative canvases. Everything here is aria-hidden and ignores pointer events.
import { FINE_POINTER_QUERY, REDUCE_QUERY, canRunTrail, prefersReducedMotion, watchPixelRatio } from './motion';
import { mountHeroField } from './hero-field';
import { mountCursorTrail } from './cursor-trail';
import { mountGlyphSpill } from './glyph-spill';

const host = document.querySelector<HTMLElement>('[data-hero-canvas]');

if (host && typeof window.matchMedia === 'function') {
  const hero = mountHeroField(host, prefersReducedMotion());
  const glyphCanvas = document.querySelector<HTMLCanvasElement>('canvas[data-glyph]');
  let stopTrail: (() => void) | null = null;
  let stopGlyph: (() => void) | null = null;
  let glyphReduced: boolean | null = null;

  // Re-evaluated whenever the reduced-motion or pointer media queries change.
  const sync = () => {
    hero.setReduced(prefersReducedMotion());
    const trail = canRunTrail();
    if (trail && !stopTrail) stopTrail = mountCursorTrail(hero);
    if (!trail && stopTrail) { stopTrail(); stopTrail = null; }
    // The glyph shows on every screen; reduced motion remounts it so it draws statically.
    const reduced = prefersReducedMotion();
    if (glyphCanvas && reduced !== glyphReduced) {
      stopGlyph?.();
      stopGlyph = mountGlyphSpill(glyphCanvas, hero, reduced);
      glyphReduced = reduced;
    }
  };
  sync();
  for (const q of [REDUCE_QUERY, FINE_POINTER_QUERY]) window.matchMedia(q).addEventListener('change', sync);
  watchPixelRatio(() => hero.resize());
}
