// Póster y storyboard: node --expose-gc film/poster.js  →  out/v4/poster.png, out/v4/storyboard.jpg
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { makeRenderer } from './render-view.js';
import { drawFrame } from './film.js';
import { FPS } from './timeline.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'out', 'v4');
fs.mkdirSync(out, { recursive: true });
const { canvas, D } = makeRenderer();
async function render(t) {
  const f = Math.round(t * FPS);
  drawFrame(D, canvas, f / FPS, f);
  if (D.pending.length) { await D.flush(); drawFrame(D, canvas, f / FPS, f); }
  const img = await loadImage(await canvas.encode('png'));
  if (global.gc) global.gc();
  await new Promise((r) => setImmediate(r));
  return img;
}
const poster = await render(40.5);
const pc = createCanvas(1080, 1920);
pc.getContext('2d').drawImage(poster, 0, 0);
fs.writeFileSync(path.join(out, 'poster.png'), await pc.encode('png'));
const times = [1.9, 5.6, 8.6, 10.9, 14.2, 15.9, 17.8, 20.6, 24.2, 27.6, 30.9, 34.6];
const w = 300, h = 533, cols = 6;
const sb = createCanvas(w * cols, (h + 8) * Math.ceil(times.length / cols));
const g = sb.getContext('2d');
g.fillStyle = '#f2e9d6'; g.fillRect(0, 0, sb.width, sb.height);
for (let i = 0; i < times.length; i++) {
  const img = await render(times[i]);
  g.drawImage(img, (i % cols) * w, Math.floor(i / cols) * (h + 8), w, h);
}
fs.writeFileSync(path.join(out, 'storyboard.jpg'), await sb.encode('jpeg', 88));
console.log('póster y storyboard listos');
