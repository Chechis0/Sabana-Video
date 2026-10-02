// Pixel art: el mundo se dibuja a 216×384 (cada píxel son 5×5 en el video), se reduce a una
// paleta limitada con tramado ordenado (Bayer 4×4, estable cuadro a cuadro) y se amplía sin
// suavizar. Los personajes llevan contorno de un píxel del color de su borde, oscurecido
// ("sel-out"), como los sprites de los juegos de 16 bits.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FlatD } from './flat.js';
import { W, H } from '../timeline.js';
import { PX, RW, RH, scaledCanvas } from '../style.js';
import { clamp, hexToRgb } from '../core/math.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const PALETTE_FILE = path.join(here, 'pixel-palette.json');

// ------------------------------------------------------------------ pincel
const OUTLINE = new Set(['drop', 'bear', 'person', 'bird']);
const MINW = PX * 0.9; // ninguna línea más fina que ~1 píxel

export class PixelD extends FlatD {
  constructor(ctx, Wd, Hd) {
    super(ctx, Wd, Hd);
    this.pixel = true;
    this.noRefract = true;
    this.blurScale = 0.45; // profundidad de campo más suave: las formas siguen leyéndose
    this.sprite = scaledCanvas();
  }
  lineWidth(width, o) {
    const w = o.abs ? width : this.lw(width);
    return Math.max(MINW, w);
  }
  line(path, color, width = 1.8, o = {}) {
    const ctx = this.ctx;
    const w0 = o.abs ? width : this.lw(width);
    // lo muy fino se vuelve una línea de un píxel algo más tenue
    const thin = w0 < MINW ? 0.55 + 0.45 * (w0 / MINW) : 1;
    ctx.globalAlpha = clamp((o.alpha ?? 0.85) * thin);
    ctx.strokeStyle = this.col(color);
    ctx.lineWidth = Math.max(MINW, w0);
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.stroke(path);
    ctx.globalAlpha = 1;
  }
  // personajes: se pintan en su propia capa y se les pone contorno de 1 píxel
  wrapItem(it, draw) {
    if (!OUTLINE.has(it.o.tag)) return draw();
    const L = this.sprite;
    const prev = this.ctx;
    L.g.save();
    L.g.setTransform(1, 0, 0, 1, 0, 0);
    L.g.globalCompositeOperation = 'source-over';
    L.g.globalAlpha = 1;
    L.g.clearRect(0, 0, W, H);
    L.g.restore();
    this.ctx = L.g;
    draw();
    this.ctx = prev;
    selOut(L);
    prev.save();
    prev.setTransform(1, 0, 0, 1, 0, 0);
    prev.globalAlpha = 1;
    prev.globalCompositeOperation = 'source-over';
    prev.drawImage(L, 0, 0, W, H);
    prev.restore();
  }
}

// contorno de 1 píxel alrededor de lo opaco, con el color vecino oscurecido
function selOut(L) {
  const w = L.width, h = L.height;
  const img = L.g.getImageData(0, 0, w, h);
  const d = img.data;
  const src = new Uint8ClampedArray(d);
  let any = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] >= 110) continue;
      let best = -1, ba = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = (yy * w + xx) * 4;
        if (src[j + 3] > 170 && src[j + 3] > ba) { ba = src[j + 3]; best = j; }
      }
      if (best < 0) continue;
      any = true;
      // oscuro y un poco más frío que el borde
      d[i] = src[best] * 0.32 + 6;
      d[i + 1] = src[best + 1] * 0.3 + 8;
      d[i + 2] = src[best + 2] * 0.36 + 18;
      d[i + 3] = 255;
    }
  }
  if (any) L.g.putImageData(img, 0, 0);
}

// ------------------------------------------------------------------ paleta y tramado
// Oklab: distancia perceptual para elegir el color de paleta más cercano
function srgb2lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
export function oklab(r, g, b) {
  const lr = srgb2lin(r), lg = srgb2lin(g), lb = srgb2lin(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

let PAL = null, LUT = null;
const BITS = 6, LV = 1 << BITS;
export function loadPalette(list) {
  const cols = list || JSON.parse(fs.readFileSync(PALETTE_FILE, 'utf8')).colors;
  PAL = cols.map((h) => hexToRgb(h));
  const lab = PAL.map(([r, g, b]) => oklab(r, g, b));
  LUT = new Uint8Array(LV * LV * LV);
  const step = 255 / (LV - 1);
  for (let r = 0; r < LV; r++) {
    for (let g = 0; g < LV; g++) {
      for (let b = 0; b < LV; b++) {
        const [L, A, B] = oklab(r * step, g * step, b * step);
        let bi = 0, bd = Infinity;
        for (let k = 0; k < lab.length; k++) {
          const p = lab[k];
          const dl = (L - p[0]) * 1.15, da = A - p[1], db = B - p[2];
          const dd = dl * dl + da * da + db * db;
          if (dd < bd) { bd = dd; bi = k; }
        }
        LUT[(r * LV + g) * LV + b] = bi;
      }
    }
  }
  return PAL;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

// reduce el lienzo pequeño a la paleta, con tramado ordenado de amplitud `spread`
export function quantize(canvas, spread = 22) {
  if (!LUT) loadPalette();
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const sh = 8 - BITS;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const o = BAYER[(y & 3) * 4 + (x & 3)] * spread;
      const r = clamp(d[i] + o, 0, 255) >> sh, gg = clamp(d[i + 1] + o, 0, 255) >> sh, b = clamp(d[i + 2] + o, 0, 255) >> sh;
      const c = PAL[LUT[(r * LV + gg) * LV + b]];
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

// lienzo pequeño → video 1080×1920 (vecino más cercano: píxeles nítidos)
export function upscale(low, out) {
  const g = out.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'copy';
  g.imageSmoothingEnabled = false;
  g.drawImage(low, 0, 0, RW, RH, 0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  g.imageSmoothingEnabled = true;
}

// mosaico: bloques de n×n con el color promedio (la transición clásica de las consolas)
export function mosaic(canvas, n) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let by = 0; by < h; by += n) {
    for (let bx = 0; bx < w; bx += n) {
      let r = 0, gg = 0, b = 0, c = 0;
      for (let y = by; y < Math.min(h, by + n); y++) for (let x = bx; x < Math.min(w, bx + n); x++) { const i = (y * w + x) * 4; r += d[i]; gg += d[i + 1]; b += d[i + 2]; c++; }
      r /= c; gg /= c; b /= c;
      for (let y = by; y < Math.min(h, by + n); y++) for (let x = bx; x < Math.min(w, bx + n); x++) { const i = (y * w + x) * 4; d[i] = r; d[i + 1] = gg; d[i + 2] = b; }
    }
  }
  g.putImageData(img, 0, 0);
}
// cuándo: alrededor del salto al time-lapse (23 s): sube a bloques de 12 y vuelve
const MOSAICS = [{ t: 23.0, k: 0.22, n: 12 }];
export function mosaicAt(t) {
  for (const m of MOSAICS) {
    const u = 1 - Math.abs(t - m.t) / m.k;
    if (u > 0) return Math.max(1, Math.round(1 + (m.n - 1) * u * u));
  }
  return 1;
}
