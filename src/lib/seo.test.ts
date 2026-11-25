import { describe, expect, it } from 'vitest';
import { canonicalUrl, pageSeo, personJsonLd } from './seo';

describe('pageSeo', () => {
  it('titles the home page and the story page', () => {
    expect(pageSeo('home').title).toBe('Eguin Jonathan — Backend Engineer');
    expect(pageSeo('story').title).toBe('Story — Eguin Jonathan');
  });
  it('gives every page a description and an image path', () => {
    expect(pageSeo('home').description.length).toBeGreaterThan(40);
    expect(pageSeo('story').description.length).toBeGreaterThan(40);
    expect(pageSeo('story').ogPath).toBe('/og/story.png');
    expect(pageSeo('home').ogPath).toBe('/og/home.png');
  });
});

describe('canonicalUrl', () => {
  it('builds an absolute URL from the site', () => {
    expect(canonicalUrl('https://eguinjonathan.com', '/story')).toBe('https://eguinjonathan.com/story');
    expect(canonicalUrl('https://eguinjonathan.com/', '/')).toBe('https://eguinjonathan.com/');
  });
});

describe('personJsonLd', () => {
  const ld = personJsonLd('https://eguinjonathan.com', [
    { group: 'Languages', items: ['Go', 'Python'] },
    { group: 'Frontend', items: ['Go', 'React'] },
  ]);
  it('describes the person', () => {
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('Person');
    expect(ld.name).toBe('Eguin Jonathan');
    expect(ld.jobTitle).toBe('Backend Engineer');
    expect(ld.url).toBe('https://eguinjonathan.com/');
    expect(ld.sameAs).toEqual([
      'https://github.com/Jonathan0823',
      'https://www.npmjs.com/~jonathan0823',
      'https://www.linkedin.com/in/eguin-jonathan-37a587290/',
    ]);
  });
  it('builds knowsAbout from the skills without duplicates', () => {
    expect(ld.knowsAbout).toEqual(['Go', 'Python', 'React']);
  });
});
