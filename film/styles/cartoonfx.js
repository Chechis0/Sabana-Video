// Recursos de caricatura: iris de apertura y cierre, líneas de velocidad, estrella de impacto,
// rayo en zigzag con tinta, nubecitas de polvo.
import { W, H } from '../timeline.js';
import { clamp, ease, mulberry32, hrand, lerp } from '../core/math.js';

const INK = '#1c1a2e';

// iris: todo negro salvo un círculo
export function iris(ctx, cx, cy, r) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#0d0b14';
  ctx.beginPath();
  ctx.rect(-10, -10, W + 20, H + 20);
  ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2, true);
  ctx.fill('evenodd');
  // borde de tinta del iris
  if (r > 2) { ctx.strokeStyle = '#2a2640'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}

// líneas de velocidad detrás de algo que se mueve (vx, vy: dirección del movimiento en pantalla)
export function speedLines(ctx, x, y, vx, vy, size, k, seed, col = '#ffffff') {
  if (k <= 0.01) return;
  const L = Math.hypot(vx, vy) || 1;
  const ux = vx / L, uy = vy / L, nx = -uy, ny = ux;
  const r = mulberry32(seed);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const off = (r() - 0.5) * size * 1.6;
    const back = size * (0.4 + r() * 0.5);
    const len = size * (0.9 + r() * 1.4) * k;
    const x0 = x - ux * back + nx * off, y0 = y - uy * back + ny * off;
    const x1 = x0 - ux * len, y1 = y0 - uy * len;
    const w = Math.max(2, size * (0.035 + r() * 0.03));
    ctx.globalAlpha = 0.85 * k;
    ctx.strokeStyle = INK; ctx.lineWidth = w + 4;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  ctx.restore();
}

// estrella de impacto ("¡paf!") detrás de un golpe
export function impactStar(ctx, x, y, r, k, seed = 1, fill = '#ffe45c', fill2 = '#ffffff') {
  if (k <= 0 || k >= 1) return;
  const g = ease.outBack(clamp(k * 3), 2.2) * (1 - ease.inCubic(clamp((k - 0.55) / 0.45)));
  if (g <= 0.02) return;
  const rr = mulberry32(seed);
  const pts = [];
  const n = 9;
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + seed;
    const rad = (i % 2 ? 0.45 : 0.85 + rr() * 0.3) * r * g;
    pts.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad * 0.8]);
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineJoin = 'round';
  const path = () => { ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); };
  path();
  ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.stroke();
  ctx.fillStyle = fill; ctx.fill();
  ctx.save(); ctx.translate(x, y); ctx.scale(0.55, 0.55); ctx.translate(-x, -y); path(); ctx.fillStyle = fill2; ctx.fill(); ctx.restore();
  ctx.restore();
}

// rayo de caricatura: zigzag grueso amarillo con tinta; devuelve el destello
export function cartoonBolt(ctx, t, t0, x0) {
  const u = t - t0;
  if (u < 0 || u > 0.5) return 0;
  const flash = u < 0.06 ? 1 : u < 0.12 ? 0.3 : u < 0.2 ? 0.8 : Math.max(0, 1 - (u - 0.2) / 0.3) * 0.5;
  if (u < 0.3) {
    const r = mulberry32(Math.floor(t0 * 100));
    const pts = [];
    let x = x0, y = -40;
    pts.push([x, y]);
    while (y < H * 0.4) { x += (r() - 0.5) * 140; y += 70 + r() * 60; pts.push([x, y]); }
    // contorno del zigzag (ancho que se afina)
    const left = [], right = [];
    pts.forEach(([px, py], i) => { const w = 34 * (1 - i / pts.length) + 6; left.push([px - w, py - (i % 2 ? 10 : -10)]); right.push([px + w * 0.6, py + (i % 2 ? 10 : -10)]); });
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    left.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    right.reverse().forEach(([px, py]) => ctx.lineTo(px, py));
    ctx.closePath();
    ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.stroke();
    ctx.fillStyle = '#ffe95a'; ctx.fill();
    ctx.shadowColor = 'rgba(255,240,150,0.9)'; ctx.shadowBlur = 40; ctx.fill();
    ctx.restore();
  }
  return flash;
}

// nubecitas de polvo detrás de los pasos (carrera de caricatura)
export function dustPuffs(ctx, x, y, s, t, seed, dir = 1) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < 4; i++) {
    const ph = ((t * 3 + i / 4 + hrand(seed, i)) % 1);
    const px = x - dir * (20 + ph * 90) * s, py = y - ph * 30 * s;
    const r = (10 + ph * 24) * s;
    ctx.globalAlpha = 0.9 * (1 - ph);
    ctx.fillStyle = '#f4ead2';
    ctx.strokeStyle = 'rgba(80,60,40,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
