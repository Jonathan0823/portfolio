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

const skills = defineCollection({
  loader: file('src/content/skills.yaml', {
    parser: (text) => (parse(text) as { group: string }[]).map((g, i) => ({ id: String(i).padStart(2, '0'), ...g })),
  }),
  schema: skillGroupSchema,
});

const years = defineCollection({
  loader: file('src/content/years.yaml', {
    parser: (text) => (parse(text) as { year: string }[]).map((y) => ({ id: y.year, ...y })),
  }),
  schema: storyYearSchema,
});

export const collections = { roles, projects, milestones, skills, years };
