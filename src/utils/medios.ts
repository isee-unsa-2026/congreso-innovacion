import fs from 'node:fs';
import path from 'node:path';

/** true si la ruta ('/img/...') existe dentro de public/. Se evalúa al compilar. */
export function enPublic(ruta?: string | null) {
  if (!ruta) return false;
  return fs.existsSync(path.join(process.cwd(), 'public', ruta.replace(/^\/+/, '')));
}

/**
 * Alto (px) para que logos de proporciones distintas tengan un peso visual parejo:
 * todos ocupan aproximadamente la misma área (`area`, en px²), dentro de [min, max].
 */
export function altoOptico(ancho: number, alto: number, area: number, min = 0, max = Infinity) {
  const h = Math.sqrt(area / (ancho / alto));
  return Math.round(Math.min(max, Math.max(min, h)) * 10) / 10;
}

/** Iniciales para el monograma: primer nombre + apellido paterno ("Ruth Escobar Juárez" → "RE"). */
export function iniciales(nombre: string) {
  const partes = nombre.split(/\s+/).filter((w) => /^\p{Lu}/u.test(w) && !w.endsWith('.'));
  if (!partes.length) return '';
  const apellido = partes.length >= 3 ? partes[partes.length - 2] : partes[partes.length - 1];
  return (partes[0][0] + (partes.length > 1 ? apellido[0] : '')).toUpperCase();
}
