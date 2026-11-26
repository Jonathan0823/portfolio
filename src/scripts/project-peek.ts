// Hover preview for the project list: a window that trails the pointer and shows the
// project's screenshot. It has no frame of its own: each time it shows a project, pixels build
// the picture (scripts/pixel-assemble.ts), and they take it apart when the pointer leaves.
// Fine pointers only, and not under reduced motion (the expanded row shows the same picture).
import { createAssembler, NONE } from './pixel-assemble';
import { canRunTrail } from './motion';
import { easeFactor, frameScale } from './timing';

const BUILD_MS = 560;
const SWITCH_MS = 420;
const SCATTER_MS = 300;
const LINGER_MS = 120; // grace before taking the box apart, so crossing between rows switches directly
const GAP = 28; // px between the pointer and the window

const peek = document.querySelector<HTMLElement>('[data-peek]');
const list = document.getElementById('projects');

if (peek && list && canRunTrail()) {
  const items = [...peek.querySelectorAll<HTMLElement>('[data-peek-item]')];
  const assembler = createAssembler(items, peek.querySelector<HTMLCanvasElement>('[data-peek-px]')!);
  // Every picture stays in the stack; the assembler's clipping decides which cells show which.
  items.forEach((el) => (el.hidden = false));
  let current: string | null = null;
  let x = 0, y = 0, targetX = 0, targetY = 0, lastY = 0;
  let raf = 0, last = 0;

  const frame = (now: number) => {
    raf = 0;
    const scale = last ? frameScale(now - last) : 1;
    last = now;
    const follow = easeFactor(0.2, scale);
    x += (targetX - x) * follow;
    y += (targetY - y) * follow;
    // Sit to the right of the pointer; flip to the left near the right edge.
    const width = peek.offsetWidth;
    const left = x + GAP + width > window.innerWidth - 16 ? x - GAP - width : x + GAP;
    peek.style.transform = `translate(${left}px, ${y - peek.offsetHeight / 2}px)`;
    if (current !== null && Math.abs(targetX - x) + Math.abs(targetY - y) > 0.3) raf = requestAnimationFrame(frame);
  };
  const wake = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  let linger = 0;
  const show = (id: string, fromAbove: boolean) => {
    clearTimeout(linger);
    linger = 0;
    if (id === current) return;
    const wasHidden = peek.classList.contains('hidden');
    current = id;
    peek.classList.remove('hidden');
    if (wasHidden) {
      x = targetX;
      y = targetY;
      assembler.reset();
    }
    const layer = items.findIndex((el) => el.dataset.peekItem === id);
    assembler.show(layer, fromAbove ? 'top' : 'bottom', wasHidden ? BUILD_MS : SWITCH_MS);
    wake();
  };
  const hide = () => {
    if (current === null || linger) return;
    linger = window.setTimeout(() => {
      linger = 0;
      current = null;
      assembler.show(NONE, 'left', SCATTER_MS, () => peek.classList.add('hidden'));
    }, LINGER_MS);
  };

  let pointerIn = false, scrollRaf = 0;
  const evaluate = (target: Element | null, clientY: number) => {
    const row = target?.closest<HTMLElement>('[data-project]');
    // An open row already shows its picture; the summary part of a row is what previews.
    const onSummary = row && target?.closest('[data-cursor="eye"]');
    if (row && onSummary && !row.querySelector('[data-detail]:not([data-collapsed])')) show(row.dataset.project!, clientY >= lastY);
    else hide();
    lastY = clientY;
    wake();
  };
  list.addEventListener('pointermove', (e) => {
    pointerIn = true;
    targetX = e.clientX;
    targetY = e.clientY;
    evaluate(e.target as Element, e.clientY);
  });
  // Opening a row under a still pointer puts the same picture on the page: drop the preview.
  list.addEventListener('click', (e) => evaluate(e.target as Element, e.clientY));
  list.addEventListener('pointerleave', () => {
    pointerIn = false;
    hide();
  });
  // Scrolling moves rows under a still pointer: look again at what is under it.
  window.addEventListener('scroll', () => {
    if (!pointerIn || scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      evaluate(document.elementFromPoint(targetX, targetY), targetY);
    });
  }, { passive: true });
}
