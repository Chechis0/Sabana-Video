// Elementos del paisaje dibujados a lápiz: frailejones, árboles nativos, tocones, casas...
import { ellipsePts, rectPts } from '../core/pencil.js';
import { hrand, noise1, clamp, ease, lerp, mulberry32, shade } from '../core/math.js';

const PAPERC = '#f2e9d6';

// ------------------------------------------------------------------ frailejón
export function drawFrailejon(D, f, t, o = {}) {
  const h = f.h;
  const th = 92 * h; // tronco
  const rr = 50 * h; // roseta
  if (!D.visible(f.x, f.y - th, th + rr + 30)) return;
  const ps = D.ps;
  const detail = ps * h > 0.5;
  const sway = o.sway ?? 0.03 * noise1(t * 0.6 + f.seed, 3);
  D.save();
  D.translate(f.x, f.y);
  // sombra al pie
  D.shape(ellipsePts(6, 2, 26 * h, 7 * h, 12), '#6f6a3e', { alpha: 0.35, edge: 3, rim: false, seed: f.seed, angle: -0.2, base: false });
  // tronco con hojas secas (marcescentes)
  const tw = 15 * h;
  const trunk = [[-tw * 0.55, 0], [-tw * 0.6, -th * 0.5], [-tw * 0.62, -th], [tw * 0.62, -th], [tw * 0.6, -th * 0.5], [tw * 0.55, 0]];
  const tp = D.shape(trunk, '#8b7a5c', { seed: f.seed, angle: -1.45, knock: true, jitter: 0.8, smooth: false });
  if (detail) {
    // faldón de hojas secas: trazos colgantes
    for (let k = 0; k < 7; k++) {
      const y0 = -th + (k / 7) * th * 0.9;
      const pts = [];
      for (let q = -2; q <= 2; q++) pts.push([q * tw * 0.26, y0 + 10 * h + Math.abs(q) * 2]);
      D.stroke(pts, '#5d4c36', 1.2, { alpha: 0.55, seed: f.seed + k });
    }
  }
  D.translate(0, -th);
  D.rotate(sway);
  // flores (varas con cabezuelas amarillas)
  if (f.flowers) {
    const nst = detail ? 3 : 1;
    for (let k = 0; k < nst; k++) {
      const a = -Math.PI / 2 + (k - (nst - 1) / 2) * 0.42 + 0.1 * noise1(t * 0.8 + k, f.seed);
      const L = (70 + 18 * k) * h;
      const ex = Math.cos(a) * L, ey = Math.sin(a) * L;
      D.stroke([[0, -8], [ex * 0.5 + 4, ey * 0.5], [ex, ey]], '#7d8a55', 2.2, { seed: f.seed + 20 + k });
      if (detail) {
        for (let q = 0; q < 4; q++) {
          const fx = ex + (q - 1.5) * 7 * h, fy = ey + Math.abs(q - 1.5) * 6 * h - 4;
          D.stroke([[ex, ey + 6 * h], [fx, fy]], '#7d8a55', 1.2, { seed: f.seed + 60 + q });
          D.shape(ellipsePts(fx, fy, 4.2 * h, 3.6 * h, 9), '#f2c233', { seed: f.seed + 40 + q + k * 3, edge: 2, angle: -0.6 });
          D.shape(ellipsePts(fx, fy, 1.5 * h, 1.5 * h, 6), '#b8701c', { seed: f.seed + 50 + q, edge: 0 });
        }
      } else {
        D.shape(ellipsePts(ex, ey, 5 * h, 4 * h, 8), '#f2c233', { seed: f.seed + 40 + k, edge: 2 });
      }
    }
  }
  // roseta de hojas afelpadas plateadas
  const nL = detail ? 15 : 7;
  const leaves = [];
  for (let k = 0; k < nL; k++) {
    const u = k / (nL - 1);
    const a = -Math.PI + 0.12 + u * (Math.PI - 0.24) + 0.08 * (hrand(f.seed, k) - 0.5);
    const back = k % 2 === 0;
    leaves.push({ a, back, L: rr * (back ? 1.0 : 0.86) * (0.9 + 0.2 * hrand(f.seed, k, 2)), k });
  }
  // hojas colgantes (abajo) primero
  if (detail) {
    for (let k = 0; k < 4; k++) {
      const a = 0.35 + k * 0.8;
      leaves.unshift({ a: Math.PI / 2 + (k - 1.5) * 0.7, back: true, L: rr * 0.6, k: 30 + k, droop: true });
    }
  }
  leaves.sort((p, q) => (q.back ? 1 : 0) - (p.back ? 1 : 0));
  for (const lf of leaves) {
    const { a, L } = lf;
    const cx = Math.cos(a) * L * 0.5, cy = Math.sin(a) * L * 0.5 * 0.85;
    const col = lf.droop ? '#9c9a70' : lf.back ? '#98a57e' : '#bcc6a0';
    D.shape(ellipsePts(cx, cy, L * 0.52, L * 0.13 + 3, detail ? 12 : 8, a, 0.05, f.seed + lf.k), col, {
      seed: f.seed + lf.k, knock: true, angle: a, edge: 2.4, jitter: 0.7,
    });
    if (detail && !lf.back) {
      D.stroke([[Math.cos(a) * 4, Math.sin(a) * 4], [Math.cos(a) * L * 0.85, Math.sin(a) * L * 0.85 * 0.85]], '#e8ecd8', 1.4, { alpha: 0.7, seed: f.seed + lf.k });
    }
  }
  // corazón de la roseta
  D.shape(ellipsePts(0, -2, 12 * h, 8 * h, 10), '#d9dcc2', { seed: f.seed + 99, knock: true, edge: 2 });
  // hoja protagonista: de su punta cuelga la gota que nace de la niebla
  if (f.tip) {
    const [tx, ty] = f.tip;
    const lx = tx - f.x, ly = ty - (f.y - th);
    const a = Math.atan2(ly, lx), L = Math.hypot(lx, ly);
    const lp = D.shape(ellipsePts(Math.cos(a) * L * 0.5, Math.sin(a) * L * 0.5, L * 0.52, 7 * h, 14, a, 0.03, f.seed + 5), '#c3cca8', { seed: f.seed + 5, knock: true, angle: a, edge: 2.4 });
    D.stroke([[Math.cos(a) * 6, Math.sin(a) * 6], [Math.cos(a) * L * 0.92, Math.sin(a) * L * 0.92]], '#eef1e2', 1.5, { alpha: 0.8, seed: f.seed + 6 });
  }
  D.restore();
}

// ------------------------------------------------------------------ árboles nativos
const TREE_STYLE = {
  roble: { trunk: '#6e4e34', dark: '#3e6a3c', mid: '#55874a', light: '#78a862', crown: [1, 0.95], th: 70, cr: 62, n: 6 },
  aliso: { trunk: '#8a8174', dark: '#4f7d45', mid: '#6d9d55', light: '#8fbd6c', crown: [0.72, 1.3], th: 88, cr: 56, n: 5 },
  siete: { trunk: '#6a4a33', dark: '#46743f', mid: '#5f8f4f', light: '#80ad66', crown: [1.05, 0.85], th: 62, cr: 58, n: 5, flowers: ['#8e5aa8', '#a86cc4', '#7c4a98'] },
  encenillo: { trunk: '#6b4b36', dark: '#41683f', mid: '#5c8549', light: '#7ea45f', crown: [0.95, 1.0], th: 66, cr: 58, n: 5, blush: '#b0583f' },
  cucharo: { trunk: '#5f4632', dark: '#2f5a38', mid: '#437347', light: '#62905a', crown: [0.7, 1.35], th: 74, cr: 52, n: 5 },
};

export function treeHeight(kind, size) {
  const s = TREE_STYLE[kind];
  return (s.th + s.cr * s.crown[1] * 2) * size;
}

// g: 0..1 crecimiento (0 = semilla/plántula, 1 = árbol adulto)
export function drawTree(D, tr, t, g = 1, o = {}) {
  const st = TREE_STYLE[tr.kind] || TREE_STYLE.roble;
  const size = tr.size;
  if (g <= 0.001) return;
  const H = treeHeight(tr.kind, size);
  if (!D.visible(tr.x, tr.y - H * 0.5, H * 0.7 + 30)) return;
  const ps = D.ps;
  D.save();
  D.translate(tr.x, tr.y);
  const wind = (o.wind ?? 0.02) * noise1(t * 0.7 + tr.seed * 0.01, 7);
  if (g < 0.22) {
    drawSapling(D, clamp(g / 0.22), tr.seed, t, o);
    D.restore();
    return;
  }
  const gg = (g - 0.22) / 0.78;
  const k = ease.outBack(clamp(gg), 1.3);
  const th = st.th * size * lerp(0.35, 1, k);
  const cr = st.cr * size * lerp(0.22, 1, k);
  const rx = cr * st.crown[0], ry = cr * st.crown[1];
  // sombra
  D.shape(ellipsePts(8 * size, 3, rx * 0.95, rx * 0.26, 12), '#35502c', { alpha: 0.28, edge: 4, rim: false, base: false, seed: tr.seed, angle: -0.2 });
  // tronco
  const tw = 9 * size * lerp(0.5, 1, k);
  D.shape([[-tw, 0], [-tw * 0.7, -th], [tw * 0.7, -th], [tw, 0]], st.trunk, { seed: tr.seed, smooth: false, angle: -1.5, knock: true, edge: 2.4, jitter: 0.7 });
  if (ps > 0.55) {
    D.stroke([[-tw * 0.2, -th * 0.2], [-tw * 0.1, -th * 0.6], [-tw * 0.3, -th * 0.95]], shade(st.trunk, -0.3), 1.2, { alpha: 0.6, seed: tr.seed });
    D.stroke([[0, -th * 0.55], [tw * 2.2, -th * 0.9]], st.trunk, 3, { seed: tr.seed + 2 });
  }
  // copa
  D.translate(0, -th - ry * 0.75);
  D.rotate(wind);
  const n = ps < 0.3 ? 2 : ps < 0.5 ? 3 : st.n;
  const rnd = mulberry32(tr.seed);
  const blobs = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd();
    const d = i === 0 ? 0 : 0.42;
    blobs.push([Math.cos(a) * rx * d, Math.sin(a) * ry * d * 0.9, (0.62 + rnd() * 0.18) * (i === 0 ? 1.25 : 1)]);
  }
  // masa oscura (sombra) + masa media + luces arriba-izquierda
  const ANG = [-1.05, -0.62, 0.3];
  const ang = ANG[tr.seed % 3];
  const outline = ellipsePts(0, 0, rx, ry, 20, 0, 0.13, tr.seed);
  const crownP = D.shape(outline, st.dark, { seed: tr.seed, knock: true, angle: ang, edge: 3.4, baseAlpha: 0.62 });
  if (n > 2) {
    for (let i = 1; i < Math.min(blobs.length, 4); i++) {
      const [bx, by, bs] = blobs[i];
      D.shadeIn(crownP, ellipsePts(bx * 0.8 - rx * 0.12, by * 0.7 - ry * 0.2, rx * bs * 0.62, ry * bs * 0.55, 14, 0, 0.16, tr.seed + i), st.mid, { seed: tr.seed + i, angle: ANG[(tr.seed + i) % 3], baseAlpha: 0.55, base: true, edge: 2 });
    }
  } else {
    D.shadeIn(crownP, ellipsePts(-rx * 0.12, -ry * 0.16, rx * 0.84, ry * 0.76, 14, 0, 0.12, tr.seed + 1), st.mid, { seed: tr.seed + 1, angle: ang, baseAlpha: 0.55, base: true });
  }
  D.shadeIn(crownP, ellipsePts(-rx * 0.3, -ry * 0.42, rx * 0.42, ry * 0.32, 12, 0.3, 0.18, tr.seed + 7), st.light, { seed: tr.seed + 7, angle: ANG[(tr.seed + 1) % 3], alpha: 0.9, baseAlpha: 0.5, base: true, edge: 2 });
  if (st.blush && ps > 0.3) {
    D.shadeIn(crownP, ellipsePts(rx * 0.3, -ry * 0.2, rx * 0.36, ry * 0.3, 10, 0, 0.2, tr.seed + 8), st.blush, { seed: tr.seed + 8, alpha: 0.75, angle: -0.4 });
  }
  if (st.flowers && k > 0.6) {
    const fl = clamp((k - 0.6) / 0.4);
    const nf = ps < 0.4 ? 5 : 11;
    for (let i = 0; i < nf; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.8;
      const fx = Math.cos(a) * rx * d, fy = Math.sin(a) * ry * d;
      const r = (4.5 + rnd() * 3) * size * fl;
      D.shape(ellipsePts(fx, fy, r, r, 7), st.flowers[i % 3], { seed: tr.seed + 30 + i, edge: 2, rim: false });
    }
  }
  // detalle de hojas: pequeños trazos
  if (ps > 0.7) {
    for (let i = 0; i < 9; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.75;
      const fx = Math.cos(a) * rx * d, fy = Math.sin(a) * ry * d;
      D.stroke([[fx - 5, fy + 3], [fx, fy - 2], [fx + 5, fy + 2]], shade(st.dark, -0.25), 1.3, { alpha: 0.5, seed: tr.seed + 60 + i });
    }
  }
  D.restore();
}

export function drawSapling(D, g, seed, t, o = {}) {
  // plántula: tallito con hojas que se abren
  const hgt = lerp(8, 34, g);
  const sway = 0.08 * Math.sin(t * 2.2 + seed);
  D.shape(ellipsePts(0, 1, 16, 5, 10), '#6b4a30', { seed, edge: 2, alpha: 0.9, angle: -0.2 });
  const top = [Math.sin(sway) * hgt, -hgt];
  D.stroke([[0, 0], [top[0] * 0.4, -hgt * 0.5], top], '#5d8a3a', 2.6, { seed: seed + 1 });
  const nl = g < 0.4 ? 2 : 4;
  for (let i = 0; i < nl; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const yy = i < 2 ? 1 : 0.55;
    const L = lerp(6, 15, g) * (i < 2 ? 1 : 0.8);
    const px = top[0] * yy, py = top[1] * yy;
    const a = side < 0 ? Math.PI + 0.5 : -0.5;
    D.shape(ellipsePts(px + Math.cos(a) * L * 0.55, py + Math.sin(a) * L * 0.55, L * 0.6, L * 0.28, 10, a), i < 2 ? '#7fb24f' : '#6a9f45', { seed: seed + 5 + i, knock: true, edge: 2 });
  }
}

// bolsa de vivero con plántula
export function drawBagSeedling(D, x, y, seed, t, s = 1) {
  D.save();
  D.translate(x, y);
  D.scale(s);
  D.shape([[-13, 0], [-15, -24], [15, -24], [13, 0]], '#2e2a28', { seed, smooth: false, knock: true, angle: -1.3 });
  D.stroke([[-15, -23], [15, -23]], '#55504a', 1.5, { seed });
  D.shape(ellipsePts(0, -24, 14, 4, 10), '#5a3e2a', { seed: seed + 1, edge: 2 });
  D.translate(0, -24);
  drawSapling(D, 0.75, seed, t);
  D.restore();
}

// ------------------------------------------------------------------ tocón
export function drawStump(D, s, t) {
  if (!D.visible(s.x, s.y - 10, 40 * s.s)) return;
  D.save();
  D.translate(s.x, s.y);
  D.scale(s.s);
  D.shape(ellipsePts(4, 2, 24, 6, 10), '#7d6440', { alpha: 0.3, edge: 3, base: false, rim: false, seed: s.seed });
  D.shape([[-15, 0], [-14, -18], [14, -18], [15, 0], [8, 3], [-6, 3]], '#7a5a3c', { seed: s.seed, knock: true, angle: -1.4, smooth: false });
  D.shape(ellipsePts(0, -18, 14.5, 5, 12), '#c9a275', { seed: s.seed + 1, knock: true, angle: -0.3 });
  if (D.ps > 0.6) D.stroke(ellipsePts(0, -18, 7, 2.4, 8).concat([[7, -18]]), '#8a6a45', 1, { seed: s.seed });
  D.restore();
}

// ------------------------------------------------------------------ casas
export function drawHouse(D, h, t) {
  const w = h.w;
  if (!D.visible(h.x, h.y - w * 0.4, w)) return;
  D.save();
  D.translate(h.x, h.y);
  const wh = w * 0.42;
  D.shape(ellipsePts(6, 2, w * 0.6, w * 0.12, 10), '#6c6a44', { alpha: 0.25, edge: 3, base: false, rim: false, seed: h.seed });
  // muro
  D.shape(rectPts(-w / 2, -wh, w, wh, 3), '#efe7d4', { seed: h.seed, knock: true, angle: -1.2, smooth: false, jitter: 0.6 });
  D.shape(rectPts(-w / 2, -wh * 0.28, w, wh * 0.28, 3), '#8d7a62', { seed: h.seed + 1, smooth: false, alpha: 0.55, edge: 1 }); // zócalo
  if (D.ps > 0.35) {
    D.shape(rectPts(-w * 0.12, -wh * 0.72, w * 0.18, wh * 0.72, 1), '#6e4630', { seed: h.seed + 2, smooth: false });
    D.shape(rectPts(w * 0.16, -wh * 0.75, w * 0.18, wh * 0.3, 1), '#6d9cc2', { seed: h.seed + 3, smooth: false });
    D.shape(rectPts(-w * 0.4, -wh * 0.75, w * 0.18, wh * 0.3, 1), '#6d9cc2', { seed: h.seed + 4, smooth: false });
  }
  // techo de teja
  const rh = w * 0.34;
  D.shape([[-w / 2 - 7, -wh + 2], [-w / 2 + 6, -wh - rh], [w / 2 - 6, -wh - rh], [w / 2 + 7, -wh + 2]], h.roof, { seed: h.seed + 5, smooth: false, knock: true, angle: -1.45 });
  if (D.ps > 0.45) {
    for (let i = 1; i < 6; i++) {
      const x = -w / 2 + (i / 6) * w;
      D.stroke([[x - 3, -wh], [x + 1, -wh - rh + 2]], shade(h.roof, -0.3), 1, { alpha: 0.5, seed: h.seed + i });
    }
  }
  D.restore();
}

export function drawChurch(D, c, t) {
  if (!D.visible(c.x, c.y - 120, 200)) return;
  D.save();
  D.translate(c.x, c.y);
  D.shape(ellipsePts(8, 2, 80, 14, 10), '#6c6a44', { alpha: 0.25, edge: 3, base: false, rim: false, seed: 5 });
  D.shape(rectPts(-60, -70, 120, 70, 3), '#f3ecdc', { seed: 11, knock: true, smooth: false, angle: -1.2 });
  D.shape([[-66, -68], [0, -112], [66, -68]], '#c7643f', { seed: 12, knock: true, smooth: false });
  // torre
  D.shape(rectPts(-18, -170, 36, 102, 3), '#f6efe0', { seed: 13, knock: true, smooth: false, angle: -1.3 });
  D.shape([[-22, -168], [0, -206], [22, -168]], '#b8553a', { seed: 14, knock: true, smooth: false });
  D.shape(ellipsePts(0, -142, 8, 11, 10), '#6e4630', { seed: 15 });
  D.stroke([[0, -206], [0, -226]], '#6e4630', 2, { seed: 16 });
  D.stroke([[-6, -219], [6, -219]], '#6e4630', 2, { seed: 17 });
  D.shape([[-12, 0], [-12, -30], [0, -40], [12, -30], [12, 0]], '#6e4630', { seed: 18, smooth: false });
  D.restore();
}

// ------------------------------------------------------------------ matas de pajonal
export function drawTuft(D, x, y, s, seed, col = '#a99a52') {
  if (!D.visible(x, y - 10, 30 * s)) return;
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.32 + (hrand(seed, i) - 0.5) * 0.2;
    const L = (14 + hrand(seed, i, 3) * 12) * s;
    D.stroke([[x + (i - 2) * 2 * s, y], [x + Math.cos(a) * L * 0.5 + (i - 2) * 2 * s, y + Math.sin(a) * L * 0.55], [x + Math.cos(a) * L, y + Math.sin(a) * L]], i % 2 ? col : shade(col, -0.2), 1.6, { seed: seed + i, alpha: 0.8 });
  }
}

export function drawRock(D, x, y, s, seed) {
  if (!D.visible(x, y, 30 * s)) return;
  D.shape(ellipsePts(x, y - 6 * s, 18 * s, 11 * s, 10, 0, 0.18, seed), '#9d998c', { seed, knock: true, angle: -0.8 });
  D.shape(ellipsePts(x - 4 * s, y - 10 * s, 8 * s, 4 * s, 8, 0, 0.2, seed + 1), '#c4c0b2', { seed: seed + 1, edge: 1.5 });
}

// ------------------------------------------------------------------ sotobosque
const FLOWER_COLS = ['#f4f1e6', '#e98fa6', '#f2c233', '#b684d0'];
export function drawUnderstory(D, u, t, g = 1) {
  if (g <= 0.02 || !D.visible(u.x, u.y - 15, 50 * u.s)) return;
  if (D.ps < 0.5) return;
  D.save();
  D.translate(u.x, u.y);
  D.scale(u.s * ease.outBack(clamp(g), 1.5));
  if (u.kind === 'fern') {
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.42;
      const L = 26 + (i % 2) * 6;
      const ex = Math.cos(a) * L, ey = Math.sin(a) * L * 0.8;
      D.stroke([[0, 0], [ex * 0.5, ey * 0.6 - 3], [ex, ey]], '#3f6e3a', 2.2, { seed: u.seed + i });
      for (let q = 1; q < 4; q++) {
        const px = ex * q / 4, py = ey * q / 4 - 2;
        D.stroke([[px - 5, py - 2], [px, py], [px + 5, py - 2]], '#5a8f47', 1.4, { seed: u.seed + i * 5 + q, alpha: 0.8 });
      }
    }
  } else if (u.kind === 'bush') {
    D.shape(ellipsePts(0, -12, 24, 15, 12, 0, 0.18, u.seed), '#467a40', { seed: u.seed, knock: true, angle: -0.62, baseAlpha: 0.6 });
    D.shape(ellipsePts(-6, -17, 12, 7, 10, 0, 0.2, u.seed + 1), '#6e9f55', { seed: u.seed + 1, edge: 2, baseAlpha: 0.5 });
  } else {
    const col = FLOWER_COLS[u.seed % FLOWER_COLS.length];
    for (let i = 0; i < 5; i++) {
      const fx = (hrand(u.seed, i) - 0.5) * 34, fy = -4 - hrand(u.seed, i, 2) * 14;
      D.stroke([[fx, 0], [fx, fy]], '#4f7d3f', 1.3, { seed: u.seed + i });
      D.shape(ellipsePts(fx, fy, 3.6, 3.2, 7), col, { seed: u.seed + 10 + i, edge: 1.5 });
    }
  }
  D.restore();
}
