// Flora andina vista de lado, a lápiz de color: árboles nativos del bosque de niebla
// (roble, encenillo, aliso, yarumo, sietecueros), helechos arborescentes, frailejones,
// pajonal, helechos, bromelias, tocones y plántulas que crecen.
import { ellipsePts, rectPts } from '../core/pencil.js';
import { clamp, lerp, ease, noise1, hrand, mulberry32, shade, mix } from '../core/math.js';

// ------------------------------------------------------------------ sombra proyectada
// con luz baja la sombra se alarga en dirección contraria al sol (D.shadowK, D.shadowDir)
export function castShadow(D, rx, ry, seed, alpha = 0.3, col = '#26301c', y = 0) {
  const k = D.shadowK || 0, dir = D.shadowDir || 1;
  const sx = Math.sign(D.M[0]) || 1;
  const len = rx * 2.6 * k;
  D.shape(ellipsePts(dir * sx * len * 0.5, y, rx + len * 0.5, ry * (1 + 0.25 * k), 16), col, { alpha: alpha * (1 + 0.25 * k), edge: 4, base: false, rim: false, seed });
}

// ------------------------------------------------------------------ utilidades de forma
// borde festoneado (como copa de árbol dibujada): lóbulos redondos hacia afuera
export function clumpPts(cx, cy, rx, ry, seed, lobes = 7, n = 30, bump = 0.13) {
  const pts = [];
  const ph = hrand(seed, 1) * 6.28;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + bump * (Math.pow(Math.abs(Math.sin(a * lobes / 2 + ph)), 0.55) - 0.6) + 0.06 * noise1(i * 0.9 + seed * 3.1, seed);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}

const TREES = {
  roble: { H: 1250, trunk: 0.42, crownW: 0.78, clumps: 10, bark: '#5d4430', dark: '#2c4a2c', mid: '#3f6b38', light: '#62934c', hi: '#94be66', shape: 'round' },
  encenillo: { H: 980, trunk: 0.38, crownW: 0.66, clumps: 9, bark: '#5b4332', dark: '#2a4630', mid: '#3d6340', light: '#5e8a4f', hi: '#8db36a', blush: '#b0503c', shape: 'round' },
  aliso: { H: 1150, trunk: 0.36, crownW: 0.52, clumps: 9, bark: '#a59d8e', dark: '#3a5f36', mid: '#548446', light: '#7aa85a', hi: '#a6cc78', shape: 'cone' },
  siete: { H: 720, trunk: 0.36, crownW: 0.8, clumps: 7, bark: '#5f4633', dark: '#35553a', mid: '#4b7545', light: '#6d9a58', hi: '#99c070', flowers: ['#8e4fb0', '#a764c9', '#7640a0'], shape: 'round' },
  cucharo: { H: 900, trunk: 0.4, crownW: 0.55, clumps: 8, bark: '#574030', dark: '#244634', mid: '#355f42', light: '#548452', hi: '#83ad6a', shape: 'cone' },
};

const cache = new Map();
function genTree(kind, seed) {
  const key = kind + '|' + seed;
  if (cache.has(key)) return cache.get(key);
  const st = TREES[kind];
  const r = mulberry32(seed);
  const Hh = st.H * (0.85 + r() * 0.3);
  const th = Hh * st.trunk * (0.9 + r() * 0.2);
  const cw = Hh * st.crownW * (0.85 + r() * 0.3);
  const lean = (r() - 0.5) * 0.12;
  const trunk = [];
  for (let i = 0; i <= 6; i++) {
    const u = i / 6;
    trunk.push([Math.sin(u * 2.2 + seed) * cw * 0.03 + lean * u * th, -u * th]);
  }
  const top = trunk[trunk.length - 1];
  const crownH = Hh - th;
  const clumps = [];
  const branches = [];
  const N = st.clumps;
  for (let i = 0; i < N; i++) {
    let cx, cy, rr;
    if (st.shape === 'cone') {
      const u = i / (N - 1);
      cy = top[1] - crownH * (0.08 + 0.78 * u) + (r() - 0.5) * 30;
      const wid = cw * 0.5 * (1 - u * 0.75);
      cx = top[0] + (r() * 2 - 1) * wid * 0.7;
      rr = cw * (0.2 + 0.1 * (1 - u)) * (0.8 + r() * 0.4);
    } else {
      const a = -Math.PI / 2 + (r() * 2 - 1) * 1.35;
      const dd = i === 0 ? 0 : 0.35 + r() * 0.5;
      cx = top[0] + Math.cos(a) * cw * 0.5 * dd;
      cy = top[1] - crownH * 0.48 + Math.sin(a) * crownH * 0.45 * dd;
      rr = cw * (i === 0 ? 0.34 : 0.2 + r() * 0.12);
    }
    const layer = i === 0 ? 1 : r() < 0.35 ? 0 : r() < 0.6 ? 1 : 2;
    clumps.push({ x: cx, y: cy, rx: rr * (1 + r() * 0.25), ry: rr * (0.72 + r() * 0.2), layer, seed: seed + i * 17 });
    // rama desde el tronco hacia la mata
    if (i > 0 && r() < 0.8) {
      const bx = top[0] + (r() - 0.5) * 20, by = top[1] + r() * th * 0.25;
      branches.push({ pts: [[bx, by], [lerp(bx, cx, 0.5) + (r() - 0.5) * 40, lerp(by, cy, 0.55)], [cx * 0.9 + top[0] * 0.1, cy + rr * 0.3]], w: 10 + r() * 8 });
    }
  }
  clumps.sort((a, b) => a.layer - b.layer || b.y - a.y);
  const g = { Hh, th, cw, trunk, clumps, branches, st, lean };
  cache.set(key, g);
  return g;
}

export function treeHeight(kind, seed) { return genTree(kind, seed).Hh; }

// tr: {x, z, kind, seed}; P = [sx, sy, s]; g crecimiento 0..1; light: -1 (sol a la izq) .. 1
export function drawTree(D, tr, P, t, o = {}) {
  const g = o.g ?? 1;
  if (g <= 0.001) return;
  if (tr.kind === 'yarumo') return drawYarumo(D, tr, P, t, o);
  if (tr.kind === 'helecho') return drawTreeFern(D, tr, P, t, o);
  const G = genTree(tr.kind, tr.seed);
  const st = G.st;
  const [sx, sy, s] = P;
  const px = G.Hh * s; // altura en pantalla
  if (sx < -G.cw * s - 50 || sx > D.W + G.cw * s + 50 || sy < -30 || sy - px > D.H + 50) return;
  const L = o.light ?? -1;
  D.save();
  D.translate(sx, sy);
  D.scale(s);
  if (g < 0.2) { drawSapling(D, g / 0.2, tr.seed, t); D.restore(); return; }
  const gg = ease.outCubic((g - 0.2) / 0.8);
  D.scale(lerp(0.12, 1, gg));
  const sway = (o.wind ?? 1) * 0.012 * noise1(t * 0.6 + tr.seed * 0.013, 7);
  const detail = px > 620 ? 2 : px > 200 ? 1 : 0;
  // sombra de contacto
  castShadow(D, G.cw * 0.42, G.cw * 0.07, tr.seed, 0.28, '#2a3a20');
  // tronco
  const tw = G.Hh * 0.028 + 10;
  const left = [], right = [];
  G.trunk.forEach(([x, y], i) => {
    const u = i / (G.trunk.length - 1);
    const w = tw * (1 - u * 0.45) * (i === 0 ? 1.35 : 1);
    left.push([x - w, y]); right.push([x + w, y]);
  });
  const trunkPts = left.concat(right.reverse());
  const tp = D.shape(trunkPts, st.bark, { seed: tr.seed, angle: -1.45, knock: true, edge: 2.6, jitter: 0.6 });
  if (detail === 2) {
    // lado en sombra del tronco
    const sh = G.trunk.map(([x, y], i) => [x + (L < 0 ? 1 : -1) * tw * 0.35, y]);
    const shp = sh.map(([x, y]) => [x + (L < 0 ? tw : -tw), y]);
    D.shadeIn(tp, sh.concat(shp.reverse()), shade(st.bark, -0.35), { seed: tr.seed + 1, angle: -1.3, alpha: 0.8 });
    {
      for (let k = 0; k < 6; k++) {
        const y0 = -G.th * (0.1 + k * 0.14);
        D.stroke([[-tw * 0.4, y0], [-tw * 0.1, y0 - 30], [tw * 0.2, y0 - 55]], shade(st.bark, -0.4), 1.4, { seed: tr.seed + 40 + k, alpha: 0.55 });
      }
      // musgo en el tronco (bosque de niebla)
      if (o.moss) {
        D.shadeIn(tp, ellipsePts(-tw * 0.4, -G.th * 0.35, tw * 0.9, G.th * 0.2, 10, 0, 0.3, tr.seed), '#6d8f3c', { seed: tr.seed + 5, alpha: 0.9, angle: -0.6 });
      }
    }
  }
  // copa (se mueve con el viento)
  const top = G.trunk[G.trunk.length - 1];
  D.translate(top[0], top[1]);
  D.rotate(sway);
  D.translate(-top[0], -top[1]);
  const drawClump = (c, tone) => {
    const lobes = detail === 2 ? 9 : 7;
    const pts = clumpPts(c.x, c.y, c.rx, c.ry, c.seed, lobes, detail ? 30 : 16, detail ? 0.14 : 0.1);
    const base = tone === 0 ? st.dark : st.mid;
    const cp = D.shape(pts, base, { seed: c.seed, knock: true, angle: [-1.05, -0.62, 0.3][c.seed % 3], edge: 3.2, baseAlpha: 0.6, jitter: 0.8 });
    if (detail === 1) {
      D.shape(clumpPts(c.x + L * c.rx * 0.25, c.y - c.ry * 0.3, c.rx * 0.58, c.ry * 0.46, c.seed + 2, 5, 16, 0.16), tone === 0 ? st.mid : st.light, { seed: c.seed + 2, edge: 0, base: false, alpha: 0.9, angle: -1.05 });
      const fr = Math.min(c.rx * 0.12, 11 / Math.max(0.01, D.ps));
      if (st.flowers && tone > 0) D.multi([0, 1, 2, 3].map((k) => ellipsePts(c.x + (k - 1.5) * c.rx * 0.34, c.y - c.ry * 0.1 + (k % 2) * c.ry * 0.3, fr, fr, 7)), st.flowers[c.seed % 3], { seed: c.seed + 60, edge: 1, base: false });
    }
    if (detail === 2) {
      // sombra abajo y del lado contrario al sol
      D.shadeIn(cp, ellipsePts(c.x - L * c.rx * 0.35, c.y + c.ry * 0.45, c.rx * 0.95, c.ry * 0.6, 14, 0, 0.15, c.seed + 1), st.dark, { seed: c.seed + 1, alpha: 0.85, angle: -0.62 });
      // luz del lado del sol
      D.shadeIn(cp, clumpPts(c.x + L * c.rx * 0.3, c.y - c.ry * 0.38, c.rx * 0.55, c.ry * 0.42, c.seed + 2, 5, 18, 0.18), tone === 0 ? st.mid : st.light, { seed: c.seed + 2, alpha: 0.95, angle: [-1.05, 0.3][c.seed % 2], baseAlpha: 0.5, base: true, edge: 2 });
      if (detail === 2 && tone > 0) {
        D.shadeIn(cp, clumpPts(c.x + L * c.rx * 0.42, c.y - c.ry * 0.55, c.rx * 0.28, c.ry * 0.2, c.seed + 3, 4, 14, 0.2), st.hi, { seed: c.seed + 3, alpha: 0.9, angle: -1.05, baseAlpha: 0.5, base: true, edge: 1.5 });
        // hojitas del borde
        const rr = mulberry32(c.seed);
        for (let k = 0; k < 7; k++) {
          const a = -Math.PI / 2 + L * 0.5 + (rr() - 0.5) * 2.2;
          const fx = c.x + Math.cos(a) * c.rx * 0.8, fy = c.y + Math.sin(a) * c.ry * 0.78;
          D.stroke([[fx - 7, fy + 3], [fx, fy - 4], [fx + 7, fy + 2]], shade(st.dark, -0.3), 1.4, { seed: c.seed + 50 + k, alpha: 0.5 });
        }
      }
      if (st.blush && tone > 0) D.shadeIn(cp, ellipsePts(c.x + c.rx * 0.2, c.y - c.ry * 0.1, c.rx * 0.3, c.ry * 0.25, 10, 0, 0.3, c.seed + 4), st.blush, { seed: c.seed + 4, alpha: 0.55, angle: -0.4 });
      if (st.flowers && tone > 0) {
        const rr = mulberry32(c.seed + 9);
        for (let k = 0; k < (detail === 2 ? 9 : 4); k++) {
          const a = rr() * 6.28, dd = Math.sqrt(rr()) * 0.75;
          const fr = Math.min(c.rx * (0.07 + rr() * 0.04), 12 / Math.max(0.01, D.ps));
          D.shape(ellipsePts(c.x + Math.cos(a) * c.rx * dd, c.y + Math.sin(a) * c.ry * dd, fr, fr, 7), st.flowers[k % 3], { seed: c.seed + 60 + k, edge: 1.5, rim: false });
        }
      }
    }
  };
  if (detail === 0) {
    // lejos: toda la copa en una sola forma + luces del lado del sol
    const ang = [-1.05, -0.62, 0.3][tr.seed % 3];
    D.multi(G.clumps.map((c) => clumpPts(c.x, c.y, c.rx, c.ry, c.seed, 6, 14, 0.1)), st.mid, { seed: tr.seed, knock: true, angle: ang, edge: 2.5, jitter: 0.6, baseAlpha: 0.55 });
    D.multi(G.clumps.filter((c) => c.layer > 0).map((c) => clumpPts(c.x + L * c.rx * 0.25, c.y - c.ry * 0.3, c.rx * 0.55, c.ry * 0.45, c.seed + 2, 5, 10, 0.15)), st.light, { seed: tr.seed + 3, edge: 0, base: false, alpha: 0.85, angle: -1.05 });
    if (st.flowers) D.multi(G.clumps.filter((c) => c.layer > 0).map((c) => ellipsePts(c.x, c.y - c.ry * 0.2, c.rx * 0.35, c.ry * 0.25, 8)), st.flowers[0], { seed: tr.seed + 4, edge: 0, base: false, alpha: 0.6 });
    D.restore();
    return;
  }
  // matas de atrás
  for (const c of G.clumps) if (c.layer === 0) drawClump(c, 0);
  // ramas
  if (detail >= 1) for (const b of G.branches) D.stroke(b.pts, st.bark, b.w * 0.8, { seed: tr.seed + b.w, alpha: 0.95 });
  for (const c of G.clumps) if (c.layer > 0) drawClump(c, 1);
  // epífitas: barba de viejo colgando y bromelias
  if (o.moss && detail === 2) {
    // barba de viejo: mechones cortos, ondulados, gris verdoso
    const rr = mulberry32(tr.seed + 77);
    for (let k = 0; k < 4; k++) {
      const c = G.clumps[Math.floor(rr() * G.clumps.length)];
      const hx = c.x + (rr() - 0.5) * c.rx, hy = c.y + c.ry * 0.62;
      const len = 30 + rr() * 45;
      const sw = 5 * noise1(t * 0.9 + k, tr.seed);
      const pts = [];
      for (let q = 0; q <= 5; q++) pts.push([hx + Math.sin(q * 1.7 + k) * 5 + sw * q / 5, hy + (q / 5) * len]);
      D.stroke(pts, '#8e9a7c', 4, { seed: tr.seed + 80 + k, alpha: 0.85 });
      D.stroke(pts.map(([x, y]) => [x + 3, y - 2]), '#b7c0a2', 2, { seed: tr.seed + 90 + k, alpha: 0.6 });
    }
    if (detail === 2) {
      const b = G.branches[0];
      if (b) drawBromeliad(D, b.pts[1][0], b.pts[1][1] - 6, 0.9, tr.seed + 5, t);
    }
  }
  D.restore();
}

// yarumo: tronco blanco y delgado, ramas en candelabro, hojas palmeadas plateadas
function drawYarumo(D, tr, P, t, o) {
  const [sx, sy, s] = P;
  const r = mulberry32(tr.seed);
  const Hh = 1450 * (0.85 + r() * 0.3);
  if (sx < -600 * s || sx > D.W + 600 * s) return;
  const g = o.g ?? 1;
  D.save();
  D.translate(sx, sy);
  D.scale(s * lerp(0.15, 1, ease.outCubic(clamp(g))));
  const sway = 0.02 * noise1(t * 0.5 + tr.seed * 0.01, 5);
  const px = Hh * s;
  D.shape(ellipsePts(0, 0, 90, 14, 10), '#2a3a20', { alpha: 0.25, edge: 4, base: false, rim: false, seed: tr.seed });
  const tw = 16;
  const trunk = [[-tw, 0], [-tw * 0.7, -Hh * 0.7], [tw * 0.7, -Hh * 0.7], [tw, 0]];
  D.shape(trunk, '#cfc9ba', { seed: tr.seed, angle: -1.5, knock: true, smooth: false, edge: 2 });
  if (px > 150) for (let k = 1; k < 9; k++) D.stroke([[-tw * 0.8, -k * Hh * 0.08], [tw * 0.8, -k * Hh * 0.08 - 4]], '#8f897a', 1.4, { seed: tr.seed + k, alpha: 0.6 });
  D.rotate(sway);
  const arms = 3 + Math.floor(r() * 2);
  for (let i = 0; i < arms; i++) {
    const a = -Math.PI / 2 + (i - (arms - 1) / 2) * 0.55 + (r() - 0.5) * 0.2;
    const L = Hh * (0.18 + r() * 0.12);
    const bx = 0, by = -Hh * 0.68;
    const ex = bx + Math.cos(a) * L, ey = by + Math.sin(a) * L;
    D.stroke([[bx, by], [lerp(bx, ex, 0.5) + Math.cos(a) * 10, lerp(by, ey, 0.4)], [ex, ey]], '#c5beae', 9, { seed: tr.seed + 10 + i });
    // corona de hojas palmeadas (colgantes)
    const nl = px > 200 ? 6 : 3;
    for (let k = 0; k < nl; k++) {
      const la = Math.PI / 2 + (k - (nl - 1) / 2) * 0.55 + (r() - 0.5) * 0.2;
      const lx = ex + Math.cos(la - Math.PI) * 10, ly = ey;
      const LL = 150 + r() * 60;
      const cx = lx + Math.cos(la) * LL * 0.5 * (k % 2 ? 1 : -1) * 0.6, cy = ly - 20 + Math.abs(Math.cos(la)) * 30 + LL * 0.25;
      const under = k % 2 === 0;
      D.shape(palmLeaf(cx, cy, LL * 0.5, la + (under ? 0.3 : -0.3), tr.seed + k), under ? '#b9c7b4' : '#6f8d63', { seed: tr.seed + 30 + k + i * 7, knock: true, edge: 2.5, angle: -0.8 });
    }
    D.shape(clumpPts(ex, ey - 20, 60, 34, tr.seed + i, 5, 16, 0.2), '#7d9a6c', { seed: tr.seed + 50 + i, knock: true, edge: 2.5 });
  }
  D.restore();
}
function palmLeaf(cx, cy, R, rot, seed) {
  const pts = [];
  const lobes = 7;
  for (let i = 0; i < lobes * 4; i++) {
    const a = (i / (lobes * 4)) * Math.PI * 2;
    const lobe = Math.pow(Math.abs(Math.cos(a * lobes / 2)), 2);
    const rr = R * (0.35 + 0.65 * lobe);
    pts.push([cx + Math.cos(a + rot) * rr, cy + Math.sin(a + rot) * rr * 0.45]);
  }
  return pts;
}

// helecho arborescente: tronco fibroso y penacho de frondas arqueadas
function drawTreeFern(D, tr, P, t, o) {
  const [sx, sy, s] = P;
  const r = mulberry32(tr.seed);
  const Hh = 520 * (0.8 + r() * 0.4);
  if (sx < -400 * s || sx > D.W + 400 * s) return;
  D.save();
  D.translate(sx, sy);
  D.scale(s);
  const px = Hh * s;
  D.shape(ellipsePts(0, 0, 50, 9, 10), '#2a3a20', { alpha: 0.25, edge: 4, base: false, rim: false, seed: tr.seed });
  const tw = 13;
  D.shape([[-tw, 0], [-tw * 0.85, -Hh], [tw * 0.85, -Hh], [tw, 0]], '#4a3a2a', { seed: tr.seed, angle: -1.45, knock: true, smooth: false, edge: 2.5 });
  if (px > 120) for (let k = 0; k < 10; k++) D.stroke([[-tw, -k * Hh * 0.1], [0, -k * Hh * 0.1 - 6], [tw, -k * Hh * 0.1]], '#2e241a', 1.6, { seed: tr.seed + k, alpha: 0.6 });
  const nf = px > 150 ? 11 : 6;
  for (let i = 0; i < nf; i++) {
    const side = i % 2 ? 1 : -1;
    const a0 = -Math.PI / 2 + side * (0.2 + (i / nf) * 1.2) + 0.05 * noise1(t * 0.8 + i, tr.seed);
    const L = 230 + r() * 90;
    const pts = [];
    for (let q = 0; q <= 8; q++) {
      const u = q / 8;
      const a = a0 + side * u * u * 1.6;
      const px0 = pts.length ? pts[pts.length - 1][0] : 0, py0 = pts.length ? pts[pts.length - 1][1] : -Hh;
      pts.push([px0 + Math.cos(a) * L / 8, py0 + Math.sin(a) * L / 8]);
    }
    const back = i < nf / 2;
    const col = back ? '#3f6a3a' : '#5f9148';
    D.stroke(pts, shade(col, -0.3), 3, { seed: tr.seed + 20 + i });
    // pinnas
    if (px > 100) {
      for (let q = 1; q < pts.length - 1; q++) {
        const [x0, y0] = pts[q], [x1, y1] = pts[q + 1];
        const dx = x1 - x0, dy = y1 - y0, dl = Math.hypot(dx, dy) || 1;
        const nx = -dy / dl, ny = dx / dl;
        const pl = 38 * (1 - q / pts.length) + 8;
        D.shape([[x0, y0], [x0 + nx * pl + dx * 0.3, y0 + ny * pl + dy * 0.3], [x1, y1], [x0 - nx * pl + dx * 0.3, y0 - ny * pl + dy * 0.3]], col, { seed: tr.seed + 40 + i * 9 + q, edge: 1.6, alpha: 0.95, knock: !back, jitter: 0.6 });
      }
    }
  }
  D.restore();
}

// ------------------------------------------------------------------ plántula
export function drawSapling(D, g, seed, t, o = {}) {
  const hgt = lerp(10, 70, g);
  const sway = 0.07 * Math.sin(t * 2.2 + seed);
  if (!o.noSoil) D.shape(ellipsePts(0, 1, 22, 6, 10), '#5a3e28', { seed, edge: 2, alpha: 0.9, angle: -0.2 });
  D.save();
  if (o.scale) D.scale(o.scale);
  D.rotate(sway);
  D.stroke([[0, 0], [1, -hgt * 0.5], [0, -hgt]], '#5d7a34', 3, { seed: seed + 1 });
  const nl = 2 + Math.floor(g * 5);
  for (let i = 0; i < nl; i++) {
    const side = i % 2 ? 1 : -1;
    const y = -hgt * (0.35 + 0.65 * (i / Math.max(1, nl - 1)));
    const L = 16 + 8 * g;
    D.shape(ellipsePts(side * L * 0.55, y - 3, L * 0.55, L * 0.24, 10, side * -0.4), i % 2 ? '#79b04c' : '#6aa243', { seed: seed + 5 + i, edge: 1.5, knock: true });
  }
  D.restore();
}

// ------------------------------------------------------------------ frailejón (Espeletia) de lado
// f: {h (escala), seed, flowers}. En primer plano se dibujan los pelitos plateados de las hojas.
export function drawFrailejon(D, f, P, t, o = {}) {
  const [sx, sy, s] = P;
  const h = f.h || 1;
  const th = 150 * h, rr = 70 * h;
  const px = (th + rr * 1.3) * s;
  if (sx < -rr * 2 * s - 40 || sx > D.W + rr * 2 * s + 40 || sy < -20 || sy - px > D.H + 40) return;
  const detail = px > 700 ? 3 : px > 260 ? 2 : px > 70 ? 1 : 0;
  const L = o.light ?? -1;
  const back = o.backlight ?? 0; // contraluz: bordes que brillan
  D.save();
  D.translate(sx, sy);
  D.scale(s);
  D.shape(ellipsePts(8, 0, 34 * h, 7 * h, 10), '#4f4a2a', { alpha: 0.3, edge: 3, base: false, rim: false, seed: f.seed });
  // tronco cubierto de hojas secas
  const tw = 17 * h;
  const tp = D.shape([[-tw * 0.9, 0], [-tw, -th * 0.5], [-tw * 1.05, -th], [tw * 1.05, -th], [tw, -th * 0.5], [tw * 0.9, 0]], '#7d6a4c', { seed: f.seed, angle: -1.45, knock: true, jitter: 0.8, smooth: false });
  if (detail >= 1) {
    D.shadeIn(tp, [[-L * tw * 0.1, 0], [-L * tw * 0.1, -th], [-L * tw * 1.2, -th], [-L * tw * 1.2, 0]], '#4d3e2c', { seed: f.seed + 1, angle: -1.4, alpha: 0.8, smooth: false });
    const nsk = detail >= 2 ? 11 : 5;
    for (let k = 0; k < nsk; k++) {
      const y0 = -th + (k / nsk) * th * 0.95;
      D.stroke([[-tw, y0], [-tw * 0.3, y0 + 12 * h], [tw * 0.4, y0 + 9 * h], [tw, y0 + 14 * h]], k % 2 ? '#5b4a34' : '#9a8663', 1.6, { alpha: 0.7, seed: f.seed + k });
    }
  }
  D.translate(0, -th);
  D.rotate((o.sway ?? 0.025) * noise1(t * 0.5 + f.seed, 3));
  // varas florales
  if (f.flowers && detail >= 1) {
    for (let k = 0; k < 3; k++) {
      const a = -Math.PI / 2 + (k - 1) * 0.35;
      const Ls = (110 + 25 * k) * h;
      const ex = Math.cos(a) * Ls, ey = Math.sin(a) * Ls;
      D.stroke([[0, -10], [ex * 0.5 + 5, ey * 0.5], [ex, ey]], '#8a8a5a', 2.4, { seed: f.seed + 20 + k });
      for (let q = 0; q < (detail >= 2 ? 4 : 2); q++) {
        const fx = ex + (q - 1.5) * 9 * h, fy = ey + Math.abs(q - 1.5) * 7 * h - 4;
        D.stroke([[ex, ey + 8 * h], [fx, fy]], '#8a8a5a', 1.3, { seed: f.seed + 60 + q });
        D.shape(ellipsePts(fx, fy, 6 * h, 5 * h, 10), '#f2c233', { seed: f.seed + 40 + q + k * 3, edge: 2, angle: -0.6 });
        D.shape(ellipsePts(fx, fy, 2.2 * h, 2.2 * h, 6), '#b8701c', { seed: f.seed + 50 + q, edge: 0 });
      }
    }
  }
  // roseta: hojas lanceoladas en abanico (atrás oscuras, adelante claras y afelpadas)
  const nL = detail >= 2 ? 19 : detail === 1 ? 11 : 6;
  const leaves = [];
  for (let k = 0; k < nL; k++) {
    const u = k / (nL - 1);
    const a = -Math.PI + 0.15 + u * (Math.PI - 0.3) + 0.08 * (hrand(f.seed, k) - 0.5);
    const isBack = k % 2 === 0;
    leaves.push({ a, back: isBack, len: rr * (isBack ? 1.05 : 0.9) * (0.88 + 0.24 * hrand(f.seed, k, 2)), k });
  }
  if (detail >= 1) for (let k = 0; k < 5; k++) leaves.unshift({ a: Math.PI / 2 + (k - 2) * 0.55, back: true, len: rr * 0.65, k: 40 + k, droop: true });
  leaves.sort((p, q) => (q.back ? 1 : 0) - (p.back ? 1 : 0));
  const leafShape = (a, len, wdt) => {
    const pts = [];
    const n = 12;
    for (let i = 0; i <= n; i++) { const u = i / n; const w = Math.sin(Math.PI * Math.pow(u, 0.8)) * wdt; pts.push([u * len, -w]); }
    for (let i = n; i >= 0; i--) { const u = i / n; const w = Math.sin(Math.PI * Math.pow(u, 0.8)) * wdt; pts.push([u * len, w]); }
    const c = Math.cos(a), si = Math.sin(a);
    // curvatura hacia arriba
    return pts.map(([x, y]) => { const yy = y - 0.12 * x * x / len; return [x * c - yy * si, x * si + yy * c]; });
  };
  for (const lf of leaves) {
    const col = lf.droop ? '#8f8a62' : lf.back ? '#7f8f6a' : '#aab792';
    const wdt = lf.len * 0.13 + 3;
    const pts = leafShape(lf.a, lf.len, wdt);
    const lp = D.shape(pts, col, { seed: f.seed + lf.k, knock: true, angle: lf.a, edge: 2.4, jitter: 0.6 });
    if (detail >= 2 && !lf.back) {
      // nervio central y pelusa
      D.stroke([[Math.cos(lf.a) * 5, Math.sin(lf.a) * 5], [Math.cos(lf.a) * lf.len * 0.85, Math.sin(lf.a) * lf.len * 0.85 - 0.1 * lf.len]], '#eef1e2', 1.4, { alpha: 0.75, seed: f.seed + lf.k });
      D.shadeIn(lp, pts.map(([x, y]) => [x * 0.98, y * 0.98 + wdt * 0.25]), '#e3e8d2', { seed: f.seed + lf.k + 3, alpha: 0.5, angle: lf.a + 0.4 });
    }
    if (detail >= 3 && !lf.back) hairs(D, pts, f.seed + lf.k, back);
    if (back > 0 && detail >= 1 && !lf.droop) rimLight(D, pts, back * (lf.back ? 0.5 : 1), f.seed + lf.k);
  }
  D.shape(ellipsePts(0, -4, 15 * h, 10 * h, 12), '#dde2c8', { seed: f.seed + 99, knock: true, edge: 2 });
  // hoja protagonista (de su punta nace la gota) y rocío
  if (f.tip) {
    const a = f.tip.a, len = f.tip.len * h, wdt = len * 0.12 + 4;
    const pts = leafShape(a, len, wdt);
    const lp = D.shape(pts, back > 0.5 ? '#98a680' : '#c9d2ae', { seed: f.seed + 7, knock: true, angle: a, edge: 2.6, jitter: 0.5 });
    D.shadeIn(lp, pts.map(([x, y]) => [x, y + wdt * 0.55]), '#6f7d5a', { seed: f.seed + 11, alpha: 0.7, angle: a + 0.5 });
    D.stroke([[Math.cos(a) * 6, Math.sin(a) * 6], [Math.cos(a) * len * 0.9 + 0.1 * len * Math.sin(a), Math.sin(a) * len * 0.9 - 0.1 * len * Math.cos(a)]], '#f2f4e6', 1.8, { alpha: 0.85, seed: f.seed + 8 });
    if (detail >= 2) hairs(D, pts, f.seed + 9, back);
    if (back > 0) rimLight(D, pts, back * 1.2, f.seed + 10);
    const dew = o.dew ?? 0;
    if (dew > 0.01) {
      const c = Math.cos(a), si = Math.sin(a);
      for (let k = 0; k < 9; k++) {
        const u0 = 0.55 + 0.4 * (k / 8);
        const u = lerp(u0, 0.99, 1 - dew);
        const side = (k % 2 ? 1 : -1) * wdt * 0.45 * Math.sin(Math.PI * u) * dew;
        const x = u * len, yy = side - 0.12 * x * x / len;
        const bx = x * c - yy * si, by = x * si + yy * c;
        const br = (1.6 + (k % 3) * 0.9) * dew;
        D.shape(ellipsePts(bx, by, br, br, 10), '#dff2fb', { seed: f.seed + 30 + k, edge: 0.6, alpha: 0.9, baseAlpha: 0.7 });
        D.shape(ellipsePts(bx - br * 0.35, by - br * 0.35, br * 0.3, br * 0.3, 6), '#ffffff', { seed: f.seed + 40 + k, edge: 0, baseAlpha: 1 });
      }
    }
  }
  D.restore();
}

// pelitos plateados en el contorno de una hoja (a escala macro)
function hairs(D, pts, seed, back) {
  const r = mulberry32(seed + 5);
  const n = pts.length;
  const pp = [];
  for (let i = 0; i < n; i += 1) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n];
    const dx = x1 - x0, dy = y1 - y0, dl = Math.hypot(dx, dy) || 1;
    for (let k = 0; k < 3; k++) {
      const u = r();
      const x = x0 + dx * u, y = y0 + dy * u;
      const nx = dy / dl, ny = -dx / dl;
      const L = 4 + r() * 7;
      pp.push([[x, y], [x + nx * L + (r() - 0.5) * 3, y + ny * L + (r() - 0.5) * 3]]);
    }
  }
  const ctx = D.ctx;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = back > 0 ? 'rgba(255,250,230,0.85)' : 'rgba(245,248,235,0.7)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (const [a, b] of pp) {
    const A = D.P(a[0], a[1]), B = D.P(b[0], b[1]);
    ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]);
  }
  ctx.stroke();
  ctx.restore();
}

// borde iluminado a contraluz
export function rimLight(D, pts, k, seed, col = '#fff4d6') {
  if (k <= 0.01) return;
  const ctx = D.ctx;
  const p = D.path(pts, { seed, jitter: 0.5 });
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.55 * k;
  ctx.strokeStyle = col;
  ctx.lineWidth = D.lw(2.6);
  ctx.stroke(p);
  ctx.globalAlpha = 0.18 * k;
  ctx.lineWidth = D.lw(9);
  ctx.stroke(p);
  ctx.restore();
}

// ------------------------------------------------------------------ plantas menores
export function drawTussock(D, P, seed, t, col = '#c8b064', hgt = 60) {
  const [sx, sy, s] = P;
  const hp = hgt * s;
  if (hp < 3 || sx < -80 || sx > D.W + 80) return;
  D.save(); D.translate(sx, sy); D.scale(s);
  const n = hp > 30 ? 12 : 6;
  D.shape(ellipsePts(0, -4, hgt * 0.45, 8, 10), shade(col, -0.25), { seed, edge: 2, alpha: 0.8, knock: true });
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.2 + 0.1 * noise1(t * 0.9 + i, seed);
    const L = hgt * (0.6 + 0.5 * hrand(seed, i));
    D.stroke([[0, 0], [Math.cos(a) * L * 0.45, Math.sin(a) * L * 0.6], [Math.cos(a) * L, Math.sin(a) * L * 0.9 + L * 0.12]], shade(col, (i % 3 - 1) * 0.15), Math.max(1.4, 2.6 * Math.sqrt(s)), { seed: seed + i, alpha: 0.9 });
  }
  D.restore();
}

export function drawFern(D, P, seed, t, col = '#4f8a3e', size = 1) {
  const [sx, sy, s] = P;
  if (sx < -200 || sx > D.W + 200) return;
  D.save(); D.translate(sx, sy); D.scale(s * size);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const side = i - (n - 1) / 2;
    const a0 = -Math.PI / 2 + side * 0.36 + 0.06 * noise1(t + i, seed);
    const L = 80 + 30 * hrand(seed, i);
    const pts = [];
    let x = 0, y = 0;
    for (let q = 0; q <= 6; q++) {
      const a = a0 + Math.sign(side || 1) * (q / 6) ** 2 * 1.2;
      pts.push([x, y]);
      x += Math.cos(a) * L / 6; y += Math.sin(a) * L / 6;
    }
    const c = shade(col, (i % 2) * 0.12);
    D.stroke(pts, shade(c, -0.3), 2, { seed: seed + i });
    for (let q = 1; q < pts.length - 1; q++) {
      const [x0, y0] = pts[q], [x1, y1] = pts[q + 1];
      const dx = x1 - x0, dy = y1 - y0, dl = Math.hypot(dx, dy) || 1;
      const nx = -dy / dl, ny = dx / dl, pl = 16 * (1 - q / 7) + 4;
      D.shape([[x0, y0], [x0 + nx * pl + dx * 0.4, y0 + ny * pl + dy * 0.4], [x1, y1], [x0 - nx * pl + dx * 0.4, y0 - ny * pl + dy * 0.4]], c, { seed: seed + 20 + i * 7 + q, edge: 1.4, knock: true, jitter: 0.5 });
    }
  }
  D.restore();
}

export function drawBromeliad(D, x, y, sc, seed, t) {
  D.save(); D.translate(x, y); D.scale(sc);
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.38;
    const L = 30 + 8 * Math.abs(i - 3) * -0.5 + 10;
    const pts = [[0, 0], [Math.cos(a - 0.12) * L * 0.5, Math.sin(a - 0.12) * L * 0.5], [Math.cos(a) * L, Math.sin(a) * L], [Math.cos(a + 0.12) * L * 0.5, Math.sin(a + 0.12) * L * 0.5]];
    D.shape(pts, i % 2 ? '#7a9a45' : '#5d8a3a', { seed: seed + i, edge: 1.5, knock: true, smooth: false });
  }
  D.shape([[0, -4], [-5, -26], [0, -34], [5, -26]], '#d84a32', { seed: seed + 9, edge: 1.5, knock: true });
  D.restore();
}

export function drawStump(D, P, seed, sc = 1) {
  const [sx, sy, s] = P;
  if (sx < -100 || sx > D.W + 100) return;
  D.save(); D.translate(sx, sy); D.scale(s * sc);
  castShadow(D, 44, 9, seed, 0.35, '#3d3020');
  const w = 26 + hrand(seed) * 10, hh = 28 + hrand(seed, 1) * 26;
  const body = D.shape([[-w, 0], [-w * 0.95, -hh], [w * 0.95, -hh - 6], [w, 0], [w * 1.3, 3], [-w * 1.3, 3]], '#6e5238', { seed, knock: true, angle: -1.4, edge: 2.4 });
  D.shadeIn(body, [[w * 0.2, 0], [w * 0.2, -hh - 8], [w * 1.4, -hh - 8], [w * 1.4, 4]], '#4a3524', { seed: seed + 1, alpha: 0.8, angle: -1.3, smooth: false });
  // corte (anillos)
  D.shape(ellipsePts(0, -hh - 3, w * 0.95, 8, 14), '#d9b98a', { seed: seed + 2, knock: true, edge: 2 });
  D.stroke(ellipsePts(0, -hh - 3, w * 0.55, 4.5, 12).concat([[w * 0.55, -hh - 3]]), '#9a7650', 1.2, { seed: seed + 3, alpha: 0.7 });
  D.restore();
}

export function drawFlower(D, P, seed, col, t) {
  const [sx, sy, s] = P;
  if (s * 20 < 2 || sx < -30 || sx > D.W + 30) return;
  D.save(); D.translate(sx, sy); D.scale(s);
  const sw = 0.1 * Math.sin(t * 2 + seed);
  D.rotate(sw);
  D.stroke([[0, 0], [1, -12], [0, -24]], '#5f7f3a', 1.6, { seed });
  D.shape(ellipsePts(0, -26, 6, 5, 8), col, { seed: seed + 1, edge: 1.5, knock: true });
  D.shape(ellipsePts(0, -26, 2, 2, 6), '#f5d34a', { seed: seed + 2, edge: 0 });
  D.restore();
}

export function drawRock(D, P, seed, sc = 1, col = '#8a877a') {
  const [sx, sy, s] = P;
  if (sx < -120 || sx > D.W + 120) return;
  D.save(); D.translate(sx, sy); D.scale(s * sc);
  const pts = ellipsePts(0, -14, 40, 24, 12, 0, 0.18, seed).map(([x, y]) => [x, Math.min(y, 2)]);
  const rp = D.shape(pts, col, { seed, knock: true, angle: -0.5, edge: 2.5 });
  D.shadeIn(rp, ellipsePts(12, -4, 38, 18, 10), shade(col, -0.35), { seed: seed + 1, alpha: 0.8 });
  D.shadeIn(rp, ellipsePts(-12, -28, 18, 8, 8), '#6f8f3c', { seed: seed + 2, alpha: 0.7 });
  D.restore();
}
