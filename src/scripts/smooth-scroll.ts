import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { canRunTrail } from './motion';

if (canRunTrail()) {
  new Lenis({
    autoRaf: true,
    lerp: 0.12,
    anchors: true,
  });
}
