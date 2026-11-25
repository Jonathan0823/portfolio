import { getCollection } from 'astro:content';
import {
  achievementMonths,
  assertContentIntegrity,
  sortRoles,
  type MilestoneEntry,
  type ProjectEntry,
  type RoleEntry,
} from './content-logic';

export { achievementMonths };

/** Loads every collection once and fails the build if the content is inconsistent. */
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

/** Roles of one kind (all by default), newest first. */
export async function getRoles(kind?: 'work' | 'education') {
  const { roles } = await loadChecked();
  return sortRoles(roles.filter((r) => !kind || r.data.kind === kind));
}

/** Projects in their display order. */
export async function getProjects() {
  const { projects } = await loadChecked();
  return [...projects].sort((a, b) => a.data.order - b.data.order);
}

/** Milestones oldest first, as the story page reads. */
export async function getMilestones() {
  const { milestones } = await loadChecked();
  return [...milestones].sort((a, b) => a.data.date.localeCompare(b.data.date));
}

/** Skill groups in file order. */
export async function getSkills() {
  const groups = await getCollection('skills');
  return groups.sort((a, b) => a.id.localeCompare(b.id));
}
