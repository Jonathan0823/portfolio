import { getCollection } from 'astro:content';
import {
  achievementMonths,
  assertContentIntegrity,
  groupMilestonesByYear,
  sortRoles,
  type MilestoneEntry,
  type ProjectEntry,
  type RoleEntry,
} from './content-logic';

export { achievementMonths };

async function loadChecked() {
  const [roles, projects, milestones] = await Promise.all([
    getCollection('roles'),
    getCollection('projects'),
    getCollection('milestones'),
  ]);
  assertContentIntegrity({
    roles: roles as RoleEntry[],
    projects: projects as ProjectEntry[],
    milestones: milestones as MilestoneEntry[],
  });
  return { roles, projects, milestones };
}

export async function getRoles(kind?: 'work' | 'education') {
  const { roles } = await loadChecked();
  return sortRoles(roles.filter((r) => !kind || r.data.kind === kind));
}

export async function getProjects() {
  const { projects } = await loadChecked();
  return [...projects].sort((a, b) => a.data.order - b.data.order);
}

export async function getMilestones() {
  const { milestones } = await loadChecked();
  return [...milestones].sort((a, b) => a.data.date.localeCompare(b.data.date));
}

export async function getSkills() {
  const groups = await getCollection('skills');
  return groups.sort((a, b) => a.id.localeCompare(b.id));
}

export async function getStoryYears() {
  const [milestones, years] = await Promise.all([getMilestones(), getCollection('years')]);
  return groupMilestonesByYear(
    milestones,
    years.map((y) => y.data),
  );
}
