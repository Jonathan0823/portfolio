import { HEAT_PALETTE, hash } from './pixel-math';
import type { HeroField } from './hero-field';
import { blobGeometry, blobValue, levelForValue, shortestTurn } from './blob-shape';
import { decayFactor, easeFactor, frameScale, smoothVelocity } from './timing';
import { isShapeName, morphShows, shapeCells, type ShapeName } from './cursor-shapes';

const MAX_CELL = 10;
const TEXT_SELECTOR = 'p,li,dt,dd,span,h3,h4,figcaption,blockquote';
const BLOB_CELLS = 64;
const BLOB_CENTER = 32;
const BLOB_SIZE = BLOB_CELLS * MAX_CELL;
const TRAIL_CELLS = 120;
const TRAIL_CENTER = 60;
const TRAIL_SIZE = TRAIL_CELLS * MAX_CELL;
const REST_RADIUS = 5;
const SQUARE_RADIUS = 2;
const UNDERLINE_LEVEL = 0;
const HEADING_SCALE = 2.4;
const UNDER_PALETTE = ['#f3f3f3', '#efefef', '#ebebeb', '#e6e6e6', '#e1e1e1', '#dcdcdc'];

interface TrailCell {
  cellX: number;
  cellY: number;
  strength: number;
}

export function mountCursorTrail(fields: HeroField[]): () => void {
  const shapeCache = new Map<ShapeName, ReturnType<typeof shapeCells>>();
  const cellsOf = (name: ShapeName) => {
    let cells = shapeCache.get(name);
    if (!cells) shapeCache.set(name, (cells = shapeCells(name)));
    return cells;
  };
  const pickField = (y: number): { field: HeroField; rect: DOMRect } | null => {
    let best: { field: HeroField; rect: DOMRect } | null = null,
      bestDistance = Infinity;
    for (const field of fields) {
      const rect = field.rect();
      if (!rect.width || rect.bottom < -200 || rect.top > window.innerHeight + 200) continue;
      const distance = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
      if (distance < bestDistance) {
        best = { field, rect };
        bestDistance = distance;
      }
    }
    return best;
  };
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const makeBlobCanvas = (zIndex: number) => {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = `position:fixed;left:0;top:0;width:${BLOB_SIZE}px;height:${BLOB_SIZE}px;pointer-events:none;z-index:${zIndex};opacity:0`;
    canvas.width = BLOB_SIZE * dpr;
    canvas.height = BLOB_SIZE * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (zIndex < 0) document.body.insertBefore(canvas, document.body.firstChild);
    else document.body.appendChild(canvas);
    return { canvas, ctx };
  };
  const heat = makeBlobCanvas(50);
  const mono = makeBlobCanvas(-1);
  const blobCanvas = heat.canvas,
    blobCtx = heat.ctx;

  const trailCanvas = document.createElement('canvas');
  trailCanvas.setAttribute('aria-hidden', 'true');
  trailCanvas.style.cssText = `position:fixed;left:0;top:0;width:${TRAIL_SIZE}px;height:${TRAIL_SIZE}px;pointer-events:none;z-index:-1;image-rendering:pixelated`;
  trailCanvas.width = TRAIL_SIZE;
  trailCanvas.height = TRAIL_SIZE;
  const trailCtx = trailCanvas.getContext('2d')!;
  document.body.insertBefore(trailCanvas, document.body.firstChild);

  const trail = new Map<string, TrailCell>();
  let targetX = 0,
    targetY = 0;
  let cursorX = 0,
    cursorY = 0;
  let speed = 0,
    heading = 0,
    clock = 0;
  let radius = REST_RADIUS,
    targetRadius = REST_RADIUS;
  let raf = 0,
    pointerInside = false;
  let heroContact = 0;
  let smoothDx = 0,
    smoothDy = 0,
    lastFrameTime = 0;
  let pointerClientX = 0,
    pointerClientY = 0,
    scrollRaf = 0;
  let hoveredLink: Element | null = null,
    linkProgress = 0,
    overLink = false;
  let onHeading = false,
    overText = false,
    overTextValue = 0,
    visible = 0,
    cell = MAX_CELL;
  let shapeTarget: ShapeName | null = null,
    shape: ShapeName | null = null,
    shapeProgress = 0;

  const fillCell = (
    cellX: number,
    cellY: number,
    originX: number,
    originY: number,
    offsetX: number,
    offsetY: number,
    ctx: CanvasRenderingContext2D,
  ) => ctx.fillRect((cellX - originX) * cell + offsetX + 1, (cellY - originY) * cell + offsetY + 1, cell - 1, cell - 1);

  const frame = (now: number) => {
    raf = 0;
    if (document.hidden) return;
    const scale = lastFrameTime ? frameScale(now - lastFrameTime) : 1;
    lastFrameTime = now;
    const picked = pickField(targetY);
    const hero = picked?.field ?? null;
    cell = hero ? hero.field().cellSize : window.innerWidth < 700 ? 8 : MAX_CELL;
    const prevX = cursorX,
      prevY = cursorY;
    const follow = easeFactor(0.35, scale);
    cursorX += (targetX - cursorX) * follow;
    cursorY += (targetY - cursorY) * follow;
    clock += 0.12 * scale;
    radius += (targetRadius - radius) * easeFactor(0.25, scale);
    const dx = cursorX - prevX,
      dy = cursorY - prevY,
      stepLength = Math.hypot(dx, dy);
    const perFrame = scale > 0 ? 1 / scale : 0;
    const smooth = smoothVelocity({ x: smoothDx, y: smoothDy }, { x: dx * perFrame, y: dy * perFrame }, 0.18, scale);
    smoothDx = smooth.x;
    smoothDy = smooth.y;
    const smoothSpeed = Math.hypot(smoothDx, smoothDy);
    speed += (smoothSpeed - speed) * easeFactor(0.5, scale);
    if (smoothSpeed > 0.6) {
      heading += shortestTurn(heading, Math.atan2(smoothDy, smoothDx)) * easeFactor(0.3, scale);
    }
    const stretch = Math.min(speed / 18, 1);
    linkProgress += ((overLink ? 1 : 0) - linkProgress) * easeFactor(0.3, scale);
    overTextValue += ((overText ? 1 : 0) - overTextValue) * easeFactor(0.25, scale);
    visible += ((pointerInside ? 1 : 0) - visible) * easeFactor(0.35, scale);
    if (!pointerInside && visible < 0.02) visible = 0;
    if (shapeTarget !== shape) {
      shapeProgress -= shapeProgress * easeFactor(0.3, scale);
      if (shapeProgress < 0.04) {
        shape = shapeTarget;
        shapeProgress = 0;
      }
    } else if (shape) {
      shapeProgress += (1 - shapeProgress) * easeFactor(0.2, scale);
    }
    heat.canvas.style.opacity = String(visible * (1 - overTextValue));
    mono.canvas.style.opacity = String(visible * overTextValue);

    const heroRect = picked?.rect ?? null;
    const flipped = !!hero?.flipped;
    const offsetX = heroRect ? ((heroRect.left % cell) + cell) % cell : 0;
    const offsetY = heroRect ? (((flipped ? heroRect.bottom : heroRect.top) % cell) + cell) % cell : 0;
    const cursorCellX = Math.floor((cursorX - offsetX) / cell),
      cursorCellY = Math.floor((cursorY - offsetY) / cell);
    const originX = cursorCellX - BLOB_CENTER,
      originY = cursorCellY - BLOB_CENTER;
    const blobTransform = `translate(${originX * cell}px,${originY * cell}px)`;
    heat.canvas.style.transform = blobTransform;
    mono.canvas.style.transform = blobTransform;
    blobCtx.clearRect(0, 0, BLOB_SIZE, BLOB_SIZE);
    mono.ctx.clearRect(0, 0, BLOB_SIZE, BLOB_SIZE);

    const insideHero =
      !!heroRect &&
      pointerInside &&
      cursorX >= heroRect.left &&
      cursorX <= heroRect.right &&
      cursorY >= heroRect.top &&
      cursorY <= heroRect.bottom;
    const flickerTime = Math.floor(clock * 2);

    if (linkProgress > 0.02 && hoveredLink && hoveredLink.isConnected) {
      const rect = hoveredLink.getBoundingClientRect();
      const row = Math.floor((rect.bottom + 5 - offsetY) / cell);
      const firstCell = Math.floor((rect.left - offsetX) / cell),
        lastCell = Math.floor((rect.right - 1 - offsetX) / cell);
      const half = (lastCell - firstCell + 1) / 2 + 0.5,
        middle = (firstCell + lastCell + 1) / 2;
      blobCtx.fillStyle = HEAT_PALETTE[UNDERLINE_LEVEL];
      for (let cell = firstCell; cell <= lastCell; cell++) {
        if (Math.abs(cell + 0.5 - middle) <= half * linkProgress)
          fillCell(cell, row, originX, originY, offsetX, offsetY, blobCtx);
      }
    }
    const blobAlpha = linkProgress < 0.5 ? 1 - linkProgress / 0.5 : 0;
    const morphing = !!shape && shapeProgress > 0.02;
    if (morphing && !insideHero) {
      for (const c of cellsOf(shape!)) {
        if (!morphShows(c.dx, c.dy, shapeProgress, true)) continue;
        const level = levelForValue(1 - c.distance * 0.55, hash(c.dx, c.dy, flickerTime) * 2 - 1);
        blobCtx.fillStyle = HEAT_PALETTE[level];
        fillCell(cursorCellX + c.dx, cursorCellY + c.dy, originX, originY, offsetX, offsetY, blobCtx);
        if (overTextValue > 0.02) {
          mono.ctx.fillStyle = UNDER_PALETTE[level];
          fillCell(cursorCellX + c.dx, cursorCellY + c.dy, originX, originY, offsetX, offsetY, mono.ctx);
        }
      }
    }
    if (blobAlpha > 0.05 && !insideHero && !(morphing && shapeProgress > 0.98)) {
      const shaped = blobGeometry(radius * Math.max(0.3, blobAlpha), morphing ? 0 : stretch);
      const reach = Math.ceil(shaped.longRadius + shaped.shift) + 1;
      for (let cellY = cursorCellY - reach; cellY <= cursorCellY + reach; cellY++) {
        for (let cellX = cursorCellX - reach; cellX <= cursorCellX + reach; cellX++) {
          const value = blobValue(
            cellX + 0.5 - (cursorX - offsetX) / cell,
            cellY + 0.5 - (cursorY - offsetY) / cell,
            heading,
            shaped,
          );
          if (value === null) continue;
          if (morphing && !morphShows(cellX - cursorCellX, cellY - cursorCellY, shapeProgress, false)) continue;
          const level = levelForValue(value, hash(cellX, cellY, flickerTime) * 2 - 1);
          blobCtx.fillStyle = HEAT_PALETTE[level];
          fillCell(cellX, cellY, originX, originY, offsetX, offsetY, blobCtx);
          if (overTextValue > 0.02) {
            mono.ctx.fillStyle = UNDER_PALETTE[level];
            fillCell(cellX, cellY, originX, originY, offsetX, offsetY, mono.ctx);
          }
        }
      }
    }

    const steps = Math.max(1, Math.min(12, Math.ceil(stepLength / cell)));
    if (hero && heroRect && insideHero && blobAlpha > 0.05) {
      const field = hero.field();
      const shaped = blobGeometry(radius, stretch);
      const reach = Math.ceil(shaped.longRadius + shaped.shift) + 1;
      for (let step = 1; step <= steps; step++) {
        const column = (prevX + (dx * step) / steps - heroRect.left) / field.cellSize;
        const pointY = prevY + (dy * step) / steps;
        const row = (flipped ? heroRect.bottom - pointY : pointY - heroRect.top) / field.cellSize;
        for (let r = Math.max(0, Math.floor(row - reach)); r < Math.min(field.rows, row + reach); r++) {
          for (let c = Math.max(0, Math.floor(column - reach)); c < Math.min(field.columns, column + reach); c++) {
            const value = blobValue(c + 0.5 - column, (r + 0.5 - row) * (flipped ? -1 : 1), heading, shaped);
            if (value === null) continue;
            const index = r * field.columns + c;
            const jitter = (hash(c, r, flickerTime) * 2 - 1) * 0.06;
            field.heat[index] = Math.max(field.heat[index], 0.3 + value * 0.75 + jitter);
          }
        }
      }
      hero.markDirty();
    }
    heroContact = insideHero ? 1 : heroContact * decayFactor(0.95, scale);
    if (pointerInside && !insideHero && heroContact > 0.05 && speed > 1.2) {
      const amount = heroContact * Math.min(1, speed / 14),
        brushRadius = 3.2;
      for (let step = 1; step <= steps; step++) {
        const column = (prevX - offsetX + (dx * step) / steps) / cell,
          row = (prevY - offsetY + (dy * step) / steps) / cell;
        for (let cellY = Math.floor(row - brushRadius); cellY < row + brushRadius; cellY++) {
          for (let cellX = Math.floor(column - brushRadius); cellX < column + brushRadius; cellX++) {
            const distance = Math.hypot(cellX + 0.5 - column, cellY + 0.5 - row) / brushRadius;
            if (distance > 1) continue;
            const key = cellX + ',' + cellY,
              strength = amount * (1 - distance * distance * 0.8) * (0.8 + 0.2 * hash(cellX, cellY, 3));
            const existing = trail.get(key);
            if (!existing || existing.strength < strength) trail.set(key, { cellX, cellY, strength });
          }
        }
      }
    }
    trailCanvas.style.transform = `translate(${(cursorCellX - TRAIL_CENTER) * cell + offsetX}px,${(cursorCellY - TRAIL_CENTER) * cell + offsetY}px)`;
    trailCtx.clearRect(0, 0, TRAIL_SIZE, TRAIL_SIZE);
    trail.forEach((entry, key) => {
      entry.strength *= decayFactor(0.955, scale);
      if (entry.strength < 0.08) {
        trail.delete(key);
        return;
      }
      const localX = entry.cellX - cursorCellX + TRAIL_CENTER,
        localY = entry.cellY - cursorCellY + TRAIL_CENTER;
      if (localX < 0 || localY < 0 || localX >= TRAIL_CELLS || localY >= TRAIL_CELLS) return;
      const flicker = hash(entry.cellX, entry.cellY, Math.floor(clock * 3)) < 0.3 ? 1 : 0;
      const level = Math.max(0, Math.min(5, Math.round(entry.strength * 5 - flicker)));
      trailCtx.fillStyle = HEAT_PALETTE[level];
      trailCtx.fillRect(localX * cell + 1, localY * cell + 1, cell - 1, cell - 1);
    });

    const busy =
      trail.size > 0 ||
      Math.abs(targetX - cursorX) + Math.abs(targetY - cursorY) > 0.2 ||
      speed > 0.15 ||
      Math.abs(targetRadius - radius) > 0.02 ||
      (linkProgress > 0.02 && linkProgress < 0.98) ||
      Math.abs((overText ? 1 : 0) - overTextValue) > 0.01 ||
      Math.abs((pointerInside ? 1 : 0) - visible) > 0.01 ||
      shapeTarget !== shape ||
      (!!shape && shapeProgress < 0.98);
    if (busy) raf = requestAnimationFrame(frame);
  };

  const wake = () => {
    if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
  };
  const pointOverText = (x: number, y: number, target: Element | null): boolean => {
    const doc = document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node } | null;
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    let node: Node | null = null;
    if (doc.caretPositionFromPoint) node = doc.caretPositionFromPoint(x, y)?.offsetNode ?? null;
    else if (doc.caretRangeFromPoint) node = doc.caretRangeFromPoint(x, y)?.startContainer ?? null;
    else return !!target?.closest(TEXT_SELECTOR);
    if (!node || node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) return false;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const r of Array.from(range.getClientRects())) {
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
    }
    return false;
  };

  const evaluate = (target: Element | null) => {
    overText = !!target && pointOverText(pointerClientX, pointerClientY, target);
    const named = target?.closest<HTMLElement>('[data-cursor]')?.dataset.cursor;
    shapeTarget = isShapeName(named) ? named : null;
    const link = shapeTarget ? null : (target?.closest('a,button,summary') ?? null);
    onHeading = !!target?.closest('h1,h2');
    const onSquare = !!target?.closest('[data-sq]');
    overLink = !!link && !onSquare && !link.hasAttribute('data-pixel-btn');
    if (link && !onSquare && !link.hasAttribute('data-pixel-btn')) hoveredLink = link;
    targetRadius = onSquare ? SQUARE_RADIUS : onHeading ? REST_RADIUS * HEADING_SCALE : REST_RADIUS;
  };

  const onMove = (e: MouseEvent) => {
    targetX = pointerClientX = e.clientX;
    targetY = pointerClientY = e.clientY;
    if (!pointerInside) {
      cursorX = targetX;
      cursorY = targetY;
      pointerInside = true;
    }
    evaluate(e.target instanceof Element ? e.target : null);
    wake();
  };
  const onScroll = () => {
    if (scrollRaf || !pointerInside) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      if (!pointerInside) return;
      targetX = pointerClientX;
      targetY = pointerClientY;
      evaluate(document.elementFromPoint(pointerClientX, pointerClientY));
      wake();
    });
  };
  const onLeave = () => {
    pointerInside = false;
    wake();
  };
  const onOut = (e: MouseEvent) => {
    if (!e.relatedTarget) onLeave();
  };
  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
      pointerInside = false;
      visible = 0;
      heat.canvas.style.opacity = '0';
      mono.canvas.style.opacity = '0';
    } else wake();
  };
  document.addEventListener('mousemove', onMove);
  window.addEventListener('scroll', onScroll, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);
  document.addEventListener('mouseout', onOut);
  window.addEventListener('blur', onLeave);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    document.removeEventListener('mousemove', onMove);
    window.removeEventListener('scroll', onScroll);
    cancelAnimationFrame(scrollRaf);
    document.documentElement.removeEventListener('mouseleave', onLeave);
    document.removeEventListener('mouseout', onOut);
    window.removeEventListener('blur', onLeave);
    document.removeEventListener('visibilitychange', onVisibility);
    cancelAnimationFrame(raf);
    blobCanvas.remove();
    trailCanvas.remove();
    mono.canvas.remove();
  };
}
