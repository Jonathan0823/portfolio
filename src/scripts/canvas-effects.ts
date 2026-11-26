import {
  FINE_POINTER_QUERY,
  REDUCE_QUERY,
  canRunTrail,
  prefersReducedMotion,
  watchPixelRatio,
  whenIdle,
} from './motion';
import { mountHeroField, type HeroField } from './hero-field';
import { mountCursorTrail } from './cursor-trail';
import { mountGlyphSpill } from './glyph-spill';
import { FIELD_BLEED, fieldShape } from './field-edges';
import { mountHeroHint } from './hero-hint';
import { FOOT_BLEED, mountFooterTide, tideSwell } from './footer-tide';

const SEEDS: Record<string, number> = { hero: 1.3, strip: 4.7, foot: 8.1 };
const hosts = [...document.querySelectorAll<HTMLElement>('[data-pixel-field]')];

if (typeof window.matchMedia === 'function') {
  const fields: HeroField[] = hosts.map((host) => {
    const kind = host.dataset.pixelField ?? 'hero';
    return mountHeroField(host, prefersReducedMotion(), {
      seed: SEEDS[kind] ?? 2.2,
      flipped: kind === 'foot',
      shape: (motion) => ({
        ...fieldShape(kind, host.getBoundingClientRect(), scrollY, innerHeight, motion),
        ...(kind === 'foot' ? { swell: tideSwell.rows, crest: tideSwell.crest, stamp: tideSwell.stamp } : {}),
      }),
      // the footer bleeds further up so the tide has room to rise
      bleed: kind === 'foot' ? FOOT_BLEED : FIELD_BLEED,
    });
  });
  const hero = fields[hosts.findIndex((h) => h.dataset.pixelField === 'hero')] ?? null;
  const glyphCanvas = document.querySelector<HTMLCanvasElement>('canvas[data-glyph]');
  let stopTrail: (() => void) | null = null;
  let stopGlyph: (() => void) | null = null;
  let glyphReduced: boolean | null = null;

  const sync = () => {
    const reduced = prefersReducedMotion();
    fields.forEach((f) => f.setReduced(reduced));
    const trail = canRunTrail();
    if (trail && !stopTrail) stopTrail = mountCursorTrail(fields);
    if (!trail && stopTrail) {
      stopTrail();
      stopTrail = null;
    }
    if (hero && glyphCanvas && reduced !== glyphReduced) {
      stopGlyph?.();
      stopGlyph = mountGlyphSpill(glyphCanvas, hero, reduced);
      glyphReduced = reduced;
    }
  };
  whenIdle(sync);
  whenIdle(mountHeroHint);
  const foot = fields[hosts.findIndex((h) => h.dataset.pixelField === 'foot')];
  if (foot) whenIdle(() => mountFooterTide(foot));
  for (const q of [REDUCE_QUERY, FINE_POINTER_QUERY]) window.matchMedia(q).addEventListener('change', sync);
  watchPixelRatio(() => fields.forEach((f) => f.resize()));
}
