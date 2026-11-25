import { PROFILE_URLS } from './profile';

export type SeoPage = 'home' | 'story';

const PAGES: Record<SeoPage, { title: string; description: string }> = {
  home: {
    title: 'Eguin Jonathan — Backend Engineer',
    description:
      'Eguin Jonathan is a backend engineer in Karawang, Indonesia, building device gateways, data pipelines and fast dashboards in Go, Python and TypeScript. Open to remote roles.',
  },
  story: {
    title: 'Story — Eguin Jonathan',
    description:
      'How Eguin Jonathan went from informatics student to backend engineer writing software for factory machines and the people who watch them.',
  },
};

export function pageSeo(page: SeoPage) {
  return { ...PAGES[page], ogPath: `/og/${page}.png` };
}

/** Absolute URL for a path on the site. */
export function canonicalUrl(site: string, pathname: string): string {
  return new URL(pathname, site).href;
}

export function personJsonLd(site: string, skills: readonly { group: string; items: readonly string[] }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Eguin Jonathan',
    jobTitle: 'Backend Engineer',
    url: canonicalUrl(site, '/'),
    sameAs: PROFILE_URLS,
    knowsAbout: [...new Set(skills.flatMap((s) => s.items))],
  };
}
