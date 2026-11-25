import { PALETTE as COL, hash, heatLevel } from './pixel-math';
import type { HeroField } from './hero-field';

const G = 14; // cell size
const N = 64; // overlay cells per side
const H = 32; // cursor cell inside the overlay
const S = N * G;
const TN = 120, TH = 60, TS = TN * G;

/**
 * The cursor pixel trail: a pixel blob that follows the pointer plus fading cells left behind.
 * Overlays are fixed-position and ignore pointer events; the system cursor is never hidden.
 * Returns a function that removes everything.
 */
export function mountCursorTrail(hero: HeroField | null): () => void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const mk = (blend: boolean) => {
    const c = document.createElement('canvas');
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = `position:fixed;left:0;top:0;width:${S}px;height:${S}px;pointer-events:none;z-index:51;opacity:0;transition:opacity .15s;${blend ? 'mix-blend-mode:difference;' : ''}`;
    c.width = S * dpr;
    c.height = S * dpr;
    const x = c.getContext('2d')!;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    document.body.appendChild(c);
    return [c, x] as const;
  };
  const [cvA, cA] = mk(true);
  const [cvB, cB] = mk(false);
  const both = [cvA, cvB];

  const cvT = document.createElement('canvas');
  cvT.setAttribute('aria-hidden', 'true');
  cvT.style.cssText = `position:fixed;left:0;top:0;width:${TS}px;height:${TS}px;pointer-events:none;z-index:-1;image-rendering:pixelated`;
  cvT.width = TS;
  cvT.height = TS;
  const cT = cvT.getContext('2d')!;
  const prevIsolation = document.body.style.isolation;
  document.body.style.isolation = 'isolate';
  document.body.insertBefore(cvT, document.body.firstChild);

  const trail = new Map<string, { i: number; j: number; h: number }>();
  let tx = 0, ty = 0, x = 0, y = 0, v = 0, ang = 0, t = 0, r0 = 1.5, rT = 1.5;
  let raf = 0, timer = 0, shown = false, W = 0, WT = 0, hc = 0;
  let svx = 0, svy = 0, link: Element | null = null, lp = 0, linkMode = false;
  let cur = { k: 0, ang: 0, w: 0, t: 0 };

  const shapeD = (du: number, dv: number, r: number) => {
    const ca = Math.cos(cur.ang), sa = Math.sin(cur.ang), u = du * ca + dv * sa, vv = -du * sa + dv * ca;
    const a = r * (1 + cur.k), b = r / (1 + cur.k * 0.45), th = Math.atan2(vv, u);
    const wob = 1 + cur.w * (0.3 * Math.sin(3 * th + cur.t) + 0.2 * Math.sin(5 * th - 1.7 * cur.t));
    return Math.sqrt((u / a) * (u / a) + (vv / b) * (vv / b)) / wob;
  };
  const cell = (i: number, j: number, ox: number, oy: number, ctx: CanvasRenderingContext2D) =>
    ctx.fillRect((i - ox) * G + 1, (j - oy) * G + 1, G - 1, G - 1);

  const tick = () => {
    raf = 0;
    const px = x, py = y;
    x += (tx - x) * 0.35;
    y += (ty - y) * 0.35;
    t += 0.12;
    r0 += (rT - r0) * 0.25;
    const dx = x - px, dy = y - py, sp = Math.hypot(dx, dy);
    svx += (dx - svx) * 0.18;
    svy += (dy - svy) * 0.18;
    const sv = Math.hypot(svx, svy);
    v += (sv - v) * 0.5;
    if (sv > 0.6) {
      const ta = Math.atan2(svy, svx);
      let da = ta - ang;
      da -= Math.round(da / Math.PI) * Math.PI;
      ang += da * 0.3;
    }
    const k = Math.min(v / 18, 1), w = Math.min(0.6, v / 40);
    cur = { k, ang, w, t };
    const ccx = Math.floor(x / G), ccy = Math.floor(y / G), ox = ccx - H, oy = ccy - H;
    for (const c of both) c.style.transform = `translate(${ox * G}px,${oy * G}px)`;
    cA.clearRect(0, 0, S, S);
    cB.clearRect(0, 0, S, S);
    cA.fillStyle = '#FFFFFF';
    const ft = hero ? hero.time() : t * 0.2;
    W += (WT - W) * 0.15;
    const We = Math.min(1, W + k * 0.25);
    lp += ((linkMode ? 1 : 0) - lp) * 0.3;

    if (lp > 0.02 && link && link.isConnected) {
      const r = link.getBoundingClientRect();
      const row = Math.floor((r.bottom + 5) / G), i0 = Math.floor(r.left / G), i1 = Math.floor((r.right - 1) / G);
      const half = (i1 - i0 + 1) / 2 + 0.5, mid = (i0 + i1 + 1) / 2;
      for (let i = i0; i <= i1; i++) if (Math.abs(i + 0.5 - mid) <= half * lp) cell(i, row, ox, oy, cA);
    }
    const blobA = lp < 0.5 ? 1 - lp / 0.5 : 0;
    if (blobA > 0.05) {
      const rr = r0 * Math.max(0.3, blobA), rb = Math.ceil(rr * (1 + k) * 1.4) + 1;
      for (let j = ccy - rb; j <= ccy + rb; j++) {
        for (let i = ccx - rb; i <= ccx + rb; i++) {
          const d = shapeD(i + 0.5 - x / G, j + 0.5 - y / G, rr);
          if (d > 1) continue;
          if (We < 0.12 || (We < 0.4 && d < 0.45)) cell(i, j, ox, oy, cA);
          else {
            cB.fillStyle = COL[heatLevel(i, j, d, k, ft, We)];
            cell(i, j, ox, oy, cB);
          }
        }
      }
    }

    // Heat dragged into the hero field, and fading cells left on the page near it.
    const n = Math.max(1, Math.min(40, Math.ceil(sp / (G * 0.5))));
    let inH = false;
    if (hero) {
      const z = hero.rect(), m = 3 * G;
      const near = shown && x >= z.left - m && x <= z.right + m && y >= z.top - m && y <= z.bottom + m;
      if (near) {
        if (x >= z.left && x <= z.right && y >= z.top && y <= z.bottom) inH = true;
        const F = hero.field(), cs = F.cs, rad = 2.2;
        for (let q = 1; q <= n; q++) {
          const mc = (px + (dx * q) / n - z.left) / cs, mr = (py + (dy * q) / n - z.top) / cs;
          for (let yy = Math.max(0, Math.floor(mr - rad)); yy < Math.min(F.R, mr + rad); yy++) {
            for (let xx = Math.max(0, Math.floor(mc - rad)); xx < Math.min(F.C, mc + rad); xx++) {
              const d = Math.hypot(xx + 0.5 - mc, yy + 0.5 - mr) / rad;
              if (d < 1) F.heat[yy * F.C + xx] = Math.max(F.heat[yy * F.C + xx], 0.55 + (1 - d) * 0.35);
            }
          }
        }
        hero.markDirty();
      }
    }
    hc = inH ? 1 : hc * 0.93;
    if (shown && !inH && hc > 0.05 && v > 1.2) {
      const amt = hc * Math.min(1, v / 18), rad = 1.5;
      for (let q = 1; q <= n; q++) {
        const mc = (px + (dx * q) / n) / G, mr = (py + (dy * q) / n) / G;
        for (let jj = Math.floor(mr - rad); jj < mr + rad; jj++) {
          for (let ii = Math.floor(mc - rad); ii < mc + rad; ii++) {
            const d = Math.hypot(ii + 0.5 - mc, jj + 0.5 - mr) / rad;
            if (d > 1) continue;
            const key = ii + ',' + jj, h = amt * (1 - d * 0.5), o = trail.get(key);
            if (!o || o.h < h) trail.set(key, { i: ii, j: jj, h });
          }
        }
      }
    }
    cvT.style.transform = `translate(${(ccx - TH) * G}px,${(ccy - TH) * G}px)`;
    cT.clearRect(0, 0, TS, TS);
    trail.forEach((o, key) => {
      o.h *= 0.9;
      if (o.h < 0.08) {
        trail.delete(key);
        return;
      }
      const li = o.i - ccx + TH, lj = o.j - ccy + TH;
      if (li < 0 || lj < 0 || li >= TN || lj >= TN) return;
      const lv = Math.max(0, Math.min(5, Math.round(o.h * 5 - (hash(o.i, o.j, Math.floor(t * 3)) < 0.3 ? 1 : 0))));
      cT.fillStyle = COL[lv];
      cT.fillRect(li * G + 1, lj * G + 1, G - 1, G - 1);
    });

    const busy = trail.size > 0 || Math.abs(WT - W) > 0.01 || Math.abs(tx - x) + Math.abs(ty - y) > 0.2 ||
      v > 0.15 || Math.abs(rT - r0) > 0.02 || (lp > 0.02 && lp < 0.98);
    if (shown) {
      if (busy) raf = requestAnimationFrame(tick);
      else timer = window.setTimeout(() => { timer = 0; if (shown && !raf) raf = requestAnimationFrame(tick); }, 60);
    }
  };

  const wake = () => {
    if (timer) { clearTimeout(timer); timer = 0; }
    if (!raf) raf = requestAnimationFrame(tick);
  };

  const onMove = (e: MouseEvent) => {
    tx = e.clientX;
    ty = e.clientY;
    if (!shown) { x = tx; y = ty; shown = true; }
    const el = e.target instanceof Element ? e.target : null;
    for (const c of both) c.style.opacity = '1';
    let dmin = 1e9;
    document.querySelectorAll('canvas[data-px],canvas[data-cal]').forEach(c => {
      const z = c.getBoundingClientRect();
      const ddx = Math.max(z.left - tx, 0, tx - z.right), ddy = Math.max(z.top - ty, 0, ty - z.bottom);
      dmin = Math.min(dmin, Math.hypot(ddx, ddy));
    });
    WT = Math.max(0, Math.min(1, 1 - dmin / 260));
    const a = el?.closest('a,button') ?? null, big = el?.closest('h1,h2');
    linkMode = !!a;
    if (a) link = a;
    rT = big ? 3.6 : 1.5;
    wake();
  };
  const onLeave = () => {
    for (const c of both) c.style.opacity = '0';
    shown = false;
  };
  document.addEventListener('mousemove', onMove);
  document.documentElement.addEventListener('mouseleave', onLeave);

  return () => {
    document.removeEventListener('mousemove', onMove);
    document.documentElement.removeEventListener('mouseleave', onLeave);
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    cvA.remove();
    cvB.remove();
    cvT.remove();
    document.body.style.isolation = prevIsolation;
  };
}
