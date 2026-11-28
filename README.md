# Eguin Jonathan's portfolio

The source code of [eguinjonathan.com](https://eguinjonathan.com), my personal website. I'm a backend and full-stack software engineer in Karawang, Indonesia.

**[Visit the site](https://eguinjonathan.com)** · **[Read my story](https://eguinjonathan.com/story/)**

## What's on the site

- **Home:** my experience, skills and projects, and how to contact me.
- **Story:** how I got here, year by year.

## Things to try

- Move your mouse along the edge of the lava at the top or bottom of the page to make waves.
- Press and hold on the top section, then let go.
- Watch the two pixel characters after the page loads, and find them again in the footer.
- On a phone, tap near the lava's edge or fling the page to the bottom.

## Built with

[Astro](https://astro.build), TypeScript and [Tailwind CSS](https://tailwindcss.com), with [Lenis](https://lenis.darkroom.engineering) for smooth scrolling. It's a static site hosted on Cloudflare Pages.

## Run it on your computer

You need [Node.js](https://nodejs.org) 24 and [pnpm](https://pnpm.io).

```sh
git clone https://github.com/Jonathan0823/portfolio.git
cd portfolio
pnpm install
pnpm dev
```

Then open the address shown in your terminal. No API keys or tokens are needed.

## Use the code for your own site

You're welcome to reuse the code. Please replace everything that is about me first:

| What                              | Where                                             |
| --------------------------------- | ------------------------------------------------- |
| Story, projects, jobs and skills  | `src/content/`                                    |
| Contact details and profile links | `src/lib/profile.ts`                              |
| Name and intro text               | `src/components/`, `src/pages/`, `src/lib/seo.ts` |
| Site address                      | `astro.config.mjs`                                |
| CV and icons                      | `public/`                                         |
| GitHub stats                      | `src/data/github.json`                            |

Some text also lives elsewhere, so search the project for "Eguin" before publishing. The workflow in `.github/workflows/deploy.yml` deploys to my Cloudflare project, so change or delete it.

## License

The source code is released under the [MIT License](LICENSE).

My personal content is not covered by that license and remains © Eguin Jonathan, all rights reserved. This includes the writing about me, `src/content/`, `public/cv.pdf`, the favicons and touch icon, and my personal details.

Third-party names, logos and characters (including Clawd and Pi), fonts and packages belong to their owners and keep their own terms.
