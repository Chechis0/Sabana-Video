// Papel crema con fibras, manchas suaves y grano; más una capa de "diente" para multiplicar.
import { createCanvas } from '@napi-rs/canvas';
import { mulberry32, fbm2 } from './math.js';

export const PAPER = '#f2e9d6';

export function makePaper(W, H, seed = 7) {
  const rnd = mulberry32(seed);
  const c = createCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = PAPER;
  g.fillRect(0, 0, W, H);
  // manchas de baja frecuencia
  const lw = Math.ceil(W / 12), lh = Math.ceil(H / 12);
  const low = createCanvas(lw, lh);
  const lg = low.getContext('2d');
  const img = lg.createImageData(lw, lh);
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) {
      const v = fbm2(x / 9, y / 9, seed, 4);
      const i = (y * lw + x) * 4;
      const k = v > 0 ? 255 : 120;
      img.data[i] = k; img.data[i + 1] = k * 0.96; img.data[i + 2] = k * 0.88;
      img.data[i + 3] = Math.abs(v) * 60;
    }
  }
  lg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true;
  g.globalAlpha = 0.55;
  g.drawImage(low, 0, 0, W, H);
  g.globalAlpha = 1;
  // fibras
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * W, y = rnd() * H;
    const L = 4 + rnd() * 16, a = rnd() * Math.PI * 2;
    g.strokeStyle = rnd() < 0.5 ? `rgba(120,100,70,${0.03 + rnd() * 0.06})` : `rgba(255,255,250,${0.1 + rnd() * 0.2})`;
    g.lineWidth = 0.5 + rnd() * 0.8;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.6) * L * 0.5, y + Math.sin(a + 0.6) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L);
    g.stroke();
  }
  // grano fino
  for (let i = 0; i < 26000; i++) {
    g.fillStyle = rnd() < 0.6 ? `rgba(90,70,40,${0.03 + rnd() * 0.07})` : `rgba(255,255,255,${0.1 + rnd() * 0.25})`;
    g.fillRect(rnd() * W, rnd() * H, 1 + rnd(), 1 + rnd());
  }
  return c;
}

// Capa de "diente" (se multiplica sobre los colores: el lápiz no llena los valles del papel)
export function makeTooth(W, H, seed = 11) {
  const rnd = mulberry32(seed);
  const c = createCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 60000; i++) {
    const v = 200 + rnd() * 50;
    g.fillStyle = `rgba(${v},${v - 6},${v - 18},${0.25 + rnd() * 0.5})`;
    const s = 0.8 + rnd() * 1.6;
    g.fillRect(rnd() * W, rnd() * H, s, s * (0.6 + rnd() * 0.8));
  }
  // rayado muy tenue en diagonal (textura de hoja prensada)
  for (let i = 0; i < 1400; i++) {
    const x = rnd() * W, y = rnd() * H, L = 20 + rnd() * 60;
    g.strokeStyle = `rgba(215,205,185,${0.15 + rnd() * 0.2})`;
    g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + L * 0.5, y - L); g.stroke();
  }
  return c;
}

// viñeta cálida
export function makeVignette(W, H) {
  const c = createCanvas(W, H);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(W / 2, H * 0.46, H * 0.25, W / 2, H / 2, H * 0.72);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(1, 'rgba(214,196,168,1)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  return c;
}
