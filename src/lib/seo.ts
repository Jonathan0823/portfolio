import { PROFILE_URLS } from './profile';

export type SeoPage = 'home' | 'story';

const PAGES: Record<SeoPage, { title: string; description: string; imageAlt: string }> = {
  home: {
    title: 'Eguin Jonathan — Software Engineer (Backend & Full-Stack)',
    imageAlt: 'Eguin Jonathan, software engineer: Go, Python, TypeScript, IoT and data pipelines',
    description:
      'Eguin Jonathan, software engineer in Indonesia: device gateways, data pipelines and fast dashboards in Go, Python, TypeScript. Open to remote roles.',
  },
  story: {
    title: 'My Story — Eguin Jonathan, Software Engineer',
    imageAlt: 'Eguin Jonathan, from informatics student to software engineer',
    description:
      'How Eguin Jonathan went from informatics student to software engineer writing software for production machines and the people who watch them.',
  },
};

export function pageSeo(page: SeoPage) {
  return { ...PAGES[page], ogPath: `/og/${page}.png` };
}

export function canonicalUrl(site: string, pathname: string): string {
  return new URL(pathname, site).href;
}

/** one identifier for the person, so each block points at the same one */
function personId(site: string) {
  return canonicalUrl(site, '/#person');
}

export function websiteJsonLd(site: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Eguin Jonathan',
    url: canonicalUrl(site, '/'),
    publisher: { '@id': personId(site) },
    author: { '@id': personId(site) },
  };
}

/** who the site is about: the facts search engines use to tie the site to the person */
function person(site: string) {
  return {
    '@type': 'Person',
    '@id': personId(site),
    name: 'Eguin Jonathan',
    jobTitle: 'Software Engineer',
    url: canonicalUrl(site, '/'),
    sameAs: PROFILE_URLS,
    homeLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Karawang',
        addressRegion: 'West Java',
        addressCountry: 'ID',
      },
    },
    alumniOf: { '@type': 'CollegeOrUniversity', name: 'Universitas Singaperbangsa Karawang' },
    knowsLanguage: ['id', 'en', 'ja'],
  };
}

export function personJsonLd(site: string, skills: readonly { group: string; items: readonly string[] }[]) {
  return {
    '@context': 'https://schema.org',
    ...person(site),
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
    mainEntity: person(site),
  };
}
