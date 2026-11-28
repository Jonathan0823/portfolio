// The Wave's input for a hovering mouse: the pointer just outside a surface presses it in, harder the faster it moves.
import { pressWave } from './surface-wave';
import { pointOnField, type MountWaveInput } from './surface-waves';

/** the pointer's speed eases toward each move's speed this much, and fades by this per frame once moves stop */
const SPEED_EASE = 0.35;
const SPEED_FADE = 0.8;
/** ms without a move before the speed starts fading; moves further apart than MOVE_GAP_MS give no speed */
const STILL_MS = 60;
const MOVE_GAP_MS = 100;

export const hoverInput: MountWaveInput = (wake) => {
  const pointer = { x: 0, y: 0, inside: false, speed: 0, time: 0 };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const gap = e.timeStamp - pointer.time;
    if (pointer.inside && gap > 0 && gap < MOVE_GAP_MS) {
      const speed = Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) / gap;
      pointer.speed += (speed - pointer.speed) * SPEED_EASE;
    }
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.time = e.timeStamp;
    pointer.inside = true;
    wake();
  };
  const onLeave = () => {
    pointer.inside = false;
    pointer.speed = 0;
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);
  window.addEventListener('blur', onLeave);

  return {
    frame(now) {
      if (now - pointer.time > STILL_MS) pointer.speed *= SPEED_FADE;
    },
    step(field, wave) {
      if (!pointer.inside) return;
      const { column, outside } = pointOnField(field, pointer.x, pointer.y);
      if (column < -field.field().columns || column > 2 * field.field().columns) return;
      pressWave(wave, column, outside, pointer.speed);
    },
    stop() {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('blur', onLeave);
    },
  };
};
