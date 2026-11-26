import { describe, expect, it } from 'vitest';
import { projectAnchor, projectForAchievement, projectLinks, projectYear, splitProjectBody } from './projects';

const body = `The open-source version.

## Problem

Drops happen.

## What I did

A gateway.

## Why open source

So others don’t start from zero.
`;

describe('splitProjectBody', () => {
  it('takes the text before the first heading as the description', () => {
    expect(splitProjectBody(body).description).toBe('The open-source version.');
  });

  it('turns each ## heading into a labelled section, in order', () => {
    expect(splitProjectBody(body).sections).toEqual([
      { label: 'Problem', text: 'Drops happen.' },
      { label: 'What I did', text: 'A gateway.' },
      { label: 'Why open source', text: 'So others don’t start from zero.' },
    ]);
  });

  it('handles a body without sections', () => {
    expect(splitProjectBody('Just text.')).toEqual({ description: 'Just text.', sections: [] });
  });

  it('handles an empty body', () => {
    expect(splitProjectBody(undefined)).toEqual({ description: '', sections: [] });
  });
});

describe('projectYear', () => {
  it('is the year of the project month', () => {
    expect(projectYear('2025-08')).toBe('2025');
  });
});

describe('projectLinks', () => {
  it('lists the repo first, then extra repos, labelled by repo name', () => {
    expect(
      projectLinks({
        repo: 'https://github.com/Jonathan0823/nexusbus',
        extraRepos: [
          { text: 'nexusbus-mqtt-consumer', href: 'https://github.com/Jonathan0823/nexusbus-mqtt-consumer' },
        ],
      }),
    ).toEqual([
      { text: 'nexusbus', href: 'https://github.com/Jonathan0823/nexusbus' },
      { text: 'nexusbus-mqtt-consumer', href: 'https://github.com/Jonathan0823/nexusbus-mqtt-consumer' },
    ]);
  });
});

describe('projectForAchievement', () => {
  const projects = [
    { id: 'a', data: {} },
    { id: 'nexusbus', data: { fromAchievement: 'gateway' } },
  ];
  it('finds the Project published from an Achievement', () => {
    expect(projectForAchievement(projects, 'gateway')?.id).toBe('nexusbus');
  });
  it('returns undefined when none matches', () => {
    expect(projectForAchievement(projects, 'other')).toBeUndefined();
  });
  it('anchors a Project row by its id', () => expect(projectAnchor('nexusbus')).toBe('project-nexusbus'));
});
