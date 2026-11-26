import { createAssembler, NONE } from './pixel-assemble';
import { canRunCursor } from './motion';
import { easeFactor, frameScale } from './timing';

const BUILD_MS = 560;
const SWITCH_MS = 420;
const SCATTER_MS = 300;
const LINGER_MS = 120;
const GAP = 28;

const peek = document.querySelector<HTMLElement>('[data-peek]');
const list = document.getElementById('projects');

if (peek && list && canRunCursor()) {
  const items = [...peek.querySelectorAll<HTMLElement>('[data-peek-item]')];
  const assembler = createAssembler(items, peek.querySelector<HTMLCanvasElement>('[data-peek-px]')!);
  items.forEach((el) => (el.hidden = false));
  let current: string | null = null;
  let x = 0,
    y = 0,
    targetX = 0,
    targetY = 0,
    lastY = 0;
  let raf = 0,
    last = 0;

  const frame = (now: number) => {
    raf = 0;
    const scale = last ? frameScale(now - last) : 1;
    last = now;
    const follow = easeFactor(0.2, scale);
    x += (targetX - x) * follow;
    y += (targetY - y) * follow;
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

  let pointerIn = false,
    scrollRaf = 0;
  const evaluate = (target: Element | null, clientY: number) => {
    const row = target?.closest<HTMLElement>('[data-project]');
    const onSummary = row && target?.closest('[data-cursor="eye"]');
    if (row && onSummary && !row.querySelector('[data-detail]:not([data-collapsed])'))
      show(row.dataset.project!, clientY >= lastY);
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
  list.addEventListener('click', (e) => evaluate(e.target as Element, e.clientY));
  list.addEventListener('pointerleave', () => {
    pointerIn = false;
    hide();
  });
  window.addEventListener(
    'scroll',
    () => {
      if (!pointerIn || scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        evaluate(document.elementFromPoint(targetX, targetY), targetY);
      });
    },
    { passive: true },
  );
}
