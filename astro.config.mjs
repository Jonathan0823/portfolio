// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { execSync } from 'node:child_process';

// the site changes when a commit lands, so the last commit's date is each page's last-modified date
const lastCommit = (() => {
  try {
    return new Date(execSync('git log -1 --format=%cI', { encoding: 'utf8' }).trim());
  } catch {
    return new Date();
  }
})();

export default defineConfig({
  site: 'https://eguinjonathan.com',
  integrations: [sitemap({ lastmod: lastCommit })],
  vite: {
    plugins: [tailwindcss()],
  },
});
