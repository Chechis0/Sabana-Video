// Cuadros sueltos para revisión: node film/still.js 3.3 12 25.5 ...  (STILL_DIR=carpeta)
import fs from 'fs';
import path from 'path';
import { makeRenderer } from './render-view.js';
import { drawFrame } from './film.js';
import { FPS } from './timeline.js';

const outDir = process.env.STILL_DIR || 'out/stills';
fs.mkdirSync(outDir, { recursive: true });
const { canvas, D } = makeRenderer();
const times = process.argv.slice(2).map(Number);
for (const t of times) {
  const t0 = Date.now();
  const frame = Math.round(t * FPS);
  drawFrame(D, canvas, frame / FPS, frame);
  if (D.pending.length) { await D.flush(); drawFrame(D, canvas, frame / FPS, frame); }
  if (global.gc) global.gc();
  await new Promise((r) => setImmediate(r));
  const file = path.join(outDir, `t${t.toFixed(2).padStart(5, '0')}.png`);
  fs.writeFileSync(file, await canvas.encode('png'));
  console.log(file, Date.now() - t0, 'ms');
}
