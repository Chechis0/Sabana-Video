// Efectos: lluvia, relámpago, vapor, chispas de siembra, tierra, salpicaduras, corazón.
import { W, H } from './timeline.js';
import { ellipsePts } from './core/pencil.js';
import { clamp, lerp, ease, mulberry32, noise1, hrand, prog } from './core/math.js';
import { glow } from './engine/post.js';

export function sparkle(D, x, y, k, size, seed, col = '#fff3b0') {
  if (k <= 0 || k >= 1) return;
  const a = 1 - k;
  const r = size * ease.outBack(clamp(k * 2.5), 2);
  glow(D.ctx, x, y, r * 1.6, col, 0.5 * a);
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + seed;
    D.stroke([[x + Math.cos(ang) * r * 0.25, y + Math.sin(ang) * r * 0.25], [x + Math.cos(ang) * r, y + Math.sin(ang) * r]], col, 2.8, { seed: seed + i, alpha: a, abs: true });
  }
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + seed + Math.PI / 4;
    D.stroke([[x + Math.cos(ang) * r * 0.2, y + Math.sin(ang) * r * 0.2], [x + Math.cos(ang) * r * 0.55, y + Math.sin(ang) * r * 0.55]], col, 2, { seed: seed + 9 + i, alpha: a * 0.8, abs: true });
  }
}

export function dirtPuff(D, x, y, s, k, seed) {
  if (k <= 0 || k >= 1) return;
  const r = mulberry32(seed);
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI * (0.1 + r() * 0.8), v = (22 + r() * 34) * s;
    const px = x + Math.cos(a) * v * k, py = y + Math.sin(a) * v * k + 70 * s * k * k;
    D.shape(ellipsePts(px, py, 3.6 * s * (1 - k * 0.5), 3 * s * (1 - k * 0.5), 6), '#6e4c30', { seed: seed + i, edge: 1, alpha: 1 - k });
  }
}

export function splash(D, x, y, s, k, seed, col = '#bfe6fb', n = 8) {
  if (k <= 0 || k >= 1) return;
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * (0.12 + r() * 0.76), v = (34 + r() * 34) * s;
    const px = x + Math.cos(a) * v * k, py = y + Math.sin(a) * v * k * 1.3 + 100 * s * k * k;
    D.shape(ellipsePts(px, py, 3.2 * s, 4.4 * s, 7), col, { seed: seed + i, edge: 1.2, alpha: 1 - k * k });
  }
  const ring = ellipsePts(x, y + 2 * s, (16 + 40 * k) * s, (4 + 10 * k) * s, 18);
  D.stroke(ring.concat([ring[0]]), '#effaff', 2, { seed, alpha: (1 - k) * 0.9, abs: true });
}

// vapor que sube (gota evaporándose)
export function steam(D, x, y, s, t, seed, k = 1) {
  if (k <= 0.01) return;
  for (let i = 0; i < 4; i++) {
    const ph = ((t * 0.55 + i / 4) % 1);
    const pts = [];
    for (let q = 0; q < 7; q++) {
      const yy = y - (30 + ph * 90 + q * 11) * s;
      pts.push([x + ((i - 1.5) * 10 + Math.sin(q * 1.1 + t * 2.6 + i) * 7) * s, yy]);
    }
    D.stroke(pts, '#ffffff', 3.2 * Math.min(2, s), { seed: seed + i, alpha: Math.sin(ph * Math.PI) * 0.75 * k, abs: true });
  }
}

// lluvia en capas (paralaje simple): trazos inclinados
export function rain(D, t, k, cam, o = {}) {
  if (k <= 0.01) return;
  const ctx = D.ctx;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineCap = 'round';
  const layers = [[0.5, 180, 'rgba(210,225,240,', 0.35], [1, 160, 'rgba(225,236,248,', 0.5], [1.8, 70, 'rgba(240,246,252,', 0.6]];
  for (const [depth, n0, col, al] of layers) {
    const r = mulberry32(Math.floor(t * 24) * 7 + depth * 100);
    const n = Math.floor(n0 * k);
    for (let i = 0; i < n; i++) {
      const x = r() * (W + 300) - 150, y = r() * (H + 300) - 150;
      const L = (22 + r() * 30) * depth;
      ctx.strokeStyle = col + (al * (0.5 + r() * 0.5)) + ')';
      ctx.lineWidth = (0.9 + r() * 1.2) * depth;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - L * 0.18, y + L); ctx.stroke();
    }
  }
  ctx.restore();
}

// salpicaduras de lluvia sobre una franja de suelo (y0..y1 en pantalla)
export function rainSplashes(D, t, k, y0, y1) {
  if (k <= 0.01) return;
  const ctx = D.ctx;
  const r = mulberry32(Math.floor(t * 24) * 3 + 11);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < 60 * k; i++) {
    const x = r() * W, y = lerp(y0, y1, r());
    const rr = (3 + r() * 9) * (0.4 + (y - y0) / (y1 - y0 + 1));
    ctx.strokeStyle = `rgba(235,245,252,${0.4 + r() * 0.3})`;
    ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.ellipse(x, y, rr * 1.6, rr * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// relámpago: rayo quebrado + destello
export function lightning(D, t, t0, x0 = W * 0.7) {
  const u = t - t0;
  if (u < 0 || u > 0.5) return 0;
  const flash = u < 0.06 ? 1 : u < 0.12 ? 0.3 : u < 0.2 ? 0.8 : Math.max(0, 1 - (u - 0.2) / 0.3) * 0.5;
  const ctx = D.ctx;
  if (u < 0.28) {
    const r = mulberry32(Math.floor(t0 * 100));
    let x = x0, y = -20;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.shadowColor = 'rgba(200,220,255,1)';
    ctx.shadowBlur = 30;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x, y);
    while (y < H * 0.42) { x += (r() - 0.5) * 70; y += 30 + r() * 40; ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.restore();
  }
  return flash;
}
