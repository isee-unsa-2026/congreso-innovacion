import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Publicado en GitHub Pages: https://blastingdays2026.github.io/
// Si se usa un dominio propio, cambiar `site` aqui y en public/robots.txt.
export default defineConfig({
  site: 'https://blastingdays2026.github.io',
  trailingSlash: 'always',
  build: { format: 'directory' },
  // La CSP exige script-src 'self': nunca inyectar scripts en linea.
  vite: { build: { assetsInlineLimit: 0 } },
  integrations: [sitemap({ filter: (page) => !/\/(programa|organizacion)\/?$/.test(page) })],
});

