// Capas de suelo: cielo, cordillera, páramo, potreros, bosque (unión de manchas), sabana y quebradas.
import { Path2D, createCanvas } from '@napi-rs/canvas';
import { ellipsePts, rectPts } from '../core/pencil.js';
import { clamp, lerp, ease, mix, noise1, hrand, mulberry32, prog, shade, rgba, Polyline } from '../core/math.js';
import { T } from '../timeline.js';
import {
  WORLD, ridgeY, paramoBottom, halfW, riverList, rivers, L1, GAP, sGap0, sGap1, sStuck, sFront0,
  forestCells, cellRadius, fields, PLACES, clouds, inCrown,
} from './layout.js';
import { drawTuft, drawRock } from './props.js';

// ---------------------------------------------------------------- estado del agua en la quebrada de la gota
export function frontS(t) {
  if (t < T.dry[0]) return sFront0;
  if (t < T.dry[1]) return lerp(sFront0, sStuck + 6, ease.inOut(prog(t, T.dry[0], T.dry[1])));
  if (t < T.refill[0]) return sStuck + 6;
  return lerp(sStuck + 6, L1.length + 40, ease.inOutSine(prog(t, T.refill[0], T.refill[1])));
}
export function gapWidthMul(t) {
  if (t < T.dry[0]) return 0.55;
  if (t < T.refill[0]) return lerp(0.55, 0.3, prog(t, T.dry[0], T.dry[1]));
  return lerp(0.3, 1, ease.inOut(prog(t, T.refill[0], T.refill[1] + 0.6)));
}

// ---------------------------------------------------------------- geometría estática
const rng = mulberry32(99);
const ridgeL = 1520 - halfW(950, -1), ridgeR = 1520 + halfW(950, 1);
const bodyPts = (() => {
  const pts = [];
  for (let x = ridgeL; x <= ridgeR; x += 40) pts.push([x, ridgeY(x) - 4]);
  // lado derecho baja con borde orgánico
  for (let y = ridgeY(ridgeR) + 60; y < 3900; y += 90) pts.push([1520 + halfW(y, 1), y]);
  // borde inferior: arco del valle que se deshace en papel
  for (let a = 0; a <= Math.PI; a += Math.PI / 40) {
    const x = 1520 + Math.cos(a) * halfW(3900, Math.cos(a) > 0 ? 1 : -1), y = 3900 + Math.sin(a) * 1080;
    pts.push([x + 30 * noise1(a * 7, 22), y + 40 * noise1(a * 9, 23)]);
  }
  for (let y = 3900; y > ridgeY(ridgeL) + 60; y -= 90) pts.push([1520 - halfW(y, -1), y]);
  return pts;
})();
const paramoPts = (() => {
  const pts = [];
  for (let x = ridgeL; x <= ridgeR; x += 40) pts.push([x, ridgeY(x) - 4]);
  for (let y = ridgeY(ridgeR) + 60; y < paramoBottom(ridgeR - 60); y += 60) pts.push([1520 + halfW(y, 1), y]);
  for (let x = ridgeR - 60; x >= ridgeL + 60; x -= 40) pts.push([x, paramoBottom(x)]);
  for (let y = paramoBottom(ridgeL + 60); y > ridgeY(ridgeL) + 60; y -= 60) pts.push([1520 - halfW(y, -1), y]);
  return pts;
})();
// franja dorada de pajonal dentro del páramo (variación de color)
const paramo2Pts = (() => {
  const pts = [];
  for (let x = ridgeL + 140; x <= ridgeR - 140; x += 40) pts.push([x, ridgeY(x) + 150 + 60 * noise1(x / 180, 31)]);
  for (let x = ridgeR - 140; x >= ridgeL + 140; x -= 40) pts.push([x, paramoBottom(x) - 70 + 40 * noise1(x / 150, 32)]);
  return pts;
})();
const farRange1 = (() => {
  const pts = [];
  for (let x = ridgeL + 30; x <= ridgeR - 30; x += 60) pts.push([x, Math.min(ridgeY(x) + 10, 460 + 140 * Math.abs(noise1(x / 330, 41)) + 0.00008 * (x - 1520) ** 2 - (1 - Math.min(1, Math.abs(x - 1520) / 1300)) * 0)]);
  for (let x = ridgeR - 30; x >= ridgeL + 30; x -= 60) pts.push([x, ridgeY(x) + 30]);
  return pts;
})();
const farRange2 = (() => {
  const pts = [];
  for (let x = ridgeL + 30; x <= ridgeR - 30; x += 60) pts.push([x, Math.min(ridgeY(x) + 10, 600 + 120 * Math.abs(noise1(x / 250, 43)) + 0.00005 * (x - 1520) ** 2)]);
  for (let x = ridgeR - 30; x >= ridgeL + 30; x -= 60) pts.push([x, ridgeY(x) + 30]);
  return pts;
})();

// zona seca (grietas) alrededor del tramo sin bosque
const dryZone = (() => {
  const pts = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const y = lerp(GAP.y0 - 10, GAP.y1 + 10, i / n);
    const p = L1.at(L1.sAtY(y));
    pts.push([p.x - 330 - 40 * noise1(i * 0.7, 51), y]);
  }
  for (let i = n; i >= 0; i--) {
    const y = lerp(GAP.y0 - 10, GAP.y1 + 10, i / n);
    const p = L1.at(L1.sAtY(y));
    pts.push([p.x + 330 + 40 * noise1(i * 0.7, 52), y]);
  }
  return pts;
})();
const cracks = (() => {
  const out = [];
  const r = mulberry32(606);
  for (let i = 0; i < 70; i++) {
    const y = lerp(GAP.y0 + 20, GAP.y1 - 10, r());
    const p = L1.at(L1.sAtY(y));
    let x = p.x + (r() - 0.5) * 560, yy = y;
    const pts = [[x, yy]];
    let a = r() * Math.PI * 2;
    const n = 3 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) {
      a += (r() - 0.5) * 1.4;
      x += Math.cos(a) * (10 + r() * 16);
      yy += Math.sin(a) * (7 + r() * 10);
      pts.push([x, yy]);
    }
    out.push(pts);
  }
  return out;
})();

const tufts = (() => {
  const out = [];
  const r = mulberry32(77);
  for (let i = 0; i < 900; i++) {
    const x = 100 + r() * 2840, y = 480 + r() * 800;
    if (y < ridgeY(x) + 8 || y > paramoBottom(x)) continue;
    out.push([x, y, 0.7 + r() * 0.7, i]);
  }
  // mechones secos en el potrero
  for (let i = 0; i < 90; i++) {
    const y = lerp(GAP.y0, GAP.y1, r());
    const p = L1.at(L1.sAtY(y));
    out.push([p.x + (r() - 0.5) * 600, y, 0.6 + r() * 0.5, 1000 + i, true]);
  }
  return out;
})();
const rocks = [[1238, 902, 0.9], [1120, 930, 0.7], [1215, 985, 0.6], [1150, 1010, 0.8], [1000, 780, 1], [1320, 700, 0.8]];

// ---------------------------------------------------------------- dibujo
export function sunPos(t) {
  // amanecer detrás de la cresta; al final alto a la derecha
  if (t < 12) return [1290, lerp(520, 420, ease.outQuad(prog(t, 0, 6)))];
  return [2770, 505];
}

const skyDome = (() => {
  const pts = [];
  for (let x = ridgeL; x <= ridgeR; x += 60) pts.push([x, ridgeY(x) + 40]);
  const yb = ridgeY(ridgeR) + 40;
  for (let a = 0; a <= Math.PI; a += Math.PI / 36) {
    pts.push([1520 + Math.cos(a) * (ridgeR - 1520 + 10) + 20 * noise1(a * 6, 61), yb - Math.sin(a) * (yb + 560) + 30 * noise1(a * 8, 62)]);
  }
  return pts;
})();

export function drawSky(D, t) {
  const k = prog(t, 4, 30);
  const top = '#a8c6e0', low = '#f2c89e';
  const x0 = -400, x1 = 3440;
  const ctx = D.ctx;
  ctx.save();
  const dome = D.path(skyDome, { seed: 7, jitter: 3 });
  // halo suave del borde del cielo sobre el papel
  D.fill(dome, top, { seed: 8, angle: -0.12, soft: true, edge: 14, alpha: 0.8, rim: false, base: false });
  ctx.clip(dome);
  const sky = [[x0, -760], [x1, -760], [x1, 1100], [x0, 1100]];
  D.shape(sky, top, { seed: 1, angle: -0.12, edge: 0, jitter: 3, alpha: 0.95, smooth: false });
  const warm = [[x0, 180], [x1, 180], [x1, 1100], [x0, 1100]];
  D.shape(warm, low, { seed: 2, angle: -0.1, edge: 0, alpha: 0.75 - 0.25 * k, soft: true, smooth: false });
  const warm2 = [[x0, 330], [x1, 330], [x1, 1100], [x0, 1100]];
  D.shape(warm2, low, { seed: 3, angle: -0.08, edge: 0, alpha: 0.7 - 0.3 * k, soft: false, smooth: false });
  // sol
  const [sx, sy] = sunPos(t);
  if (D.visible(sx, sy, 200)) {
    D.save(); D.translate(sx, sy);
    const rot = t * 0.15;
    for (let i = 0; i < 14; i++) {
      const a = rot + (i / 14) * Math.PI * 2;
      const r0 = 78, r1 = 104 + (i % 2) * 22;
      D.stroke([[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * r1, Math.sin(a) * r1]], '#f0b73c', 3.2, { seed: 70 + i, alpha: 0.8 });
    }
    D.shape(ellipsePts(0, 0, 64, 64, 26, 0, 0.02, 9), '#f7cf4a', { seed: 9, angle: -0.9, edge: 5 });
    D.shape(ellipsePts(-14, -16, 30, 26, 16), '#fbe38a', { seed: 10, angle: -0.6, edge: 2, rim: false, alpha: 0.8 });
    D.restore();
  }
  // nubes
  for (const c of clouds) {
    const cx = c.x + t * 6 * c.s, cy = c.y;
    if (!D.visible(cx, cy, 260 * c.s)) continue;
    D.save(); D.translate(cx, cy); D.scale(c.s);
    const base = D.shape([[-150, 10], [-120, -30], [-70, -52], [-20, -44], [20, -70], [80, -56], [120, -26], [160, 8], [100, 22], [-80, 24]], '#fbf6ec', { seed: 200 + c.seed, knock: false, angle: -0.2, edge: 5, alpha: 0.9 });
    D.shadeIn(base, [[-150, 0], [160, 0], [160, 30], [-150, 30]], '#c9d3dc', { seed: 210 + c.seed, alpha: 0.6, angle: -0.1 });
    D.restore();
  }
  // cordilleras lejanas
  D.shape(farRange1, '#a9b8c8', { seed: 31, angle: -1.2, edge: 3, jitter: 2, smooth: true, alpha: 0.9 });
  D.shape(farRange2, '#93a8b6', { seed: 32, angle: -1.1, edge: 3, jitter: 2, smooth: true });
  ctx.restore();
}

export function drawLand(D, t) {
  // cuerpo de la montaña (potreros claros)
  D.shape(bodyPts, '#d8c98c', { seed: 40, angle: -0.2, edge: 6, jitter: 2.4, knock: true, smooth: true, baseAlpha: 0.45 });
  // páramo
  D.shape(paramoPts, '#b9ad69', { seed: 41, angle: -1.45, edge: 5, jitter: 2, baseAlpha: 0.45 });
  D.shape(paramo2Pts, '#c8b36a', { seed: 42, angle: -1.5, edge: 6, jitter: 3, alpha: 0.55, soft: true, rim: false });
  // parcelas de la sabana
  for (const f of fields) {
    if (!D.visible(f.x + f.w / 2, f.y + f.h / 2, Math.max(f.w, f.h))) continue;
    D.save(); D.translate(f.x + f.w / 2, f.y + f.h / 2); D.rotate(f.rot);
    D.shape(rectPts(-f.w / 2, -f.h / 2, f.w, f.h, 3), f.color, { seed: f.seed, angle: f.angle, edge: 3, jitter: 1.5, smooth: false, alpha: 0.9, rimAlpha: 0.2 });
    if (D.ps > 0.5) {
      for (let k = 1; k < 5; k++) D.stroke([[-f.w / 2 + 6, -f.h / 2 + (k * f.h) / 5], [f.w / 2 - 6, -f.h / 2 + (k * f.h) / 5]], shade(f.color, -0.25), 1.2, { seed: f.seed + k, alpha: 0.45 });
    }
    D.restore();
  }
  // zona seca del potrero
  const dryK = 1 - clamp((t - 21) / 6);
  if (D.visible(1200, 1830, 520)) {
    const dz = D.shape(dryZone, '#d9ae6c', { seed: 45, angle: -0.4, edge: 6, jitter: 3, alpha: 0.95 });
    if (dryK < 0.99) D.fill(dz, '#b9bf78', { seed: 46, angle: -1.05, edge: 6, alpha: 1 - dryK, rim: false });
    if (dryK > 0.02 && D.ps > 0.35) {
      for (let i = 0; i < cracks.length; i++) D.stroke(cracks[i], '#8a5f33', 1.5, { seed: 500 + i, alpha: 0.75 * dryK, smooth: false });
    }
  }
}

// bosque: unión de todas las manchas visibles (sin costuras internas).
// Se pinta la silueta en una máscara fuera de pantalla y luego se "rellena" con la textura.
let maskC = null;
function maskCanvas(D) {
  if (!maskC) maskC = [createCanvas(D.W, D.H), createCanvas(D.W, D.H)];
  return maskC;
}
function textureUnion(D, circles, color, o) {
  const [mc] = maskCanvas(D);
  const g = mc.getContext('2d');
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, D.W, D.H);
  g.fillStyle = '#000';
  for (const p of circles) g.fill(p);
  g.globalCompositeOperation = 'source-in';
  if (o.knock) { g.fillStyle = o.knock; g.fillRect(0, 0, D.W, D.H); g.globalCompositeOperation = 'source-atop'; }
  g.fillStyle = rgba(color, o.baseAlpha ?? 0.22);
  g.fillRect(0, 0, D.W, D.H);
  g.fillStyle = D._pat(color, { seed: o.seed, angle: o.angle, anchor: D.P(0, 0) }, o.soft ? 'soft' : 'fill');
  g.fillRect(0, 0, D.W, D.H);
  D.ctx.globalAlpha = o.alpha ?? 1;
  D.ctx.drawImage(mc, 0, 0);
  D.ctx.globalAlpha = 1;
}

export function drawForestFloor(D, t) {
  const view = viewRect(D);
  const halo = [], body = [], inner = [];
  const grow = 7 / D.cam.z;
  for (let i = 0; i < forestCells.length; i++) {
    const c = forestCells[i];
    const r = cellRadius(c, t);
    if (r < 1) continue;
    if (c.x + r < view[0] || c.x - r > view[2] || c.y + r < view[1] || c.y - r > view[3]) continue;
    halo.push(D.path(ellipsePts(c.x, c.y, r + grow, (r + grow) * 0.82, 14, 0, 0.12, i), { seed: i + 1, jitter: 3 }));
    body.push(D.path(ellipsePts(c.x, c.y, r, r * 0.82, 14, 0, 0.12, i), { seed: i, jitter: 1.5 }));
    if (c.band === 'crown' || c.band === 'trunk' || c.t0 < 0) inner.push(D.path(ellipsePts(c.x, c.y + r * 0.1, r * 0.8, r * 0.62, 12, 0, 0.1, i + 3), { seed: i + 7, jitter: 1.5 }));
  }
  if (!body.length) return;
  textureUnion(D, halo, '#5d8a4c', { seed: 59, angle: -0.2, soft: true, alpha: 0.75 });
  textureUnion(D, body, '#5d8a4c', { seed: 60, angle: -0.2, knock: '#e9e0c8', baseAlpha: 0.5 });
  const ia = 0.5 * clamp((1.3 - D.cam.z) / 0.7);
  if (inner.length && ia > 0.01) textureUnion(D, inner, '#4a7843', { seed: 61, angle: -0.62, alpha: ia, baseAlpha: 0 });
}

export function viewRect(D) {
  const z = D.cam.z;
  const hw = D.W / 2 / z + 60, hh = D.H / 2 / z + 60;
  return [D.cam.x - hw, D.cam.y - hh, D.cam.x + hw, D.cam.y + hh];
}

export function drawGroundDetails(D, t) {
  if (D.cam.z < 0.55) return;
  const view = viewRect(D);
  const dryK = 1 - clamp((t - 21) / 6);
  for (const [x, y, s, i, dry] of tufts) {
    if (x < view[0] || x > view[2] || y < view[1] || y > view[3]) continue;
    if (dry && dryK < 0.05) continue;
    D.ctx.globalAlpha = 1;
    drawTuft(D, x, y, s, i, dry ? '#c2a257' : '#9f9148');
  }
  for (const [x, y, s] of rocks) drawRock(D, x, y, s, Math.round(x));
}

// ---------------------------------------------------------------- quebradas
function ribbon(poly, s0, s1, widthFn, step) {
  const L = [], R = [];
  const n = Math.max(2, Math.ceil((s1 - s0) / step));
  for (let i = 0; i <= n; i++) {
    const s = lerp(s0, s1, i / n);
    const p = poly.at(s);
    const w = widthFn(s) / 2;
    L.push([p.x + p.nx * w, p.y + p.ny * w]);
    R.push([p.x - p.nx * w, p.y - p.ny * w]);
  }
  return L.concat(R.reverse());
}

export function drawRivers(D, t) {
  const view = viewRect(D);
  const z = D.cam.z;
  for (const e of riverList) {
    // recorte rápido
    let vis = false;
    for (let i = 0; i < e.pts.length; i += 4) {
      const [x, y] = e.pts[i];
      if (x > view[0] - 60 && x < view[2] + 60 && y > view[1] - 60 && y < view[3] + 60) { vis = true; break; }
    }
    if (!vis) continue;
    const poly = e.poly;
    const Ltot = poly.length;
    const hero = e.name === 'L1';
    const front = hero ? Math.min(frontS(t), Ltot) : Ltot;
    const gm = gapWidthMul(t);
    const wFn = (s) => {
      let w = lerp(e.w0, e.w1, s / Ltot) * (1 + 0.12 * noise1(s / 40, e.w0));
      if (hero && s > sGap0 - 80) w *= lerp(1, gm, clamp((s - (sGap0 - 80)) / 80));
      if (hero) w *= clamp((front - s) / 70);
      // nacimiento: empieza finito
      if (!e.root) w *= clamp(s / 60 + 0.25);
      else w *= clamp((Ltot - s) / 50 + 0.2);
      return Math.max(0, w);
    };
    const step = Math.max(10, 16 / z);
    // cauce seco (solo quebrada de la gota)
    if (hero && front < Ltot) {
      const s0 = Math.max(front - 40, sGap0 - 60);
      const bed = ribbon(poly, s0, Ltot, (s) => lerp(e.w0, e.w1, s / Ltot) * 0.95 + 6, step);
      D.shape(bed, '#caa672', { seed: 80, angle: -0.3, edge: 3, jitter: 1.2, alpha: 0.9, rimAlpha: 0.8 });
      if (z > 0.5) {
        for (let s = s0 + 10; s < Ltot - 10; s += 26) {
          const p = poly.at(s);
          D.stroke([[p.x - p.nx * 5, p.y - p.ny * 5], [p.x + p.tx * 6, p.y + p.ty * 6], [p.x + p.nx * 4 + p.tx * 12, p.y + p.ny * 4 + p.ty * 12]], '#7b5431', 1.3, { seed: 81 + s, alpha: 0.7, smooth: false });
        }
      }
    }
    const sEnd = hero ? Math.min(front, Ltot) : Ltot;
    if (sEnd <= 2) continue;
    const pts = ribbon(poly, 0, sEnd, wFn, step);
    const wScreen = e.w1 * z;
    // orilla húmeda
    const bank = ribbon(poly, 0, sEnd, (s) => wFn(s) + 10, step);
    D.shape(bank, '#7f8a5a', { seed: 90 + e.w0, angle: -0.5, edge: 3, alpha: 0.45, rim: false, base: false });
    D.shape(pts, '#6aa6d6', { seed: 100 + e.w0, angle: -0.25, edge: wScreen > 6 ? 3 : 1.5, knock: '#dbe8ee', rimAlpha: 0.5, jitter: 0.9 });
    // corrientes (trazos claros que bajan)
    if (wScreen > 5) {
      const ctx = D.ctx;
      for (const off of [-0.22, 0.18]) {
        const cl = [];
        const n = Math.ceil(sEnd / step);
        for (let i = 0; i <= n; i++) {
          const s = (i / n) * sEnd;
          const p = poly.at(s);
          const w = wFn(s);
          cl.push([p.x + p.nx * w * off, p.y + p.ny * w * off]);
        }
        const path = D.path(cl, { closed: false, seed: 110, jitter: 0.6 });
        ctx.save();
        ctx.setLineDash([22 * z, 30 * z]);
        ctx.lineDashOffset = -t * 70 * z * (off > 0 ? 1 : 1.3);
        D.line(path, '#e9f5fb', 2.2, { alpha: 0.85, seed: 111 });
        ctx.restore();
      }
    }
  }
  // pozo del nacimiento
  const [px, py] = PLACES.pool;
  if (D.visible(px, py, 80)) {
    D.shape(ellipsePts(px, py + 4, 46, 16, 16, 0, 0.1, 5), '#7f8a5a', { seed: 120, alpha: 0.5, edge: 3, rim: false });
    D.shape(ellipsePts(px, py, 38, 12, 16, 0, 0.08, 6), '#72b0dc', { seed: 121, knock: '#dbe8ee', angle: -0.2 });
    D.shape(ellipsePts(px - 10, py - 3, 14, 3, 10), '#e9f5fb', { seed: 122, alpha: 0.7, edge: 1, rim: false });
  }
}
