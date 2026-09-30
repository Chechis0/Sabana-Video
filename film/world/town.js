// El pueblo del valle: casas de tapia con tejas de barro, la iglesia, la escuela y su huerto.
import { ellipsePts, rectPts } from '../core/pencil.js';
import { clamp, lerp, hrand, mulberry32, shade, noise1 } from '../core/math.js';
import { streamZ } from './geo.js';

const WALL = ['#f1e8d6', '#efe2c4', '#f4ecdc', '#e9dcc0'];
const TRIM = ['#3f7f9a', '#2f6a4a', '#9a4a3a', '#3a5a8a', '#c49a3a'];

export function drawHouse(D, P, seed, t, o = {}) {
  const [sx, sy, s] = P;
  const w = o.w ?? 200 + hrand(seed) * 90, h = o.h ?? 120 + hrand(seed, 2) * 30;
  if (sx + w * s < -40 || sx - w * s > D.W + 40) return;
  const px = h * s;
  D.save(); D.translate(sx, sy); D.scale(s);
  const wall = WALL[seed % WALL.length], trim = TRIM[seed % TRIM.length];
  D.shape(ellipsePts(0, 2, w * 0.62, 12, 12), '#3a3a24', { alpha: 0.25, edge: 4, base: false, rim: false, seed });
  // zócalo de color y muros blancos
  const body = D.shape(rectPts(-w / 2, -h, w, h, 3), wall, { seed, knock: true, angle: -1.3, edge: 2.4, jitter: 0.6, baseAlpha: 0.6 });
  D.shadeIn(body, rectPts(-w / 2 - 5, -26, w + 10, 30, 2), trim, { seed: seed + 1, angle: -0.2, smooth: false });
  D.shadeIn(body, rectPts(w * 0.15, -h - 5, w * 0.4, h + 10, 2), shade(wall, -0.18), { seed: seed + 2, alpha: 0.6, smooth: false });
  // puerta y ventanas
  D.shape(rectPts(-w * 0.08, -h * 0.68, w * 0.16, h * 0.68, 2), shade(trim, -0.15), { seed: seed + 3, knock: true, smooth: false, edge: 1.6 });
  if (px > 60) {
    for (const wx of [-w * 0.33, w * 0.25]) {
      D.shape(rectPts(wx - 14, -h * 0.72, 28, 30, 2), '#2f3a44', { seed: seed + 4 + (wx > 0 ? 1 : 0), knock: true, smooth: false, edge: 1.4 });
      D.stroke([[wx - 18, -h * 0.72 + 32], [wx + 18, -h * 0.72 + 32]], trim, 3, { seed: seed + 6 });
      // materas con geranios
      D.shape(rectPts(wx - 15, -h * 0.72 + 34, 30, 8, 2), '#a8583a', { seed: seed + 7, smooth: false, edge: 1 });
      for (let k = 0; k < 3; k++) D.shape(ellipsePts(wx - 9 + k * 9, -h * 0.72 + 32, 4, 3.4, 7), ['#e0453a', '#f06a8a', '#e0453a'][k], { seed: seed + 8 + k, edge: 1 });
    }
  }
  // tejado de teja de barro
  const roof = [[-w / 2 - 22, -h + 4], [w / 2 + 22, -h + 4], [w / 2 - w * 0.12, -h - 58], [-w / 2 + w * 0.12, -h - 58]];
  const rp = D.shape(roof, '#b5563a', { seed: seed + 10, knock: true, smooth: false, angle: -0.3, edge: 2.6 });
  if (px > 50) {
    for (let k = 0; k < 7; k++) {
      const x = lerp(-w / 2 - 10, w / 2 + 10, k / 6);
      D.stroke([[x, -h + 2], [x * 0.78, -h - 56]], '#8a3b28', 1.6, { seed: seed + 20 + k, alpha: 0.55 });
    }
    D.shadeIn(rp, [[-w, -h - 30], [w, -h - 30], [w, -h - 70], [-w, -h - 70]], '#d27a52', { seed: seed + 11, alpha: 0.6, smooth: false });
  }
  D.restore();
}

export function drawChurch(D, P, seed, t) {
  const [sx, sy, s] = P;
  D.save(); D.translate(sx, sy); D.scale(s);
  const wall = '#f4ecdc';
  D.shape(ellipsePts(0, 2, 170, 16, 12), '#3a3a24', { alpha: 0.25, edge: 4, base: false, rim: false, seed });
  D.shape(rectPts(-150, -190, 300, 190, 3), wall, { seed, knock: true, angle: -1.3, baseAlpha: 0.6 });
  D.shape([[-170, -186], [170, -186], [0, -290]], '#b5563a', { seed: seed + 1, knock: true, smooth: false });
  // torre
  D.shape(rectPts(-55, -430, 110, 250, 3), wall, { seed: seed + 2, knock: true, angle: -1.35, baseAlpha: 0.6 });
  D.shape(rectPts(-30, -390, 60, 70, 2), '#3a4250', { seed: seed + 3, knock: true, smooth: false });
  D.shape([[-66, -426], [66, -426], [0, -530]], '#b5563a', { seed: seed + 4, knock: true, smooth: false });
  D.stroke([[0, -530], [0, -575]], '#5a4a3a', 3, { seed: seed + 5 });
  D.stroke([[-14, -558], [14, -558]], '#5a4a3a', 3, { seed: seed + 6 });
  D.shape([[-36, 0], [-36, -110], [0, -140], [36, -110], [36, 0]], '#6a4a32', { seed: seed + 7, knock: true, smooth: false });
  D.restore();
}

// huerto escolar: cama elevada con surcos y una cerquita
export function drawGardenBed(D, P, seed, t, g = 0) {
  const [sx, sy, s] = P;
  D.save(); D.translate(sx, sy); D.scale(s);
  D.shape([[-150, 0], [150, 0], [140, -26], [-140, -26]], '#6e4a30', { seed, knock: true, smooth: false, angle: -0.2 });
  D.shape([[-140, -26], [140, -26], [118, -44], [-118, -44]], mix2(g), { seed: seed + 1, knock: true, smooth: false, angle: 0.3 });
  for (let k = 0; k < 4; k++) D.stroke([[-110 + k * 10, -30 - k * 3.6], [110 - k * 10, -30 - k * 3.6]], '#4a3020', 1.6, { seed: seed + 2 + k, alpha: 0.6 });
  // lechugas y coles
  for (let k = 0; k < 6; k++) {
    const x = -105 + k * 34;
    D.shape(ellipsePts(x, -44, 13, 9, 10, 0, 0.2, k), k % 2 ? '#7fae52' : '#8cc063', { seed: seed + 10 + k, knock: true });
  }
  // cerca de palos
  for (let k = 0; k < 11; k++) D.stroke([[-165 + k * 33, 8], [-165 + k * 33, -36]], '#8a6238', 3.4, { seed: seed + 30 + k });
  D.stroke([[-168, -24], [168, -24]], '#8a6238', 2.4, { seed: seed + 50 });
  D.restore();
}
const mix2 = (g) => (g > 0.5 ? '#5a3e2a' : '#8a6a48');

// cultivos en el valle: franjas de colores sobre el suelo
export function drawField(D, cam, x0, x1, off0, off1, col, seed, y) {
  const pts = [[x0, off0], [x1, off0], [x1, off1], [x0, off1]].map(([x, off]) => {
    const z = streamZ(x) + off;
    const p = cam.project(x, y(x, z), z);
    return p ? [p[0], p[1]] : null;
  });
  if (pts.some((p) => !p)) return;
  D.shape(pts, col, { seed, smooth: false, knock: true, angle: 0.2 + (seed % 3) * 0.3, edge: 2 });
}

export function drawCloud(D, P, size, seed, t, col = '#ffffff', shadowCol = '#c9d3e0', alpha = 1) {
  const [sx, sy, s] = P;
  const R = size * s;
  if (sx < -R * 2 || sx > D.W + R * 2 || sy < -R * 2 || sy > D.H + R * 2) return;
  const r = mulberry32(seed);
  const puffs = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI;
    puffs.push([Math.cos(a) * R * (0.55 + r() * 0.35), -Math.sin(a) * R * (0.35 + r() * 0.3), R * (0.28 + r() * 0.22)]);
  }
  D.save(); D.translate(sx + noise1(t * 0.1 + seed, 3) * R * 0.05, sy);
  D.multi(puffs.map(([x, y, rr]) => ellipsePts(x, y, rr, rr * 0.85, 14, 0, 0.1, seed)).concat([ellipsePts(0, 0, R * 0.95, R * 0.28, 16)]), shadowCol, { seed, knock: false, edge: 4, soft: false, alpha, baseAlpha: 0.7, angle: -0.35 });
  D.multi(puffs.map(([x, y, rr]) => ellipsePts(x - rr * 0.15, y - rr * 0.18, rr * 0.8, rr * 0.68, 12, 0, 0.1, seed + 1)), col, { seed: seed + 1, edge: 3, alpha, baseAlpha: 0.75, angle: -0.35 });
  D.restore();
}
