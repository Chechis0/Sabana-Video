// Muestrario de texturas: node film/swatch.js salida.png
import fs from 'fs';
import { createCanvas } from '@napi-rs/canvas';
import { Pencil, ellipsePts } from './core/pencil.js';
import { makePaper, makeTooth } from './core/paper.js';
const W = 1080, H = 1920;
const c = createCanvas(W, H), g = c.getContext('2d');
const D = new Pencil(g, W, H);
const draw = () => {
  D.setFrame(0, 0, { x: W / 2, y: H / 2, z: 1 }, 2);
  g.drawImage(makePaper(W, H), 0, 0);
  const cols = ['#3f6b38', '#c7a268', '#7f9f4c', '#4f8fbf', '#a99a55', '#5d4430', '#e0a9a0', '#2c4a2c'];
  cols.forEach((col, i) => {
    const x = (i % 2) * 540, y = Math.floor(i / 2) * 400;
    D.shape([[x + 20, y + 20], [x + 520, y + 20], [x + 520, y + 380], [x + 20, y + 380]], col, { seed: i, smooth: false, knock: true, angle: -0.25 + i * 0.3, baseAlpha: 0.45 });
  });
  for (let i = 0; i < 12; i++) D.shape(ellipsePts(90 + (i % 6) * 180, 1700 + Math.floor(i / 6) * 150, 70, 55, 20, 0, 0.12, i), ['#3f6b38', '#62934c', '#94be66'][i % 3], { seed: 50 + i, knock: true, angle: [-1.05, -0.62, 0.3][i % 3] });
  g.globalCompositeOperation = 'multiply'; g.drawImage(makeTooth(W, H), 0, 0); g.globalCompositeOperation = 'source-over';
};
draw(); await D.flush(); draw();
fs.writeFileSync(process.argv[2], await c.encode('png'));
