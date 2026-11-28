import { z } from 'astro/zod';
import { PIXEL_ART_NAMES } from './skill-art';

const BRACKETS = /\[[^\]]*\](?!\()/;
const PLACEHOLDER = /placeholder/i;

export function findPlaceholder(text: string): string | undefined {
  return text.match(BRACKETS)?.[0] ?? text.match(PLACEHOLDER)?.[0];
}

const copy = z
  .string()
  .trim()
  .min(1, 'must not be empty')
  .superRefine((value, ctx) => {
    const hit = findPlaceholder(value);
    if (hit) ctx.addIssue({ code: 'custom', message: `placeholder text is not allowed: "${hit}"` });
  });

export const PRESENT = 'present';

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
  story: z.array(copy).min(1).optional(),
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
  result: copy.optional(),
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
  refs: z.array(z.object({ kind: z.enum(['role', 'achievement', 'project']), id: z.string() })).default([]),
});

export const skillSchema = z
  .object({
    name: copy,
    /** simple-icons slug */
    icon: z
      .string()
      .regex(/^[a-z0-9]+$/, 'must be a simple-icons slug')
      .optional(),
    /** letters for a pixel monogram, when there is no logo */
    mono: z
      .string()
      .regex(/^[A-Z]{1,3}$/, 'must be 1 to 3 capital letters')
      .optional(),
    /** a hand-drawn mark from PIXEL_ART */
    art: z.enum(PIXEL_ART_NAMES).optional(),
    /** drawn larger: the tools used most */
    primary: z.boolean().default(false),
  })
  .refine((s) => [s.icon, s.mono, s.art].filter(Boolean).length === 1, 'set exactly one of icon, mono or art');

export const skillGroupSchema = z.object({
  group: copy,
  items: z.array(skillSchema).min(1),
});

export const storyYearSchema = z.object({
  year: z.string().regex(/^(\d{4}|now)$/, 'must be a year like 2025, or "now"'),
  subtitle: copy,
  meta: copy.optional(),
});

export type Role = z.infer<typeof roleSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Milestone = z.infer<typeof milestoneSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type SkillGroup = z.infer<typeof skillGroupSchema>;
