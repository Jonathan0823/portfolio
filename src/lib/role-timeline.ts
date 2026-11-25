import type { Entry } from './content-logic';
import type { Role } from './schemas';

export type RoleEntry = Entry<Role>;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const index = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
const fromIndex = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;

/** "2025-07" -> "Jul 2025" */
export function formatMonth(m: string): string {
  return `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
}

/** "Jul 2025 – now" for an open role. */
export function formatRange(start: string, end: string): string {
  return `${formatMonth(start)} – ${end === 'present' ? 'now' : formatMonth(end)}`;
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
  const end = role.data.end === 'present' ? currentMonth : role.data.end;
  const marked = new Set(role.data.achievements.map((a) => a.month));
  const out: Square[] = [];
  for (let i = index(role.data.start); i <= index(end); i++) {
    const month = fromIndex(i);
    out.push({ month, label: formatMonth(month), hasAchievement: marked.has(month) });
  }
  return out;
}
