import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../astro.config.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const base = `/${String(config.base ?? '').replace(/^\/+|\/+$/g, '')}`;
const origin = new URL(config.site).origin;
const textExtensions = new Set(['.html', '.css', '.js', '.xml', '.txt', '.json', '.webmanifest']);
const rootRelative = new RegExp(
  `(?:href|src|action|content|poster)=["']/(?!/|${base.slice(1)}/)|url\\(["']?/(?!/|${base.slice(1)}/)`,
  'g',
);
const wrongOrigin = new RegExp(`${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(?!${base.slice(1)}/)`, 'g');

async function* files(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (textExtensions.has(extname(entry.name))) yield path;
  }
}

const failures = [];
for await (const path of files(dist)) {
  const contents = await readFile(path, 'utf8');
  const matches = [...contents.matchAll(rootRelative), ...contents.matchAll(wrongOrigin)];
  if (matches.length) {
    failures.push(`${relative(dist, path)}: ${matches.map(({ 0: match }) => match).join(', ')}`);
  }
}

if (failures.length) {
  console.error(`Se encontraron rutas que omiten la base ${base}:\n${failures.join('\n')}`);
  process.exit(1);
}

console.log(`Rutas verificadas: todos los recursos internos usan ${base}/`);
