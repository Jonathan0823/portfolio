# Eguin portfolio

Personal portfolio site for Eguin Jonathan, built with [Astro](https://astro.build) and deployed as static files to Cloudflare Pages. It has two pages, home (`/`) and story (`/story`), and the content is kept in Markdown and YAML so it can be edited without touching the components.

## Stack

- **Astro 7** for static pages, with TypeScript throughout
- **Tailwind CSS 4** via the Vite plugin, with global styles in `src/styles/global.css`
- **Vitest** for unit tests of the logic in `src/lib` and `src/scripts`
- **satori** and **@resvg/resvg-js** to render the Open Graph images at build time
- **Lenis** for smooth scrolling
- **Geist** and **Geist Mono** fonts, self-hosted through Fontsource
- **pnpm** as the package manager (pinned by `packageManager` in `package.json`)

## Quick start

Requires Node 24 and pnpm.

```
pnpm install --frozen-lockfile
pnpm dev      # local dev server
pnpm test     # unit tests
pnpm check    # astro check (type and content checks)
pnpm build    # static build into dist/
pnpm preview  # serve dist/ locally
pnpm lhci     # Lighthouse CI on / and /story, mobile and desktop
```

`pnpm lhci` runs Lighthouse against `astro preview` on port 4321. Performance, accessibility and best-practices must each score at least 0.95. Set `CHROME_PATH` if Chrome is not on the default path.

## Scripts

| Script           | What it does                                                           |
| ---------------- | ---------------------------------------------------------------------- |
| `dev`            | Starts the Astro dev server                                            |
| `build`          | Builds the static site into `dist/`                                    |
| `preview`        | Serves the built `dist/`                                               |
| `check`          | Runs `astro check`                                                     |
| `test`           | Runs the Vitest suite once                                             |
| `lhci`           | Runs Lighthouse CI for mobile and desktop                              |
| `stats:snapshot` | Refreshes the committed GitHub stats snapshot (needs `GH_STATS_TOKEN`) |

## Project layout

```
src/
  content/        Site content: milestones, projects, roles (Markdown), skills.yaml, years.yaml
  content.config.ts  Content collection schemas
  components/     Astro components for each section of the pages
  layouts/        BaseLayout.astro, the shared shell
  pages/          Routes: index, story, 404, /og/[page].png, robots.txt
  lib/            Content loading, schemas, SEO, Open Graph, GitHub stats, timeline helpers
  scripts/        Browser effects: pixel canvases, cursor trail, smooth scroll, page cover
  styles/         global.css with the design tokens
  data/           github.json, the committed GitHub stats snapshot
scripts/          github-snapshot.ts, the stats refresh script
public/           Static assets, including favicons and cv.pdf
docs/             Notes for agents and architecture decisions
```

Two notes on the layout:

- Pure logic (no DOM access) lives in `src/lib` and `src/scripts` as small modules with tests beside them. Browser code that needs the DOM sits in the same folders and is kept separate from the maths.
- `src/content.config.ts` validates every content file at build time. A bad entry fails the build rather than reaching the page.

## Editing content

- **Milestones** (`src/content/milestones/`): dated Markdown files named `YYYY-MM-slug.md`, shown on the story page.
- **Projects** (`src/content/projects/`): Markdown files with the project details. A `## ` heading in the body becomes a labelled section.
- **Roles** (`src/content/roles/`): Markdown files for each job or role, shown on the experience timeline.
- **Skills** (`src/content/skills.yaml`): skill groups, shown in file order.
- **Years** (`src/content/years.yaml`): the subtitle and meta line for each year on `/story`.
- **CV**: place `public/cv.pdf`. CV links only render once the file exists.
- **Contact and profile links**: edit `src/lib/profile.ts`.
- **Site address**: set once in `astro.config.mjs`.

## GitHub stats

The stats on the page come from `src/data/github.json`, a snapshot committed to the repo. If `GH_STATS_TOKEN` is set at build time, the build fetches live numbers from the GitHub GraphQL API instead. If the fetch fails, the build logs a warning and uses the snapshot, so it never fails because of GitHub.

To refresh the committed snapshot:

```
GH_STATS_TOKEN=<token> pnpm stats:snapshot
```

## Testing and CI

- `pnpm test` runs the Vitest suite (`src/**/*.test.ts`).
- The CI workflow (`.github/workflows/ci.yml`) runs on every pull request: install with the frozen lockfile, `test`, `check`, `build`, then `lhci`.

## Deployment

The deploy workflow (`.github/workflows/deploy.yml`) runs on pushes to `main`, on a daily schedule, and on manual dispatch. It builds the site with `GH_STATS_TOKEN` from the repository secrets, then uploads `dist/` to Cloudflare Pages (project `eguinjonathan`, branch `main`). It needs the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets.

## Further reading

- [GLOSSARY.md](GLOSSARY.md): domain terms used across the code and content
- [docs/](docs/): agent workflow notes, the issue tracker, and triage labels
