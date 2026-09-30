// La quebrada: lecho de piedras, lámina de agua con reflejo del cielo, corrientes que
// bajan, espuma en las cascadas. El nivel del agua cambia con la historia (waterK).
import { W, H } from '../timeline.js';
import { clamp, lerp, mix, shade, noise1, hrand, mulberry32, ease } from '../core/math.js';
import { bed, streamZ, STREAM_W, FALLS, ground } from './geo.js';
import { ellipsePts } from '../core/pencil.js';

const HALF = STREAM_W / 2;
const CH = 160; // tramo por objeto

// env.water(x) → 0..1 caudal en ese punto
export function addStream(stage, cam, env, t) {
  const d0 = streamZ(cam.x) - cam.z;
  const [xa, xb] = cam.xRange(Math.max(d0 - HALF, cam.near + 10), 300);
  const c0 = Math.floor(xa / CH), c1 = Math.ceil(xb / CH);
  for (let c = c0; c <= c1; c++) {
    const x0 = c * CH, x1 = x0 + CH;
    const zc = streamZ(x0 + CH / 2);
    const d = zc - cam.z;
    if (d < cam.near + 20) continue;
    stage.add(d, (D) => drawChunk(D, cam, env, t, x0, x1), { sortD: stage.zc - cam.z, bias: 0, tag: 'water' });
  }
}

// ancho irregular de la quebrada (orillas orgánicas)
export function bankWob(x, side) {
  return 1 + 0.16 * noise1(x / 70 + side * 13, 21) + 0.08 * noise1(x / 23 + side * 7, 22);
}
function edgePts(cam, x0, x1, off, lift, wk) {
  const pts = [];
  for (let x = x0; x <= x1 + 0.1; x += 8) {
    const z = streamZ(x) + off * wk(x) * (off ? bankWob(x, Math.sign(off)) : 1);
    const p = cam.project(x, bed(x) + lift, z);
    if (p) pts.push([p[0], p[1], p[2], x]);
  }
  return pts;
}

function drawChunk(D, cam, env, t, x0, x1) {
  const wf = env.water || (() => 1);
  // lecho (siempre visible: piedras y barro; seco se ve agrietado)
  const bedFar = edgePts(cam, x0, x1, HALF * 0.95, 1, () => 1);
  const bedNear = edgePts(cam, x0, x1, -HALF * 0.95, 1, () => 1);
  if (bedFar.length < 2 || bedNear.length < 2) return;
  const dryK = 1 - clamp(wf((x0 + x1) / 2) * 3);
  const bedCol = mix('#6f6a55', '#a88a5c', dryK * (env.dryBed ?? 1));
  const poly = bedFar.map((p) => [p[0], p[1]]).concat(bedNear.slice().reverse().map((p) => [p[0], p[1]]));
  // sin bordes en los lados del tramo (no se notan las costuras entre tramos)
  D.shape(poly, bedCol, { seed: 700, anchor: [0, 0], smooth: false, edge: 0, angle: 0.3, knock: true, jitter: 0, still: true });
  D.stroke(bedNear.map((p) => [p[0], p[1]]), shade(bedCol, -0.3), 2, { seed: 705 + (x0 / CH | 0), alpha: 0.5 });
  // piedritas del lecho
  const r = mulberry32(x0 * 7 + 3);
  for (let k = 0; k < 7; k++) {
    const x = x0 + r() * CH, f = r() * 1.8 - 0.9;
    const z = streamZ(x) + f * HALF;
    const p = cam.project(x, bed(x) + 2, z);
    if (!p) continue;
    const s = p[2] * (5 + r() * 9);
    if (s < 1.5) continue;
    D.shape(ellipsePts(p[0], p[1], s, s * 0.55, 8, 0, 0.2, k), r() < 0.5 ? '#8c8a7c' : '#6d6a5e', { seed: x0 + k, edge: 1.5, knock: true });
  }
  // agua
  const full = (x) => clamp(wf(x));
  let any = false;
  for (let x = x0; x <= x1; x += 40) if (full(x) > 0.02) any = true;
  if (!any) return;
  const wk = (x) => 0.15 + 0.85 * ease.outQuad(full(x));
  const far = edgePts(cam, x0, x1, HALF * 0.86, 6, wk);
  const near = edgePts(cam, x0, x1, -HALF * 0.86, 6, wk);
  // recorta donde no hay agua (frente de avance)
  const keep = (p) => full(p[3]) > 0.02;
  const fa = far.filter(keep), ne = near.filter(keep);
  if (fa.length < 2 || ne.length < 2) return;
  const wpoly = fa.map((p) => [p[0], p[1]]).concat(ne.slice().reverse().map((p) => [p[0], p[1]]));
  const deep = env.waterDeep || '#4f8fbf', sky = env.waterSky || '#b8e0f2';
  const wp = D.shape(wpoly, deep, { seed: 720, anchor: [0, 0], smooth: false, edge: 0, angle: 0.15, knock: true, jitter: 0, still: true });
  D.stroke(ne.map((p) => [p[0], p[1]]), shade(deep, -0.3), 2.2, { seed: 725 + (x0 / CH | 0), alpha: 0.6 });
  D.stroke(fa.map((p) => [p[0], p[1]]), '#e8f4fa', 1.8, { seed: 726 + (x0 / CH | 0), alpha: 0.5 });
  // reflejo del cielo en la mitad lejana
  const mid = edgePts(cam, x0, x1, 0, 6, wk).filter(keep);
  if (mid.length >= 2) {
    const rp = fa.map((p) => [p[0], p[1]]).concat(mid.slice().reverse().map((p) => [p[0], p[1] + 2]));
    D.shadeIn(wp, rp, sky, { seed: 740, anchor: [0, 0], alpha: 0.85, angle: 0.1, smooth: false, jitter: 0 });
  }
  // caídas: donde el lecho baja en picada, el agua es espuma blanca con chorros que bajan
  for (let x = x0; x < x1; x += 8) {
    const sl = (bed(x + 8) - bed(x)) / 8;
    if (sl > -0.9 || full(x) < 0.2) continue;
    const q = [];
    for (const [xx, off] of [[x, HALF * 0.86], [x + 8, HALF * 0.86], [x + 8, -HALF * 0.86], [x, -HALF * 0.86]]) {
      const z = streamZ(xx) + off * wk(xx);
      const p = cam.project(xx, bed(xx) + 6, z);
      if (p) q.push([p[0], p[1]]);
    }
    if (q.length === 4) D.shape(q, '#e8f5fb', { seed: 760 + (x / 8 | 0), smooth: false, edge: 1.5, alpha: 0.92 * full(x), rim: false, baseAlpha: 0.8 });
  }
  // corrientes: trazos blancos que bajan con el agua
  const speed = env.flowSpeed ?? 260;
  const rr = mulberry32(x0 * 13 + 1);
  const n = 7;
  for (let k = 0; k < n; k++) {
    const f = rr() * 1.5 - 0.75;
    const len = 30 + rr() * 50;
    const ph = rr() * CH;
    let xs = x0 + ((ph + t * speed * (0.8 + rr() * 0.4)) % CH);
    if (full(xs) < 0.3) continue;
    const pts = [];
    for (let q = 0; q < 4; q++) {
      const x = xs + (q / 3) * len;
      const z = streamZ(x) + f * HALF * 0.8 * wk(x);
      const p = cam.project(x, bed(x) + 7, z);
      if (p) pts.push([p[0], p[1]]);
    }
    if (pts.length < 2) continue;
    const s = cam.project(xs, bed(xs), streamZ(xs))?.[2] ?? 1;
    D.stroke(pts, '#f4fbff', Math.max(1.2, Math.min(4, s * 3)), { seed: x0 + k * 3, alpha: 0.75 * full(xs), abs: true });
  }
  // espuma en las cascadas del tramo
  for (const [fx, h, w] of FALLS) {
    if (fx < x0 - w || fx > x1 + w) continue;
    const k = full(fx);
    if (k < 0.15) continue;
    drawFoam(D, cam, t, fx, h, w, k);
  }
}

function drawFoam(D, cam, t, fx, h, w, k) {
  const xb = fx + w * 0.6;
  const yb = bed(xb) + 6;
  const r = mulberry32(fx);
  // chorros: trazos cortos que caen por la cara de la cascada (animados)
  for (let i = 0; i < 12; i++) {
    const f = (i / 11) * 1.6 - 0.8;
    const z = streamZ(fx) + f * HALF * 0.75;
    const ph = (t * 2.2 + hrand(fx, i)) % 1;
    const u0 = ph * 0.8, u1 = Math.min(1, u0 + 0.35);
    const pts = [];
    for (let q = 0; q <= 3; q++) {
      const u = lerp(u0, u1, q / 3);
      const x = fx - w * 0.5 + u * w * 1.1;
      const p = cam.project(x, bed(x) + 8, z);
      if (p) pts.push([p[0], p[1]]);
    }
    if (pts.length > 1) D.stroke(pts, i % 3 ? '#ffffff' : '#bfe0f0', 2.8, { seed: fx + i, alpha: 0.85 * k });
  }
  // espuma abajo: burbujas que hierven
  for (let i = 0; i < 12; i++) {
    const f = r() * 1.6 - 0.8;
    const x = xb + r() * 60;
    const z = streamZ(x) + f * HALF * 0.8;
    const p = cam.project(x, yb + 2 + r() * 6, z);
    if (!p) continue;
    const s = p[2] * (6 + r() * 10) * (0.8 + 0.3 * Math.sin(t * 9 + i));
    D.shape(ellipsePts(p[0], p[1], s, s * 0.6, 8, 0, 0.25, i), '#f6fbff', { seed: fx + 30 + i, edge: 2, alpha: 0.85 * k, rim: false });
  }
  // rocío: gotitas que saltan
  for (let i = 0; i < 8; i++) {
    const ph = ((t * 1.6 + i / 8) % 1);
    const x = xb + (r() - 0.3) * 50 + ph * 30;
    const z = streamZ(x) + (r() * 1.6 - 0.8) * HALF;
    const y = yb + Math.sin(ph * Math.PI) * (20 + r() * 25);
    const p = cam.project(x, y, z);
    if (!p) continue;
    const s = Math.max(1.2, p[2] * 2.2);
    D.shape(ellipsePts(p[0], p[1], s, s, 6), '#ffffff', { seed: fx + 60 + i, edge: 0, alpha: 0.8 * k * Math.sin(ph * Math.PI), baseAlpha: 0.9 });
  }
}
