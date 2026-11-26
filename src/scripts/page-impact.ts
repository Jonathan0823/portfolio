import { HEAT_PALETTE, hash } from './pixel-math';
import {
  FEEDBACK_CELL,
  KICK_CAP,
  SHOCKWAVE_EVENT,
  arrivalMs,
  clampLevel,
  farthestCorner,
  impactStrength,
  kickFalloff,
  ringRadius,
  springValue,
  waveSpeed,
  type ShockwaveDetail,
} from './cursor-math';

/** content worth kicking: things a reader would call "a thing on the page", not layout wrappers */
const KICKABLE =
  'h1,h2,h3,p,li,dt,dd,figure,img,svg,nav a,button,[data-skill-row],[data-skill],[data-stat],[data-project],[data-pixel-btn]';
const KICK_MS = 540;

interface Kickable {
  el: HTMLElement;
  cx: number;
  cy: number;
}

/** Visible content, outermost match only (a paragraph moves its own links with it), centred where it sits now. */
function pickKickable(): Kickable[] {
  const vw = innerWidth,
    vh = innerHeight;
  const visible: HTMLElement[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(KICKABLE)) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.right < 0 || r.bottom < 0 || r.left > vw || r.top > vh) continue;
    // a full-screen figure would drag the whole page's backdrop around
    if (r.width > vw * 0.95 && r.height > vh * 0.6) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.position === 'fixed') continue;
    visible.push(el);
  }
  const set = new Set(visible);
  const picked: Kickable[] = [];
  for (const el of visible) {
    let parent = el.parentElement,
      nested = false;
    while (parent && !nested) {
      nested = set.has(parent);
      parent = parent.parentElement;
    }
    if (nested) continue;
    const r = el.getBoundingClientRect();
    picked.push({ el, cx: r.left + r.width / 2, cy: r.top + r.height / 2 });
  }
  return picked;
}

/**
 * The front reaches the element at `delay`, throws it away from the epicentre, and it springs back with a damped overshoot.
 * Composite 'add' so it rides on top of any transform the element already has (reveal animations, tilts).
 */
function kick(el: Element, dx: number, dy: number, rotate: number, delay: number): void {
  const rest = 'translate(0px,0px) rotate(0deg) scale(1)';
  const frames: Keyframe[] = [{ offset: 0, transform: rest }];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const v = springValue(u);
    frames.push({
      offset: 0.08 + 0.92 * u,
      transform: `translate(${(dx * v).toFixed(2)}px,${(dy * v).toFixed(2)}px) rotate(${(rotate * v).toFixed(2)}deg) scale(${(1 + 0.03 * v).toFixed(4)})`,
    });
  }
  frames[frames.length - 1].transform = rest;
  el.animate(frames, { duration: KICK_MS, delay, composite: 'add', easing: 'linear' });
}

/** A short shake of main and footer, not the cursor's own canvases, which live on body. */
function shake(amplitude: number): void {
  const steps = 16;
  const frames: Keyframe[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const k = amplitude * Math.exp(-4 * u) * (1 - u);
    // the last frame is exactly at rest so nothing is left offset
    const x = i === steps ? 0 : Math.cos(Math.PI * 2 * 3.5 * u) * k;
    const y = i === steps ? 0 : Math.sin(Math.PI * 2 * 4.5 * u + 1) * k * 0.6;
    frames.push({ offset: u, transform: `translate(${x.toFixed(2)}px,${y.toFixed(2)}px)` });
  }
  for (const el of document.querySelectorAll('main,footer')) {
    el.animate(frames, { duration: 350, composite: 'add', easing: 'linear' });
  }
}

/** a faint warm wash from the epicentre, only at near-full charge */
function flash(x: number, y: number): void {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:9996;background:radial-gradient(circle at ${x}px ${y}px,#FFFFFF 0%,#FFD23F 70%);opacity:0`;
  document.body.appendChild(el);
  const done = () => el.remove();
  const animation = el.animate([{ opacity: 0.15 }, { opacity: 0 }], { duration: 200, easing: 'ease-out' });
  animation.onfinish = done;
  animation.oncancel = done;
  // belt and braces: a throttled tab never fires onfinish
  setTimeout(done, 500);
}

/** A viewport-wide pixel ring at constant speed, thinning and cooling behind its leading edge. */
function drawFront(x: number, y: number, farthest: number, speed: number, charge: number): void {
  const vw = innerWidth,
    vh = innerHeight;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = vw;
  canvas.height = vh;
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:9997';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  const gridW = Math.ceil(vw / FEEDBACK_CELL),
    gridH = Math.ceil(vh / FEEDBACK_CELL);
  const originX = Math.floor(x / FEEDBACK_CELL),
    originY = Math.floor(y / FEEDBACK_CELL);
  const duration = arrivalMs(farthest, speed);
  const seed = Math.floor(x * 7 + y * 13);
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    ctx.clearRect(0, 0, vw, vh);
    const radius = ringRadius(now - start, speed) / FEEDBACK_CELL;
    const thick = (3 + 1.5 * charge) * (1 - 0.55 * t);
    const keep = 1 - t * 0.75;
    const inner = Math.max(0, radius - thick);
    // enough rays that the ring has no gaps at its current circumference
    const rays = Math.max(8, Math.ceil(radius * Math.PI * 2 * 1.3));
    for (let k = 0; k < rays; k++) {
      const angle = (k / rays) * Math.PI * 2,
        cos = Math.cos(angle),
        sin = Math.sin(angle);
      for (let d = inner; d <= radius; d += 0.5) {
        const gx = originX + Math.round(cos * d),
          gy = originY + Math.round(sin * d);
        if (gx < 0 || gy < 0 || gx >= gridW || gy >= gridH || hash(gx, gy, seed) > keep) continue;
        const u = thick > 0 ? 1 - (radius - d) / thick : 1;
        ctx.fillStyle = HEAT_PALETTE[clampLevel(1 + u * 4 - t * 1.2)];
        ctx.fillRect(gx * FEEDBACK_CELL, gy * FEEDBACK_CELL, FEEDBACK_CELL, FEEDBACK_CELL);
      }
    }
    if (now - start < duration) requestAnimationFrame(step);
    else canvas.remove();
  };
  requestAnimationFrame(step);
  setTimeout(() => canvas.remove(), duration + 400);
}

/**
 * A charged release hitting the page: the front crosses the viewport, content is kicked as it arrives,
 * main and footer shake, and listeners get SHOCKWAVE_EVENT. Below the impact threshold it does nothing.
 */
export function pageImpact(x: number, y: number, charge: number): void {
  const impact = impactStrength(charge);
  if (impact.ramp <= 0) return;
  const farthest = farthestCorner(x, y, innerWidth, innerHeight);
  const speed = waveSpeed(farthest);
  drawFront(x, y, farthest, speed, charge);
  const nearestFirst = pickKickable().sort((a, b) => Math.hypot(a.cx - x, a.cy - y) - Math.hypot(b.cx - x, b.cy - y));
  for (const { el, cx, cy } of nearestFirst.slice(0, KICK_CAP)) {
    const distance = Math.hypot(cx - x, cy - y);
    const fall = kickFalloff(distance, farthest);
    // straight up when it is under the epicentre, since there is no direction to throw it
    const ux = distance < 1 ? 0 : (cx - x) / distance,
      uy = distance < 1 ? -1 : (cy - y) / distance;
    // alternate the twist so neighbours do not all lean the same way
    const sign = hash(Math.floor(cx), Math.floor(cy), 31) < 0.5 ? -1 : 1;
    kick(el, ux * impact.kick * fall, uy * impact.kick * fall, impact.rotate * sign * fall, arrivalMs(distance, speed));
  }
  shake(impact.shake);
  if (impact.flash) flash(x, y);
  const detail: ShockwaveDetail = { x, y, charge, speed };
  window.dispatchEvent(new CustomEvent(SHOCKWAVE_EVENT, { detail }));
}
