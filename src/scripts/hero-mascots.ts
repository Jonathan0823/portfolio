// The hero's mascot intro. Once the hero has settled, Clawd lets go of the lava and lands on the headline, knocking "Hi, I'm"
// crooked. He panics, then hops letter to letter straightening it, and Pi drops from the lava onto his head. Clawd
// catches him, Pi hops down onto the name and both stay there, idling. A click makes one jump; holding the pointer
// charges a blast that throws them off the name and back.
// The headline is drawn letter by letter on a canvas while the letters are crooked (each where the browser put it),
// and the real text comes back for good once they are straight: after that it is never touched.
import type { HeroField } from './hero-field';
import { drawMascot, type View } from './mascot-draw';
import { CLAWD, PI } from './mascot-sprites';
import type { Pose } from './mascot-motion';
import { REDUCE_QUERY, prefersReducedMotion } from './motion';
import { measureHeadline, type Letter } from './hero-headline';
import { isMoving, knock, straighten, stepSpring } from './letter-spring';
import { BLAST_MIN_MS, chargeOf, floorUnder, throwOf } from './hero-blast';
import { createSparks } from './hero-sparks';
import { mountHeroPointer } from './hero-pointer';
import { bob, makeActor, stepIdle, type Actor, type Then } from './hero-actor';

const GRAVITY = 2600;
const PANIC_S = 0.55;
const FIX_HOP_S = 0.17;
/** the show starts this long after the hero has settled */
const START_DELAY_MS = 500;
/** an idle show redraws this often: it has nothing fast to show */
const IDLE_FRAME_MS = 32;

const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const smooth = (p: number) => p * p * (3 - 2 * p);

/** Plays the intro once the hero has settled; the returned function ends it at once, leaving the real headline. */
export function mountHeroMascots(hero: HeroField | null, settled: Promise<void>): () => void {
  let stop = () => {};
  let cancelled = false;
  void settled.then(() => {
    if (cancelled) return;
    const wait = window.setTimeout(() => {
      if (!cancelled) stop = play(hero);
    }, START_DELAY_MS);
    stop = () => clearTimeout(wait);
  });
  return () => {
    cancelled = true;
    stop();
  };
}

function play(hero: HeroField | null): () => void {
  const section = document.getElementById('top');
  const h1 = section?.querySelector<HTMLElement>('h1');
  if (!hero || !section || !h1 || prefersReducedMotion()) return () => {};
  const field = hero.field();
  const cs = field.cellSize;
  const unit = cs / 2;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const box = section.getBoundingClientRect();
  const W = Math.round(box.width);
  const H = Math.round(box.height);
  const { letters, lines } = measureHeadline(h1, box, dpr);
  if (lines.length < 2) return () => {};

  const find = (line: number, ch: string) => lines[line].find((l) => l.ch === ch) ?? lines[line][0];
  const hostTop = hero.rect().top - box.top;
  const lavaAt = (x: number) =>
    hostTop + field.surface[Math.min(field.columns - 1, Math.max(0, Math.floor(x / cs)))] * cs;
  const make = (name: Actor['name'], line: number, landing: Letter, home: Letter) =>
    makeActor(name, name === 'pi' ? PI : CLAWD, lines[line], landing, home, lavaAt(landing.x + landing.w / 2), unit);
  const clawd = make('clawd', 0, find(0, 'I'), find(1, 'u'));
  const pi = make('pi', 1, find(1, 'u'), find(1, 'n'));
  const actors = [clawd, pi];
  const sizeOf = (a: Actor) => ({ w: a.sprite.width * unit, h: a.sprite.height * unit });
  /** Pi falls onto Clawd's head: where its feet land */
  const landY = (a: Actor) => (a === pi ? clawd.y - sizeOf(clawd).h - clawd.lift : a.landing.top);
  /** Pi waits until Clawd has straightened everything */
  const startWhen = (a: Actor) => a === clawd || (clawd.queue.length > 0 && clawd.next >= clawd.queue.length);

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('data-hero-mascots', '');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:20;pointer-events:none';
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  section.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  const view: View = { cell: cs, base: 0, wade: -1, height: H };
  const effects = createSparks();

  let last = 0;
  let lastDrawn = 0;
  let raf = 0;
  let lettersLive = false;
  let over = false;
  let introDone = false;
  let done = false;

  /** the headline is drawn here while the letters are crooked; the real text is hidden meanwhile */
  const showLetters = (on: boolean) => {
    lettersLive = on;
    if (on) h1.style.setProperty('-webkit-text-fill-color', 'transparent');
    else h1.style.removeProperty('-webkit-text-fill-color');
  };

  const throwable = (a: Actor) => a.mode === 'idle' || (a.mode === 'hop' && a.then !== 'fix');
  const pointer = mountHeroPointer(canvas, {
    // a press on a mascot makes it jump; quick presses jump higher, and the other one reacts
    press: (() => {
      let streak = 0;
      let lastPress = 0;
      return (x: number, y: number) => {
        for (const a of actors) {
          const { w, h } = sizeOf(a);
          if (a.mode !== 'idle' || x < a.x - 6 || x > a.x + w + 6 || y < a.y - h - 6 || y > a.y + 6) continue;
          const t = performance.now();
          streak = t - lastPress < 900 ? Math.min(3, streak + 1) : 1;
          lastPress = t;
          bob(a, 1, 18 + 9 * streak);
          effects.burst(a.x + w / 2, a.y, 2 + streak, t);
          const other = actors.find((o) => o !== a && o.mode === 'idle');
          if (other) other.reactIn = 0.15;
          return;
        }
      };
    })(),
    release(x, y, held) {
      if (held < BLAST_MIN_MS || !introDone) return;
      const now = performance.now();
      const charge = chargeOf(held);
      effects.blast(x, y, charge, now);
      // once the intro is over the headline stays still and only the mascots take the blast
      for (const a of actors) {
        if (!throwable(a)) continue;
        const { w, h } = sizeOf(a);
        const t = throwOf({ x, y }, { x: a.x + w / 2, y: a.y - h / 2 }, charge, Math.random);
        Object.assign(a, {
          mode: 'fly',
          t: 0,
          vx: t.vx,
          vy: t.vy,
          spin: t.spin,
          ang: 0,
          sx: 0.8,
          sy: 1.25,
          shuffled: false,
        });
        a.bobs = 0;
      }
    },
  });

  const cleanup = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    showLetters(false);
    canvas.remove();
    pointer.stop();
    removeEventListener('resize', cleanup);
    reduce.removeEventListener('change', onReduce);
  };
  const reduce = window.matchMedia(REDUCE_QUERY);
  const onReduce = () => reduce.matches && cleanup();
  reduce.addEventListener('change', onReduce);
  addEventListener('resize', cleanup);

  const startHop = (a: Actor, to: Letter, dur: number, h: number, then: Then) => {
    a.mode = 'hop';
    a.t = 0;
    a.then = then;
    a.hop = { x0: a.x, y0: a.y, x1: to.x + to.w / 2 - sizeOf(a).w / 2, y1: to.top, dur, h };
    a.at = to;
  };
  /** the landing knocks its line crooked, the nearest letters the most */
  const knockLine = (a: Actor) => {
    const at = a.letters.indexOf(a.landing);
    a.queue = a.letters.filter((_, j) => Math.abs(j - at) <= 2);
    a.letters.forEach((l, j) => {
      if (Math.abs(j - at) > 2) return;
      knock(l, Math.max(0.35, 1 - Math.abs(j - at) / 3), Math.random() < 0.5 ? -1 : 1, Math.random);
    });
  };
  const topAt = (a: Actor, cx: number) => {
    let best = a.letters[0];
    for (const l of a.letters) if (Math.abs(l.x + l.w / 2 - cx) < Math.abs(best.x + best.w / 2 - cx)) best = l;
    return best.top;
  };
  /** the next thing after a panic or a fix: the next crooked letter, or home onto the name */
  const carryOn = (a: Actor) => {
    if (a.next < a.queue.length) startHop(a, a.queue[a.next], FIX_HOP_S, 18, 'fix');
    else startHop(a, a.home, 0.46, 46, 'home');
  };
  /** the idle step off its place and back, along the second line */
  const wander = (a: Actor, back: boolean) => {
    if (back) {
      startHop(a, a.home, 0.3, 22, 'idle');
      return true;
    }
    const near = [a.home, ...lines[1]].filter(
      (l) => l !== a.at && Math.abs(l.x - a.home.x) < 130 && l.ch !== 'n' && l.ch !== 'u',
    );
    if (a.name !== 'clawd' || !near.length) return false;
    startHop(a, near[0], 0.3, 22, 'idle');
    return true;
  };
  const lastLineTop = (x: number) =>
    lines[lines.length - 1].reduce((b, l) => (Math.abs(l.x + l.w / 2 - x) < Math.abs(b.x + b.w / 2 - x) ? l : b)).top;

  const drawLetters = () => {
    for (const l of letters) {
      const cx = l.x + l.w / 2;
      const cy = l.baseline - l.fs * 0.3;
      ctx.save();
      ctx.translate(cx, cy + l.dy);
      ctx.rotate(l.rot);
      ctx.font = l.font;
      ctx.fillStyle = l.color;
      ctx.fillText(l.ch, l.x - cx, l.baseline - cy);
      ctx.restore();
    }
  };

  const frame = (now: number) => {
    if (done) return;
    raf = requestAnimationFrame(frame);
    if (pi.mode === 'idle') introDone = true;
    const held = pointer.heldMs(now);
    const charge = introDone && held !== null && held > 200 ? chargeOf(held) : 0;
    const charging = introDone && held !== null && held > 200;
    const resting = actors.every((a) => a.mode === 'idle' || a.mode === 'wait');
    if (!lettersLive && resting && !charging && !effects.busy() && now - lastDrawn < IDLE_FRAME_MS) return;
    // a skipped frame leaves `last` alone, so the next update gets all the time that has passed
    const dt = Math.min(50, last ? now - last : 16) / 1000;
    last = now;
    lastDrawn = now;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!lettersLive && !over && letters.some(isMoving)) showLetters(true);

    let still = true;
    for (const l of letters) {
      stepSpring(l, dt);
      if (isMoving(l)) still = false;
    }
    if (lettersLive) drawLetters();

    for (const a of actors) {
      const { w, h } = sizeOf(a);
      if (a.mode === 'wait') {
        if (!startWhen(a)) continue;
        a.mode = 'ooze';
        a.t = 0;
        a.y = a.lavaY;
        a.vy = 40;
      }
      a.t += dt;
      let lift = 0;
      let blink = false;
      let panic = false;
      let tilt = 0;
      // the squash it is easing toward
      let tsx = 1;
      let tsy = 1;
      if (a.mode === 'ooze') {
        // pulled out of the lava by its own weight: it slides out slowly, then faster, trailing a neck of lava, until it lets go
        a.vy += 1100 * dt;
        a.y += a.vy * dt;
        tsy = 1.12;
        tsx = 0.92;
        const gx = Math.round((a.x + w / 2 - cs / 2) / cs) * cs;
        const topY = a.y - h;
        const hot = ['#FFC43C', '#FF7A28', '#E5484D'];
        ctx.fillStyle = hot[2];
        ctx.fillRect(gx - cs, a.lavaY - cs, cs * 3, cs);
        for (let y = a.lavaY, j = 0; y < topY + cs; y += cs, j++) {
          ctx.globalAlpha = Math.max(0.2, 1 - (topY - a.lavaY) / (cs * 9));
          ctx.fillStyle = hot[2 - Math.min(2, j)];
          ctx.fillRect(gx, y, cs, cs);
        }
        ctx.globalAlpha = 1;
        if (topY >= a.lavaY + cs) a.mode = 'fall';
      } else if (a.mode === 'fall') {
        a.vy += GRAVITY * dt;
        a.y += a.vy * dt;
        tsy = 1 + Math.min(0.12, a.vy / 9000);
        tsx = 2 - tsy;
        const hot = ['#FFC43C', '#FF7A28', '#E5484D'];
        const gx = Math.round((a.x + w / 2 - cs / 2) / cs) * cs;
        for (let i = 1; i <= 3; i++) {
          ctx.globalAlpha = 1 - i * 0.28;
          ctx.fillStyle = hot[i - 1];
          ctx.fillRect(gx, a.y - h - i * cs, cs, cs);
        }
        ctx.globalAlpha = 1;
        if (a.y >= landY(a)) {
          a.mode = 'land';
          a.t = 0;
          a.y = landY(a);
          a.sx = 1.28;
          a.sy = 0.74;
          effects.burst(a.x + w / 2, a.y, a === pi ? 4 : 6, now);
          if (a === clawd) knockLine(a);
          else {
            // Clawd takes the weight, then bounces him
            clawd.sx = 1.22;
            clawd.sy = 0.74;
            bob(clawd, 1, 9);
          }
        }
      } else if (a.mode === 'land') {
        if (a === pi) a.y = landY(a);
        if (a.t > 0.22) {
          a.t = 0;
          if (a === pi) a.mode = 'caught';
          else {
            a.mode = 'panic';
            a.panicFrom = a.x;
          }
        }
      } else if (a.mode === 'caught') {
        // rides on Clawd's head for a moment, then hops down onto the name
        a.y = landY(a);
        if (a.t > 0.5) startHop(a, a.home, 0.34, 30, 'idle');
      } else if (a.mode === 'fly') {
        // thrown by a blast: tumbling through the air until it lands on the headline again
        a.vy += GRAVITY * dt;
        a.x += a.vx * dt;
        const fromY = a.y;
        a.y += a.vy * dt;
        a.ang += a.spin * dt;
        tilt = a.ang;
        if (a.x < 0 || a.x > W - w) {
          a.x = Math.max(0, Math.min(W - w, a.x));
          a.vx *= -0.5;
          a.spin *= -0.5;
        }
        a.leg = Math.floor(a.t / 0.05) % 2 ? 1 : 0;
        tsx = 0.92;
        tsy = 1.1;
        const cx = a.x + w / 2;
        const ground = floorUnder(letters, cx, fromY, lastLineTop(cx));
        if (a.vy > 0 && a.y >= ground && a.t > 0.08) {
          a.y = ground;
          a.mode = 'stunned';
          a.t = 0;
          a.sx = 1.35;
          a.sy = 0.66;
          effects.burst(a.x + w / 2, a.y, 5, now);
        }
      } else if (a.mode === 'stunned') {
        // dazed for a moment, then back to its place on the name
        blink = true;
        tilt = Math.sin(a.t * 30) * 3 * Math.max(0, 1 - a.t / 0.5);
        if (a.t > 0.55) startHop(a, a.home, 0.4, 30, 'idle');
      } else if (a.mode === 'panic') {
        // runs back and forth along its line in one smooth sweep after another, a red "!" flashing over its head
        panic = true;
        const last = a.queue[a.queue.length - 1];
        const lo = Math.max(a.letters[0].x, a.queue[0].x - 40);
        const hi = last.x + last.w - w + 40;
        const mid = (lo + hi) / 2;
        const amp = (hi - lo) / 2;
        const ramp = Math.min(1, a.t / 0.25);
        const want = mid + amp * 0.92 * Math.sin(a.t * 9 + 1.2);
        a.x = ramp < 1 ? a.panicFrom + (want - a.panicFrom) * smooth(ramp) : want;
        a.leg = Math.floor(a.t / 0.06) % 2 ? 1 : 0;
        a.y += (topAt(a, a.x + w / 2) - a.y) * Math.min(1, dt * 20);
        lift = Math.abs(Math.sin(a.t * 18)) * 6;
        tilt = Math.cos(a.t * 9 + 1.2) * 6;
        if (a.t > PANIC_S) carryOn(a);
      } else if (a.mode === 'hop') {
        const p = Math.min(1, a.t / a.hop.dur);
        const e = smooth(p);
        a.x = a.hop.x0 + (a.hop.x1 - a.hop.x0) * e;
        a.y = a.hop.y0 + (a.hop.y1 - a.hop.y0) * e;
        lift = Math.sin(p * Math.PI) * a.hop.h;
        a.leg = Math.floor(a.t / 0.06) % 2 ? 1 : 0;
        tilt = (a.hop.x1 - a.hop.x0 > 0 ? 1 : -1) * Math.sin(p * Math.PI) * 5;
        // crouch, stretch in the air, ready to land
        [tsx, tsy] = p < 0.12 ? [1.08, 0.88] : p < 0.85 ? [0.94, 1.1] : [1, 1];
        if (p >= 1) {
          a.sx = 1.18;
          a.sy = 0.84;
          if (a.then === 'fix') {
            // lands on the letter and nudges it straight
            const l = a.queue[a.next];
            straighten(l);
            effects.burst(l.x + l.w / 2, l.top, 2, now);
            a.next++;
            a.mode = 'dwell';
          } else {
            a.mode = 'idle';
            a.evIn = rnd(1.4, 2.6);
            a.blinkIn = rnd(1.5, 3);
            if (a.then === 'home') a.shuffled = false;
          }
          a.t = 0;
        }
      } else if (a.mode === 'dwell') {
        if (a.t > 0.03) carryOn(a);
      } else if (a.mode === 'idle') {
        const look = stepIdle(a, {
          dt,
          now,
          unit,
          ptr: pointer.ptr,
          charge,
          canWander: pi.mode === 'idle',
          wander,
          rand: Math.random,
        });
        ({ lift, tilt, tsx, tsy, blink } = look);
      }
      a.lift = lift;
      const k = Math.min(1, dt * 22);
      a.sx += (tsx - a.sx) * k;
      a.sy += (tsy - a.sy) * k;
      // coming out of the lava, only what is below its surface shows
      if (a.mode === 'ooze') {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, a.lavaY, W, H);
        ctx.clip();
      }
      const pose: Pose = { P: a.x / unit, F: ((H - (a.y - lift)) * 2) / cs, sx: a.sx, sy: a.sy, tilt, leg: a.leg };
      drawMascot(ctx, a.sprite, pose, view, blink);
      if (a.mode === 'ooze') ctx.restore();
      if (panic && Math.floor(a.t / 0.14) % 2 === 0) {
        const bx = Math.round(a.x + w / 2 - 3);
        const by = a.y - lift - h - 28;
        ctx.fillStyle = '#E5484D';
        ctx.fillRect(bx, by, 6, 14);
        ctx.fillRect(bx, by + 19, 6, 6);
      }
    }

    // once every letter has been straightened the real text comes back, and stays
    if (lettersLive && still && clawd.queue.length > 0 && clawd.next >= clawd.queue.length) {
      showLetters(false);
      over = true;
    }
    if (charging) effects.drawCharge(ctx, pointer.ptr.x, pointer.ptr.y, charge, now);
    effects.draw(ctx, now);
  };
  raf = requestAnimationFrame(frame);
  return cleanup;
}
