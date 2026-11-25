import { z } from 'astro/zod';

/** Text that must never ship: [ ... ] brackets (not markdown links) or the word "placeholder". */
const BRACKETS = /\[[^\]]*\](?!\()/;
const PLACEHOLDER = /placeholder/i;

export function findPlaceholder(text: string): string | undefined {
  return text.match(BRACKETS)?.[0] ?? text.match(PLACEHOLDER)?.[0];
}

/** Non-empty text with no placeholder markers. */
const copy = z
  .string()
  .trim()
  .min(1, 'must not be empty')
  .superRefine((value, ctx) => {
    const hit = findPlaceholder(value);
    if (hit) ctx.addIssue({ code: 'custom', message: `placeholder text is not allowed: "${hit}"` });
  });

/** A Role's `end` while it is still open. */
export const PRESENT = 'present';

/** YYYY-MM */
export const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'must be a month like 2025-08');

const url = z.url();

export const visualSchema = z.object({
  kind: z.enum(['diagram', 'screenshot', 'photo']),
  label: copy,
  src: z.string().optional(),
});

export const achievementSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'must be a lowercase slug'),
  month,
  text: copy,
  tags: z.array(copy).default([]),
  detail: z
    .object({
      problem: copy,
      did: copy,
      why: copy.optional(),
      result: copy,
    })
    .optional(),
  visual: visualSchema.optional(),
});

export const roleSchema = z.object({
  title: copy,
  org: copy,
  location: copy.optional(),
  start: month,
  end: z.union([month, z.literal(PRESENT)]),
  kind: z.enum(['work', 'education']),
  note: copy.optional(),
  achievements: z.array(achievementSchema).default([]),
});

export const projectSchema = z.object({
  name: copy,
  order: z.number().int(),
  month,
  result: copy,
  repo: url,
  extraRepos: z.array(z.object({ text: copy, href: url })).default([]),
  package: url.optional(),
  tags: z.array(copy).default([]),
  visual: visualSchema,
  fromAchievement: z.string().optional(),
});

export const milestoneSchema = z.object({
  date: month,
  label: copy,
  title: copy,
  tags: z.array(copy).default([]),
  link: z.object({ href: url, text: copy }).optional(),
  refs: z
    .array(z.object({ kind: z.enum(['role', 'achievement', 'project']), id: z.string() }))
    .default([]),
});

export const skillGroupSchema = z.object({
  group: copy,
  items: z.array(copy).min(1),
});

/** Subtitle for one year of the story page; "now" is the closing group. */
export const storyYearSchema = z.object({
  year: z.string().regex(/^(\d{4}|now)$/, 'must be a year like 2025, or "now"'),
  subtitle: copy,
  meta: copy.optional(),
});

export type Role = z.infer<typeof roleSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Milestone = z.infer<typeof milestoneSchema>;
export type SkillGroup = z.infer<typeof skillGroupSchema>;
