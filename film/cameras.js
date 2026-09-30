// Cámaras de cada plano. Un encuadre se define por: un punto del mundo (tx,ty,tz) que debe
// verse en (sx,sy) de la pantalla, la distancia d, la focal f y la altura del horizonte lensY.
import { Cam } from './engine/camera.js';
import { W, H } from './timeline.js';
import { clamp, lerp, ease, prog, noise1, spring } from './core/math.js';
import { pchip } from './core/interp.js';
import { T, X, zAt, gy, dropState, dropX, heroTip, seedSpot } from './story.js';
import { bed, ground } from './world/geo.js';

export function frame(o) {
  const f = o.f ?? 1000, d = o.d;
  let lensY = o.lensY ?? H * 0.5;
  const x = o.tx - (o.sx - W / 2) * d / f;
  let y = o.ty - (lensY - o.sy) * d / f;
  // la cámara nunca queda bajo tierra: si hace falta, sube el horizonte
  const z = o.tz - d;
  const gmin = ground(x, z) + (o.minH ?? 14);
  if (y < gmin) { y = gmin; lensY = o.sy + (o.ty - y) * f / d; }
  return new Cam({ x, y, z, f, lensY, focus: o.focus ?? d, aperture: o.ap ?? 0, roll: o.roll ?? 0 });
}

// interpolación suave (PCHIP) de encuadres clave: keys = [[t, {...}], ...]
function keyed(keys) {
  const ts = keys.map((k) => k[0]);
  const names = Object.keys(keys[0][1]);
  const fns = {};
  for (const n of names) fns[n] = pchip(ts, keys.map((k) => k[1][n]));
  return (t) => { const o = {}; for (const n of names) o[n] = fns[n](t); return o; };
}

const dropAt = (t) => { const d = dropState(t); return d ? { x: d.x, y: d.y + 23 * (d.s || 1), z: d.z } : null; };

// temblor de cámara en mano, muy leve
function handheld(c, t, k = 1) {
  c.x += noise1(t * 0.8, 91) * 1.6 * k * (c.focus / 400);
  c.y += noise1(t * 0.7, 92) * 1.6 * k * (c.focus / 400);
  return c;
}

// ------------------------------------------------------------------ A · páramo (0–6 s): macro → caída → revelación
const tip = heroTip();
const A = keyed([
  [0.0, { dx: -30, dy: 10, d: 130, sy: 860, lensY: 1480, ap: 2.6, f: 1000 }],
  [2.6, { dx: -10, dy: 4, d: 108, sy: 880, lensY: 1450, ap: 2.6, f: 1000 }],
  [3.35, { dx: 0, dy: 0, d: 112, sy: 820, lensY: 1300, ap: 2.6, f: 1000 }],
  [3.85, { dx: 0, dy: 0, d: 140, sy: 1100, lensY: 700, ap: 2.6, f: 1000 }],
  [4.4, { dx: 10, dy: 0, d: 170, sy: 1180, lensY: 620, ap: 2.2, f: 1000 }],
  [5.2, { dx: 120, dy: 0, d: 900, sy: 1480, lensY: 820, ap: 0.6, f: 1000 }],
  [6.0, { dx: 260, dy: 0, d: 1300, sy: 1500, lensY: 860, ap: 0.4, f: 1000 }],
]);
function camA(t) {
  const k = A(t);
  const d = dropAt(Math.max(t, 0.2)) || { x: tip.x, y: tip.y, z: tip.z };
  // durante la caída la cámara persigue a la gota con algo de retraso
  const c = frame({ tx: d.x + k.dx, ty: d.y + k.dy, tz: d.z, sx: W / 2, sy: k.sy, d: k.d, f: k.f, lensY: k.lensY, ap: k.ap, focus: k.d });
  return handheld(c, t, 0.6);
}

// ------------------------------------------------------------------ B · bosque y llegada al potrero (6–13 s)
const B = keyed([
  [6.0, { d: 520, sx: 470, sy: 1250, lensY: 860, ap: 0.9, lead: 0 }],
  [7.6, { d: 420, sx: 470, sy: 1260, lensY: 880, ap: 1.0, lead: 0 }],
  [8.4, { d: 300, sx: 440, sy: 1230, lensY: 900, ap: 1.3, lead: 0 }],
  [9.2, { d: 320, sx: 460, sy: 1240, lensY: 900, ap: 1.2, lead: 0 }],
  [10.2, { d: 420, sx: 360, sy: 1330, lensY: 900, ap: 1.0, lead: 0 }],
  [11.4, { d: 440, sx: 400, sy: 1330, lensY: 890, ap: 1.0, lead: 0 }],
  [12.3, { d: 620, sx: 360, sy: 1350, lensY: 820, ap: 0.6, lead: 0 }],
  [13.0, { d: 520, sx: 440, sy: 1330, lensY: 800, ap: 0.8, lead: 0 }],
]);
// suavizado de la x de la cámara (sigue a la gota sin sacudirse en las cascadas)
function smoothDropX(t, w = 0.35) {
  let s = 0, n = 0;
  for (let k = -3; k <= 3; k++) { const x = dropX(clamp(t + k * w / 3, T.slide[1], 40)); if (x != null) { s += x; n++; } }
  return s / n;
}
function camB(t) {
  const k = B(t);
  const x = smoothDropX(t);
  const d = dropAt(t);
  const c = frame({ tx: x, ty: bed(x, false) + 30, tz: zAt(x, 0), sx: k.sx, sy: k.sy, d: k.d, lensY: k.lensY, ap: k.ap, focus: k.d });
  return handheld(c, t);
}

// ------------------------------------------------------------------ D · primer plano de la evaporación
function camD(t) {
  const u = ease.inOut(prog(t, T.evap[0], T.evap[1]));
  const x = X.stuck, y = bed(x) + 20;
  return handheld(frame({ tx: x, ty: y, tz: zAt(x, 0), sx: 540, sy: lerp(1150, 1180, u), d: lerp(200, 150, u), lensY: lerp(600, 520, u), ap: 2.0 }), t, 0.5);
}
// ------------------------------------------------------------------ E · separados (gran plano general)
function camE(t) {
  const u = ease.inOut(prog(t, T.apart[0], T.apart[1]));
  // el osezno en primer plano mira a la osa, lejos, al otro lado del potrero
  const x = X.cubEdge, off = -300;
  const focus = lerp(430, 2000, ease.inOut(prog(t, T.apart[0] + 0.5, T.apart[0] + 1.1)));
  return handheld(frame({ tx: x, ty: gy(x, off) + 40, tz: zAt(x, off), sx: lerp(300, 290, u), sy: 1520, d: lerp(470, 430, u), lensY: 900, ap: 1.1, focus }), t, 0.4);
}
// ------------------------------------------------------------------ F · la niña
// de la gota (primer plano) a la niña (contrapicado, a contraluz) y foco al fondo: llega la comunidad
const F = keyed([
  [16.5, { w: 0, d: 160, sx: 540, sy: 1200, lensY: 800, ap: 2.2, focus: 160 }],
  [17.0, { w: 0, d: 160, sx: 540, sy: 1230, lensY: 820, ap: 2.2, focus: 160 }],
  [17.7, { w: 1, d: 175, sx: 540, sy: 1400, lensY: 1650, ap: 1.8, focus: 175 }],
  [18.3, { w: 1, d: 180, sx: 540, sy: 1400, lensY: 1650, ap: 1.8, focus: 180 }],
  [18.8, { w: 1, d: 190, sx: 620, sy: 1400, lensY: 1650, ap: 1.4, focus: 900 }],
  [19.2, { w: 1, d: 195, sx: 640, sy: 1400, lensY: 1650, ap: 1.2, focus: 950 }],
]);
function camF(t) {
  const k = F(t);
  // del primer plano de la gota a un plano bajo de la gota y la niña, juntas
  const x0 = X.stuck, g = { x: X.stuck + 40, off: 18 };
  const tx = lerp(x0, g.x, k.w), tz = lerp(zAt(x0, 0), zAt(g.x, g.off), k.w);
  const ty = lerp(bed(x0) + 20, gy(g.x, g.off) + 40, k.w);
  return handheld(frame({ tx, ty, tz, sx: k.sx, sy: k.sy, d: k.d, lensY: k.lensY, ap: k.ap, focus: k.focus }), t, 0.6);
}
// ------------------------------------------------------------------ G · sembrar (travelling lateral)
function camG(t) {
  const u = prog(t, 19.2, T.lapse[0]);
  const x = lerp(4420, 5840, ease.inOutSine(u) * 0.3 + u * 0.7);
  return handheld(frame({ tx: x, ty: bed(x, false) + 60, tz: zAt(x, 0), sx: 540, sy: 1330, d: 600, lensY: 900, ap: 0.7 }), t, 0.5);
}
// ------------------------------------------------------------------ H · el tiempo (fijo, gran plano general)
function camH(t) {
  const u = prog(t, T.lapse[0], T.lapse[1]);
  const x = 5200;
  return frame({ tx: x, ty: bed(x, false) + 120, tz: zAt(x, 250), sx: 540, sy: 1240, d: lerp(2700, 2600, u), lensY: 780, ap: 0.2, focus: 2600 });
}
// ------------------------------------------------------------------ I · la lluvia llega
function camI(t) {
  return handheld(camH(T.lapse[1]), t, 1.2);
}
// ------------------------------------------------------------------ J · la lluvia recarga a la gota
function camJ(t) {
  const x = X.stuck;
  const u = ease.inOut(prog(t, 26.9, T.flow + 0.4));
  return handheld(frame({ tx: x, ty: bed(x) + 20, tz: zAt(x, 0), sx: 540, sy: 1180, d: lerp(200, 170, u), lensY: 820, ap: 2.0 }), t, 0.7);
}
// ------------------------------------------------------------------ K · el agua vuelve y el reencuentro
const Kk = keyed([
  [28.6, { d: 400, sx: 480, sy: 1330, lensY: 880, ap: 1.0, w: 1 }],
  [29.4, { d: 440, sx: 470, sy: 1330, lensY: 860, ap: 0.9, w: 1 }],
  [29.9, { d: 440, sx: 540, sy: 1400, lensY: 880, ap: 0.9, w: 0 }],
  [32.0, { d: 470, sx: 540, sy: 1400, lensY: 870, ap: 0.8, w: 0 }],
]);
function camK(t) {
  const k = Kk(t);
  const xd = smoothDropX(t, 0.3);
  const x = lerp(X.meet, xd, k.w);
  const off = lerp(X.meetOff, 0, k.w);
  return handheld(frame({ tx: x, ty: gy(x, off) + 50, tz: zAt(x, off), sx: k.sx, sy: k.sy, d: k.d, lensY: k.lensY, ap: k.ap, focus: k.d }), t);
}
// ------------------------------------------------------------------ L · río abajo y el huerto
const L = keyed([
  [32.0, { d: 520, sx: 420, sy: 1320, lensY: 820, ap: 0.8, w: 1 }],
  [33.0, { d: 700, sx: 420, sy: 1280, lensY: 820, ap: 0.7, w: 1 }],
  [33.5, { d: 360, sx: 540, sy: 1300, lensY: 860, ap: 1.1, w: 0 }],
  [35.0, { d: 320, sx: 540, sy: 1320, lensY: 880, ap: 1.2, w: 0 }],
]);
function camL(t) {
  const k = L(t);
  const G = seedSpot();
  const xd = t < T.leap[0] ? smoothDropX(t, 0.3) : G.x;
  const x = lerp(G.x - 60, xd, k.w);
  const z = lerp(G.z + 60, zAt(x, 0), k.w);
  return handheld(frame({ tx: x, ty: gy(x, lerp(-200, 0, k.w)) + 60, tz: z, sx: k.sx, sy: k.sy, d: k.d, lensY: k.lensY, ap: k.ap, focus: k.d }), t);
}
// ------------------------------------------------------------------ M · subida a las nubes
function camM(t) {
  const u = ease.inCubic(prog(t, T.rise[0], T.rise[1]));
  const G = seedSpot();
  const x = G.x + 200 * u;
  return frame({ tx: x, ty: G.y + 60 + 9000 * u, tz: G.z + 60, sx: 540, sy: lerp(1260, 960, u), d: lerp(460, 3000, u), lensY: lerp(900, 1500, u), ap: 1.0 * (1 - u), focus: 460 });
}

export const SHOTS = [
  { name: 'paramo', t: [0, 6.0], cam: camA },
  { name: 'bosque', t: [6.0, 13.0], cam: camB },
  { name: 'evapora', t: [13.0, 15.1], cam: camD },
  { name: 'separados', t: [15.1, 16.5], cam: camE },
  { name: 'nina', t: [16.5, 19.2], cam: camF },
  { name: 'siembra', t: [19.2, 23.0], cam: camG },
  { name: 'tiempo', t: [23.0, 26.0], cam: camH },
  { name: 'lluvia', t: [26.0, 26.9], cam: camI },
  { name: 'recarga', t: [26.9, 28.6], cam: camJ },
  { name: 'reencuentro', t: [28.6, 32.0], cam: camK },
  { name: 'huerto', t: [32.0, 35.0], cam: camL },
  { name: 'subida', t: [35.0, 36.1], cam: camM },
  { name: 'mapa', t: [36.1, 41.01], cam: null },
];
export function shotAt(t) {
  for (const s of SHOTS) if (t >= s.t[0] && t < s.t[1]) return s;
  return SHOTS[SHOTS.length - 1];
}
