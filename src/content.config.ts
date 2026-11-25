import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { parse } from 'yaml';
import { milestoneSchema, projectSchema, roleSchema, skillGroupSchema, storyYearSchema } from './lib/schemas';

const roles = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/roles' }),
  schema: roleSchema,
});

const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/projects' }),
  schema: projectSchema,
});

const milestones = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/milestones' }),
  schema: milestoneSchema,
});

// One YAML list of { group, items[] }; the order in the file is the display order.
const skills = defineCollection({
  loader: file('src/content/skills.yaml', {
    parser: (text) =>
      (parse(text) as { group: string }[]).map((g, i) => ({ id: String(i).padStart(2, '0'), ...g })),
  }),
  schema: skillGroupSchema,
});

// Subtitle and one-line meta for each year of /story, keyed by year.
const years = defineCollection({
  loader: file('src/content/years.yaml', {
    parser: (text) => (parse(text) as { year: string }[]).map((y) => ({ id: y.year, ...y })),
  }),
  schema: storyYearSchema,
});

export const collections = { roles, projects, milestones, skills, years };
