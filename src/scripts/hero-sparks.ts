// The hero show's sparks: bursts where a mascot lands, the ring that closes in while a blast charges, and the
// shockwave that leaves when it is let go. Drawn as square pixels in the lava's colours.

const HOT = ['#FFC43C', '#FF7A28', '#E5484D'];
const PIXEL = 5;
const SPARK_S = 0.5;
const WAVE_S = 0.45;

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  c: string;
}
interface Wave {
  x: number;
  y: number;
  born: number;
  charge: number;
}

export interface Sparks {
  /** n sparks thrown up from a point */
  burst(x: number, y: number, n: number, now: number): void;
  /** the shockwave and the sparks thrown out in every direction by a blast */
  blast(x: number, y: number, charge: number, now: number): void;
  draw(ctx: CanvasRenderingContext2D, now: number): void;
  /** the ring that closes in on the pointer while charging */
  drawCharge(ctx: CanvasRenderingContext2D, x: number, y: number, charge: number, now: number): void;
  /** anything still to draw, so the show cannot rest */
  busy(): boolean;
}

const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const snap = (v: number) => Math.round(v / PIXEL) * PIXEL;

export function createSparks(): Sparks {
  const sparks: Spark[] = [];
  const waves: Wave[] = [];
  return {
    burst(x, y, n, now) {
      for (let i = 0; i < n; i++)
        sparks.push({ x, y, vx: rnd(-130, 130), vy: -rnd(100, 300), born: now, c: HOT[i % 3] });
    },
    blast(x, y, charge, now) {
      waves.push({ x, y, born: now, charge });
      const n = 10 + Math.round(charge * 22);
      const power = 0.4 + 0.6 * charge;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + rnd(-0.1, 0.1);
        const speed = rnd(200, 520) * (0.6 + power);
        sparks.push({
          x,
          y,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - 80,
          born: now,
          c: HOT[i % 3],
        });
      }
    },
    drawCharge(ctx, x, y, charge, now) {
      const radius = 64 - 46 * charge;
      ctx.fillStyle = HOT[charge < 0.4 ? 0 : charge < 0.8 ? 1 : 2];
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * Math.PI * 2 + now / 300;
        const jitter = charge > 0.9 ? rnd(-2, 2) : 0;
        ctx.fillRect(
          Math.round(x + Math.cos(ang) * radius + jitter - 2),
          Math.round(y + Math.sin(ang) * radius + jitter - 2),
          PIXEL,
          PIXEL,
        );
      }
    },
    draw(ctx, now) {
      for (let i = waves.length - 1; i >= 0; i--) {
        const w = waves[i];
        const age = (now - w.born) / 1000;
        if (age > WAVE_S) {
          waves.splice(i, 1);
          continue;
        }
        const r = age * 820 * (0.6 + 0.4 * w.charge);
        ctx.globalAlpha = 1 - age / WAVE_S;
        ctx.fillStyle = HOT[Math.min(2, Math.floor(age / 0.15))];
        const n = Math.min(70, Math.round(r / 6) + 8);
        for (let k = 0; k < n; k++) {
          const ang = (k / n) * Math.PI * 2;
          ctx.fillRect(snap(w.x + Math.cos(ang) * r), snap(w.y + Math.sin(ang) * r), PIXEL, PIXEL);
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        const age = (now - s.born) / 1000;
        if (age > SPARK_S) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = 1 - age / SPARK_S;
        ctx.fillStyle = s.c;
        ctx.fillRect(snap(s.x + s.vx * age), snap(s.y + s.vy * age + 700 * age * age), PIXEL, PIXEL);
      }
      ctx.globalAlpha = 1;
    },
    busy: () => sparks.length > 0 || waves.length > 0,
  };
}
