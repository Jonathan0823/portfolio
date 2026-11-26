import type { Entry } from './content-logic';
import { PRESENT, type Role } from './schemas';

export type RoleEntry = Entry<Role>;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const monthIndex = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
export const monthFromIndex = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;

export function formatMonth(m: string): string {
  return `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
}

export const yearOf = (m: string): string => m.slice(0, 4);

export function monthsOfYear(year: string): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

export const monthOf = (d: Date): string => monthFromIndex(d.getUTCFullYear() * 12 + d.getUTCMonth());

export function wholeYearsSince(start: string, now: Date): number {
  return Math.floor((monthIndex(monthOf(now)) - monthIndex(start)) / 12);
}

export const isOpenEnd = (end: string): boolean => end === PRESENT;
export const resolveEnd = (end: string, currentMonth: string): string => (isOpenEnd(end) ? currentMonth : end);

export function formatRange(start: string, end: string): string {
  return `${formatMonth(start)} – ${isOpenEnd(end) ? 'now' : formatMonth(end)}`;
}

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
  hasAchievement: boolean;
}

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
