// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// The one place the site address lives. If the .com is taken, change it here only.
export default defineConfig({
  site: 'https://eguinjonathan.com',
  vite: {
    plugins: [tailwindcss()],
  },
});
