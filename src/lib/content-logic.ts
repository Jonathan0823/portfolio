import { monthsOfYear, yearOf } from './role-timeline';
import { findPlaceholder, type Milestone, type Project, type Role } from './schemas';

export interface Entry<T> {
  id: string;
  data: T;
  /** Markdown body, if the entry has one. */
  body?: string;
}
export type RoleEntry = Entry<Role>;
export type ProjectEntry = Entry<Project>;
export type MilestoneEntry = Entry<Milestone>;

/** Roles, newest start first. */
export function sortRoles<T extends RoleEntry>(roles: readonly T[]): T[] {
  return [...roles].sort((a, b) => b.data.start.localeCompare(a.data.start));
}

/** Distinct YYYY-MM months of a role that have an Achievement, oldest first. */
export function achievementMonths(role: RoleEntry): string[] {
  return [...new Set(role.data.achievements.map((a) => a.month))].sort();
}

/**
 * Cross-entry rules a single-file schema cannot check. Throws one Error that
 * lists every problem found.
 */
export function assertContentIntegrity(content: {
  roles: readonly RoleEntry[];
  projects: readonly ProjectEntry[];
  milestones: readonly MilestoneEntry[];
}): void {
  const problems: string[] = [];
  const achievementIds = new Set<string>();

  for (const role of content.roles) {
    for (const a of role.data.achievements) {
      if (achievementIds.has(a.id)) problems.push(`duplicate achievement id "${a.id}" (in role "${role.id}")`);
      achievementIds.add(a.id);
    }
  }
  const roleIds = new Set(content.roles.map((r) => r.id));
  const projectIds = new Set(content.projects.map((p) => p.id));

  for (const p of content.projects) {
    const from = p.data.fromAchievement;
    if (from && !achievementIds.has(from)) {
      problems.push(`project "${p.id}": fromAchievement "${from}" does not match any Achievement id`);
    }
  }
  for (const m of content.milestones) {
    for (const ref of m.data.refs) {
      const known = { role: roleIds, achievement: achievementIds, project: projectIds }[ref.kind];
      if (!known.has(ref.id)) problems.push(`milestone "${m.id}": refs ${ref.kind} "${ref.id}" does not exist`);
    }
  }
  for (const [collection, entries] of [
    ['roles', content.roles],
    ['projects', content.projects],
    ['milestones', content.milestones],
  ] as const) {
    for (const e of entries) {
      const hit = e.body ? findPlaceholder(e.body) : undefined;
      if (hit) problems.push(`${collection}/${e.id}: placeholder text in body: "${hit}"`);
    }
  }

  if (problems.length) throw new Error(`Content check failed:\n - ${problems.join('\n - ')}`);
}

/** The Milestone label that puts a Milestone in the closing group, and that group's year key. */
export const NOW_LABEL = 'Now';
export const NOW_YEAR = 'now';

export interface YearInfo {
  /** "2025", or "now" for the closing group. */
  year: string;
  subtitle: string;
  meta?: string | undefined;
}

export interface YearGroup<T extends MilestoneEntry = MilestoneEntry> extends YearInfo {
  /** Jan to Dec of the year (empty for the closing group), with how many Milestones fall in each. */
  months: { month: string; count: number }[];
  milestones: T[];
}

/**
 * Groups Milestones by year, oldest first, each group in date order. Milestones
 * labelled "Now" go in a closing "now" group. Subtitles come from `years`;
 * a group without one is an error.
 */
export function groupMilestonesByYear<T extends MilestoneEntry>(
  milestones: readonly T[],
  years: readonly YearInfo[],
): YearGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const m of [...milestones].sort((a, b) => a.data.date.localeCompare(b.data.date))) {
    const key = m.data.label === NOW_LABEL ? NOW_YEAR : yearOf(m.data.date);
    buckets.set(key, [...(buckets.get(key) ?? []), m]);
  }
  const keys = [...buckets.keys()].sort((a, b) =>
    a === NOW_YEAR ? 1 : b === NOW_YEAR ? -1 : a.localeCompare(b),
  );
  return keys.map((key) => {
    const info = years.find((y) => y.year === key);
    if (!info) throw new Error(`No subtitle for story year "${key}": add it to src/content/years.yaml`);
    const items = buckets.get(key)!;
    const months =
      key === NOW_YEAR
        ? []
        : monthsOfYear(key).map((month) => ({ month, count: items.filter((m) => m.data.date === month).length }));
    return { ...info, months, milestones: items };
  });
}
