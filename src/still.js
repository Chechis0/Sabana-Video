// Renderiza cuadros sueltos para revisión: node src/still.js 2.5 13 30.2 ...
import fs from 'fs';
import path from 'path';
import { makeRenderer, drawFrame } from './scene.js';
import { FPS } from './timeline.js';

const outDir = process.env.STILL_DIR || 'out/stills';
fs.mkdirSync(outDir, { recursive: true });
const { canvas, D } = makeRenderer();
const times = process.argv.slice(2).map(Number);
for (const t of times) {
  const t0 = Date.now();
  const frame = Math.round(t * FPS);
  drawFrame(D, frame / FPS, frame);
  // la primera pasada crea los mosaicos de textura; se redibuja ya con patrones rápidos
  if (D.pending.length) { await D.flush(); drawFrame(D, frame / FPS, frame); }
  if (global.gc) global.gc();
  const file = path.join(outDir, `t${t.toFixed(2).padStart(5, '0')}.png`);
  fs.writeFileSync(file, await canvas.encode('png'));
  console.log(file, Date.now() - t0, 'ms');
}
