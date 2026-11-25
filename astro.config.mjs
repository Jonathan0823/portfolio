// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// The one place the site address lives. If the .com is taken, change it here only.
export default defineConfig({
  site: 'https://eguinjonathan.com',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
