import type { APIRoute, GetStaticPaths } from 'astro';
import { renderOgImage } from '../../lib/og';

const IMAGES = {
  home: { headline: 'Eguin Jonathan', sub: 'Software engineer · Go, Python, TypeScript · IoT and data pipelines' },
  story: { headline: 'How I got here', sub: 'Eguin Jonathan · from informatics student to software engineer' },
} as const;

export const getStaticPaths: GetStaticPaths = () => Object.keys(IMAGES).map((page) => ({ params: { page } }));

export const GET: APIRoute = async ({ params }) => {
  const { headline, sub } = IMAGES[params.page as keyof typeof IMAGES];
  const png = await renderOgImage(headline, sub);
  return new Response(png as BodyInit, { headers: { 'Content-Type': 'image/png' } });
};
