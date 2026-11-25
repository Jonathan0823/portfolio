// Lenis smooth scrolling for mouse and trackpad. Touch screens and reduced motion keep native
// scrolling. Lenis drives the real window scroll, so scroll listeners elsewhere keep working.
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { canRunTrail } from './motion';

if (canRunTrail()) {
  new Lenis({
    autoRaf: true,
    lerp: 0.12,
    // In-page links ease to their section; sections carry their own top padding for the nav.
    anchors: true,
  });
}
