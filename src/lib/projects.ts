/** Helpers for rendering a Project row. */
import { yearOf } from './role-timeline';

export const projectYear = yearOf;

export interface ProjectSection {
  label: string;
  text: string;
}

/** Splits a Project body: text before the first "## " heading is the description, each heading is a labelled section. */
export function splitProjectBody(body: string | undefined): { description: string; sections: ProjectSection[] } {
  const [intro = '', ...parts] = (body ?? '').split(/^## +/m);
  const sections = parts.map((part) => {
    const [label = '', ...rest] = part.split('\n');
    return { label: label.trim(), text: rest.join('\n').trim() };
  });
  return { description: intro.trim(), sections };
}

/** The repo link first, then any extra repos; the first is labelled with the repo name. */
export function projectLinks(project: {
  repo: string;
  extraRepos: { text: string; href: string }[];
}): { text: string; href: string }[] {
  const name = new URL(project.repo).pathname.split('/').filter(Boolean).at(-1) ?? project.repo;
  return [{ text: name, href: project.repo }, ...project.extraRepos];
}
