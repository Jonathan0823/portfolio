import {
  FINE_POINTER_QUERY,
  REDUCE_QUERY,
  canRunCursor,
  prefersReducedMotion,
  watchPixelRatio,
  whenIdle,
} from './motion';
import { mountHeroField, type HeroField } from './hero-field';
import { mountCursor } from './cursor';
import { mountGlyphSpill, type GlyphSpill } from './glyph-spill';
import { FIELD_BLEED, fieldShape } from './field-edges';
import { FOOT_BLEED, mountFooterTide, tideSwell } from './footer-tide';
import { heroLifeShape, mountHeroLife } from './hero-life';
import { mountHeroMascots } from './hero-mascots';
import { footWordmarkShape } from './footer-wordmark';
import { mountFooterMascots } from './footer-mascots';
import { combineInputs, mountSurfaceWaves, type SurfaceWaves } from './surface-waves';
import { hoverInput } from './wave-hover';
import { touchInput } from './wave-touch';
import { blastInput } from './wave-blast';
import { CALM } from './surface-wave';

const SEEDS: Record<string, number> = { hero: 1.3, strip: 4.7, foot: 8.1 };
const hosts = [...document.querySelectorAll<HTMLElement>('[data-pixel-field]')];

if (typeof window.matchMedia === 'function') {
  // read by every field's shape, so declared before the fields mount
  let waves: SurfaceWaves | null = null;
  const fields: HeroField[] = hosts.map((host) => {
    const kind = host.dataset.pixelField ?? 'hero';
    return mountHeroField(host, prefersReducedMotion(), {
      seed: SEEDS[kind] ?? 2.2,
      flipped: kind === 'foot',
      shape: (motion) => {
        const base = {
          ...fieldShape(kind, host.getBoundingClientRect(), scrollY, innerHeight, motion),
          ...(kind === 'foot'
            ? {
                swell: tideSwell.rows,
                stamp: tideSwell.stamp,
                cap: tideSwell.cap,
              }
            : {}),
        };
        const field = fields[hosts.indexOf(host)];
        return {
          ...base,
          // the hero's ignite empties its field, and the footer's wordmark moulds its cells
          ...(kind === 'hero' ? heroLifeShape(field, motion, base) : {}),
          ...(kind === 'foot' ? footWordmarkShape(field, motion, base.coverage) : {}),
          ...(waves?.shape(field) ?? {}),
        };
      },
      // the footer bleeds further up so the tide has room to rise
      bleed: kind === 'foot' ? FOOT_BLEED : FIELD_BLEED,
    });
  });
  const hero = fields[hosts.findIndex((h) => h.dataset.pixelField === 'hero')] ?? null;
  const glyphCanvas = document.querySelector<HTMLCanvasElement>('canvas[data-glyph]');
  let stopCursor: (() => void) | null = null;
  let wavesKey: string | null = null;
  let glyph: GlyphSpill | null = null;
  let glyphKey: string | null = null;

  const sync = () => {
    const reduced = prefersReducedMotion();
    fields.forEach((f) => f.setReduced(reduced));
    // reduced motion keeps the system cursor: it never gets the pixel pointer, the charge or the page impact
    const cursor = canRunCursor();
    if (cursor && !stopCursor) stopCursor = mountCursor(fields);
    if (!cursor && stopCursor) {
      stopCursor();
      stopCursor = null;
    }
    // the Wave: a hovering mouse presses the surfaces and a charged blast rolls across them; on touch, taps and the page's scrolling move them
    const fine = window.matchMedia(FINE_POINTER_QUERY).matches;
    const nextWaves = reduced ? null : fine ? 'hover' : 'touch';
    if (nextWaves !== wavesKey) {
      waves?.stop();
      waves = nextWaves
        ? mountSurfaceWaves(fields, nextWaves === 'hover' ? combineInputs(hoverInput, blastInput(fields)) : touchInput)
        : null;
      wavesKey = nextWaves;
    }
    // the glyph spill reads both when it mounts, so a change of either remounts it
    const key = `${reduced}:${window.matchMedia(FINE_POINTER_QUERY).matches}`;
    if (hero && glyphCanvas && key !== glyphKey) {
      glyph?.stop();
      glyph = mountGlyphSpill(glyphCanvas, hero, reduced);
      glyphKey = key;
    }
  };
  // a still field is not repainted by itself, and the nav's dark band has to follow the scroll (field-edges.ts)
  addEventListener(
    'scroll',
    () => {
      if (!prefersReducedMotion()) return;
      fields.forEach((f, i) => hosts[i].dataset.pixelField !== 'foot' && f.markDirty());
    },
    { passive: true },
  );
  whenIdle(sync);
  whenIdle(() => void mountHeroMascots(hero, mountHeroLife(hero)));
  const foot = fields[hosts.findIndex((h) => h.dataset.pixelField === 'foot')];
  // hover drives the tide, so it exists on a fine pointer only and switching pointer remounts it
  let stopTide: (() => void) | null = null;
  const mountTide = () => {
    stopTide?.();
    stopTide = foot && window.matchMedia(FINE_POINTER_QUERY).matches ? mountFooterTide(foot) : null;
  };
  whenIdle(mountTide);
  // Clawd and Pi stand on the wordmark; reduced motion keeps them still, so a change of it remounts them
  let stopMascots: (() => void) | null = null;
  const mountMascots = () => {
    stopMascots?.();
    stopMascots = foot
      ? mountFooterMascots(foot, prefersReducedMotion(), (from, to) => waves?.under(foot, from, to) ?? CALM)
      : null;
  };
  whenIdle(mountMascots);
  for (const q of [REDUCE_QUERY, FINE_POINTER_QUERY])
    window.matchMedia(q).addEventListener('change', () => {
      sync();
      mountTide();
      mountMascots();
    });
  watchPixelRatio(() => fields.forEach((f) => f.resize()));
}
