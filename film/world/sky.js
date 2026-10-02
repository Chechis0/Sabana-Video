// Cielo: degradado a lápiz, sol, luna, estrellas, arcoíris y cordilleras lejanas.
import { Path2D } from '@napi-rs/canvas';
import { W, H } from '../timeline.js';
import { clamp, lerp, mix, noise1, fbm2, mulberry32, hexToRgb, rgba, shade } from '../core/math.js';
import { glow } from '../engine/post.js';
import { PENCIL, PIXEL, PAPER, PX } from '../style.js';
import { drawCloud } from './town.js';

export function drawSky(D, cam, env) {
  const ctx = D.ctx;
  const hy = cam.lensY; // horizonte
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const gr = ctx.createLinearGradient(0, hy - H * 0.95, 0, hy + 40);
  gr.addColorStop(0, env.skyTop);
  gr.addColorStop(0.55, env.skyMid);
  gr.addColorStop(1, env.skyHor);
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  if (!PENCIL) return;
  // trazo de lápiz sobre el degradado (dos pasadas, ángulos distintos)
  const top = new Path2D();
  top.rect(-20, -20, W + 40, Math.max(0, hy + 60));
  D.ctx.globalAlpha = 1;
  D.fill(top, env.skyTop, { soft: true, edge: 0, base: false, alpha: 0.5, angle: -0.35, anchor: [0, 0], seed: 900 });
  // segunda pasada sólo como grano (sin borde duro)
  const mid = new Path2D();
  mid.rect(-20, -20, W + 40, Math.max(0, hy + 60));
  D.fill(mid, env.skyHor, { soft: true, edge: 0, base: false, alpha: 0.18, angle: 0.3, anchor: [0, 0], seed: 901 });
}

// sol con halo; devuelve su posición en pantalla
export function drawSun(D, cam, env) {
  const s = env.sun;
  if (!s || s.k <= 0) return null;
  const [x, y] = cam.dir(s.az, s.el);
  const ctx = D.ctx;
  const r = s.r ?? 46;
  glow(ctx, x, y, r * 16, s.halo || s.col, 0.55 * s.k);
  glow(ctx, x, y, r * 6, s.col, 0.8 * s.k);
  // disco
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = s.k;
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, '#fffdf4');
  gr.addColorStop(0.7, s.disc || '#fff3c4');
  gr.addColorStop(1, rgba(s.disc || '#fff3c4', 0));
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.arc(x, y, r * 1.05, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  return [x, y];
}

export function drawMoon(D, cam, env) {
  const m = env.moon;
  if (!m || m.k <= 0.01) return;
  const [x, y] = cam.dir(m.az, m.el);
  const ctx = D.ctx;
  glow(ctx, x, y, 220, '#9fb8e8', 0.35 * m.k);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = m.k;
  ctx.fillStyle = '#f4f1e2';
  ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = m.k * 0.25;
  ctx.fillStyle = '#b9b6a4';
  ctx.beginPath(); ctx.arc(x - 8, y - 6, 7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 9, y + 8, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

const STARS = (() => {
  const r = mulberry32(4242);
  return Array.from({ length: 260 }, () => ({ x: r(), y: r(), s: 0.6 + r() * r() * 2.6, ph: r() * 6.28 }));
})();
export function drawStars(D, cam, env, t) {
  const k = env.stars || 0;
  if (k <= 0.01) return;
  const ctx = D.ctx;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const st of STARS) {
    const x = st.x * W, y = st.y * (cam.lensY - 60);
    const tw = 0.6 + 0.4 * Math.sin(t * 7 + st.ph * 3);
    if (PAPER && st.s > 1.7) {
      // estrellitas de cartulina con su sombra
      const R = 4 + st.s * 3.2;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(st.ph);
      ctx.globalAlpha = k;
      ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 4; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 4;
      ctx.beginPath();
      for (let q = 0; q < 10; q++) { const a = (q / 10) * Math.PI * 2 - Math.PI / 2, rr = q % 2 ? R * 0.45 : R; q ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath();
      ctx.fillStyle = tw > 0.8 ? '#fff6c4' : '#f4e7a8';
      ctx.fill();
      ctx.restore();
      continue;
    }
    if (PIXEL) {
      // estrellas de un píxel; las grandes, una crucecita que titila
      const px = Math.floor(x / PX) * PX, py = Math.floor(y / PX) * PX;
      ctx.globalAlpha = Math.min(1, k * tw * (0.45 + st.s / 3));
      ctx.fillStyle = '#fffbe8';
      ctx.fillRect(px, py, PX, PX);
      if (st.s > 2.2 && tw > 0.75) { ctx.globalAlpha *= 0.6; ctx.fillRect(px - PX, py, PX * 3, PX); ctx.fillRect(px, py - PX, PX, PX * 3); }
      continue;
    }
    ctx.globalAlpha = k * tw * (0.5 + st.s / 5);
    ctx.fillStyle = '#fffbe8';
    ctx.beginPath(); ctx.arc(x, y, st.s, 0, Math.PI * 2); ctx.fill();
    if (st.s > 2.2) glow(ctx, x, y, st.s * 6, '#fff6d8', k * 0.3 * tw);
  }
  ctx.restore();
}

// arcoíris: arco centrado en el punto antisolar (debajo del horizonte)
export function drawRainbow(D, cam, env) {
  const k = env.rainbow || 0;
  if (k <= 0.01) return;
  const ctx = D.ctx;
  const cx = env.rainbowX ?? W * 0.55, cy = cam.lensY + (env.rainbowDrop ?? 260);
  const R = env.rainbowR ?? 820;
  const cols = ['#e2534a', '#ef9a3c', '#f2d45a', '#7cc16a', '#5aa6d6', '#6f6cc8', '#a26ac0'];
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'screen';
  const bw = 16;
  cols.forEach((c, i) => {
    ctx.globalAlpha = k * 0.42;
    ctx.strokeStyle = c;
    ctx.lineWidth = bw;
    ctx.filter = 'blur(5px)';
    ctx.beginPath();
    ctx.arc(cx, cy, R - i * bw * 0.9, Math.PI * 1.02, Math.PI * 1.98);
    ctx.stroke();
  });
  ctx.filter = 'none';
  // arco secundario, muy tenue
  cols.slice().reverse().forEach((c, i) => {
    ctx.globalAlpha = k * 0.1;
    ctx.strokeStyle = c;
    ctx.lineWidth = bw;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.28 - i * bw * 0.9, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
  });
  ctx.restore();
}

// cordilleras lejanas: siluetas a gran distancia (casi sin paralaje)
const RANGES = [
  { Z: 42000, base: -1500, amp: 9000, freq: 1 / 7000, seed: 71, col: '#8fa0c0' },
  { Z: 26000, base: -1500, amp: 6200, freq: 1 / 4800, seed: 72, col: '#7f93a8' },
  { Z: 14000, base: -1600, amp: 3600, freq: 1 / 3000, seed: 73, col: '#6f8a86' },
];
export function addRanges(stage, cam, env) {
  for (const R of RANGES) {
    const d = R.Z - cam.z;
    if (d < 100) continue;
    stage.add(d, (D) => {
      const [x0, x1] = cam.xRange(d, 60);
      const pts = [];
      const n = 70;
      for (let i = 0; i <= n; i++) {
        const x = lerp(x0, x1, i / n);
        const v = Math.abs(fbm2(x * R.freq, 0.5, R.seed, 4));
        const y = R.base + R.amp * (0.25 + v * 1.2);
        const p = cam.project(x, y, R.Z);
        pts.push([p[0], p[1]]);
      }
      const pb = cam.project(x1, -1e5, R.Z), pa = cam.project(x0, -1e5, R.Z);
      pts.push([pts[pts.length - 1][0], H + 50], [pts[0][0], H + 50]);
      D.save();
      D.shape(pts, env.rangeTint ? mix(R.col, env.rangeTint, 0.5) : R.col, { seed: R.seed, smooth: false, edge: 3, angle: -0.5, jitter: 0.6, still: true });
      D.restore();
    }, { haze: 0.8 });
  }
}

// nubes de día en el cielo (versiones nuevas): a direcciones fijas, como el sol; se apartan del sol
// y desaparecen de noche y en la tormenta
const SKY_CLOUDS = [[-0.95, 0.44, 300, 11], [-0.38, 0.6, 230, 12], [0.22, 0.4, 330, 13], [0.68, 0.53, 250, 14], [1.08, 0.34, 300, 15], [-1.32, 0.3, 270, 16], [0.02, 0.75, 210, 17]];
export function drawSkyClouds(D, cam, env, t, sun) {
  const day = clamp((env.sun?.k ?? 0) * 1.2) * (1 - clamp((env.clouds || 0) * 2)) * (1 - clamp((env.stars || 0) * 2)) * (1 - clamp((env.rain || 0) * 3));
  if (day <= 0.02) return;
  const warm = env.skyHor || '#ffffff';
  for (const [az, el, size, seed] of SKY_CLOUDS) {
    const [x, y] = cam.dir(az + t * 0.006, el);
    if (y > cam.lensY - size * 0.2) continue;
    if (sun && Math.hypot(x - sun[0], y - sun[1]) < size * 1.1) continue;
    const col = mix('#ffffff', warm, 0.25), sh = mix('#d6e2ee', env.skyMid || '#d6e2ee', 0.35);
    drawCloud(D, [x, y, 1], size, 900 + seed, t, col, sh, 0.95 * day);
  }
}
