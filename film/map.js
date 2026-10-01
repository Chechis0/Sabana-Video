// Revelación final: la cuenca vista desde lo alto es un árbol. El páramo y los bosques son la
// copa, las quebradas son las ramas, el río es el tronco y los canales del valle son las raíces.
import { createCanvas, Path2D } from '@napi-rs/canvas';
import { W, H } from './timeline.js';
import { clamp, lerp, ease, prog, noise1, hrand, mulberry32, mix, shade, catmull } from './core/math.js';
import { ellipsePts, rectPts } from './core/pencil.js';
import { initAssets } from './render-view.js';
import { godRays, bloom, grade, paperPass, glow, gradientLayer } from './engine/post.js';
import { handText } from './text.js';
import { sparkle } from './effects.js';
import { T } from './story.js';

// ------------------------------------------------------------------ geometría del árbol (coordenadas de mapa = pantalla base)
const CX = 540;
const TRUNK_TOP = 1130, TRUNK_BOT = 1540;
const CROWN = { cx: 540, cy: 770, rx: 470, ry: 400 };
function inCrown(x, y) {
  // copa: unión de lóbulos
  const lobes = [[540, 760, 440, 360], [300, 820, 230, 200], [780, 820, 230, 200], [400, 560, 250, 210], [680, 560, 250, 210], [540, 470, 230, 150]];
  return lobes.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1);
}
// ramas (quebradas): polilíneas desde el tronco hacia la copa
const R = mulberry32(2024);
function branch(x0, y0, x1, y1, bend, n = 8) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = lerp(x0, x1, u) + Math.sin(u * Math.PI) * bend + 8 * noise1(u * 5 + x1, 3);
    const y = lerp(y0, y1, u) + 6 * noise1(u * 4 + y1, 4);
    pts.push([x, y]);
  }
  return pts;
}
const BR = [
  // [desde, hasta, curva, grosor]
  [[CX, TRUNK_TOP], [CX, 520], 10, 13],
  [[CX, 1010], [300, 740], -40, 10], [[CX, 1010], [780, 740], 40, 10],
  [[CX, 900], [370, 560], -30, 8], [[CX, 900], [710, 560], 30, 8],
  [[300, 740], [150, 620], -20, 6], [[300, 740], [240, 520], 20, 6], [[300, 760], [150, 860], 10, 5],
  [[780, 740], [930, 620], 20, 6], [[780, 740], [840, 520], -20, 6], [[780, 760], [930, 860], -10, 5],
  [[370, 560], [300, 430], -10, 5], [[370, 560], [440, 420], 10, 5], [[710, 560], [640, 420], -10, 5], [[710, 560], [790, 440], 10, 5],
  [[CX, 640], [480, 400], -10, 5], [[CX, 640], [600, 400], 10, 5],
  [[420, 960], [250, 960], 15, 4], [[660, 960], [830, 960], -15, 4],
].map(([a, b, bend, w]) => ({ pts: catmull(branch(a[0], a[1], b[0], b[1], bend), 4), w }));
// raíces: canales que se abren en el valle
const ROOTS = [
  [[CX, TRUNK_BOT - 20], [200, 1740], -50, 11], [[CX, TRUNK_BOT - 20], [880, 1740], 50, 11],
  [[CX, TRUNK_BOT], [400, 1830], -20, 9], [[CX, TRUNK_BOT], [680, 1830], 20, 9],
  [[330, 1680], [70, 1700], 25, 6], [[750, 1680], [1010, 1700], -25, 6],
  [[260, 1720], [150, 1880], -15, 5], [[820, 1720], [930, 1880], 15, 5],
  [[440, 1780], [330, 1920], -10, 4], [[640, 1780], [750, 1920], 10, 4], [[CX, 1600], [CX, 1920], 5, 6],
].map(([a, b, bend, w]) => ({ pts: catmull(branch(a[0], a[1], b[0], b[1], bend, 6), 4), w }));
const TRUNK = catmull(branch(CX, TRUNK_TOP - 10, CX, TRUNK_BOT + 10, 6, 6), 4);

// árboles (vistos desde arriba) que llenan la copa; t0: cuándo brotan en la revelación
const CANOPY = (() => {
  const out = [];
  const r = mulberry32(77);
  for (let i = 0; i < 1400 && out.length < 520; i++) {
    const x = 70 + r() * 940, y = 330 + r() * 860;
    if (!inCrown(x, y)) continue;
    if (y < 470 && Math.abs(x - CX) < 330) continue; // páramo arriba
    const dist = Math.hypot(x - CX, (y - TRUNK_TOP) * 0.9) / 560;
    const old = r() < 0.35; // bosque que ya existía
    out.push({ x, y, r: 13 + r() * 12, seed: i, t0: old ? 0 : T.map + 0.6 + dist * 1.9 + r() * 0.35, col: ['#3f6f3a', '#4f8a44', '#5e9a4c', '#35603a'][Math.floor(r() * 4)] });
  }
  // galería de bosque a lo largo del tronco
  for (let y = TRUNK_TOP; y < TRUNK_BOT; y += 16) {
    for (const s of [-1, 1]) out.push({ x: CX + s * (26 + r() * 18), y: y + r() * 8, r: 13 + r() * 8, seed: 900 + y + s, t0: T.map + 0.3 + (TRUNK_BOT - y) / 400, col: '#4a8040' });
  }
  return out.sort((a, b) => a.y - b.y);
})();
const FRAILEJONES = (() => {
  const out = [];
  const r = mulberry32(81);
  for (let i = 0; i < 400 && out.length < 110; i++) {
    const x = 210 + r() * 660, y = 360 + r() * 190;
    if (!inCrown(x, y + 30)) continue;
    out.push({ x, y, r: 3 + r() * 3 });
  }
  return out;
})();
const FIELDS = (() => {
  const out = [];
  const r = mulberry32(83);
  for (let i = 0; i < 90; i++) {
    const x = 20 + r() * 1040, y = 1180 + r() * 760;
    if (Math.abs(x - CX) < 80 && y < 1580) continue;
    if (inCrown(x, y) || inCrown(x, y - 40)) continue;
    out.push({ x, y, w: 50 + r() * 90, h: 36 + r() * 60, a: (r() - 0.5) * 0.5, col: ['#c2cc6c', '#9fbe5e', '#d6c36a', '#b3cf7c', '#8fb456', '#dcc98a', '#c7a85e'][Math.floor(r() * 7)] });
  }
  return out;
})();
// 20 municipios que siembran
const MUNIS = (() => {
  const pts = [[210, 650], [360, 470], [520, 560], [700, 480], [860, 640], [260, 880], [430, 760], [650, 760], [820, 900], [540, 980],
    [330, 1010], [760, 1040], [470, 1180], [610, 1260], [380, 1400], [700, 1390], [250, 1560], [830, 1560], [440, 1690], [650, 1700]];
  return pts.map(([x, y], i) => ({ x, y, t: T.map + 1.0 + i * 0.1 + (i % 3) * 0.04 }));
})();
const HOUSES = (() => {
  const out = [];
  const r = mulberry32(85);
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2, d = 30 + r() * 80;
    out.push({ x: CX + Math.cos(a) * d * 1.4, y: 1610 + Math.sin(a) * d * 0.6, s: 7 + r() * 5 });
  }
  return out;
})();

// ------------------------------------------------------------------ dibujo
function river(D, pts, w, t, seed, alpha = 1) {
  D.stroke(pts, '#3f7fb8', w + 5, { seed, alpha: 0.35 * alpha, abs: true });
  D.stroke(pts, '#6fb2df', w, { seed: seed + 1, alpha: 0.95 * alpha, abs: true, textured: true });
  // brillo dorado que corre por el agua
  const n = pts.length;
  const k = ((t * 0.6 + seed * 0.13) % 1);
  const i0 = Math.floor(k * (n - 4));
  D.stroke(pts.slice(i0, i0 + 4), '#fff6d8', Math.max(1.5, w * 0.35), { seed: seed + 2, alpha: 0.7 * alpha, abs: true });
}

function drawTreeTop(D, x, y, r, col, seed, k) {
  if (k <= 0) return;
  const rr = r * ease.outBack(clamp(k), 2);
  // sombra alargada (luz dorada desde arriba a la izquierda)
  D.shape(ellipsePts(x + rr * 0.45, y + rr * 0.4, rr * 1.05, rr * 0.85, 10, 0.5), '#1f3a24', { seed, alpha: 0.35, edge: 2, base: false, rim: false });
  const p = D.shape(ellipsePts(x, y, rr, rr * 0.92, 12, 0, 0.12, seed), col, { seed: seed + 1, knock: true, edge: 2, angle: [-1.05, -0.62, 0.3][seed % 3], baseAlpha: 0.55 });
  D.shape(ellipsePts(x - rr * 0.3, y - rr * 0.3, rr * 0.45, rr * 0.38, 8), shade(col, 0.35), { seed: seed + 2, edge: 0, base: false, alpha: 0.85 });
}

let layerCache = null; // fondo estático (papel, sabana, campos) — se pinta una vez
function staticBase(D) {
  if (layerCache) return layerCache;
  const c = createCanvas(W, H);
  const g = c.getContext('2d');
  const A = initAssets();
  g.drawImage(A.paper, 0, 0);
  const D2 = Object.create(D);
  D2.ctx = g;
  layerCache = c;
  return c;
}

export function drawMap(D, canvas, t, frame) {
  const A = initAssets();
  const ctx = canvas.getContext('2d');
  D.setFrame(t, frame, { x: W / 2, y: H / 2, z: 1 }, 2);
  D.ctx = ctx; D.mainCtx = ctx; D.haze = null;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.drawImage(A.paper, 0, 0);
  // cámara: se aleja despacio y se asienta
  const u = ease.outCubic(prog(t, T.map, T.map + 2.6));
  const z = lerp(1.55, 1.0, u) * (1 + 0.012 * prog(t, T.map + 2.6, T.end));
  const cy = lerp(1300, H / 2, u);
  D.save();
  D.translate(W / 2, H / 2);
  D.scale(z);
  D.translate(-W / 2, -cy);
  D.slow = true;
  // sabana (fondo verde claro con textura)
  D.shape(rectPts(-200, -200, W + 400, H + 400, 4), '#cdd6a0', { seed: 1, knock: true, smooth: false, angle: -0.3, edge: 0, baseAlpha: 0.5 });
  // campos del valle
  for (const f of FIELDS) {
    D.save(); D.translate(f.x, f.y); D.rotate(f.a);
    const fp = D.shape(rectPts(-f.w / 2, -f.h / 2, f.w, f.h, 2).map(([x, y], i) => [x + 5 * noise1(i + f.x, 1), y + 5 * noise1(i + f.y, 2)]), f.col, { seed: Math.floor(f.x), smooth: false, angle: [0, 0.8, -0.8][Math.floor(f.y) % 3], edge: 2, knock: true, baseAlpha: 0.5 });
    for (let k = 1; k < 5; k++) D.stroke([[-f.w / 2 + 4, -f.h / 2 + k * f.h / 5], [f.w / 2 - 4, -f.h / 2 + k * f.h / 5]], shade(f.col, -0.25), 1.2, { seed: Math.floor(f.x) + k, alpha: 0.45, abs: true });
    D.restore();
  }
  // copa: suelo (bosque viejo + potreros) y páramo arriba
  const crownPts = [];
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    let rr = 1;
    let x = CROWN.cx + Math.cos(a) * CROWN.rx, y = CROWN.cy + Math.sin(a) * CROWN.ry;
    // busca el borde real de la unión de lóbulos
    let lo = 0, hi = 1.6;
    for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (inCrown(CROWN.cx + Math.cos(a) * CROWN.rx * m, CROWN.cy + Math.sin(a) * CROWN.ry * m)) lo = m; else hi = m; }
    rr = lo;
    crownPts.push([CROWN.cx + Math.cos(a) * CROWN.rx * rr, CROWN.cy + Math.sin(a) * CROWN.ry * rr]);
  }
  const leaf = ease.inOut(prog(t, T.map + 0.5, T.map + 2.8));
  const crown = D.shape(crownPts, mix('#b9b070', '#6f9a52', leaf), { seed: 3, knock: true, angle: -0.62, edge: 4 });
  D.shadeIn(crown, ellipsePts(CX, 470, 380, 130, 20), '#c8b56a', { seed: 4, alpha: 0.95, angle: -0.2 });
  // lagunas del páramo
  for (const [lx, ly, rx, ry, sd] of [[420, 440, 30, 15, 5], [650, 455, 24, 12, 6], [540, 395, 16, 9, 9]]) {
    D.shape(ellipsePts(lx, ly, rx + 6, ry + 5, 14, 0.15, 0.25, sd), '#6f8f4a', { seed: sd + 20, edge: 2, alpha: 0.8 });
    const lp = D.shape(ellipsePts(lx, ly, rx, ry, 14, 0.15, 0.25, sd), '#5aa0d2', { seed: sd, knock: true, edge: 1.5 });
    D.shadeIn(lp, ellipsePts(lx - rx * 0.3, ly - ry * 0.35, rx * 0.5, ry * 0.3, 8), '#dff2fb', { seed: sd + 1, alpha: 0.8 });
  }
  for (const f of FRAILEJONES) {
    D.shape(ellipsePts(f.x + 2, f.y + 2, f.r, f.r * 0.8, 7), '#6d6a3a', { seed: Math.floor(f.x * 3) + 1, edge: 0, alpha: 0.35, base: false });
    D.shape(ellipsePts(f.x, f.y, f.r, f.r, 8), '#c8d0a8', { seed: Math.floor(f.x * 3), edge: 1, alpha: 0.95, knock: true });
  }
  // tronco: bosque de galería
  D.shape([[CX - 60, TRUNK_TOP - 30], [CX + 60, TRUNK_TOP - 30], [CX + 52, TRUNK_BOT], [CX + 80, TRUNK_BOT + 40], [CX - 80, TRUNK_BOT + 40], [CX - 52, TRUNK_BOT]], mix('#9aa864', '#4f8042', leaf), { seed: 7, knock: true, angle: -1.3 });
  // ríos: ramas, tronco y raíces
  for (const [i, b] of BR.entries()) river(D, b.pts, b.w, t, 20 + i);
  river(D, TRUNK, 16, t, 60);
  for (const [i, b] of ROOTS.entries()) river(D, b.pts, b.w, t, 70 + i);
  // pueblo en la base de las raíces
  for (const h of HOUSES) {
    D.shape(rectPts(h.x - h.s, h.y - h.s * 0.7, h.s * 2, h.s * 1.4, 1), '#f2ead8', { seed: Math.floor(h.x), smooth: false, edge: 1, knock: true });
    D.shape(rectPts(h.x - h.s, h.y - h.s * 0.7, h.s * 2, h.s * 0.7, 1), '#b5563a', { seed: Math.floor(h.x) + 1, smooth: false, edge: 0.8 });
  }
  // árboles: los viejos ya están; los nuevos brotan del tronco hacia afuera
  for (const c of CANOPY) {
    const k = c.t0 <= 0 ? 1 : prog(t, c.t0, c.t0 + 0.4);
    drawTreeTop(D, c.x, c.y, c.r, c.col, c.seed, k);
  }
  D.slow = false;
  // 20 municipios: se encienden y quedan brillando (un pueblito con su luz)
  for (const m of MUNIS) {
    if (t < m.t) continue;
    const k = prog(t, m.t, m.t + 0.7);
    const on = ease.outBack(clamp((t - m.t) * 4), 2);
    const [sx, sy] = D.P(m.x, m.y);
    glow(ctx, sx, sy, 46 * z * on, '#ffe79a', 0.6 * (0.85 + 0.15 * Math.sin(t * 4 + m.x)));
    ctx.save();
    ctx.globalAlpha = on;
    ctx.fillStyle = '#fffbe6';
    ctx.beginPath(); ctx.arc(sx, sy, 5.5 * z, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d98a2a'; ctx.lineWidth = 2.2 * z;
    ctx.beginPath(); ctx.arc(sx, sy, 9 * z * on, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    sparkle(D, sx, sy, k, 60 * z, m.x, '#fff4b8');
  }
  // nubes que se abren al llegar y otras que pasan (con su sombra)
  const open = ease.inOut(prog(t, T.map, T.map + 1.0));
  const CL = [[250, 600, 190], [820, 780, 170], [330, 1420, 130], [860, 1300, 120]];
  CL.forEach(([x, y, r], i) => {
    const dx = (t - T.map) * 14 + (i % 2 ? 1 : -1) * open * 600;
    const cx = x + dx, cyy = y - (1 - open) * 0;
    const a = i < 2 ? 1 - open : 0.8 * ease.inOut(prog(t, T.map + 0.5, T.map + 1.5));
    const puffs = [0, 1, 2, 3, 4].map((k) => ellipsePts(cx + (k - 2) * r * 0.42, cyy + Math.sin(k * 2.1) * r * 0.2, r * 0.45, r * 0.38, 12, 0, 0.1, i * 10 + k));
    D.multi(puffs.map((p) => p.map(([px, py]) => [px + 60, py + 80])), '#2a3a2a', { seed: 400 + i, alpha: 0.18 * a, edge: 4, base: false, rim: false });
    D.multi(puffs, '#ffffff', { seed: 410 + i, alpha: 0.92 * a, edge: 4, baseAlpha: 0.8, rim: false, angle: -0.35 });
  });
  D.restore();
  // velo de nubes que se abre (continuación de la subida)
  const veil = 1 - ease.inOut(prog(t, T.map, T.map + 0.9));
  if (veil > 0) { ctx.save(); ctx.globalAlpha = veil; ctx.fillStyle = '#fbf8f0'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  // luz dorada de la tarde
  gradientLayer(canvas, [[0, 'rgba(255,214,150,0.9)'], [0.5, 'rgba(255,236,200,0.2)'], [1, 'rgba(255,200,150,0.5)']], 'soft-light', 0.55);
  glow(ctx, 120, 160, 900, '#ffd89a', 0.3);
  bloom(canvas, { strength: 0.22 });
  grade(canvas, { filter: 'saturate(1.12) contrast(1.05)', layers: [['#ffb45a', 0.1, 'soft-light']] });
  paperPass(canvas, A, { vignette: 0.5 });
  drawTitles(D, t);
}

function drawTitles(D, t) {
  const ctx = D.ctx;
  if (t < T.title1 - 0.1) return;
  // bandas de papel para que el texto se lea
  const kt = ease.inOut(prog(t, T.title1 - 0.3, T.title1 + 0.3));
  if (kt > 0) {
    const g = ctx.createLinearGradient(0, 0, 0, 330);
    g.addColorStop(0, `rgba(248,242,228,${0.92 * kt})`);
    g.addColorStop(1, 'rgba(248,242,228,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 330);
  }
  const kb = ease.inOut(prog(t, T.credits - 0.4, T.credits + 0.3));
  if (kb > 0) {
    const g = ctx.createLinearGradient(0, H - 420, 0, H - 250);
    g.addColorStop(0, 'rgba(248,242,228,0)');
    g.addColorStop(1, `rgba(248,242,228,${0.94 * kb})`);
    ctx.fillStyle = g; ctx.fillRect(0, H - 420, W, 420);
  }
  const o = { mode: 'words', maxW: 980 };
  handText(D, 'Conectar el bosque es sembrar agua.', W / 2, 128, 82, '#2f4a3a', prog(t, T.title1, T.title1 + 0.5), { ...o, seed: 3, halo: 'rgba(250,246,236,0.9)' });
  handText(D, 'Sembrar agua es sembrar futuro.', W / 2, 228, 82, '#2f6f9a', prog(t, T.title2, T.title2 + 0.5), { ...o, seed: 4, halo: 'rgba(250,246,236,0.9)' });
  handText(D, 'Árboles para mi País', W / 2, H - 206, 84, '#3d6a3a', prog(t, T.credits, T.credits + 0.4), { ...o, seed: 6 });
  handText(D, '+261.000 árboles · 20 municipios de Cundinamarca', W / 2, H - 146, 44, '#4a3d30', prog(t, T.credits + 0.25, T.credits + 0.6), { ...o, seed: 7, font: 'PatrickHand' });
  handText(D, 'Fundación Parque Jaime Duque', W / 2, H - 96, 42, '#4a3d30', prog(t, T.credits + 0.35, T.credits + 0.7), { ...o, seed: 8, font: 'PatrickHand' });
  handText(D, 'Creado por: Sergio Pardo Osorio', W / 2, H - 38, 44, '#2f4a3a', prog(t, T.credits + 0.6, T.credits + 1.0), { ...o, seed: 9 });
}
