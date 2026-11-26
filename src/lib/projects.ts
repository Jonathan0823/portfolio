import { yearOf } from './role-timeline';

export const projectYear = yearOf;

export interface ProjectSection {
  label: string;
  text: string;
}

export function splitProjectBody(body: string | undefined): { description: string; sections: ProjectSection[] } {
  const [intro = '', ...parts] = (body ?? '').split(/^## +/m);
  const sections = parts.map((part) => {
    const [label = '', ...rest] = part.split('\n');
    return { label: label.trim(), text: rest.join('\n').trim() };
  });
  return { description: intro.trim(), sections };
}

export function projectForAchievement<T extends { data: { fromAchievement?: string | undefined } }>(
  projects: readonly T[],
  achievementId: string,
): T | undefined {
  return projects.find((p) => p.data.fromAchievement === achievementId);
}

export const projectAnchor = (id: string): string => `project-${id}`;

export function projectLinks(project: {
  repo: string;
  extraRepos: { text: string; href: string }[];
}): { text: string; href: string }[] {
  const name = new URL(project.repo).pathname.split('/').filter(Boolean).at(-1) ?? project.repo;
  return [{ text: name, href: project.repo }, ...project.extraRepos];
}
