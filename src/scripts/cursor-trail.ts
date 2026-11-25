import { HEAT_PALETTE, hash, heatLevel } from './pixel-math';
import type { HeroField } from './hero-field';

const CELL = 14; // cell size in CSS px
const BLOB_CELLS = 64; // blob overlay cells per side
const BLOB_CENTER = 32; // cursor cell inside the blob overlay
const BLOB_SIZE = BLOB_CELLS * CELL;
const TRAIL_CELLS = 120; // trail overlay cells per side
const TRAIL_CENTER = 60;
const TRAIL_SIZE = TRAIL_CELLS * CELL;
const NEAR_CANVAS_PX = 260; // how close to a pixel canvas the blob starts to heat up

interface TrailCell {
  cellX: number;
  cellY: number;
  /** 0..1, fades as the cell ages */
  strength: number;
}

interface BlobShape {
  /** how stretched the blob is along its heading, from speed */
  stretch: number;
  heading: number;
  wobble: number;
  phase: number;
}

/**
 * The cursor pixel trail: a pixel blob that follows the pointer plus fading cells left behind.
 * Overlays are fixed-position and ignore pointer events; the system cursor is never hidden.
 * The animation loop only runs while the pointer is over the page, the tab is visible and
 * something is still moving or the pointer is near a pixel canvas; otherwise it stops.
 * Returns a function that removes everything.
 */
export function mountCursorTrail(hero: HeroField | null): () => void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const createBlobCanvas = (blend: boolean) => {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = `position:fixed;left:0;top:0;width:${BLOB_SIZE}px;height:${BLOB_SIZE}px;pointer-events:none;z-index:51;opacity:0;transition:opacity .15s;${blend ? 'mix-blend-mode:difference;' : ''}`;
    canvas.width = BLOB_SIZE * dpr;
    canvas.height = BLOB_SIZE * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    document.body.appendChild(canvas);
    return [canvas, ctx] as const;
  };
  const [lightCanvas, lightCtx] = createBlobCanvas(true);
  const [colorCanvas, colorCtx] = createBlobCanvas(false);
  const blobCanvases = [lightCanvas, colorCanvas];

  const trailCanvas = document.createElement('canvas');
  trailCanvas.setAttribute('aria-hidden', 'true');
  trailCanvas.style.cssText = `position:fixed;left:0;top:0;width:${TRAIL_SIZE}px;height:${TRAIL_SIZE}px;pointer-events:none;z-index:-1;image-rendering:pixelated`;
  trailCanvas.width = TRAIL_SIZE;
  trailCanvas.height = TRAIL_SIZE;
  const trailCtx = trailCanvas.getContext('2d')!;
  const previousIsolation = document.body.style.isolation;
  document.body.style.isolation = 'isolate';
  document.body.insertBefore(trailCanvas, document.body.firstChild);

  const trail = new Map<string, TrailCell>();
  let targetX = 0, targetY = 0; // where the pointer is
  let cursorX = 0, cursorY = 0; // the eased position the blob follows
  let speed = 0, heading = 0, clock = 0;
  let radius = 1.5, targetRadius = 1.5;
  let raf = 0, pointerInside = false;
  let warmth = 0, targetWarmth = 0; // 0..1, closeness to a pixel canvas
  let heroContact = 0;
  let smoothDx = 0, smoothDy = 0;
  let hoveredLink: Element | null = null, linkProgress = 0, overLink = false;
  let shape: BlobShape = { stretch: 0, heading: 0, wobble: 0, phase: 0 };

  const blobDistance = (du: number, dv: number, blobRadius: number) => {
    const cos = Math.cos(shape.heading), sin = Math.sin(shape.heading);
    const along = du * cos + dv * sin, across = -du * sin + dv * cos;
    const longRadius = blobRadius * (1 + shape.stretch), shortRadius = blobRadius / (1 + shape.stretch * 0.45);
    const angle = Math.atan2(across, along);
    const wobble = 1 + shape.wobble * (0.3 * Math.sin(3 * angle + shape.phase) + 0.2 * Math.sin(5 * angle - 1.7 * shape.phase));
    return Math.sqrt((along / longRadius) ** 2 + (across / shortRadius) ** 2) / wobble;
  };
  const fillCell = (cellX: number, cellY: number, originX: number, originY: number, ctx: CanvasRenderingContext2D) =>
    ctx.fillRect((cellX - originX) * CELL + 1, (cellY - originY) * CELL + 1, CELL - 1, CELL - 1);

  const frame = () => {
    raf = 0;
    if (document.hidden) return;
    const prevX = cursorX, prevY = cursorY;
    cursorX += (targetX - cursorX) * 0.35;
    cursorY += (targetY - cursorY) * 0.35;
    clock += 0.12;
    radius += (targetRadius - radius) * 0.25;
    const dx = cursorX - prevX, dy = cursorY - prevY, stepLength = Math.hypot(dx, dy);
    smoothDx += (dx - smoothDx) * 0.18;
    smoothDy += (dy - smoothDy) * 0.18;
    const smoothSpeed = Math.hypot(smoothDx, smoothDy);
    speed += (smoothSpeed - speed) * 0.5;
    if (smoothSpeed > 0.6) {
      const wantedHeading = Math.atan2(smoothDy, smoothDx);
      let turn = wantedHeading - heading;
      turn -= Math.round(turn / Math.PI) * Math.PI;
      heading += turn * 0.3;
    }
    const stretch = Math.min(speed / 18, 1), wobble = Math.min(0.6, speed / 40);
    shape = { stretch, heading, wobble, phase: clock };
    const cursorCellX = Math.floor(cursorX / CELL), cursorCellY = Math.floor(cursorY / CELL);
    const originX = cursorCellX - BLOB_CENTER, originY = cursorCellY - BLOB_CENTER;
    for (const canvas of blobCanvases) canvas.style.transform = `translate(${originX * CELL}px,${originY * CELL}px)`;
    lightCtx.clearRect(0, 0, BLOB_SIZE, BLOB_SIZE);
    colorCtx.clearRect(0, 0, BLOB_SIZE, BLOB_SIZE);
    lightCtx.fillStyle = '#FFFFFF';
    const fieldTime = hero ? hero.time() : clock * 0.2;
    warmth += (targetWarmth - warmth) * 0.15;
    const effectiveWarmth = Math.min(1, warmth + stretch * 0.25);
    linkProgress += ((overLink ? 1 : 0) - linkProgress) * 0.3;

    // Over a link the blob turns into an underline.
    if (linkProgress > 0.02 && hoveredLink && hoveredLink.isConnected) {
      const rect = hoveredLink.getBoundingClientRect();
      const row = Math.floor((rect.bottom + 5) / CELL);
      const firstCell = Math.floor(rect.left / CELL), lastCell = Math.floor((rect.right - 1) / CELL);
      const half = (lastCell - firstCell + 1) / 2 + 0.5, middle = (firstCell + lastCell + 1) / 2;
      for (let cell = firstCell; cell <= lastCell; cell++) {
        if (Math.abs(cell + 0.5 - middle) <= half * linkProgress) fillCell(cell, row, originX, originY, lightCtx);
      }
    }
    const blobAlpha = linkProgress < 0.5 ? 1 - linkProgress / 0.5 : 0;
    if (blobAlpha > 0.05) {
      const blobRadius = radius * Math.max(0.3, blobAlpha);
      const reach = Math.ceil(blobRadius * (1 + stretch) * 1.4) + 1;
      for (let cellY = cursorCellY - reach; cellY <= cursorCellY + reach; cellY++) {
        for (let cellX = cursorCellX - reach; cellX <= cursorCellX + reach; cellX++) {
          const distance = blobDistance(cellX + 0.5 - cursorX / CELL, cellY + 0.5 - cursorY / CELL, blobRadius);
          if (distance > 1) continue;
          if (effectiveWarmth < 0.12 || (effectiveWarmth < 0.4 && distance < 0.45)) fillCell(cellX, cellY, originX, originY, lightCtx);
          else {
            colorCtx.fillStyle = HEAT_PALETTE[heatLevel(cellX, cellY, distance, stretch, fieldTime, effectiveWarmth)];
            fillCell(cellX, cellY, originX, originY, colorCtx);
          }
        }
      }
    }

    // Heat dragged into the hero field, and fading cells left on the page near it.
    const steps = Math.max(1, Math.min(40, Math.ceil(stepLength / (CELL * 0.5))));
    let insideHero = false;
    if (hero) {
      const heroRect = hero.rect(), margin = 3 * CELL;
      const near =
        pointerInside &&
        cursorX >= heroRect.left - margin && cursorX <= heroRect.right + margin &&
        cursorY >= heroRect.top - margin && cursorY <= heroRect.bottom + margin;
      if (near) {
        if (cursorX >= heroRect.left && cursorX <= heroRect.right && cursorY >= heroRect.top && cursorY <= heroRect.bottom) insideHero = true;
        const field = hero.field(), brushRadius = 2.2;
        for (let step = 1; step <= steps; step++) {
          const fieldColumn = (prevX + (dx * step) / steps - heroRect.left) / field.cellSize;
          const fieldRow = (prevY + (dy * step) / steps - heroRect.top) / field.cellSize;
          for (let row = Math.max(0, Math.floor(fieldRow - brushRadius)); row < Math.min(field.rows, fieldRow + brushRadius); row++) {
            for (let column = Math.max(0, Math.floor(fieldColumn - brushRadius)); column < Math.min(field.columns, fieldColumn + brushRadius); column++) {
              const distance = Math.hypot(column + 0.5 - fieldColumn, row + 0.5 - fieldRow) / brushRadius;
              if (distance < 1) {
                const index = row * field.columns + column;
                field.heat[index] = Math.max(field.heat[index], 0.55 + (1 - distance) * 0.35);
              }
            }
          }
        }
        hero.markDirty();
      }
    }
    heroContact = insideHero ? 1 : heroContact * 0.93;
    if (pointerInside && !insideHero && heroContact > 0.05 && speed > 1.2) {
      const amount = heroContact * Math.min(1, speed / 18), brushRadius = 1.5;
      for (let step = 1; step <= steps; step++) {
        const column = (prevX + (dx * step) / steps) / CELL, row = (prevY + (dy * step) / steps) / CELL;
        for (let cellY = Math.floor(row - brushRadius); cellY < row + brushRadius; cellY++) {
          for (let cellX = Math.floor(column - brushRadius); cellX < column + brushRadius; cellX++) {
            const distance = Math.hypot(cellX + 0.5 - column, cellY + 0.5 - row) / brushRadius;
            if (distance > 1) continue;
            const key = cellX + ',' + cellY, strength = amount * (1 - distance * 0.5), existing = trail.get(key);
            if (!existing || existing.strength < strength) trail.set(key, { cellX, cellY, strength });
          }
        }
      }
    }
    trailCanvas.style.transform = `translate(${(cursorCellX - TRAIL_CENTER) * CELL}px,${(cursorCellY - TRAIL_CENTER) * CELL}px)`;
    trailCtx.clearRect(0, 0, TRAIL_SIZE, TRAIL_SIZE);
    trail.forEach((cell, key) => {
      cell.strength *= 0.9;
      if (cell.strength < 0.08) {
        trail.delete(key);
        return;
      }
      const localX = cell.cellX - cursorCellX + TRAIL_CENTER, localY = cell.cellY - cursorCellY + TRAIL_CENTER;
      if (localX < 0 || localY < 0 || localX >= TRAIL_CELLS || localY >= TRAIL_CELLS) return;
      const flicker = hash(cell.cellX, cell.cellY, Math.floor(clock * 3)) < 0.3 ? 1 : 0;
      const level = Math.max(0, Math.min(5, Math.round(cell.strength * 5 - flicker)));
      trailCtx.fillStyle = HEAT_PALETTE[level];
      trailCtx.fillRect(localX * CELL + 1, localY * CELL + 1, CELL - 1, CELL - 1);
    });

    // Keep going only while something is still changing. Idle, the loop stops and the next
    // mouse move wakes it. Near a pixel canvas the blob keeps tracking the field's animation.
    const busy =
      trail.size > 0 || Math.abs(targetWarmth - warmth) > 0.01 || targetWarmth > 0.02 ||
      Math.abs(targetX - cursorX) + Math.abs(targetY - cursorY) > 0.2 || speed > 0.15 ||
      Math.abs(targetRadius - radius) > 0.02 || (linkProgress > 0.02 && linkProgress < 0.98);
    if (pointerInside && busy) raf = requestAnimationFrame(frame);
  };

  const wake = () => {
    if (!raf && pointerInside && !document.hidden) raf = requestAnimationFrame(frame);
  };

  const onMove = (e: MouseEvent) => {
    targetX = e.clientX;
    targetY = e.clientY;
    if (!pointerInside) {
      cursorX = targetX;
      cursorY = targetY;
      pointerInside = true;
    }
    const target = e.target instanceof Element ? e.target : null;
    for (const canvas of blobCanvases) canvas.style.opacity = '1';
    let nearestCanvas = Infinity;
    document.querySelectorAll('canvas[data-px],canvas[data-cal]').forEach((canvas) => {
      const box = canvas.getBoundingClientRect();
      const gapX = Math.max(box.left - targetX, 0, targetX - box.right);
      const gapY = Math.max(box.top - targetY, 0, targetY - box.bottom);
      nearestCanvas = Math.min(nearestCanvas, Math.hypot(gapX, gapY));
    });
    targetWarmth = Number.isFinite(nearestCanvas) ? Math.max(0, Math.min(1, 1 - nearestCanvas / NEAR_CANVAS_PX)) : 0;
    const link = target?.closest('a,button') ?? null, onHeading = !!target?.closest('h1,h2');
    overLink = !!link;
    if (link) hoveredLink = link;
    targetRadius = onHeading ? 3.6 : 1.5;
    wake();
  };
  const onLeave = () => {
    for (const canvas of blobCanvases) canvas.style.opacity = '0';
    pointerInside = false;
  };
  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else wake();
  };
  document.addEventListener('mousemove', onMove);
  document.documentElement.addEventListener('mouseleave', onLeave);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    document.removeEventListener('mousemove', onMove);
    document.documentElement.removeEventListener('mouseleave', onLeave);
    document.removeEventListener('visibilitychange', onVisibility);
    cancelAnimationFrame(raf);
    lightCanvas.remove();
    colorCanvas.remove();
    trailCanvas.remove();
    document.body.style.isolation = previousIsolation;
  };
}
