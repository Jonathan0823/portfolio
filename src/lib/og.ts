import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';

const require = createRequire(import.meta.url);
const font = (weight: 400 | 600) => readFile(require.resolve(`@fontsource/geist/files/geist-latin-${weight}-normal.woff`));

const INK = '#111111';
const ACCENT = '#e5484d';
const MUTED = '#5e5e5e';
const PIXELS = ['#1e1b4b', '#4338ca', '#7c5cfa', '#ff7a28', '#ffc43c', '#e5484d'];

const el = (type: string, style: Record<string, unknown>, children?: unknown) => ({
  type,
  props: { style: { display: 'flex', ...style }, children },
});

/** 1200x630 PNG: ink on white, accent pixels. */
export async function renderOgImage(headline: string, sub: string): Promise<Uint8Array> {
  const [regular, semi] = await Promise.all([font(400), font(600)]);
  const pixels = PIXELS.map((c, i) => el('div', { width: 40, height: 40, background: c, marginLeft: i ? 8 : 0 }));
  const tree = el('div', { flexDirection: 'column', justifyContent: 'space-between', width: 1200, height: 630, background: '#ffffff', padding: 80 }, [
    el('div', {}, pixels),
    el('div', { flexDirection: 'column' }, [
      el('div', { fontSize: 112, fontWeight: 600, color: INK, letterSpacing: -6, lineHeight: 1 }, [
        { type: 'span', props: { children: headline } },
        { type: 'span', props: { style: { color: ACCENT }, children: '.' } },
      ]),
      el('div', { fontSize: 36, color: MUTED, marginTop: 28 }, sub),
    ]),
  ]);
  const svg = await satori(tree as never, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Geist', data: regular, weight: 400, style: 'normal' },
      { name: 'Geist', data: semi, weight: 600, style: 'normal' },
    ],
  });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
