import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { canRunCursor } from './motion';

if (canRunCursor()) {
  new Lenis({
    autoRaf: true,
    lerp: 0.12,
    anchors: true,
  });
}
