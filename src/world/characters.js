// Personajes: la Gota, la osa andina y su osezno, el colibrí, la comunidad sembradora.
import { ellipsePts, rectPts } from '../core/pencil.js';
import { clamp, lerp, ease, noise1, hrand, shade } from '../core/math.js';

// ------------------------------------------------------------------ la Gota
// st: {x,y (base), s (tamaño), sx, sy (squash), rot, eyes (0..1 abiertos), look [dx,dy], mood, alpha}
export function dropShape(n = 30) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    // gota clásica: punta arriba, panza redonda
    const x = Math.sin(t) * Math.pow(Math.sin(t / 2), 1.15) * 1.02;
    const y = -Math.cos(t);
    pts.push([x * 21, -(23 - y * 23)]);
  }
  return pts;
}
const DROP = dropShape();

export function drawDrop(D, st, t) {
  if (!st || st.alpha <= 0.01) return;
  D.save();
  D.translate(st.x, st.y);
  D.rotate(st.rot || 0);
  const S0 = (st.s || 1) * 1.18;
  D.scale(S0 * (st.sx || 1), S0 * (st.sy || 1));
  const a = st.alpha ?? 1;
  const seed = 4242;
  // sombrita
  if (st.shadow !== false) D.shape(ellipsePts(0, 1, 16, 4, 10), '#3d6f96', { alpha: 0.25 * a, edge: 2, base: false, rim: false, seed });
  const body = D.shape(DROP, '#93cbee', { seed, knock: a > 0.95, angle: -0.35, edge: 3.2, alpha: a, jitter: 0.9, rimAlpha: 0.6 });
  // volumen: sombra abajo-derecha
  D.shadeIn(body, ellipsePts(9, -8, 20, 16, 14, 0.4), '#5f9fd4', { seed: seed + 1, alpha: 0.8 * a, angle: -0.8 });
  // brillo
  D.shape(ellipsePts(-9, -27, 4.4, 8.5, 10, 0.35), '#ffffff', { seed: seed + 2, edge: 1.4, alpha: 0.9 * a, rim: false, baseAlpha: 0.7 });
  D.shape(ellipsePts(-11.5, -14.5, 1.9, 1.9, 7), '#ffffff', { seed: seed + 3, edge: 0, alpha: 0.9 * a, baseAlpha: 0.8 });
  // cara
  const [lx, ly] = st.look || [0, 0];
  const eo = clamp(st.eyes ?? 1);
  const mood = st.mood || 'neutral';
  const ex = 6.8, ey = -17 + ly * 2.2;
  const cx = lx * 3.2;
  const eyeCol = '#262431';
  for (const side of [-1, 1]) {
    const px = cx + side * ex, py = ey;
    if (mood === 'joy' && eo > 0.5) {
      // ojitos felices ^ ^
      D.stroke([[px - 3.6, py + 1.2], [px, py - 2.6], [px + 3.6, py + 1.2]], eyeCol, 2.4, { seed: seed + 10 + side, alpha: a, abs: false });
    } else if (eo < 0.15) {
      D.stroke([[px - 3.4, py + 0.5], [px, py + 1.8], [px + 3.4, py + 0.5]], eyeCol, 2.1, { seed: seed + 12 + side, alpha: a });
    } else {
      const eh = 4.6 * eo;
      D.shape(ellipsePts(px, py, 3.1, eh, 10), eyeCol, { seed: seed + 14 + side, edge: 1, alpha: a, baseAlpha: 0.95, dense: true });
      if (eo > 0.5) D.shape(ellipsePts(px - 1 + lx * 0.6, py - eh * 0.45, 1.1, 1.1, 6), '#ffffff', { seed: seed + 16 + side, edge: 0, alpha: a, baseAlpha: 0.95 });
    }
    if (mood === 'sad') {
      // cejas tristes
      D.stroke([[px + side * 3.8, py - 5.2], [px - side * 3.2, py - 8.2]], eyeCol, 1.5, { seed: seed + 18 + side, alpha: 0.85 * a });
    }
  }
  // mejillas
  D.shape(ellipsePts(cx - 12, ey + 6.5, 3.4, 2, 8), '#f09a92', { seed: seed + 20, edge: 1.5, alpha: 0.55 * a, rim: false });
  D.shape(ellipsePts(cx + 12, ey + 6.5, 3.4, 2, 8), '#f09a92', { seed: seed + 21, edge: 1.5, alpha: 0.55 * a, rim: false });
  // boca
  const my = ey + 7.5;
  if (mood === 'joy') {
    D.shape([[cx - 4, my - 1], [cx + 4, my - 1], [cx + 2.6, my + 3.2], [cx - 2.6, my + 3.2]], '#7a2f35', { seed: seed + 22, edge: 1, alpha: a });
  } else if (mood === 'happy') {
    D.stroke([[cx - 3, my], [cx, my + 2.2], [cx + 3, my]], eyeCol, 1.6, { seed: seed + 23, alpha: a });
  } else if (mood === 'sad') {
    D.stroke([[cx - 2.8, my + 1.8], [cx, my + 0.2], [cx + 2.8, my + 1.8]], eyeCol, 1.5, { seed: seed + 24, alpha: a });
  } else if (mood === 'o') {
    D.shape(ellipsePts(cx, my + 1, 1.8, 2.3, 8), '#7a2f35', { seed: seed + 25, edge: 1, alpha: a });
  } else {
    D.stroke([[cx - 2, my + 0.8], [cx + 2, my + 0.8]], eyeCol, 1.4, { seed: seed + 26, alpha: a });
  }
  // gotita de sudor (sequía)
  if (st.sweat) {
    const k = st.sweat;
    D.shape(ellipsePts(19, -34 + k * 8, 2.4, 3.6, 8), '#bfe3f7', { seed: seed + 30, edge: 1.2, alpha: a * clamp(1.4 - k) });
  }
  D.restore();
}

// ------------------------------------------------------------------ oso andino (de anteojos)
// b: {x,y,dir(1 derecha / -1 izquierda), s, walk (fase), moving (0..1), headDip (0..1), look (-1..1), sit(0..1)}
export function drawBear(D, b, t) {
  if (!D.visible(b.x, b.y - 60 * b.s, 140 * b.s)) return;
  const seed = b.seed || 61;
  D.save();
  D.translate(b.x, b.y);
  D.scale(b.s * (b.dir || 1), b.s);
  const fur = '#2e2825', fur2 = '#3d3530', cream = '#e6d3a8';
  const ph = b.walk || 0, mv = b.moving ?? 0;
  const sit = b.sit || 0;
  const bob = Math.abs(Math.sin(ph)) * 3 * mv;
  // sombra
  D.shape(ellipsePts(0, 2, 70, 10, 12), '#2f3a22', { alpha: 0.3, edge: 3, base: false, rim: false, seed });
  const leg = (x0, phase, far) => {
    const sw = Math.sin(ph + phase) * 14 * mv;
    const lift = Math.max(0, Math.cos(ph + phase)) * 6 * mv;
    const col = far ? '#231e1b' : fur;
    D.shape([[x0 - 10, -34], [x0 + 10, -34], [x0 + 9 + sw * 0.6, -6 - lift], [x0 + 11 + sw, -lift], [x0 - 9 + sw, -lift], [x0 - 9 + sw * 0.6, -6 - lift]], col, { seed: seed + x0, knock: true, angle: -1.3, edge: 2.5, jitter: 0.7 });
  };
  const bodyY = -44 - bob + sit * 6;
  if (sit < 0.5) {
    leg(-36, Math.PI, true);
    leg(34, 0, true);
  }
  // cuerpo
  D.save();
  D.translate(0, bodyY);
  D.rotate(-sit * 0.5);
  const body = D.shape(ellipsePts(0, 0, 58, 34, 20, 0.04, 0.05, seed), fur, { seed: seed + 1, knock: true, angle: -1.0, edge: 3, jitter: 1 });
  D.shadeIn(body, ellipsePts(-8, -18, 44, 14, 14), '#57493f', { seed: seed + 2, alpha: 0.55, angle: -0.5 });
  // colita
  D.shape(ellipsePts(-58, -8, 7, 6, 8), fur2, { seed: seed + 3, knock: true });
  D.restore();
  if (sit < 0.5) {
    leg(-30, 0, false);
    leg(40, Math.PI, false);
  } else {
    // sentado: patas traseras recogidas y delanteras rectas
    D.shape(ellipsePts(-26, -14, 26, 16, 12), fur, { seed: seed + 40, knock: true });
    D.shape([[26, -40], [42, -40], [44, 0], [26, 0]], fur, { seed: seed + 41, knock: true, smooth: false });
  }
  // cabeza
  const dip = b.headDip || 0;
  const hx = 52 + dip * 10, hy = -64 - bob + dip * 44 - sit * 26;
  D.save();
  D.translate(hx, hy);
  D.rotate(dip * 0.55 + (b.headTilt || 0));
  // orejas
  D.shape(ellipsePts(-12, -26, 8.5, 8, 10), fur, { seed: seed + 5, knock: true });
  D.shape(ellipsePts(10, -27, 8.5, 8, 10), fur, { seed: seed + 6, knock: true });
  const head = D.shape(ellipsePts(0, -4, 28, 25, 18, 0, 0.05, seed + 7), fur, { seed: seed + 7, knock: true, angle: -1.1, edge: 3 });
  // "anteojos" color crema alrededor de los ojos y hocico
  D.shadeIn(head, [[4, -18], [16, -22], [26, -14], [30, -2], [22, 6], [12, 0], [8, -8]], cream, { seed: seed + 8, angle: -0.6 });
  D.shape(ellipsePts(26, 6, 15, 11, 14, -0.1), cream, { seed: seed + 9, knock: true, angle: -0.8 }); // hocico
  D.shape(ellipsePts(38, 2, 6, 5, 10), '#1c1716', { seed: seed + 10, edge: 1.5 }); // nariz
  D.stroke([[30, 11], [36, 13], [40, 10]], '#3d2b25', 1.4, { seed: seed + 11, alpha: 0.8 });
  // ojo
  const lk = b.look || 0;
  const eo = b.eyes ?? 1;
  if (eo > 0.2) {
    D.shape(ellipsePts(14 + lk * 2, -10, 3.4, 3.8 * eo, 8), '#140f0e', { seed: seed + 12, edge: 1, dense: true });
    D.shape(ellipsePts(13 + lk * 2, -11.5, 1.2, 1.2, 6), '#ffffff', { seed: seed + 13, edge: 0, baseAlpha: 0.9 });
  } else {
    D.stroke([[10, -9], [14, -7], [18, -9]], '#140f0e', 1.8, { seed: seed + 14 });
  }
  D.restore();
  // pechera crema
  D.shape(ellipsePts(46, -38 - bob - sit * 20, 10, 8, 10, 0.4), cream, { seed: seed + 15, alpha: 0.9, edge: 2 });
  D.restore();
}

// ------------------------------------------------------------------ colibrí
export function drawHummingbird(D, h, t) {
  if (!D.visible(h.x, h.y, 60)) return;
  D.save();
  D.translate(h.x, h.y);
  D.scale((h.dir || 1) * (h.s || 1), h.s || 1);
  D.rotate(h.tilt || 0);
  const seed = 812;
  // alas vibrando (dos posiciones)
  const wf = Math.floor(t * 48) % 2;
  const wa = wf ? -0.9 : 0.3;
  D.shape(ellipsePts(-2 + Math.cos(wa) * 14, -8 + Math.sin(wa) * 14, 16, 5, 10, wa), '#cfe6e0', { seed: seed + wf, alpha: 0.6, edge: 2, rim: false });
  // cola
  D.shape([[-12, 2], [-26, 8], [-24, -1]], '#2b6b5a', { seed: seed + 3, smooth: false });
  // cuerpo
  D.shape(ellipsePts(0, 0, 14, 8, 14, -0.15), '#3f9c74', { seed: seed + 4, knock: true, angle: -0.8 });
  D.shape(ellipsePts(6, 3, 7, 4.5, 10), '#c43d63', { seed: seed + 5, edge: 1.5 }); // garganta
  D.shape(ellipsePts(10, -3, 6.5, 6, 10), '#3a8f6c', { seed: seed + 6, knock: true });
  D.stroke([[15, -3], [36, 1]], '#1d1a19', 2, { seed: seed + 7 });
  D.shape(ellipsePts(12, -5, 1.6, 1.6, 6), '#111111', { seed: seed + 8, edge: 0, baseAlpha: 1 });
  // ala delantera
  const wb = wf ? 0.5 : -1.2;
  D.shape(ellipsePts(-3 + Math.cos(wb) * 13, -6 + Math.sin(wb) * 13, 15, 5, 10, wb), '#e4f2ee', { seed: seed + 9 + wf, alpha: 0.7, edge: 2, rim: false });
  D.restore();
}

// ------------------------------------------------------------------ sembradores
// p: {x,y,dir,s,ruana,hat,skin,pose:'walk'|'dig'|'stand'|'cheer'|'kneel', ph, hold:'shovel'|'seedling'|'can'|null, kid}
export function drawPerson(D, p, t) {
  if (!D.visible(p.x, p.y - 60 * p.s, 110 * p.s)) return;
  const seed = p.seed || 1;
  D.save();
  D.translate(p.x, p.y);
  D.scale(p.s * (p.dir || 1), p.s);
  const ph = p.ph || 0;
  const pose = p.pose || 'stand';
  const walk = pose === 'walk' ? 1 : 0;
  const jump = pose === 'cheer' ? Math.max(0, Math.sin(ph)) * 18 : 0;
  const kneel = pose === 'kneel' || pose === 'dig' ? (p.kneelK ?? 1) : 0;
  const bob = walk * Math.abs(Math.sin(ph)) * 3 + jump;
  D.shape(ellipsePts(0, 1, 26, 6, 10), '#394026', { alpha: 0.3, edge: 3, base: false, rim: false, seed });
  D.translate(0, -bob);
  // piernas
  const pants = '#3b3a4a';
  const hipY = -44 + kneel * 16;
  for (const side of [-1, 1]) {
    const sw = Math.sin(ph + (side > 0 ? 0 : Math.PI)) * 10 * walk;
    const fx = side * 7 + sw + kneel * (side > 0 ? 12 : -4);
    const fy = kneel && side < 0 ? -4 : 0;
    D.stroke([[side * 6, hipY], [fx * 0.7 + (kneel && side > 0 ? 10 : 0), hipY + 22 - kneel * 12], [fx, fy - 2]], pants, 8, { seed: seed + side, alpha: 1 });
    D.shape(ellipsePts(fx + 3, fy - 2, 7, 3.6, 8), '#2a211d', { seed: seed + 5 + side, edge: 1.5 });
  }
  // ruana (trapecio con franjas)
  const ruY0 = -86 + kneel * 16, ruY1 = -36 + kneel * 14;
  const ru = [[-13, ruY0], [13, ruY0], [26, ruY1], [18, ruY1 + 4], [-18, ruY1 + 4], [-26, ruY1]];
  const rp = D.shape(ru, p.ruana, { seed: seed + 10, knock: true, angle: -1.2, smooth: false, jitter: 0.9 });
  const stripe = shade(p.ruana, -0.3), stripe2 = shade(p.ruana, 0.35);
  D.shadeIn(rp, rectPts(-30, ruY1 - 12, 60, 5, 2), stripe, { seed: seed + 11, angle: 0 });
  D.shadeIn(rp, rectPts(-30, ruY1 - 5, 60, 3, 2), stripe2, { seed: seed + 12, angle: 0 });
  // brazos (según la pose)
  const skin = p.skin || '#b07a52';
  let hand = [22, -52];
  let hand2 = [-20, -52];
  if (pose === 'walk') { hand = [16 + Math.sin(ph) * 4, -48 + kneel * 10]; hand2 = [-16 - Math.sin(ph) * 4, -48]; }
  if (pose === 'dig') {
    const k = (Math.sin(ph) + 1) / 2;
    hand = [20, -70 + k * 30 + kneel * 12]; hand2 = [14, -62 + k * 28 + kneel * 12];
  }
  if (pose === 'kneel') { hand = [24, -30]; hand2 = [18, -32]; }
  if (pose === 'cheer') { const w = Math.sin(ph * 2) * 5; hand = [18 + w, -120]; hand2 = [-18 - w, -120]; }
  if (pose === 'stand') { hand = [18, -44]; hand2 = [-18, -44]; }
  const sh = [0, ruY0 + 8];
  D.stroke([[sh[0] + 8, sh[1]], [lerp(sh[0], hand[0], 0.5) + 6, lerp(sh[1], hand[1], 0.5)], hand], p.ruana, 7, { seed: seed + 20 });
  D.stroke([[sh[0] - 8, sh[1]], [lerp(sh[0], hand2[0], 0.5) - 6, lerp(sh[1], hand2[1], 0.5)], hand2], shade(p.ruana, -0.12), 7, { seed: seed + 21 });
  D.shape(ellipsePts(hand[0], hand[1], 4.5, 4.5, 8), skin, { seed: seed + 22, edge: 1.5, knock: true });
  D.shape(ellipsePts(hand2[0], hand2[1], 4.5, 4.5, 8), skin, { seed: seed + 23, edge: 1.5, knock: true });
  // herramienta
  if (p.hold === 'shovel') {
    const [hx, hy] = hand;
    const ang = pose === 'dig' ? 1.2 + Math.sin(ph) * 0.15 : 1.35;
    const L = 58;
    const ex = hx + Math.cos(ang) * L * 0.55, ey = hy + Math.sin(ang) * L * 0.55;
    D.stroke([[hx - Math.cos(ang) * L * 0.4, hy - Math.sin(ang) * L * 0.4], [ex, ey]], '#8a6238', 3.4, { seed: seed + 30 });
    D.save(); D.translate(ex, ey); D.rotate(ang - Math.PI / 2);
    D.shape([[-7, 0], [7, 0], [6, 14], [0, 19], [-6, 14]], '#8b8f95', { seed: seed + 31, smooth: false, knock: true });
    D.restore();
  } else if (p.hold === 'seedling') {
    D.save(); D.translate(hand[0] + 2, hand[1] + 16); D.scale(0.8);
    drawBagSeedlingMini(D, seed + 40, t);
    D.restore();
  } else if (p.hold === 'can') {
    // regadera (se inclina: ¡está vacía!)
    D.save(); D.translate(hand[0] + 6, hand[1] + 6);
    D.rotate((p.canTilt || 0) * 0.9);
    D.shape(rectPts(-10, -4, 22, 18, 2), '#5f9bb5', { seed: seed + 41, knock: true, angle: -0.62 });
    D.stroke([[12, 2], [26, -10]], '#5f9bb5', 3.4, { seed: seed + 42 });
    D.shape(ellipsePts(27, -11, 4, 3, 7, -0.6), '#4f86a0', { seed: seed + 43, edge: 1 });
    D.stroke([[-8, -4], [0, -12], [9, -4]], '#4f86a0', 2, { seed: seed + 44 });
    D.restore();
  }
  // cabeza
  const hy = ruY0 - 10;
  D.shape(ellipsePts(0, hy, 11, 12, 12), skin, { seed: seed + 50, knock: true, angle: -0.9 });
  // pelo (trenzas para la niña)
  if (p.braids) {
    D.stroke([[-9, hy - 2], [-12, hy + 10], [-11, hy + 20]], '#2a1c16', 4, { seed: seed + 51 });
    D.stroke([[9, hy - 2], [12, hy + 10], [11, hy + 20]], '#2a1c16', 4, { seed: seed + 52 });
  }
  D.shape([[-11, hy - 3], [-10, hy - 10], [0, hy - 13], [10, hy - 10], [11, hy - 3], [4, hy - 7], [-4, hy - 7]], '#2a1c16', { seed: seed + 53, knock: true });
  // ojos
  const blink = hrand(Math.floor(t * 1.3), seed) < 0.1 ? 0.2 : 1;
  const happy = pose === 'cheer';
  if (happy) {
    D.stroke([[2, hy - 1], [4, hy - 3], [6, hy - 1]], '#1f1714', 1.5, { seed: seed + 54 });
    D.stroke([[-6, hy - 1], [-4, hy - 3], [-2, hy - 1]], '#1f1714', 1.5, { seed: seed + 55 });
  } else {
    D.shape(ellipsePts(4.5, hy - 1, 1.5, 2 * blink, 6), '#1f1714', { seed: seed + 54, edge: 0.5, baseAlpha: 1 });
    D.shape(ellipsePts(-3.5, hy - 1, 1.5, 2 * blink, 6), '#1f1714', { seed: seed + 55, edge: 0.5, baseAlpha: 1 });
    if (p.sad) {
      D.stroke([[2, hy - 6], [6.5, hy - 4.5]], '#1f1714', 1.2, { seed: seed + 57 });
      D.stroke([[-6, hy - 4.5], [-1.5, hy - 6]], '#1f1714', 1.2, { seed: seed + 58 });
    }
  }
  D.shape(ellipsePts(7, hy + 4, 2.6, 1.6, 6), '#e0826f', { seed: seed + 56, edge: 1, alpha: 0.6, rim: false });
  // sombrero
  if (p.hat) {
    D.shape(ellipsePts(0, hy - 10, 21, 5, 14), p.hat, { seed: seed + 60, knock: true, angle: -0.3 });
    D.shape([[-10, hy - 10], [-9, hy - 22], [0, hy - 25], [9, hy - 22], [10, hy - 10]], p.hat, { seed: seed + 61, knock: true, angle: -1.2 });
    D.shape(rectPts(-10, hy - 15, 20, 3.5, 2), '#3b2a22', { seed: seed + 62, edge: 1 });
  }
  D.restore();
}

function drawBagSeedlingMini(D, seed, t) {
  D.shape([[-8, 0], [-9, -14], [9, -14], [8, 0]], '#2e2a28', { seed, smooth: false, knock: true });
  D.stroke([[0, -14], [0, -26]], '#5d8a3a', 2, { seed: seed + 1 });
  D.shape(ellipsePts(-5, -25, 6, 2.6, 8, 0.4), '#7fb24f', { seed: seed + 2, edge: 1.5 });
  D.shape(ellipsePts(5, -28, 6, 2.6, 8, -0.4), '#6a9f45', { seed: seed + 3, edge: 1.5 });
}

// ------------------------------------------------------------------ fauna menor
export function drawBird(D, x, y, s, t, seed, col = '#3a3431') {
  if (!D.visible(x, y, 30 * s)) return;
  const f = Math.sin(t * 14 + seed);
  D.stroke([[x - 12 * s, y - f * 6 * s], [x - 5 * s, y - 2 * s], [x, y + 1 * s], [x + 5 * s, y - 2 * s], [x + 12 * s, y - f * 6 * s]], col, 2, { seed, alpha: 0.9 });
}

export function drawButterfly(D, x, y, s, t, seed, col = '#f0b43c') {
  if (!D.visible(x, y, 20 * s)) return;
  const f = Math.abs(Math.sin(t * 16 + seed));
  D.save(); D.translate(x, y); D.scale(s);
  D.shape(ellipsePts(-5 * f, -3, 6 * f + 1, 5, 8), col, { seed, edge: 1.5 });
  D.shape(ellipsePts(5 * f, -3, 6 * f + 1, 5, 8), shade(col, -0.1), { seed: seed + 1, edge: 1.5 });
  D.stroke([[0, -6], [0, 3]], '#2a2220', 1.5, { seed: seed + 2 });
  D.restore();
}

export function drawHeart(D, x, y, s, a, seed = 3) {
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const u = (i / 24) * Math.PI * 2;
    pts.push([16 * Math.pow(Math.sin(u), 3) * s * 0.6, -(13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u)) * s * 0.6]);
  }
  D.save(); D.translate(x, y);
  D.shape(pts, '#e0605a', { seed, alpha: a, knock: false, edge: 2.5 });
  D.restore();
}
