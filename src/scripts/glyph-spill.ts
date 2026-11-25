import { PALETTE as COL, fbm, hash } from './pixel-math';
import { BITMAPS, assignPixels, pickSourceColumns, type GlyphName } from './glyph-model';
import type { HeroField } from './hero-field';

const G = 14, cols = 32, rows = 38, TR = 12;
const GLYPH_WIDTH = cols * G;

interface Particle {
  ti: number; tj: number; sx: number; sy: number; L1: number; L: number;
  t0: number; del: number; out: boolean; x: number; y: number; src: number;
  ox?: number; oy?: number; k?: number;
}
interface Source { x: number; y: number; k: number }

/**
 * Glyph spill: hovering a hero link makes pixels rise from the hero field and form its icon.
 * Desktop only. Returns a function that removes the listeners.
 */
export function mountGlyphSpill(canvas: HTMLCanvasElement, hero: HeroField): () => void {
  const ctx = canvas.getContext('2d')!;
  let parts: Particle[] = [];
  let srcs: Source[] = [];
  let raf = 0, timer = 0, tt = 0, dpr = 0;

  const ensureSize = () => {
    const d = Math.min(2, window.devicePixelRatio || 1);
    if (d === dpr) return;
    dpr = d;
    canvas.width = cols * G * dpr;
    canvas.height = rows * G * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  /** Column of the hero field where the canvas starts; also snaps the canvas to the field grid. */
  const originColumn = () => {
    const F = hero.field();
    const OX = Math.max(0, Math.floor((F.w - 96 - GLYPH_WIDTH) / G));
    canvas.style.left = OX * G + 'px';
    return OX;
  };

  const sources = (): Source[] => {
    const F = hero.field(), OX = originColumn();
    const usable = F.cs === G;
    const low: number[] = [];
    for (let i = 0; i < cols; i++) low.push(usable && F.low[OX + i] !== undefined ? Math.max(F.low[OX + i], 14) : 20);
    return pickSourceColumns(low).map(i => ({ x: i, y: low[i] - TR + 1, k: usable ? F.lowK[OX + i] : 1 }));
  };

  const set = (name: GlyphName | null) => {
    if (!canvas.offsetParent) return; // hidden below the desktop breakpoint
    ensureSize();
    const now = performance.now();
    for (const q of parts) {
      if (!q.out) {
        q.out = true; q.t0 = now; q.ox = q.x; q.oy = q.y; q.del = hash(q.ti, q.tj) * 0.12;
      }
    }
    if (name) {
      srcs = sources();
      const per = assignPixels(BITMAPS[name], cols, rows, srcs.map(s => s.x));
      per.forEach((list, k) => {
        const s = srcs[k];
        list.forEach((p, n) => {
          const L1 = Math.max(0, p.tj - s.y), L = L1 + Math.abs(p.ti - s.x);
          parts.push({ ti: p.ti, tj: p.tj, sx: s.x, sy: s.y, L1, L, t0: now, del: n * 0.018 + k * 0.03, out: false, x: s.x, y: s.y - 1, src: k });
        });
      });
    }
    kick();
  };

  const at = (q: Particle, u: number): [number, number] =>
    u < q.L1 ? [q.sx, q.sy + u] : [q.sx + Math.sign(q.ti - q.sx) * Math.min(Math.abs(q.ti - q.sx), u - q.L1), Math.max(q.sy, q.tj)];

  const loop = (now: number) => {
    raf = 0;
    tt += 0.02;
    const ft = hero.time() || tt;
    ctx.clearRect(0, 0, cols * G, rows * G);
    let active = false;
    parts = parts.filter(q => {
      const e = (now - q.t0) / 1000 - q.del;
      let alpha = 1, moving = false, trailPos: [number, number] | null = null;
      if (!q.out) {
        if (e < 0) return true;
        const u = Math.min(q.L, 26 * e + 30 * e * e);
        const p = at(q, u), pb = at(q, Math.max(0, u - 1.2));
        q.x = p[0]; q.y = p[1]; moving = u < q.L;
        if (moving) trailPos = pb;
      } else if (e > 0) {
        const k = e / 0.55;
        q.y = (q.oy ?? q.y) + 30 * k * k;
        alpha = Math.max(0, 1 - k * 1.6);
        moving = true;
        if (alpha <= 0) return false;
      }
      if (moving) active = true;
      const sk = srcs[q.src] ? srcs[q.src].k : (q.k ?? 1);
      q.k = sk;
      const lvl = Math.max(0, Math.min(5, sk - (fbm(Math.round(q.x) * 0.3 - ft * 0.9, Math.floor(q.y) * 0.3) < 0.45 ? 1 : 0)));
      ctx.fillStyle = COL[lvl];
      if (trailPos) {
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillRect(Math.round(trailPos[0]) * G + 1, Math.floor(trailPos[1]) * G + 1, G - 1, G - 1);
      }
      ctx.globalAlpha = alpha;
      ctx.fillRect(Math.round(q.x) * G + 1, Math.floor(q.y) * G + 1, G - 1, G - 1);
      return true;
    });
    ctx.globalAlpha = 1;
    if (active) raf = requestAnimationFrame(loop);
    else if (parts.length) timer = window.setTimeout(() => { timer = 0; kick(); }, 50);
  };
  const kick = () => {
    if (timer) { clearTimeout(timer); timer = 0; }
    if (!raf) raf = requestAnimationFrame(loop);
  };

  const off: Array<() => void> = [];
  document.querySelectorAll<HTMLElement>('[data-glyph-for]').forEach(l => {
    const name = l.dataset.glyphFor as GlyphName;
    if (!(name in BITMAPS)) return;
    const on = () => set(name), out = () => set(null);
    l.addEventListener('mouseenter', on);
    l.addEventListener('mouseleave', out);
    l.addEventListener('focus', on);
    l.addEventListener('blur', out);
    off.push(() => {
      l.removeEventListener('mouseenter', on);
      l.removeEventListener('mouseleave', out);
      l.removeEventListener('focus', on);
      l.removeEventListener('blur', out);
    });
  });

  return () => {
    off.forEach(f => f());
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    parts = [];
    ctx.clearRect(0, 0, cols * G, rows * G);
  };
}
