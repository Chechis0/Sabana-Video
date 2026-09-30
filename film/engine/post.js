// Postproducción en espacio de pantalla: rayos de luz volumétricos, bloom, etalonaje,
// destellos del sol, papel y viñeta.
import { createCanvas } from '@napi-rs/canvas';
import { W, H } from '../timeline.js';
import { clamp, hexToRgb } from '../core/math.js';

const SW = 270, SH = 480; // cuarto de resolución
function mk(w, h) { const c = createCanvas(w, h); c.g = c.getContext('2d'); return c; }
let A = null, B = null, C = null, FULL = null;
function bufs() {
  if (!A) { A = mk(SW, SH); B = mk(SW, SH); C = mk(SW, SH); FULL = mk(W, H); }
}

// Rayos crepusculares: se toma lo más brillante del cuadro (cielo alrededor del sol),
// se enmascara lo que tapa la luz y se difumina radialmente hacia el sol.
export function godRays(canvas, sun, o = {}) {
  if (!sun || (o.strength ?? 0) <= 0.01) return;
  bufs();
  const ctx = canvas.getContext('2d');
  const [sx, sy] = [sun[0] / 4, sun[1] / 4];
  A.g.setTransform(1, 0, 0, 1, 0, 0);
  A.g.globalCompositeOperation = 'source-over';
  A.g.globalAlpha = 1;
  A.g.drawImage(canvas, 0, 0, SW, SH);
  const img = A.g.getImageData(0, 0, SW, SH);
  const d = img.data;
  const th = o.threshold ?? 0.72;
  const rad = (o.radius ?? 0.9) * SH;
  const [cr, cg, cb] = hexToRgb(o.color || '#fff2d0');
  for (let y = 0, i = 0; y < SH; y++) {
    for (let x = 0; x < SW; x++, i += 4) {
      const l = (d[i] * 0.3 + d[i + 1] * 0.55 + d[i + 2] * 0.15) / 255;
      let v = clamp((l - th) / (1 - th));
      const dd = Math.hypot(x - sx, y - sy) / rad;
      v *= Math.max(0, 1 - dd * dd);
      d[i] = cr * v; d[i + 1] = cg * v; d[i + 2] = cb * v; d[i + 3] = 255;
    }
  }
  A.g.putImageData(img, 0, 0);
  // difuminado radial: tres pasadas de copias escaladas desde el sol
  let src = A, dst = B;
  const passes = [1.08, 1.22, 1.6];
  for (const sc of passes) {
    dst.g.setTransform(1, 0, 0, 1, 0, 0);
    dst.g.globalCompositeOperation = 'source-over';
    dst.g.globalAlpha = 1;
    dst.g.fillStyle = '#000';
    dst.g.fillRect(0, 0, SW, SH);
    dst.g.globalCompositeOperation = 'lighter';
    const N = 6;
    for (let k = 0; k < N; k++) {
      const s = Math.pow(sc, k / (N - 1));
      dst.g.globalAlpha = 1 / N * 1.25;
      dst.g.setTransform(s, 0, 0, s, sx - sx * s, sy - sy * s);
      dst.g.drawImage(src, 0, 0);
    }
    [src, dst] = [dst, src];
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = clamp(o.strength);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(src, 0, 0, W, H);
  ctx.restore();
}

// Bloom: halo suave alrededor de lo más brillante
export function bloom(canvas, o = {}) {
  if ((o.strength ?? 0) <= 0.01) return;
  bufs();
  const ctx = canvas.getContext('2d');
  C.g.setTransform(1, 0, 0, 1, 0, 0);
  C.g.globalAlpha = 1;
  C.g.globalCompositeOperation = 'source-over';
  C.g.filter = `brightness(${o.gain ?? 1.1}) contrast(${o.contrast ?? 3}) blur(${o.radius ?? 10}px)`;
  C.g.drawImage(canvas, 0, 0, SW, SH);
  C.g.filter = 'none';
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = clamp(o.strength);
  ctx.drawImage(C, 0, 0, W, H);
  ctx.restore();
}

// Etalonaje: filtro CSS global + capas de color con modos de fusión
export function grade(canvas, g = {}) {
  bufs();
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (g.filter && g.filter !== 'none') {
    FULL.g.setTransform(1, 0, 0, 1, 0, 0);
    FULL.g.globalCompositeOperation = 'copy';
    FULL.g.filter = g.filter;
    FULL.g.drawImage(canvas, 0, 0);
    FULL.g.filter = 'none';
    FULL.g.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(FULL, 0, 0);
  }
  for (const [col, a, op] of g.layers || []) {
    if (a <= 0.003) continue;
    ctx.globalCompositeOperation = op;
    ctx.globalAlpha = clamp(a);
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

// Degradado vertical aplicado con un modo de fusión (p. ej. cielo más cálido arriba)
export function gradientLayer(canvas, stops, op = 'soft-light', alpha = 1, y0 = 0, y1 = H) {
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const gr = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [p, c] of stops) gr.addColorStop(p, c);
  ctx.globalCompositeOperation = op;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// Halo radial aditivo
export function glow(ctx, x, y, r, color, alpha = 1, op = 'screen') {
  if (alpha <= 0.003 || r <= 0) return;
  const [cr, cg, cb] = hexToRgb(color);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = op;
  ctx.globalAlpha = clamp(alpha);
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
  gr.addColorStop(0.25, `rgba(${cr},${cg},${cb},0.45)`);
  gr.addColorStop(0.6, `rgba(${cr},${cg},${cb},0.12)`);
  gr.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  ctx.fillStyle = gr;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

// Destellos de lente: fantasmas a lo largo de la línea sol → centro
export function lensFlare(ctx, sun, k = 1, color = '#ffd9a0') {
  if (!sun || k <= 0.01) return;
  const cx = W / 2, cy = H / 2;
  const vx = cx - sun[0], vy = cy - sun[1];
  const ghosts = [[0.35, 26, 0.18], [0.62, 60, 0.1], [0.9, 18, 0.2], [1.25, 110, 0.07], [1.6, 40, 0.1]];
  for (const [p, r, a] of ghosts) glow(ctx, sun[0] + vx * p, sun[1] + vy * p, r, color, a * k);
}

// Papel: diente multiplicado + viñeta
export function paperPass(canvas, A, o = {}) {
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = o.tooth ?? 1;
  ctx.drawImage(A.tooth, 0, 0);
  ctx.globalAlpha = o.vignette ?? 0.55;
  ctx.drawImage(A.vig, 0, 0);
  ctx.restore();
}
