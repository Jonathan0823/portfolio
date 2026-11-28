// The Wave's input for a charged blast: as the front crosses a visible surface, each column it reaches is shoved into the lava.
import { SHOCKWAVE_EVENT, type ShockwaveDetail } from './cursor-math';
import { hitWave } from './surface-wave';
import { planBlast, type BlastHit } from './wave-impact';
import type { HeroField } from './hero-field';
import type { MountWaveInput } from './surface-waves';

interface Plan {
  hits: BlastHit[];
  /** the first hit not yet applied */
  next: number;
}

/** the blast input for these fields */
export const blastInput =
  (fields: HeroField[]): MountWaveInput =>
  (wake) => {
    const plans = new Map<HeroField, Plan>();
    let released = 0,
      now = 0;

    const onBlast = (e: Event) => {
      const blast = (e as CustomEvent<ShockwaveDetail>).detail;
      released = performance.now();
      now = released;
      plans.clear();
      for (const field of fields) {
        const rect = field.rect();
        // a surface wholly off screen has nothing the front can reach
        if (rect.bottom < 0 || rect.top > innerHeight) continue;
        const f = field.field();
        const hits = planBlast(
          blast,
          {
            left: rect.left,
            cell: f.cellSize,
            edge: field.flipped ? rect.bottom : rect.top,
            flipped: field.flipped,
            rows: f.surface,
            columns: f.columns,
          },
          innerWidth,
          innerHeight,
        );
        if (hits.length) plans.set(field, { hits, next: 0 });
      }
      if (plans.size) wake();
    };
    window.addEventListener(SHOCKWAVE_EVENT, onBlast);

    return {
      frame(t) {
        now = t;
      },
      step(field, wave) {
        const plan = plans.get(field);
        if (!plan) return;
        const since = now - released;
        while (plan.next < plan.hits.length && plan.hits[plan.next].atMs <= since) {
          const hit = plan.hits[plan.next++];
          hitWave(wave, hit.column, hit.push);
        }
      },
      busy() {
        for (const [field, plan] of plans) {
          if (plan.next < plan.hits.length) return true;
          plans.delete(field);
        }
        return false;
      },
      stop() {
        window.removeEventListener(SHOCKWAVE_EVENT, onBlast);
        plans.clear();
      },
    };
  };
