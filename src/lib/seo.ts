import { PROFILE_URLS } from './profile';

export type SeoPage = 'home' | 'story';

const PAGES: Record<SeoPage, { title: string; description: string; imageAlt: string }> = {
  home: {
    title: 'Eguin Jonathan — Software Engineer (Backend & Full-Stack)',
    imageAlt: 'Eguin Jonathan, software engineer: Go, Python, TypeScript, IoT and data pipelines',
    description:
      'Eguin Jonathan, software engineer in Karawang, Indonesia: device gateways, data pipelines and fast dashboards in Go, Python, TypeScript. Open to remote roles.',
  },
  story: {
    title: 'My Story — Eguin Jonathan, Software Engineer',
    imageAlt: 'Eguin Jonathan, from informatics student to software engineer',
    description:
      'How Eguin Jonathan went from informatics student to software engineer writing software for factory machines and the people who watch them.',
  },
};

export function pageSeo(page: SeoPage) {
  return { ...PAGES[page], ogPath: `/og/${page}.png` };
}

export function canonicalUrl(site: string, pathname: string): string {
  return new URL(pathname, site).href;
}

export function personJsonLd(site: string, skills: readonly { group: string; items: readonly string[] }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Eguin Jonathan',
    jobTitle: 'Software Engineer',
    url: canonicalUrl(site, '/'),
    sameAs: PROFILE_URLS,
    knowsAbout: [...new Set(skills.flatMap((s) => s.items))],
  };
}

export function storyJsonLd(site: string, pathname: string) {
  const story = PAGES.story;
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    name: story.title,
    url: canonicalUrl(site, pathname),
    mainEntity: {
      '@type': 'Person',
      name: 'Eguin Jonathan',
      jobTitle: 'Software Engineer',
      url: canonicalUrl(site, '/'),
      sameAs: PROFILE_URLS,
    },
  };
}
