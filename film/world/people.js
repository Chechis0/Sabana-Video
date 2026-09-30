// La comunidad sembradora: campesinas y campesinos con ruana y sombrero, niñas y niños.
// Vista lateral (3/4) mirando a la derecha (dir=1). Unidades ≈ cm.
// p = { x, y (pantalla, pies), s (px/unidad), dir, pose, ph, hold, ruana, hat, hatCol, skin, hair,
//       braids, kid, mood, lookUp, eyes, lean, kneel, canTilt, wave }
import { ellipsePts, rectPts } from '../core/pencil.js';
import { clamp, lerp, ease, noise1, hrand, shade, mix } from '../core/math.js';
import { drawSapling, castShadow } from './flora.js';

const INK = '#1f1714';

function limb(D, a, b, c, col, w, seed, o = {}) {
  D.stroke([a, b, c], col, w, { seed, alpha: 1, ...o });
}

export function drawPerson(D, p, t) {
  const seed = p.seed || 1;
  const kid = !!p.kid;
  const S = p.s;
  const Hh = kid ? 124 : 166;
  const px = Hh * S;
  const detail = px > 700 ? 3 : px > 260 ? 2 : px > 90 ? 1 : 0;
  D.save();
  D.translate(p.x, p.y);
  D.scale(S * (p.dir || 1), S);
  const ph = p.ph || 0;
  const pose = p.pose || 'stand';
  const legL = kid ? 44 : 68, torso = kid ? 40 : 60, headR = kid ? 16.5 : 13;
  const walk = pose === 'walk' ? 1 : 0;
  const jump = pose === 'cheer' ? Math.max(0, Math.sin(ph)) * 16 : 0;
  const kneel = pose === 'kneel' || pose === 'plant' ? clamp(p.kneel ?? 1) : 0;
  const bob = walk * Math.abs(Math.sin(ph)) * 3 + jump;
  const lean = (p.lean ?? 0) + kneel * 0.38 + (pose === 'dig' ? 0.12 + 0.08 * Math.sin(ph) : 0);
  // sombra
  castShadow(D, kid ? 22 : 28, 6, seed, 0.3, '#2a321e', 1);
  D.translate(0, -bob);
  const pants = p.pants || '#3b3a4a', boot = '#2a211d';
  const hipY = -legL + kneel * legL * 0.42;
  const hipX = -kneel * 6;
  // piernas: [cadera, rodilla, pie]
  const legs = [];
  for (const side of [-1, 1]) {
    const sw = Math.sin(ph + (side > 0 ? 0 : Math.PI)) * 13 * walk;
    let knee, foot;
    if (kneel > 0) {
      if (side > 0) { knee = [hipX + 22, hipY + legL * 0.3]; foot = [hipX + 24, 0]; } // rodilla adelante, pie apoyado
      else { knee = [hipX + 6, -3]; foot = [hipX - 22, -2]; } // rodilla en el suelo
      knee = [lerp(hipX + side * 3, knee[0], kneel), lerp(hipY + legL * 0.5, knee[1], kneel)];
      foot = [lerp(side * 4 + sw, foot[0], kneel), lerp(0, foot[1], kneel)];
    } else {
      const lift = Math.max(0, Math.cos(ph + (side > 0 ? 0 : Math.PI))) * 6 * walk;
      foot = [side * 4 + sw, -lift];
      knee = [side * 2 + sw * 0.5 + 3, hipY + legL * 0.5 - lift * 0.5];
    }
    legs.push({ side, hip: [hipX + side * 4, hipY], knee, foot });
  }
  const drawLeg = (l, far) => {
    const c = far ? shade(pants, -0.25) : pants;
    limb(D, l.hip, l.knee, l.foot, c, kid ? 11.5 : 14, seed + l.side);
    D.shape(ellipsePts(l.foot[0] + 5, l.foot[1] - 3.5, kid ? 8.5 : 10, 5, 10), far ? '#1d1714' : boot, { seed: seed + 5 + l.side, edge: 1.5, knock: true });
  };
  drawLeg(legs[0], true);
  // torso y cabeza con inclinación
  D.save();
  D.translate(hipX, hipY);
  D.rotate(lean);
  const shY = -torso;
  // brazos: posiciones de manos según la pose
  let hn, hf; // mano cercana, mano lejana (relativas al hombro)
  const sh = [2, shY + 9];
  if (pose === 'walk') { hn = [10 + Math.sin(ph) * 8, shY + 44]; hf = [-6 - Math.sin(ph) * 8, shY + 44]; }
  else if (pose === 'kneel' || pose === 'plant') {
    const r = pose === 'plant' ? 0.5 + 0.5 * Math.sin(ph) : 0.5;
    hn = [26 + r * 6, shY + 48 + r * 8]; hf = [20 + r * 4, shY + 46 + r * 6];
  } else if (pose === 'dig') { const k = (Math.sin(ph) + 1) / 2; hn = [20, shY + 20 + k * 22]; hf = [14, shY + 30 + k * 20]; }
  else if (pose === 'cheer') { const w = Math.sin(ph * 2) * 6; hn = [14 + w, shY - 34]; hf = [-10 - w, shY - 32]; }
  else if (pose === 'wave') { const w = Math.sin(ph * 2.2) * 10; hn = [18 + w, shY - 30]; hf = [4, shY + 40]; }
  else if (pose === 'hold') { hn = [20, shY + 34]; hf = [15, shY + 36]; }
  else if (pose === 'offer') { hn = [30, shY + 18]; hf = [26, shY + 20]; }
  else { hn = [8, shY + 44]; hf = [-4, shY + 44]; }
  const ru = p.ruana || '#3f7f9a';
  const arm = (h, far) => {
    const el = [lerp(sh[0], h[0], 0.5) + (far ? -4 : 6), lerp(sh[1], h[1], 0.5) + 4];
    limb(D, sh, el, h, far ? shade(ru, -0.25) : shade(ru, -0.08), kid ? 10 : 11.5, seed + (far ? 21 : 20));
    D.shape(ellipsePts(h[0], h[1], kid ? 4.6 : 5.2, kid ? 4.6 : 5.2, 10), far ? shade(p.skin || '#b07a52', -0.2) : p.skin || '#b07a52', { seed: seed + (far ? 23 : 22), edge: 1.5, knock: true });
  };
  arm(hf, true);
  // ruana: trapecio con flecos y franjas
  const ruTop = shY - 2, ruBot = shY + (kid ? 40 : 50);
  const ruPts = [[-10, ruTop], [12, ruTop], [kid ? 26 : 30, ruBot], [kid ? 16 : 20, ruBot + 5], [kid ? -18 : -22, ruBot + 5], [kid ? -24 : -28, ruBot]];
  const rp = D.shape(ruPts, ru, { seed: seed + 10, knock: true, angle: -1.2, smooth: false, jitter: 0.8, edge: 3 });
  if (detail >= 1) {
    D.shadeIn(rp, rectPts(-40, ruBot - 14, 80, 5, 2), shade(ru, -0.35), { seed: seed + 11, angle: 0, smooth: false });
    D.shadeIn(rp, rectPts(-40, ruBot - 7, 80, 3, 2), shade(ru, 0.4), { seed: seed + 12, angle: 0, smooth: false });
    D.shadeIn(rp, [[-40, ruTop], [2, ruTop], [2, ruBot + 10], [-40, ruBot + 10]], shade(ru, -0.3), { seed: seed + 13, alpha: 0.5, angle: -1.3, smooth: false });
  }
  if (detail >= 2) {
    for (let k = 0; k < 9; k++) {
      const x = lerp(kid ? -22 : -26, kid ? 22 : 26, k / 8);
      D.stroke([[x, ruBot + 3], [x + 1, ruBot + 10]], shade(ru, -0.2), 1.6, { seed: seed + 30 + k, alpha: 0.8 });
    }
  }
  // cuello y cabeza
  const hx = 6, hy = shY - headR - 2;
  const lookUp = p.lookUp || 0;
  D.save();
  D.translate(hx, hy);
  D.rotate(-lean * 0.5 - lookUp * 0.35);
  drawHead(D, p, t, headR, detail, seed, kid, pose);
  D.restore();
  // brazo cercano y objeto
  arm(hn, false);
  drawHeld(D, p, hn, hf, pose, ph, seed, t, detail);
  D.restore();
  drawLeg(legs[1], false);
  D.restore();
}

function drawHead(D, p, t, R, detail, seed, kid, pose) {
  const skin = p.skin || '#b07a52';
  const hair = p.hair || '#2a1c16';
  // pelo de atrás (cae hasta la nuca) y trenzas
  D.shape(ellipsePts(-R * 0.3, -R * 0.05, R * 0.85, R * 1.02, 14), hair, { seed: seed + 52, knock: true });
  if (p.braids) {
    const sw = 2 * Math.sin(t * 2 + seed);
    D.stroke([[-R * 0.6, -R * 0.2], [-R * 0.9, R * 0.9], [-R * 0.7 + sw, R * 2.1]], hair, R * 0.42, { seed: seed + 51 });
    if (detail >= 2) {
      for (let k = 0; k < 4; k++) D.stroke([[-R * 0.95, R * (0.4 + k * 0.4)], [-R * 0.55, R * (0.55 + k * 0.4)]], shade(hair, 0.25), 1.2, { seed: seed + 60 + k, alpha: 0.7 });
      D.shape(ellipsePts(-R * 0.7 + sw, R * 2.15, R * 0.22, R * 0.14, 8), p.ribbon || '#e0503a', { seed: seed + 64, edge: 1 });
    }
  }
  // cara
  const face = D.shape(ellipsePts(0, 0, R, R * 1.08, 18, 0, 0.02, seed), skin, { seed: seed + 50, knock: true, angle: -0.9, edge: 2 });
  // nariz (perfil 3/4)
  D.shape([[R * 0.88, -R * 0.12], [R * 1.12, R * 0.22], [R * 0.9, R * 0.3]], skin, { seed: seed + 53, knock: true, edge: 1.4, smooth: true });
  if (detail >= 1) D.shadeIn(face, ellipsePts(-R * 0.55, R * 0.15, R * 0.6, R * 1.1, 10), shade(skin, -0.2), { seed: seed + 54, alpha: 0.6 });
  // oreja
  if (detail >= 1) D.shape(ellipsePts(-R * 0.25, R * 0.05, R * 0.2, R * 0.28, 8), shade(skin, -0.1), { seed: seed + 55, edge: 1, knock: true });
  // pelo de arriba (flequillo)
  D.shape([[-R * 1.05, R * 0.2], [-R * 1.0, -R * 0.75], [0, -R * 1.14], [R * 0.85, -R * 0.66], [R * 0.98, -R * 0.3], [R * 0.55, -R * 0.42], [R * 0.2, -R * 0.62], [-R * 0.25, -R * 0.4], [-R * 0.55, -R * 0.1]], hair, { seed: seed + 56, knock: true, edge: 2 });
  if (detail >= 2) for (let k = 0; k < 4; k++) D.stroke([[-R * 0.6 + k * R * 0.35, -R * 1.02 + Math.abs(k - 1.5) * R * 0.08], [-R * 0.4 + k * R * 0.38, -R * 0.55]], shade(hair, 0.3), 1.2, { seed: seed + 66 + k, alpha: 0.6 });
  // ojos
  const eo = p.eyes ?? (hrand(Math.floor(t * 1.3), seed) < 0.08 ? 0.15 : 1);
  const mood = p.mood || (pose === 'cheer' ? 'joy' : 'smile');
  const ex = R * 0.5, ey = -R * 0.05;
  if (mood === 'joy' && detail >= 1) {
    D.stroke([[ex - R * 0.18, ey + R * 0.05], [ex, ey - R * 0.14], [ex + R * 0.18, ey + R * 0.05]], INK, detail >= 2 ? 2 : 1.4, { seed: seed + 57 });
  } else if (eo > 0.3) {
    const er = R * (detail >= 2 ? 0.14 : 0.12);
    D.shape(ellipsePts(ex, ey, er, er * 1.35 * eo, 10), INK, { seed: seed + 57, edge: 0.6, baseAlpha: 1, dense: true });
    if (detail >= 2) D.shape(ellipsePts(ex - er * 0.3, ey - er * 0.5, er * 0.38, er * 0.38, 6), '#ffffff', { seed: seed + 58, edge: 0, baseAlpha: 1 });
    // ojo lejano (3/4)
    if (detail >= 2) D.shape(ellipsePts(ex - R * 0.62, ey, er * 0.75, er * 1.2 * eo, 8), INK, { seed: seed + 59, edge: 0.5, baseAlpha: 1, alpha: 0.85 });
  } else {
    D.stroke([[ex - R * 0.15, ey], [ex + R * 0.15, ey]], INK, 1.4, { seed: seed + 57 });
  }
  if (detail >= 2) {
    // cejas
    D.stroke([[ex - R * 0.2, ey - R * 0.32], [ex + R * 0.2, ey - R * 0.36]], hair, 1.6, { seed: seed + 61, alpha: 0.9 });
    // mejilla
    D.shape(ellipsePts(ex - R * 0.05, R * 0.32, R * 0.22, R * 0.13, 8), '#e07a6a', { seed: seed + 62, edge: 1.5, alpha: 0.55, rim: false });
    // boca
    if (mood === 'joy') D.shape([[R * 0.45, R * 0.52], [R * 0.82, R * 0.5], [R * 0.66, R * 0.72]], '#7a2f35', { seed: seed + 63, edge: 1, smooth: false });
    else if (mood === 'sad') D.stroke([[R * 0.5, R * 0.62], [R * 0.64, R * 0.56], [R * 0.78, R * 0.62]], INK, 1.3, { seed: seed + 63 });
    else D.stroke([[R * 0.5, R * 0.52], [R * 0.64, R * 0.6], [R * 0.8, R * 0.52]], INK, 1.4, { seed: seed + 63 });
  } else if (detail === 1) {
    D.shape(ellipsePts(ex, R * 0.35, R * 0.18, R * 0.1, 6), '#e07a6a', { seed: seed + 62, edge: 1, alpha: 0.5, rim: false });
  }
  // sombrero
  if (p.hat) {
    const hc = p.hatCol || (p.hat === 'straw' ? '#e3cf9a' : '#4a3a30');
    D.shape(ellipsePts(R * 0.05, -R * 0.78, R * 1.75, R * 0.36, 16), hc, { seed: seed + 70, knock: true, angle: -0.3 });
    D.shape([[-R * 0.85, -R * 0.8], [-R * 0.75, -R * 1.75], [0, -R * 1.98], [R * 0.75, -R * 1.75], [R * 0.85, -R * 0.8]], hc, { seed: seed + 71, knock: true, angle: -1.2 });
    D.shape(rectPts(-R * 0.84, -R * 1.18, R * 1.68, R * 0.28, 2), p.hatBand || '#3b2a22', { seed: seed + 72, edge: 1 });
    if (detail >= 2 && p.hat === 'straw') for (let k = 0; k < 5; k++) D.stroke([[-R * 0.7 + k * R * 0.35, -R * 1.7], [-R * 0.75 + k * R * 0.37, -R * 0.9]], shade(hc, -0.2), 1, { seed: seed + 73 + k, alpha: 0.5 });
  }
}

function drawHeld(D, p, hn, hf, pose, ph, seed, t, detail) {
  if (p.hold === 'shovel') {
    const [hx, hy] = hn;
    const ang = pose === 'dig' ? 1.25 + Math.sin(ph) * 0.12 : 1.4;
    const L = 70;
    const ex = hx + Math.cos(ang) * L * 0.6, ey = hy + Math.sin(ang) * L * 0.6;
    D.stroke([[hx - Math.cos(ang) * L * 0.4, hy - Math.sin(ang) * L * 0.4], [ex, ey]], '#8a6238', 3.6, { seed: seed + 80 });
    D.save(); D.translate(ex, ey); D.rotate(ang - Math.PI / 2);
    D.shape([[-8, 0], [8, 0], [7, 16], [0, 22], [-7, 16]], '#8b8f95', { seed: seed + 81, smooth: false, knock: true });
    D.restore();
  } else if (p.hold === 'seedling') {
    D.save(); D.translate((hn[0] + hf[0]) / 2 + 3, Math.max(hn[1], hf[1]) + 6);
    drawBagSeedling(D, seed + 90, t, detail, p.seedlingG ?? 1);
    D.restore();
  } else if (p.hold === 'can') {
    D.save(); D.translate(hn[0] + 6, hn[1] + 4);
    D.rotate((p.canTilt || 0) * 0.9);
    D.shape(rectPts(-11, -4, 24, 20, 2), '#5f9bb5', { seed: seed + 91, knock: true, angle: -0.62 });
    D.stroke([[13, 3], [29, -11]], '#5f9bb5', 3.6, { seed: seed + 92 });
    D.shape(ellipsePts(30, -12, 4.5, 3.4, 8, -0.6), '#4f86a0', { seed: seed + 93, edge: 1 });
    D.stroke([[-9, -4], [0, -13], [10, -4]], '#4f86a0', 2.2, { seed: seed + 94 });
    D.restore();
  }
}

// plántula en bolsa negra (vivero)
export function drawBagSeedling(D, seed, t, detail = 1, g = 1) {
  D.shape([[-10, 0], [-11.5, -17], [-6, -19], [6, -18], [11.5, -17], [10, 0]], '#2a2624', { seed, smooth: true, knock: true, edge: 1.6, jitter: 0.5 });
  D.shape(ellipsePts(0, -17.5, 10, 2.6, 10), '#4a3526', { seed: seed + 6, edge: 1, knock: true });
  if (detail >= 2) D.stroke([[-10, -8], [-2, -9], [10, -7]], '#4a4442', 1.2, { seed: seed + 5, alpha: 0.7 });
  D.save(); D.translate(0, -17);
  drawSapling(D, 0.3 + 0.35 * g, seed + 1, t, { noSoil: true, scale: 0.8 });
  D.restore();
}

// ------------------------------------------------------------------ colibrí
export function drawHummingbird(D, h, t) {
  D.save();
  D.translate(h.x, h.y);
  D.scale((h.dir || 1) * h.s, h.s);
  D.rotate(h.tilt || 0);
  const seed = 812;
  const wf = Math.floor(t * 48) % 3;
  const wa = [-1.1, -0.2, 0.5][wf];
  // ala trasera (borrosa)
  D.shape(ellipsePts(-2 + Math.cos(wa) * 15, -8 + Math.sin(wa) * 15, 17, 5.5, 10, wa), '#d2ebe4', { seed: seed + wf, alpha: 0.55, edge: 2, rim: false });
  D.shape([[-12, 2], [-28, 9], [-26, 0], [-29, -3]], '#1f5e4e', { seed: seed + 3, smooth: false, knock: true });
  const body = D.shape(ellipsePts(0, 0, 15, 8.5, 14, -0.15), '#3fa078', { seed: seed + 4, knock: true, angle: -0.8 });
  D.shadeIn(body, ellipsePts(-2, -5, 12, 4, 10), '#7fd0a0', { seed: seed + 11, alpha: 0.8 });
  D.shape(ellipsePts(6, 3.5, 7.5, 4.8, 10), '#d8386a', { seed: seed + 5, edge: 1.5 }); // gorguera iridiscente
  D.shape(ellipsePts(11, -3, 7, 6.5, 12), '#3a9070', { seed: seed + 6, knock: true });
  D.stroke([[16, -3], [40, 1]], '#1d1a19', 2.2, { seed: seed + 7 });
  D.shape(ellipsePts(13, -5, 1.8, 1.8, 6), '#111111', { seed: seed + 8, edge: 0, baseAlpha: 1 });
  D.shape(ellipsePts(12.6, -5.6, 0.6, 0.6, 5), '#ffffff', { seed: seed + 12, edge: 0, baseAlpha: 1 });
  const wb = [0.6, -0.4, -1.3][wf];
  D.shape(ellipsePts(-3 + Math.cos(wb) * 14, -6 + Math.sin(wb) * 14, 16, 5.5, 10, wb), '#e8f6f2', { seed: seed + 9 + wf, alpha: 0.7, edge: 2, rim: false });
  D.restore();
}

// ------------------------------------------------------------------ fauna menor
export function drawButterfly(D, x, y, s, t, seed, col = '#f0b43c') {
  const f = Math.abs(Math.sin(t * 16 + seed));
  D.save(); D.translate(x, y); D.scale(s);
  D.shape(ellipsePts(-6 * f, -3, 7 * f + 1, 6, 8), col, { seed, edge: 1.5 });
  D.shape(ellipsePts(6 * f, -3, 7 * f + 1, 6, 8), shade(col, -0.12), { seed: seed + 1, edge: 1.5 });
  D.stroke([[0, -7], [0, 4]], '#2a2220', 1.5, { seed: seed + 2 });
  D.restore();
}

export function drawBird(D, x, y, s, t, seed, col = '#3a3431') {
  const f = Math.sin(t * 14 + seed);
  D.stroke([[x - 12 * s, y - f * 6 * s], [x - 5 * s, y - 2 * s], [x, y + 1 * s], [x + 5 * s, y - 2 * s], [x + 12 * s, y - f * 6 * s]], col, 2, { seed, alpha: 0.9 });
}

export function drawHeart(D, x, y, s, a, seed = 3) {
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const u = (i / 24) * Math.PI * 2;
    pts.push([16 * Math.pow(Math.sin(u), 3) * s * 0.6, -(13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u)) * s * 0.6]);
  }
  D.save(); D.translate(x, y);
  D.shape(pts, '#e0605a', { seed, alpha: a, edge: 2.5 });
  D.restore();
}
