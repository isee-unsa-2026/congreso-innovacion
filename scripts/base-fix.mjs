// Despues de `astro build`: el sitio se publica en GitHub Pages bajo /congreso-innovacion/.
// Astro ya agrega esa base a sus propios recursos (/_astro/...), pero las rutas escritas a mano
// en las paginas (href="/inscripciones/", src="/img/...") y las URL absolutas del dominio no.
// Este paso las corrige en los archivos generados de `dist`.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = '/congreso-innovacion';
const ORIGEN = 'https://isee-unsa-2026.github.io';
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const TIPOS = new Set(['.html', '.css', '.xml', '.txt', '.ics', '.webmanifest', '.json']);

async function* archivos(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* archivos(p);
    else if (TIPOS.has(extname(e.name))) yield p;
  }
}

const raiz = new RegExp(`((?:href|src|action|content|poster|srcset)=["']|url\\(["']?)/(?!/|${BASE.slice(1)}/)`, 'g');
const absoluto = new RegExp(`${ORIGEN.replace(/[.]/g, '\\.')}/(?!${BASE.slice(1)}/)`, 'g');

let n = 0;
for await (const f of archivos(DIST)) {
  const antes = await readFile(f, 'utf8');
  const despues = antes.replace(raiz, `$1${BASE}/`).replace(absoluto, `${ORIGEN}${BASE}/`);
  if (despues !== antes) { await writeFile(f, despues); n++; }
}
console.log(`base-fix: ${n} archivos ajustados a ${BASE}/`);
