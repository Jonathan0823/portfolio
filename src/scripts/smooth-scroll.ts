import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { canRunCursor } from './motion';

if (canRunCursor()) {
  const lenis = new Lenis({
    autoRaf: false,
    lerp: 0.08,
    anchors: true,
  });
  // Lenis only needs frames while it is moving the page; asked for one every tick it keeps the whole page painting even when idle
  let raf = 0;
  const tick = (time: number) => {
    lenis.raf(time);
    raf = lenis.isScrolling || lenis.isStopped ? requestAnimationFrame(tick) : 0;
  };
  const wake = () => {
    if (raf) return;
    // Lenis eases by the time since its last frame: after an idle gap that is huge and the page would jump to its target, so it restarts its clock
    lenis.time = 0;
    raf = requestAnimationFrame(tick);
  };
  // anything that can start a smooth scroll: wheel, touch, keys, anchor clicks and scrollbar drags
  for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown', 'scroll', 'hashchange'])
    addEventListener(type, wake, { passive: true });
  lenis.on('scroll', wake);
  wake();
}
