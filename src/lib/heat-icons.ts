// The pixel icons on the contact and résumé buttons, each with the heat colour it warms to when its button is
// hovered, focused or showing its logo (global.css). Shared by the hero and the closing section.
import { HEAT_PALETTE } from './palette';
import { SMALL_BITMAPS, pixelIcon, type GlyphName } from '@/scripts/glyph-model';

const HEAT: Record<GlyphName, string> = {
  mail: HEAT_PALETTE[3],
  git: HEAT_PALETTE[4],
  linkedin: HEAT_PALETTE[2],
  resume: HEAT_PALETTE[5],
};

/** each button's icon at `size` px, with the inline style that carries its heat colour */
export function heatIcons(size: number) {
  const icon = (name: GlyphName) => ({ ...pixelIcon(SMALL_BITMAPS[name], size), style: `--heat:${HEAT[name]}` });
  return { mail: icon('mail'), git: icon('git'), linkedin: icon('linkedin'), resume: icon('resume') };
}
