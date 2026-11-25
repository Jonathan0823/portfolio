import type { Entry } from './content-logic';
import { PRESENT, type Role } from './schemas';

export type RoleEntry = Entry<Role>;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const monthIndex = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
export const monthFromIndex = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;

/** "2025-07" -> "Jul 2025" */
export function formatMonth(m: string): string {
  return `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
}

/** "2025-07" -> "2025" */
export const yearOf = (m: string): string => m.slice(0, 4);

/** Jan to Dec of a year as YYYY-MM strings. */
export function monthsOfYear(year: string): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

/** The YYYY-MM month a date falls in (UTC). */
export const monthOf = (d: Date): string => monthFromIndex(d.getUTCFullYear() * 12 + d.getUTCMonth());

/** Whole years from a month to the month of `now`. */
export function wholeYearsSince(start: string, now: Date): number {
  return Math.floor((monthIndex(monthOf(now)) - monthIndex(start)) / 12);
}

/** A Role's `end` is a month, or PRESENT while it is still open. This is the one place that is resolved. */
export const isOpenEnd = (end: string): boolean => end === PRESENT;
export const resolveEnd = (end: string, currentMonth: string): string => (isOpenEnd(end) ? currentMonth : end);

/** "Jul 2025 – now" for an open role. */
export function formatRange(start: string, end: string): string {
  return `${formatMonth(start)} – ${isOpenEnd(end) ? 'now' : formatMonth(end)}`;
}

/** 17 -> "1 yr 5 mo" */
export function formatDuration(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [];
  if (y) parts.push(`${y} ${y === 1 ? 'yr' : 'yrs'}`);
  if (m || !y) parts.push(`${m} mo`);
  return parts.join(' ');
}

export interface Square {
  month: string;
  label: string;
  /** True when the Role has at least one Achievement in this month. */
  hasAchievement: boolean;
}

/** One square per month of the Role, both ends included; an open Role ends at `currentMonth`. */
export function roleSquares(role: RoleEntry, currentMonth: string): Square[] {
  const end = resolveEnd(role.data.end, currentMonth);
  const marked = new Set(role.data.achievements.map((a) => a.month));
  const out: Square[] = [];
  for (let i = monthIndex(role.data.start); i <= monthIndex(end); i++) {
    const month = monthFromIndex(i);
    out.push({ month, label: formatMonth(month), hasAchievement: marked.has(month) });
  }
  return out;
}
