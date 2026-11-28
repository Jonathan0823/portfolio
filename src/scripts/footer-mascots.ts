// Clawd and Pi on the footer wordmark. They stand on the letter tops, bob and blink, now and then one walks or hops along
// the word (Pi hops away from loose heat), a tap makes one hop, and they burst out of the lava when the word rises and
// sink with it when it goes. This is the thin painter: it reads where the word stands from footer-wordmark, steps the pure
// models (mascot-spots / mascot-motion / mascot-particles) and draws them (mascot-draw) on a canvas layered over the
// footer field. Reduced motion keeps them still on the letters while the word is up.
import type { HeroField } from './hero-field';
import { FOOT_BLEED } from './footer-tide';
import { wordmarkRise, wordmarkStance, wordmarkWanted, type Stance } from './footer-wordmark';
import { drawMascot, drawParticle, hits, type View } from './mascot-draw';
import {
  EMERGE_SPLASHES,
  SINK_BUBBLES,
  UNDER,
  advancePresence,
  advanceTravel,
  nextDue,
  presencePose,
  staticPresence,
  startTravel,
  steer,
  sunkFloor,
  travelEnd,
  travelPose,
  type Pose,
  type Presence,
  type Spot,
  type Travel,
} from './mascot-motion';
import { bubble, crossed, particleAt, spark, splash, type Particle } from './mascot-particles';
import {
  clearFloor,
  crowds,
  heatNear,
  letterSpans,
  nearestSpot,
  planRoute,
  standingSpots,
  topsOf,
} from './mascot-spots';
import { CLAWD, PI, type MascotSprite } from './mascot-sprites';
import { CALM, type WaveUnder } from './surface-wave';
import { BLAST_MIN_MS, chargeOf } from './hero-blast';
import { mountHeroPointer } from './hero-pointer';

/** the mascots rise once the word has formed this much of itself, so the letters are there to land on */
const RISE_AT = 0.45;
/** a frame longer than this (a background tab) counts as this long */
const MAX_DT_MS = 100;
/** how a mascot idles: a half-cell hop every so often, and Clawd's blink (ms between, ms long) */
const BOB_EVERY = [2600, 4200] as const;
const BOB_MS = 380;
const BLINK_EVERY = [3000, 6000] as const;
const BLINK_MS = 130;
/** one of them moves this often (the first after FIRST_MOVE_MS), and a spark pops out of a gap this often */
const MOVE_EVERY = [8000, 12000] as const;
const FIRST_MOVE_MS = 3500;
const SPARK_EVERY = [22000, 32000] as const;
const FIRST_SPARK_MS = 9000;
/** Pi looks for loose heat this often, within this many cells either side and rows above its feet */
const LOOK_MS = 220;
const HEAT_REACH = 3;
const HEAT_ABOVE = 6;
/** Pi hops at least this many half cells away from heat; a spark is checked for Pi's sake this long into its flight */
const DODGE_MIN = 6;
const SPARK_CHECK_MS = 350;
const SPARK_NEAR = 6;
/** Pi bursts out a beat after Clawd (ms) */
const PI_DELAY = [200, 300] as const;
/** a crest under a mascot this many rows high throws it up (a blast; a hover's ripples are lower) and gravity brings it down */
const TOSS_LIFT = 2;
const TOSS_SPEED = 45;
const TOSS_PER_ROW = 6;
const GRAVITY = 200;
/** a hold on the footer: they quiver and squint from this charge, and a release after BLAST_MIN_MS throws them like a blast */
const SQUINT_CHARGE = 0.35;
const HELD_TOSS_SPEED = 38;
const HELD_TOSS_PER_CHARGE = 26;
const LAND_SQUASH_MS = 140;
const TOSS_REST_MS = 1500;
/** a tap this many px outside a mascot still counts */
const TAP_SLOP = 6;

interface Mascot {
  sprite: MascotSprite;
  presence: Presence;
  /** where it bursts out onto, and where it stands now */
  home: Spot | null;
  at: Spot;
  travel: Travel | null;
  pose: Pose | null;
  /** every place it can stand on the word */
  spots: Map<number, number>;
  bobDue: number;
  bobUntil: number;
  blinkDue: number;
  blinkUntil: number;
  /** thrown up by a blast: half cells above where it stands and how fast it is rising, and the age of the throw (s) */
  air: { h: number; v: number; t: number } | null;
  /** squashed from a landing until then */
  landUntil: number;
}

const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

const make = (sprite: MascotSprite): Mascot => ({
  sprite,
  presence: UNDER,
  home: null,
  at: { P: 0, F: 0 },
  travel: null,
  pose: null,
  spots: new Map(),
  bobDue: 0,
  bobUntil: 0,
  blinkDue: 0,
  blinkUntil: 0,
  air: null,
  landUntil: 0,
});

/** the footer's Wave under columns from..to; calm when there is none */
export type Ride = (from: number, to: number) => WaveUnder;

/** mounts the mascots on the footer field; they ride its wave as `ride` reports it. The returned function removes them */
export function mountFooterMascots(foot: HeroField, reduced: boolean, ride: Ride = () => CALM): () => void {
  const host = foot.canvas.parentElement;
  if (!host) return () => {};
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('data-px', 'mascots');
  // over the field's own canvas but, like it, under the page's content
  canvas.style.cssText = `position:absolute;left:0;bottom:0;width:100%;height:calc(100% + ${FOOT_BLEED}px);z-index:-1;pointer-events:none`;
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  const clawd = make(CLAWD);
  const pi = make(PI);
  const all = [clawd, pi];
  let layoutKey = '';
  let tops = new Int16Array(0);
  let gaps: number[] = [];
  let particles: Array<{ p: Particle; born: number }> = [];
  let flying: { p: Particle; born: number } | null = null;
  let moveDue = 0;
  let sparkDue = 0;
  let lookDue = 0;
  let drawn = '';
  let drawnParticles = false;
  let last = 0;
  let raf = 0;
  let inViewport = false;
  /** how far a hold on the footer has charged, 0..1 */
  let charge = 0;
  let view: View = { cell: 10, base: 0, wade: 0, height: 0 };

  const live = () => all.filter((m) => m.home);
  const ready = () => live().every((m) => m.presence.phase === 'up');

  /** the word is laid out differently: find where each mascot can stand, and start them under the lava */
  const lay = (stance: Stance, columns: number) => {
    layoutKey = stance.shape;
    tops = topsOf(stance.ink, columns + 2);
    const spans = letterSpans(tops, stance.x0, stance.x1);
    gaps = spans.slice(0, -1).map((s, i) => (s.end + 1 + spans[i + 1].start) / 2);
    const centre = (i: number) => (spans[i] ? spans[i].start + spans[i].end + 1 : 0);
    for (const m of all) m.spots = standingSpots(m.sprite, tops, stance.x0, stance.x1);
    // Clawd across the U's shoulders, Pi on the I beside it, or wherever each fits if the word is cut differently
    const cP = nearestSpot(clawd.spots, CLAWD, centre(2) - 1) ?? nearestSpot(clawd.spots, CLAWD, centre(1));
    const pP =
      nearestSpot(pi.spots, PI, centre(3) + 1, (P) => cP !== null && crowds(P, PI.width, cP, CLAWD.width)) ??
      nearestSpot(pi.spots, PI, centre(0));
    for (const [m, P] of [
      [clawd, cP],
      [pi, pP],
    ] as const) {
      m.home = P === null ? null : { P, F: m.spots.get(P)! };
      if (m.home) m.at = m.home;
      m.presence = UNDER;
      m.travel = null;
      m.pose = null;
    }
    particles = [];
    flying = null;
    drawn = '';
  };

  const lavaRow = (s: Stance) => s.base + s.wade;
  const throwSplash = (s: Stance, half: number, beat: (typeof EMERGE_SPLASHES)[number], now: number) =>
    splash(half / 2, lavaRow(s), beat.count, beat.height, beat.spread, Math.random).forEach((p) =>
      particles.push({ p, born: now }),
    );

  /** the pose of a mascot standing on the word: at rest or mid-travel, lifted by its bob */
  const standingPose = (m: Mascot, now: number): Pose => {
    if (m.travel) return travelPose(m.sprite, m.travel, (P) => clearFloor(m.sprite, tops, P));
    const pose: Pose = { P: m.at.P, F: m.at.F, sx: 1, sy: 1, tilt: 0, leg: 0 };
    return now < m.bobUntil ? { ...pose, F: pose.F + 1 } : pose;
  };

  /** steps one mascot's presence, and once it stands, its travel */
  const update = (m: Mascot, s: Stance, dt: number, now: number, want: boolean) => {
    const { sprite, home } = m;
    if (!home) return;
    const sunk = sunkFloor(sprite, s.wade);
    if (reduced) {
      m.presence = staticPresence(want && wordmarkRise() >= 1);
      m.at = home;
      m.pose = presencePose(sprite, m.presence, home, sunk);
      return;
    }
    const rising = want && wordmarkRise() >= RISE_AT && s.base >= 0;
    if (rising || !want) {
      const before = m.presence;
      m.presence = steer(
        sprite,
        before,
        rising,
        m.pose,
        m.presence.phase === 'up' ? m.at : home,
        sunk,
        sprite === PI ? rnd(...PI_DELAY) : 0,
      );
      if (m.presence !== before) m.travel = null;
    }
    const was = m.presence;
    m.presence = advancePresence(sprite, was, dt);
    if (was.phase === 'emerging')
      crossed(EMERGE_SPLASHES, was.t, was.t + dt).forEach((beat) =>
        throwSplash(s, (beat.at ? (m.pose?.P ?? home.P) : was.from.P) + sprite.width / 2, beat, now),
      );
    if (was.phase === 'sinking')
      crossed(SINK_BUBBLES, was.t, was.t + dt).forEach((beat) =>
        particles.push({
          p: bubble(((m.pose?.P ?? home.P) + sprite.width / 2 + beat.offset) / 2, lavaRow(s)),
          born: now,
        }),
      );
    if (m.presence.phase !== 'up') {
      m.at = home;
      m.pose = presencePose(sprite, m.presence, home, sunk);
      return;
    }
    if (m.travel) {
      const ran = m.travel;
      m.travel = advanceTravel(sprite, ran, dt);
      if (!m.travel) m.at = travelEnd(ran);
    }
    m.pose = standingPose(m, now);
  };

  const route = (m: Mascot, ends?: (P: number) => boolean, steps = Infinity) => {
    const other = live().find((o) => o !== m);
    const path = planRoute(m.sprite, {
      spots: m.spots,
      from: m.at.P,
      blocked: other && ((P) => crowds(P, m.sprite.width, other.at.P, other.sprite.width)),
      ends,
      rng: Math.random,
    });
    if (path) m.travel = startTravel(m.at, path.slice(0, steps));
  };
  const dodge = (from: number) => {
    if (pi.travel || clawd.travel || pi.presence.phase !== 'up') return;
    const mid = pi.at.P + PI.width / 2;
    route(pi, (P) => (from < mid ? P > pi.at.P : P < pi.at.P) && Math.abs(P - pi.at.P) >= DODGE_MIN, 1);
  };

  /** the idling of mascots standing on the word: bobbing, blinking, the odd walk or hop, and Pi minding the heat */
  const life = (s: Stance, now: number) => {
    for (const m of live()) {
      const bob = nextDue(now, m.bobDue, ...BOB_EVERY, Math.random);
      m.bobDue = bob.due;
      if (bob.fire) m.bobUntil = now + BOB_MS;
    }
    const blink = nextDue(now, clawd.blinkDue, ...BLINK_EVERY, Math.random);
    clawd.blinkDue = blink.due;
    if (blink.fire) clawd.blinkUntil = now + BLINK_MS;

    moveDue ||= now + FIRST_MOVE_MS;
    const move = nextDue(now, moveDue, ...MOVE_EVERY, Math.random);
    moveDue = move.due;
    if (move.fire && !all.some((m) => m.travel)) {
      const pool = live();
      route(pool[Math.floor(Math.random() * pool.length)]);
    }

    sparkDue ||= now + FIRST_SPARK_MS;
    const popped = nextDue(now, sparkDue, ...SPARK_EVERY, Math.random);
    sparkDue = popped.due;
    if (popped.fire && gaps.length && pi.home && !all.some((m) => m.travel)) {
      const mid = (pi.at.P + PI.width / 2) / 2;
      const gap = gaps.reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a));
      flying = { p: spark(Math.floor(gap), s.base + 1, gap < mid ? 1 : -1, pi.at.F / 2 + 2), born: now };
      particles.push(flying);
    }
    if (flying && now - flying.born >= SPARK_CHECK_MS) {
      const at = particleAt(flying.p, SPARK_CHECK_MS);
      if (at && Math.abs(at.x + (flying.p.dx as number) - (pi.at.P + PI.width / 2) / 2) < SPARK_NEAR) dodge(at.x * 2);
      flying = null;
    }

    if (now >= lookDue && pi.home && !pi.travel) {
      lookDue = now + LOOK_MS;
      const field = foot.field();
      const hot = heatNear(
        field.heat,
        field.columns,
        field.rows,
        { left: pi.at.P, right: pi.at.P + PI.width, row: s.base + Math.floor(pi.at.F / 2) },
        HEAT_REACH,
        HEAT_ABOVE,
      );
      if (hot !== null) dodge(hot);
    }
  };

  /** the water under a mascot: its pose is in half cells, the wave in field columns */
  const under = (m: Mascot): WaveUnder => (m.pose ? ride(m.pose.P / 2, (m.pose.P + m.sprite.width) / 2) : CALM);
  /** where a mascot is drawn and tapped: its pose lifted and tipped by the crest under its feet */
  const shown = (m: Mascot, pose: Pose): Pose => {
    const w = under(m);
    const squash = performance.now() < m.landUntil;
    const sq: Partial<Pose> = squash ? { sx: 1.15, sy: 0.85 } : {};
    // straining against the charge: the same quiver and squash as on the hero
    const strain = charge > 0 && !m.air && !m.travel ? charge : 0;
    if (strain) {
      sq.sx = 1 + 0.08 * strain;
      sq.sy = 1 - 0.12 * strain;
      sq.tilt = Math.sin(performance.now() / 22) * 2.5 * strain;
    }
    if (m.air) return { ...pose, ...sq, F: pose.F + m.air.h, tilt: 22 * Math.sin(m.air.t * 9) };
    return { ...pose, ...sq, F: pose.F + w.lift * 2, tilt: pose.tilt + w.tilt + (sq.tilt ?? 0) };
  };

  const draw = (s: Stance, now: number) => {
    const w = host.clientWidth;
    const h = host.clientHeight + FOOT_BLEED;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const key = [
      w,
      h,
      dpr,
      s.base,
      s.wade,
      ...all.map((m) => (m.pose ? Object.values(m.pose).join(',') : '-')),
      ...all.map((m) => (m.air ? m.air.h.toFixed(1) : m.landUntil > now ? 'l' : '-')),
      eyesShut(now),
      charge > 0 ? Math.floor(now / 16) : 0,
      ...all.map((m) => {
        const w = under(m);
        return `${w.lift}/${w.tilt}`;
      }),
    ].join('|');
    particles = particles.filter(({ p, born }) => now - born < p.ms);
    const hadParticles = drawnParticles;
    drawnParticles = particles.length > 0;
    if (key === drawn && !drawnParticles && !hadParticles) return;
    drawn = key;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    view = { cell: foot.field().cellSize, base: s.base, wade: s.wade, height: h };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const m of all) {
      if (!m.pose) continue;
      // a crest under its feet lifts it and tips it along the slope
      drawMascot(ctx, m.sprite, shown(m, m.pose), view, m === clawd && eyesShut(now));
    }
    for (const { p, born } of particles) {
      const d = particleAt(p, now - born);
      if (d) drawParticle(ctx, d, view);
    }
  };

  const frame = (now: number) => {
    raf = 0;
    if (!inViewport || document.hidden) return;
    const dt = last ? Math.min(MAX_DT_MS, now - last) : 16;
    last = now;
    const stance = wordmarkStance(foot);
    // only a new layout starts them over: the surface riding a row up or down (a blast) must not sink them
    if (stance.shape !== layoutKey) lay(stance, foot.field().columns);
    const held = hold?.heldMs(now) ?? null;
    charge = held === null ? 0 : chargeOf(held);
    const want = wordmarkWanted();
    for (const m of all) update(m, stance, dt, now, want);
    if (!reduced && want && ready() && live().length) life(stance, now);
    if (!reduced)
      for (const m of all) {
        toss(m, dt, now);
        // a splash under one knocks it into a hop
        if (under(m).splash) hopInPlace(m);
      }
    draw(stance, now);
    raf = requestAnimationFrame(frame);
  };
  const start = () => {
    if (!raf && inViewport && !document.hidden) raf = requestAnimationFrame(frame);
  };

  /** a hard crest throws a mascot up; it spins a little and falls back onto its letter, landing squashed */
  const toss = (m: Mascot, dt: number, now: number) => {
    if (m.presence.phase !== 'up') {
      m.air = null;
      return;
    }
    const lift = under(m).lift;
    // one throw per blast: the crest outlasts a landing, so it must not catch them again
    if (!m.air && lift >= TOSS_LIFT && now > m.landUntil + TOSS_REST_MS) {
      launch(m, TOSS_SPEED + TOSS_PER_ROW * lift, lift * 2);
    }
    const a = m.air;
    if (!a) return;
    const s = dt / 1000;
    a.v -= GRAVITY * s;
    a.h += a.v * s;
    a.t += s;
    if (a.h <= 0 && a.v < 0) {
      m.air = null;
      m.landUntil = now + LAND_SQUASH_MS;
    }
  };

  /** Clawd's eyes are shut for a blink, for the heat of coming out of the lava, while straining against a charge and while thrown */
  const eyesShut = (now: number) =>
    now < clawd.blinkUntil || charge > SQUINT_CHARGE || !!clawd.air || clawd.presence.phase === 'emerging';

  /** thrown up at `speed` half cells a second, spinning, to fall back onto its letter */
  const launch = (m: Mascot, speed: number, h = 0) => {
    m.travel = null;
    m.air = { h, v: speed, t: 0 };
  };

  const hopInPlace = (m: Mascot) => {
    if (m.travel || m.air || m.presence.phase !== 'up') return;
    m.travel = startTravel(m.at, [{ ...m.at, kind: 'hop' }]);
  };
  const onPointerDown = (e: PointerEvent) => {
    if (reduced) return;
    const box = canvas.getBoundingClientRect();
    const x = e.clientX - box.left;
    const y = e.clientY - box.top;
    for (const m of all)
      if (m.pose && m.presence.phase === 'up' && hits(m.sprite, shown(m, m.pose), view, x, y, TAP_SLOP)) {
        hopInPlace(m);
        // Clawd shuts his eyes for the jump
        if (m === clawd) clawd.blinkUntil = performance.now() + 380;
      }
  };
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  // holding on the footer charges like the hero's: they strain and squint, and letting go throws them up to fall back
  const hold = reduced
    ? null
    : mountHeroPointer(document.getElementById('contact') ?? host, {
        press: () => {},
        release: (_x, _y, held) => {
          if (held < BLAST_MIN_MS) return;
          const speed = HELD_TOSS_SPEED + HELD_TOSS_PER_CHARGE * chargeOf(held);
          for (const m of all) if (m.presence.phase === 'up' && !m.air) launch(m, speed);
        },
      });

  // nothing to animate (or to pay for) while the footer is off screen: they start again under the lava
  const io = new IntersectionObserver(
    ([entry]) => {
      inViewport = entry.isIntersecting;
      if (inViewport) start();
      else {
        for (const m of all) {
          m.presence = UNDER;
          m.travel = null;
          m.pose = null;
          if (m.home) m.at = m.home;
        }
        particles = [];
        last = 0;
        drawn = '';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    },
    { rootMargin: '40px' },
  );
  io.observe(host);
  const onVisibility = () => {
    last = 0;
    start();
  };
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    cancelAnimationFrame(raf);
    io.disconnect();
    window.removeEventListener('pointerdown', onPointerDown);
    hold?.stop();
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.remove();
  };
}
