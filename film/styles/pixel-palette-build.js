// Genera la paleta del pixel art a partir de la propia película: dibuja ~40 cuadros a baja
// resolución sin reducir colores, junta los píxeles y los agrupa (k-means en Oklab).
// Luego aviva un poco la paleta (más croma, extremos de luz) como haría un pixel artist.
//   STYLE=pixel node --expose-gc film/styles/pixel-palette-build.js [K]
import fs from 'fs';
import { makeRenderer } from '../render-view.js';
import { drawFrame } from '../film.js';
import { FPS } from '../timeline.js';
import { PALETTE_FILE, oklab } from './pixel.js';
import { mulberry32 } from '../core/math.js';

process.env.PIXEL_RAW = '1';
const K = Number(process.argv[2] || 64);
const { canvas, D } = makeRenderer();
const times = [];
for (let t = 0.4; t < 41; t += 1.0) times.push(t);
// el time-lapse y la tormenta cambian de color muy rápido: más muestras ahí
for (let t = 22.9; t < 27.2; t += 0.2) times.push(t);
for (let t = 35.0; t < 36.6; t += 0.3) times.push(t);
const samples = [];
const r = mulberry32(7);
for (const t of times) {
  const f = Math.round(t * FPS);
  drawFrame(D, canvas, f / FPS, f);
  const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 0; i < d.length; i += 4) if (r() < 0.12) samples.push([d[i], d[i + 1], d[i + 2]]);
  if (global.gc) global.gc();
  await new Promise((res) => setImmediate(res));
  process.stdout.write('.');
}
console.log('\nmuestras', samples.length);
const lab = samples.map(([a, b, c]) => oklab(a, b, c));
const rgbOf = samples;
// k-means++
const cent = [];
cent.push(lab[Math.floor(r() * lab.length)].slice());
const dist = new Float64Array(lab.length).fill(Infinity);
const d2 = (p, q) => { const a = (p[0] - q[0]) * 1.2, b = p[1] - q[1], c = p[2] - q[2]; return a * a + b * b + c * c; };
while (cent.length < K) {
  let sum = 0;
  const c = cent[cent.length - 1];
  for (let i = 0; i < lab.length; i++) { dist[i] = Math.min(dist[i], d2(lab[i], c)); sum += dist[i]; }
  let x = r() * sum, j = 0;
  for (; j < lab.length - 1; j++) { x -= dist[j]; if (x <= 0) break; }
  cent.push(lab[j].slice());
}
const asg = new Int32Array(lab.length);
for (let it = 0; it < 18; it++) {
  for (let i = 0; i < lab.length; i++) {
    let bi = 0, bd = Infinity;
    for (let k = 0; k < K; k++) { const dd = d2(lab[i], cent[k]); if (dd < bd) { bd = dd; bi = k; } }
    asg[i] = bi;
  }
  const acc = Array.from({ length: K }, () => [0, 0, 0, 0]);
  for (let i = 0; i < lab.length; i++) { const a = acc[asg[i]]; a[0] += lab[i][0]; a[1] += lab[i][1]; a[2] += lab[i][2]; a[3]++; }
  for (let k = 0; k < K; k++) if (acc[k][3]) cent[k] = [acc[k][0] / acc[k][3], acc[k][1] / acc[k][3], acc[k][2] / acc[k][3]];
}
// color medio en RGB de cada grupo (más fiel que convertir el centroide)
const accR = Array.from({ length: K }, () => [0, 0, 0, 0]);
for (let i = 0; i < lab.length; i++) { const a = accR[asg[i]]; a[0] += rgbOf[i][0]; a[1] += rgbOf[i][1]; a[2] += rgbOf[i][2]; a[3]++; }
const toHex = (v) => '#' + v.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
// avivar: más saturación (alrededor de la luminancia) en los colores apagados
const vivid = ([R, G, B], k) => {
  const l = 0.3 * R + 0.59 * G + 0.11 * B;
  return [l + (R - l) * k, l + (G - l) * k, l + (B - l) * k];
};
let cols = accR.filter((a) => a[3] > 0).map((a) => vivid([a[0] / a[3], a[1] / a[3], a[2] / a[3]], 1.12));
// rampas dibujadas a mano (con cambio de tono, como hace un pixel artist): cielo, atardecer,
// noche, tormenta, tierra, piel, rojos y agua. Lo que el k-means deja corto.
const RAMPS = [
  ['#2f5fa8', '#4f86c8', '#7fb0e0', '#b6d8f0', '#e4f3fb'],
  ['#3b2a5a', '#6a3d78', '#a24f84', '#d9677a', '#f28a64', '#f9b26a', '#fde0a0', '#fff4d6'],
  ['#0b1026', '#141c3e', '#22305c', '#34477a', '#4e6596'],
  ['#3a4450', '#57636e', '#75828c', '#96a2aa', '#b9c2c6'],
  ['#3d2a1c', '#5e4128', '#82603a', '#a8844e', '#c9a868', '#e2c98e', '#f3e4bc'],
  ['#5a3424', '#7f4a32', '#a66a48', '#c98e66', '#e5b48a'],
  ['#5a1622', '#8a2430', '#c23a3a', '#e5603e', '#f08a4a'],
  ['#1f4f7a', '#2f73a8', '#4a98cc', '#78bde6', '#b4e0f6', '#e8f8ff'],
  ['#10101c', '#fffdf4', '#ffffff'],
].flat().map((h) => h.match(/\w\w/g).map((x) => parseInt(x, 16)));
const rlab = RAMPS.map((c) => oklab(...c));
cols = cols.filter((c) => { const l = oklab(...c); return rlab.every((q) => Math.hypot(l[0] - q[0], l[1] - q[1], l[2] - q[2]) > 0.035); });
cols.push(...RAMPS);
const hex = cols.map(toHex);
const sorted = hex.map((h) => ({ h, l: oklab(...h.match(/\w\w/g).map((x) => parseInt(x, 16))) })).sort((a, b) => Math.atan2(a.l[2], a.l[1]) - Math.atan2(b.l[2], b.l[1]) || a.l[0] - b.l[0]).map((o) => o.h);
fs.writeFileSync(PALETTE_FILE, JSON.stringify({ note: 'Paleta del pixel art, generada a partir de los colores de la película (k-means en Oklab) y avivada.', colors: sorted }, null, 1));
console.log('paleta', sorted.length, 'colores →', PALETTE_FILE);
