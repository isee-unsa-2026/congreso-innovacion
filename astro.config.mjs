import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Publicado en GitHub Pages: https://isee-unsa-2026.github.io/congreso-innovacion/
// `base` alimenta import.meta.env.BASE_URL, usado por las rutas internas del sitio.
// Con dominio propio: cambiar `site`, quitar `base` y actualizar public/robots.txt.
export default defineConfig({
  site: 'https://isee-unsa-2026.github.io',
  base: '/congreso-innovacion',
  trailingSlash: 'always',
  build: { format: 'directory' },
  // La CSP exige script-src 'self': nunca inyectar scripts en linea.
  vite: { build: { assetsInlineLimit: 0 } },
  // La antigua página /organizacion/ ahora es /organizadores/
  redirects: { '/organizacion/': '/congreso-innovacion/organizadores/' },
  integrations: [sitemap({ filter: (page) => !/\/(programa|organizacion)\/?$/.test(page) })],
});

