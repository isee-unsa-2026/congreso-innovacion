import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Publicado en GitHub Pages: https://isee-unsa-2026.github.io/congreso-innovacion/
// `base` + scripts/base-fix.mjs ajustan las rutas. Con dominio propio: cambiar `site`, quitar `base`,
// quitar base-fix del script "build" y actualizar public/robots.txt.
export default defineConfig({
  site: 'https://isee-unsa-2026.github.io',
  base: '/congreso-innovacion',
  trailingSlash: 'always',
  build: { format: 'directory' },
  // La CSP exige script-src 'self': nunca inyectar scripts en linea.
  vite: { build: { assetsInlineLimit: 0 } },
  integrations: [sitemap({ filter: (page) => !/\/(programa|organizacion)\/?$/.test(page) })],
});

