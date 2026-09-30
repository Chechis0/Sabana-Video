// Luz en el aire: haces de sol entre los árboles (a una profundidad dada, así lo cercano
// los tapa), motas de polvo iluminadas y manchas de sol sobre el suelo.
import { W, H } from '../timeline.js';
import { clamp, noise1, hrand, mulberry32, hexToRgb } from '../core/math.js';

// haces: o = { col, k, angle (rad desde la vertical, + = hacia la derecha), n, seed, width, xs: [x mundo...] }
export function drawShafts(D, cam, d, t, o) {
  const ctx = D.ctx;
  const k = o.k ?? 1;
  if (k <= 0.01) return;
  const [r, g, b] = hexToRgb(o.col || '#fff0c8');
  const ang = o.angle ?? 0.35;
  const dx = Math.sin(ang), dy = Math.cos(ang);
  const s = cam.f / d;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'screen';
  const n = o.n ?? 7;
  const rnd = mulberry32(o.seed ?? 5);
  for (let i = 0; i < n; i++) {
    const wx = o.xs ? o.xs[i % o.xs.length] : cam.x + (rnd() - 0.5) * (W / s) * 1.6;
    // el haz pasa por la proyección de su ancla a media altura de la pantalla
    const mid = cam.project(wx, cam.y, cam.z + d);
    if (!mid) continue;
    const ym = H * 0.55;
    const x0 = mid[0] - dx * (ym + 200) / dy;
    const y0 = -200;
    const L = H + 600;
    const w0 = (o.width ?? 60) * (0.5 + rnd()) * Math.max(0.6, s);
    const w1 = w0 * 2.2;
    const fl = 0.6 + 0.4 * noise1(t * 0.7 + i * 3.1, 17);
    const al = (o.alpha ?? 0.22) * k * fl * (0.5 + rnd() * 0.7);
    const x1 = x0 + dx * L, y1 = y0 + dy * L;
    const nx = dy, ny = -dx;
    const gr = ctx.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, `rgba(${r},${g},${b},${al})`);
    gr.addColorStop(0.55, `rgba(${r},${g},${b},${al * 0.6})`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = gr;
    ctx.filter = `blur(${Math.max(4, w0 * 0.25).toFixed(1)}px)`;
    ctx.beginPath();
    ctx.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2);
    ctx.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
    ctx.lineTo(x1 - nx * w1 / 2, y1 - ny * w1 / 2);
    ctx.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.filter = 'none';
  ctx.restore();
}

// motas de polvo / polen que flotan en la luz (espacio de pantalla con paralaje leve)
export function drawMotes(D, cam, t, o = {}) {
  const k = o.k ?? 1;
  if (k <= 0.01) return;
  const ctx = D.ctx;
  const [r, g, b] = hexToRgb(o.col || '#fff6d8');
  const n = o.n ?? 70;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const depth = 0.3 + hrand(i, 1) * 1.2;
    const px = (hrand(i, 2) * W * 1.4 - cam.x * 0.35 * depth + t * 12 * depth + noise1(t * 0.3 + i, 3) * 30) % (W * 1.4);
    const x = (px + W * 1.4) % (W * 1.4) - W * 0.2;
    const y = ((hrand(i, 3) * H + cam.y * 0.3 * depth + noise1(t * 0.25 + i, 4) * 60 - t * 8) % H + H) % H;
    const sz = (1 + hrand(i, 4) * 2.4) * depth;
    const tw = 0.5 + 0.5 * Math.sin(t * (1 + hrand(i, 5) * 2) + i);
    ctx.globalAlpha = k * tw * 0.75;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, sz * 3);
    gr.addColorStop(0, `rgba(${r},${g},${b},1)`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(x - sz * 3, y - sz * 3, sz * 6, sz * 6);
  }
  ctx.restore();
}

// mancha de sol sobre el suelo en (x,y,z) del mundo
export function drawFleck(D, cam, x, y, z, r, t, seed, col = '#fff1c0', k = 1) {
  const p = cam.project(x, y, z);
  if (!p) return;
  const rx = r * p[2], ry = rx * 0.32;
  if (rx < 2) return;
  const fl = 0.5 + 0.5 * noise1(t * 1.3 + seed, 9);
  const ctx = D.ctx;
  const [cr, cg, cb] = hexToRgb(col);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.5 * k * fl;
  ctx.translate(p[0], p[1]);
  ctx.scale(1, ry / rx);
  const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, `rgba(${cr},${cg},${cb},0.9)`);
  gr.addColorStop(0.6, `rgba(${cr},${cg},${cb},0.35)`);
  gr.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
