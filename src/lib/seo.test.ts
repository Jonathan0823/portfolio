import { describe, expect, it } from 'vitest';
import { canonicalUrl, pageSeo, personJsonLd, storyJsonLd } from './seo';

describe('pageSeo', () => {
  it('titles the home page and the story page', () => {
    expect(pageSeo('home').title).toBe('Eguin Jonathan — Software Engineer (Backend & Full-Stack)');
    expect(pageSeo('story').title).toBe('My Story — Eguin Jonathan, Software Engineer');
  });
  it('keeps descriptions under the ~160 character snippet limit', () => {
    expect(pageSeo('home').description.length).toBeLessThanOrEqual(160);
    expect(pageSeo('story').description.length).toBeLessThanOrEqual(160);
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
    expect(ld.jobTitle).toBe('Software Engineer');
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

describe('storyJsonLd', () => {
  it('describes the story page as a profile page about the person', () => {
    const ld = storyJsonLd('https://eguinjonathan.com', '/story/');
    expect(ld['@type']).toBe('ProfilePage');
    expect(ld.url).toBe('https://eguinjonathan.com/story/');
    expect(ld.mainEntity['@type']).toBe('Person');
    expect(ld.mainEntity.name).toBe('Eguin Jonathan');
  });
});
