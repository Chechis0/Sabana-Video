// Composición de cada cuadro: cámara, coreografía de personajes, efectos y textos.
import { createCanvas } from '@napi-rs/canvas';
import { Pencil, ellipsePts, rectPts } from './core/pencil.js';
import { makePaper, makeTooth, makeVignette } from './core/paper.js';
import { clamp, lerp, ease, prog, spring, noise1, hrand, mix, mulberry32 } from './core/math.js';
import { pchip } from './core/interp.js';
import { T, W, H } from './timeline.js';
import * as LY from './world/layout.js';
import { treeBox, drawFrailejon, drawTree, drawStump, drawHouse, drawChurch, drawBagSeedling, drawSapling, drawUnderstory } from './world/props.js';
import { drawDrop, drawBear, drawHummingbird, drawPerson, drawBird, drawButterfly, drawHeart } from './world/characters.js';
import { drawSky, drawLand, drawForestFloor, drawGroundDetails, drawRivers, frontS } from './world/ground.js';
import { handText } from './text.js';

const { PLACES, plantings, dropPath: DP } = LY;
const sL1 = LY.L1.length;

// ================================================================ la Gota
const blinkAt = (t, off = 0, period = 2.9) => {
  const ph = (t + off) % period;
  return ph < 0.13 ? Math.abs(ph - 0.065) / 0.065 : 1;
};

export function sRide(t) {
  if (t < T.ride[0]) return 0;
  if (t < T.ride[1]) {
    const u = prog(t, T.ride[0], T.ride[1]);
    return LY.sGap0 * (0.72 * u + 0.28 * ease.inOutSine(u));
  }
  if (t < T.stuck) return lerp(LY.sGap0, LY.sStuck, ease.outCubic(prog(t, T.ride[1], T.stuck)));
  if (t < T.refill[0]) return LY.sStuck;
  if (t < T.refill[1]) return Math.max(LY.sStuck, frontS(t) - 22);
  const sAfter = sL1 + 18;
  if (t < T.whip[0]) return sAfter + (t - T.refill[1]) * 34;
  const s0 = sAfter + (T.whip[0] - T.refill[1]) * 34;
  if (t < T.whip[1]) return lerp(s0, LY.sPathGardenJump, ease.inOutCubic(prog(t, T.whip[0], T.whip[1])));
  return LY.sPathGardenJump;
}

function lookKeys(t, keys) {
  // keys: [[t, lx, ly], ...]
  if (t <= keys[0][0]) return [keys[0][1], keys[0][2]];
  for (let i = 1; i < keys.length; i++) {
    if (t < keys[i][0]) {
      const u = ease.inOut(prog(t, keys[i - 1][0], keys[i][0]));
      return [lerp(keys[i - 1][1], keys[i][1], u), lerp(keys[i - 1][2], keys[i][2], u)];
    }
  }
  const k = keys[keys.length - 1];
  return [k[1], k[2]];
}

export function dropState(t) {
  const pt = (a) => ({ x: a[0], y: a[1] });
  const B = pt(PLACES.birth), M = pt(PLACES.moss), P = pt(PLACES.pool);
  if (t < T.condense[0]) return null;
  if (t < T.fall) {
    const g = prog(t, T.condense[0], T.condense[1]);
    const s = 0.4 + 0.52 * ease.outCubic(g) + 0.05 * spring(t - T.condense[1], 2.2, 4) * (t > T.condense[1] ? 1 : 0);
    const wob = 0.08 * Math.sin(t * 11) * (1 - g);
    let sx = 1 + wob, sy = 1 - wob;
    let eyes = t < T.eyesOpen ? 0 : clamp((t - T.eyesOpen) / 0.12);
    if (t > T.eyesOpen + 0.32 && t < T.eyesOpen + 0.44) eyes = 0.1;
    const look = lookKeys(t, [[T.lookAround[0], 0, 0], [T.lookAround[0] + 0.15, -1, -0.3], [T.lookAround[0] + 0.4, -1, -0.3], [T.lookAround[0] + 0.55, 1, -0.3], [T.lookAround[0] + 0.8, 1, -0.3], [T.fall - 0.2, 0, 1]]);
    const ant = prog(t, T.fall - 0.3, T.fall);
    sx *= 1 + 0.14 * Math.sin(ant * Math.PI);
    sy *= 1 - 0.14 * Math.sin(ant * Math.PI);
    const mood = t < T.eyesOpen + 0.5 ? 'neutral' : t < T.lookAround[1] ? 'happy' : 'o';
    const S = Math.max(0.001, s);
    return { x: B.x, y: B.y + 54 * S * sy, s: S, sx, sy, eyes, look, mood, shadow: false, alpha: 1 };
  }
  if (t < T.land) {
    const u = prog(t, T.fall, T.land);
    const y0 = B.y + 54 * 0.92, y1 = M.y;
    return { x: lerp(B.x, M.x, u), y: y0 + (y1 - y0) * u * u, s: 0.92, sx: 0.82, sy: 1.24, eyes: 1, look: [0, 1], mood: 'o', shadow: false };
  }
  if (t < T.slideToPool[0]) {
    const u = t - T.land;
    const sq = spring(u, 3.2, 6) * 0.42;
    return { x: M.x, y: M.y, s: 0.92, sx: 1 + sq, sy: 1 - sq, eyes: u < 0.14 ? 0.1 : 1, look: [0, 0], mood: u < 0.14 ? 'neutral' : 'happy' };
  }
  if (t < T.poolSplash) {
    const u = prog(t, T.slideToPool[0], T.slideToPool[1]);
    const e = ease.inOut(u);
    return { x: lerp(M.x, P.x, e), y: lerp(M.y, P.y, e) - Math.sin(u * Math.PI) * 46, s: 0.92, sx: 0.9, sy: 1.12, rot: -0.35 * Math.sin(u * Math.PI), eyes: 1, look: [-0.4, 0.6], mood: 'joy' };
  }
  // ---- sobre el agua
  if (t < T.leap[0]) {
    const s = sRide(t);
    const p = DP.at(s);
    let size = 0.92, sx = 1, sy = 1, rot = 0.1 * Math.sin(t * 5.3), mood = 'happy', eyes = blinkAt(t, 0.7);
    let look = [p.tx * 0.6, 0.3];
    let bob = -3 * Math.abs(Math.sin(t * 6.5));
    let sweat = 0;
    if (t < T.ride[0]) { mood = 'joy'; bob = -2 * Math.abs(Math.sin(t * 9)); }
    else if (t < 8.5) mood = 'joy';
    else if (t < 11.2) {
      mood = 'happy';
      if (t > T.bird[0] && t < T.bird[1]) look = [1, -0.4];
      if (t > 9.9 && t < 10.9) look = [1, 0];
    } else if (t < T.stuck) {
      const k = prog(t, 11.2, T.stuck);
      mood = k < 0.35 ? 'neutral' : k < 0.7 ? 'o' : 'sad';
      look = k < 0.5 ? [0, 1] : [0.3, 0.6];
      rot *= 1 - k;
      bob *= 1 - k;
    }
    if (t >= T.stuck - 0.6 && t < T.revive[0]) {
      // atascada en la grieta: se evapora
      size = lerp(0.92, 0.56, ease.outCubic(prog(t, T.stuck - 0.6, 16.0)));
      rot = 0.03 * Math.sin(t * 2);
      bob = 0;
      mood = 'sad';
      eyes = 0.55 * blinkAt(t, 0.2, 2.2);
      look = [0.2, 0.5];
      sweat = t < 15 ? ((t - 13.5) * 1.6) % 1 : 0;
      if (t > T.sadEyes) eyes = clamp(0.55 - (t - T.sadEyes) * 1.2);
      if (t > T.peek) {
        eyes = ease.outBack(prog(t, T.peek, T.peek + 0.35));
        mood = t < 18.3 ? 'o' : 'happy';
        look = lookKeys(t, [[T.peek, 0.3, -0.4], [T.peek + 0.5, 0.8, -0.6], [17.8, 0.2, -0.8], [18.6, -0.3, -0.2]]);
        // mira hacia la siembra activa
        if (t > 18.6) {
          let near = null;
          for (const pl of plantings) if (pl.t > t - 0.6) { near = pl; break; }
          if (near) {
            const dx = near.x - p.x, dy = near.y - p.y, dl = Math.hypot(dx, dy) || 1;
            look = [dx / dl, dy / dl * 0.8];
          }
          eyes = blinkAt(t, 0.3, 2.4);
        }
      }
      if (t > T.rain[0] && t < T.revive[0]) { mood = 'o'; look = [0, -1]; eyes = 1; }
    } else if (t >= T.revive[0] && t < T.refill[0]) {
      // se recarga con la lluvia que ahora se queda en el suelo
      const bumps = [T.revive[0] + 0.1, T.revive[0] + 0.45, T.revive[0] + 0.8];
      size = 0.56;
      let sq = 0;
      for (let i = 0; i < bumps.length; i++) {
        if (t > bumps[i]) { size += 0.14; sq += spring(t - bumps[i], 3, 6) * 0.25; }
      }
      sx = 1 + sq; sy = 1 - sq;
      mood = 'joy'; eyes = 1; look = [0, -0.6]; bob = 0;
    } else if (t >= T.refill[0] && t < T.whip[0]) {
      size = 0.98;
      mood = t < 28.5 ? 'joy' : 'happy';
      if (t > 29.2) look = [0.5, -1];
      if (t > T.bearsMeet) mood = 'joy';
    } else if (t >= T.whip[0]) {
      size = 0.98; mood = 'joy';
      const k = Math.sin(prog(t, T.whip[0], T.whip[1]) * Math.PI);
      sx = 1 - 0.18 * k; sy = 1 + 0.28 * k;
      rot = -p.tx * 0.6 * k;
      look = [p.tx, 1];
    }
    return { x: p.x, y: p.y + bob + 4, s: size, sx, sy, rot, eyes, look, mood, sweat, shadow: false };
  }
  // ---- salto al huerto
  const J = DP.at(LY.sPathGardenJump);
  const S = PLACES.sprout;
  if (t < T.leap[1]) {
    const u = prog(t, T.leap[0], T.leap[1]);
    const x = lerp(J.x, S[0], u), y = lerp(J.y, S[1], u) - Math.sin(u * Math.PI) * 120;
    return { x, y, s: 0.98, sx: 0.9, sy: 1.12, rot: -Math.PI * 2 * ease.inOut(u), eyes: 1, look: [-0.5, 0.5], mood: 'joy', shadow: false };
  }
  if (t < T.sprout) {
    const u = prog(t, T.leap[1], T.sprout);
    const sq = spring(t - T.leap[1], 3, 5) * 0.35;
    return { x: S[0], y: S[1] + 2, s: 0.98, sx: 1 + sq + u * 0.3, sy: Math.max(0.05, 1 - sq - u * 0.95), eyes: u < 0.5 ? 1 : 0.1, look: [0, 0], mood: 'joy', alpha: 1 - u * u, shadow: false };
  }
  return null;
}

// gotita de rocío sobre el brote (guiño final)
function dewState(t) {
  if (t < T.sprout + 0.35 || t > T.zoomOut[0] + 1.2) return null;
  const S = PLACES.sprout;
  const g = sproutGrowth(t);
  const k = prog(t, T.sprout + 0.35, T.sprout + 0.55);
  const wink = t > T.sprout + 0.62 && t < T.sprout + 0.8;
  return { x: S[0] + 22 * g, y: S[1] - 40 * g, s: 0.3 * ease.outBack(k), eyes: wink ? 0 : 1, look: [0.4, -0.2], mood: 'joy', shadow: false };
}
function sproutGrowth(t) {
  return ease.outBack(prog(t, T.sprout, T.sprout + 0.5), 2);
}

// ================================================================ cámara
const Z1 = 0.33, C1 = [1520, 2560];
function buildCamera() {
  const keys = [];
  const K = (t, x, y, z) => keys.push([t, x, y, Math.log(z)]);
  K(0, 1214, 676, 5.4);
  K(1.3, 1210, 678, 4.7);
  K(2.9, 1196, 690, 3.0);
  K(3.35, 1195, 700, 2.9);
  K(3.95, 1192, 792, 2.7);
  K(4.9, 1186, 905, 2.55);
  const zf = pchip([5.7, 8, 10, 11.6], [2.55, 2.45, 2.4, 2.1]);
  for (let t = 5.8; t <= 11.61; t += 0.6) {
    const d = dropState(t);
    K(t, lerp(d.x, 1210, 0.3) + 14, d.y + 110, zf(t));
  }
  const st = LY.L1.at(LY.sStuck);
  K(12.8, 1180, 1715, 1.6);
  K(13.8, 1150, 1810, 1.45);
  K(14.8, 1160, 1815, 1.5);
  K(15.7, st.x + 8, st.y - 30, 1.8);
  K(16.3, st.x + 90, st.y - 20, 2.6);
  K(16.95, st.x + 90, st.y - 20, 2.68);
  K(18.2, 1200, 1702, 1.75);
  K(19.5, 1205, 1732, 1.8);
  K(21.5, 1200, 1822, 1.8);
  K(23.4, 1196, 1918, 1.72);
  K(24.4, 1130, 1660, 2.05);
  K(25.4, 1135, 1675, 2.12);
  K(26.3, 1225, 1935, 2.0);
  K(27.4, 1182, 1998, 1.8);
  K(28.3, 1130, 1880, 1.5);
  K(30.2, 1300, 2020, 1.85);
  const zw = pchip([30.6, 31.1, 31.7, 32.05], [1.6, 1.0, 1.1, 1.9]);
  for (let t = 30.85; t <= 32.0; t += 0.25) {
    const d = dropState(t);
    K(t, d.x + 10, d.y + 70, zw(t));
  }
  K(32.5, 1232, 4262, 2.25);
  K(33.5, 1242, 4272, 2.6);
  K(T.zoomOut[0], 1243, 4272, 2.62);
  const ts = keys.map((k) => k[0]);
  const fx = pchip(ts, keys.map((k) => k[1]));
  const fy = pchip(ts, keys.map((k) => k[2]));
  const fz = pchip(ts, keys.map((k) => k[3]));
  return (t) => ({ x: fx(t), y: fy(t), z: Math.exp(fz(t)) });
}
const camPath = buildCamera();

export function camera(t) {
  let c;
  if (t < T.zoomOut[0]) c = camPath(t);
  else {
    const c0 = camPath(T.zoomOut[0]);
    const A = PLACES.sprout;
    const u = ease.inOutCubic(prog(t, T.zoomOut[0], T.zoomOut[1]));
    const z = Math.exp(lerp(Math.log(c0.z), Math.log(Z1), u)) * (1 - 0.012 * prog(t, T.zoomOut[1], T.end));
    const sA0 = [(A[0] - c0.x) * c0.z, (A[1] - c0.y) * c0.z];
    const sA1 = [(A[0] - C1[0]) * Z1, (A[1] - C1[1]) * Z1];
    const sA = [lerp(sA0[0], sA1[0], u), lerp(sA0[1], sA1[1], u)];
    c = { x: A[0] - sA[0] / z, y: A[1] - sA[1] / z, z };
  }
  // pulso de mano (muy leve)
  const hz = 1 / c.z;
  c.x += noise1(t * 0.7, 91) * 2.2 * hz;
  c.y += noise1(t * 0.6, 92) * 2.2 * hz;
  // sacudón al caer la bolsa y al aterrizar
  const sh = spring(t - T.seedling, 5, 9) * 5 + spring(t - T.land, 5, 9) * 3;
  c.y += sh * hz;
  return c;
}

// ================================================================ osos
const cubBase = { s: 0.85, seed: 61 };
export function cubState(t) {
  const A = PLACES.bearA, E = PLACES.bearEdge, M = PLACES.meet;
  const st = { ...cubBase, dir: -1, walk: 0, moving: 0, headDip: 0, sit: 0, look: 0, eyes: blinkAt(t, 1.1, 3.3) };
  if (t < 7.6) return null;
  if (t < 9.0) {
    const u = ease.outQuad(prog(t, 7.6, 9.0));
    return { ...st, x: lerp(A[0] + 170, A[0], u), y: lerp(A[1] - 20, A[1], u), walk: t * 9, moving: 1 - prog(t, 8.8, 9.0) };
  }
  if (t < 10.15) return { ...st, x: A[0], y: A[1], headDip: prog(t, 9.0, 9.25) * (0.85 + 0.15 * Math.sin(t * 13)) };
  if (t < 11.7) {
    const k = prog(t, 10.15, 10.4);
    return { ...st, x: A[0], y: A[1], headDip: (1 - k) * 0.9, look: -1, headTilt: -0.1 * k };
  }
  if (t < 13.9) {
    const u = ease.inOut(prog(t, 11.7, 13.9));
    return { ...st, x: lerp(A[0], E[0], u), y: lerp(A[1], E[1], u), walk: t * 8, moving: 1 };
  }
  if (t < 14.6) return { ...st, x: E[0], y: E[1], dir: 1, headDip: 0.2 * prog(t, 13.9, 14.2) };
  if (t < 15.3) {
    const k = Math.sin(prog(t, 14.6, 15.3) * Math.PI);
    return { ...st, x: E[0] + k * 30, y: E[1] + k * 18, dir: 1, walk: t * 8, moving: k > 0.1 ? 1 : 0, headDip: 0.2 };
  }
  if (t < T.cheer) {
    const sit = ease.inOut(prog(t, 15.3, 15.7));
    return { ...st, x: E[0], y: E[1], dir: 1, sit, headDip: 0.1, headTilt: 0.05 * Math.sin(t * 0.9) };
  }
  if (t < T.bearsWalk[0]) {
    const sit = 1 - ease.inOut(prog(t, T.cheer, T.cheer + 0.4));
    return { ...st, x: E[0], y: E[1], dir: 1, sit, headTilt: -0.1 };
  }
  if (t < T.bearsMeet) {
    const u = ease.inOut(prog(t, T.bearsWalk[0], T.bearsMeet));
    return { ...st, x: lerp(E[0], M[0], u), y: lerp(E[1], M[1], u), dir: 1, walk: t * 9, moving: 1 - prog(t, T.bearsMeet - 0.2, T.bearsMeet) };
  }
  const k = prog(t, T.bearsMeet, T.bearsMeet + 0.3);
  return { ...st, x: M[0], y: M[1], dir: 1, headDip: 0.25 * k, eyes: t > T.bearsMeet + 0.2 && t < T.bearsMeet + 1.1 ? 0 : st.eyes };
}
export function momState(t) {
  const Bp = PLACES.bearB, M = PLACES.meet;
  const st = { s: 1.2, seed: 71, dir: -1, walk: 0, moving: 0, headDip: 0, sit: 0, eyes: blinkAt(t, 0.4, 3.7), headTilt: -0.12 };
  const off = [Bp[0] + 330, Bp[1] + 320]; // sale de cuadro mientras la comunidad siembra
  if (t < 15.2) {
    const px = Math.sin(t * 0.9) * 26;
    const v = Math.cos(t * 0.9);
    return { ...st, x: Bp[0] + px, y: Bp[1], dir: v > 0.25 ? 1 : -1, walk: t * 7, moving: Math.abs(v) > 0.25 ? 0.8 : 0 };
  }
  const x16 = Bp[0] + Math.sin(15.2 * 0.9) * 26;
  if (t < 16.2) {
    const u = ease.inOut(prog(t, 15.2, 16.2));
    return { ...st, x: lerp(x16, off[0], u), y: lerp(Bp[1], off[1], u), dir: 1, walk: t * 7, moving: 1 };
  }
  const target = [M[0] + 172, M[1] + 6];
  if (t < 26.6) return { ...st, x: off[0], y: off[1], dir: -1 };
  if (t < T.bearsWalk[0]) {
    const u = ease.inOut(prog(t, 26.6, T.bearsWalk[0]));
    return { ...st, x: lerp(off[0], Bp[0], u), y: lerp(off[1], Bp[1], u), dir: -1, walk: t * 7, moving: 1 };
  }
  if (t < T.bearsMeet) {
    const u = ease.inOut(prog(t, T.bearsWalk[0], T.bearsMeet));
    return { ...st, x: lerp(Bp[0], target[0], u), y: lerp(Bp[1], target[1], u), walk: t * 7.5, moving: 1 - prog(t, T.bearsMeet - 0.2, T.bearsMeet), headTilt: 0 };
  }
  const k = prog(t, T.bearsMeet, T.bearsMeet + 0.3);
  return { ...st, x: target[0], y: target[1], headDip: 0.3 * k, headTilt: 0, eyes: t > T.bearsMeet + 0.2 && t < T.bearsMeet + 1.1 ? 0 : st.eyes };
}

// ================================================================ colibrí
function birdState(t) {
  if (t > T.bird[0] && t < T.bird[1]) {
    const d = dropState(t);
    if (!d) return null;
    const u = prog(t, T.bird[0], T.bird[1]);
    let ox, oy;
    if (u < 0.25) { const k = ease.outCubic(u / 0.25); ox = lerp(260, 70, k); oy = lerp(-220, -70, k); }
    else if (u < 0.8) { ox = 70 + Math.sin(t * 3) * 12; oy = -70 + Math.sin(t * 4.3) * 10; }
    else { const k = ease.inCubic((u - 0.8) / 0.2); ox = lerp(70, -320, k); oy = lerp(-70, -300, k); }
    return { x: d.x + ox, y: d.y + oy, dir: u < 0.8 ? -1 : -1, s: 1.1, tilt: u > 0.8 ? -0.4 : 0.05 * Math.sin(t * 6) };
  }
  if (t > 28.6 && t < 31.2) {
    const u = prog(t, 28.6, 31.2);
    return { x: lerp(960, 1480, u), y: lerp(1700, 2040, u) + Math.sin(u * 12) * 20, dir: 1, s: 1.1, tilt: 0.1 };
  }
  return null;
}

// ================================================================ sembradores
const CREW = [
  { ruana: '#3f7f9a', hat: '#e3cf9a', skin: '#a8714b', s: 1.15, seed: 11, from: [700, 1700], enter: 17.0, hold: 'shovel', watch: [950, 1690] },
  { ruana: '#d9a53a', hat: '#4a3a30', skin: '#8d5a3b', s: 1.12, seed: 12, from: [1720, 1760], enter: 17.2, hold: 'shovel', watch: [1445, 1760] },
  { ruana: '#8a4a6a', hat: '#e3cf9a', skin: '#c08a60', s: 1.1, seed: 13, from: [690, 1990], enter: 17.35, hold: 'seedling', watch: [930, 1985] },
  { ruana: '#5b5a98', hat: '#4a3a30', skin: '#9b6444', s: 1.17, seed: 14, from: [1720, 2020], enter: 17.1, hold: 'shovel', watch: [1440, 1880] },
  { ruana: '#e0603a', hat: null, braids: true, skin: '#b07a52', s: 0.85, seed: 15, kid: true, hold: 'seedling', watch: [955, 1780] },
];
const crewPlans = CREW.map((c, k) => {
  const mine = plantings.filter((p) => p.i % 5 === k);
  const wps = []; // [t, x, y, pose, dir]
  let side;
  if (c.kid) {
    const st = LY.L1.at(LY.sStuck);
    const pl = plantings[4];
    side = 1;
    wps.push([15.45, st.x + 300, st.y + 12, 'walk', -1]);
    wps.push([16.05, pl.x + 40, pl.y + 3, 'walk', -1]);
    wps.push([16.1, pl.x + 40, pl.y + 3, 'kneel', -1]);
    wps.push([17.5, pl.x + 40, pl.y + 3, 'kneel', -1]);
    wps.push([17.7, pl.x + 40, pl.y + 3, 'stand', -1]);
  } else {
    side = c.from[0] < 1200 ? -1 : 1;
    wps.push([c.enter, c.from[0], c.from[1], 'walk', -side]);
  }
  for (const pl of mine) {
    const sx = pl.x + side * 40, sy = pl.y + 3;
    wps.push([pl.t - 0.5, sx, sy, 'walk', -side]);
    wps.push([pl.t, sx, sy, 'dig', -side]);
    wps.push([pl.t + 0.3, sx, sy, 'kneel', -side]);
  }
  const last = mine[mine.length - 1];
  const [wx, wy] = c.watch;
  const face = wx < PLACES.meet[0] + 60 ? 1 : -1;
  wps.push([last.t + 1.9, wx, wy, 'walk', face]);
  wps.push([T.cheer, wx, wy, 'stand', face]);
  wps.push([T.cheer + 1.3, wx, wy, 'cheer', face]);
  wps.push([T.bearsMeet + 0.05, wx, wy, 'stand', face]);
  wps.push([T.bearsMeet + 1.2, wx, wy, 'cheer', face]);
  wps.push([99, wx, wy, 'stand', face]);
  return { c, wps, mine };
});

function personState(plan, t) {
  const { c, wps } = plan;
  if (t < wps[0][0]) return null;
  let i = 0;
  while (i < wps.length - 1 && t >= wps[i + 1][0]) i++;
  const a = wps[i], b = wps[Math.min(i + 1, wps.length - 1)];
  const u = b[0] > a[0] ? prog(t, a[0], b[0]) : 1;
  let x = a[1], y = a[2], pose = 'stand', dir = a[4];
  const moving = Math.hypot(b[1] - a[1], b[2] - a[2]) > 2;
  if (moving) {
    x = lerp(a[1], b[1], u); y = lerp(a[2], b[2], u);
    pose = 'walk';
    dir = b[1] < a[1] ? -1 : b[1] > a[1] ? 1 : a[4];
  } else {
    pose = a[3] === 'walk' ? 'stand' : a[3];
    // 'dig' dura hasta el momento de sembrar
    if (b[3] === 'dig' || a[3] === 'dig') pose = t < b[0] && b[3] === 'kneel' ? 'dig' : pose;
  }
  // el tramo previo a sembrar es cavar
  if (a[3] === 'dig' || (b[3] === 'kneel' && a[3] === 'dig')) pose = 'dig';
  let hold = c.hold;
  if (c.kid && t > T.seedling) hold = null;
  if (c.kid && t > 20.9) hold = 'seedling';
  if (!c.kid && c.hold === 'seedling' && t > plan.mine[0].t) hold = null;
  if (pose === 'cheer') hold = null;
  return { x, y, dir, s: c.s, ruana: c.ruana, hat: c.hat, skin: c.skin, braids: c.braids, seed: c.seed, pose, ph: t * (pose === 'dig' ? 13 : pose === 'cheer' ? 7 : 10), hold };
}

// ================================================================ huerto escolar
const gardenKid = { ruana: '#3f8a6a', hat: '#e3cf9a', skin: '#9b6444', s: 0.88, seed: 21 };
function drawGarden(D, t) {
  const [gx, gy] = PLACES.garden;
  if (!D.visible(gx, gy, 200)) return;
  D.save(); D.translate(gx, gy);
  D.shape(rectPts(-120, -40, 200, 70, 4), '#8a6040', { seed: 150, angle: -0.3, knock: true, jitter: 1.2 });
  for (let k = 0; k < 3; k++) D.stroke([[-110, -28 + k * 22], [70, -28 + k * 22]], '#5e3f28', 2, { seed: 151 + k, alpha: 0.6 });
  // coles / lechugas
  for (let k = 0; k < 5; k++) {
    const x = -100 + k * 34, y = -30 + (k % 2) * 44;
    D.shape(ellipsePts(x, y, 11, 8, 10, 0, 0.2, k), k % 2 ? '#7fae52' : '#8cc063', { seed: 160 + k, knock: true });
  }
  // cerquita
  for (let k = 0; k < 8; k++) D.stroke([[-130 + k * 30, 36], [-130 + k * 30, 14]], '#8a6238', 3, { seed: 170 + k });
  D.stroke([[-132, 22], [80, 22]], '#8a6238', 2.2, { seed: 179 });
  D.restore();
  // montículo con la semilla
  const [sx, sy] = PLACES.sprout;
  D.shape(ellipsePts(sx, sy + 2, 20, 7, 10), '#6b4a30', { seed: 181, knock: true, angle: -0.2 });
}
function drawSprout(D, t) {
  const g = sproutGrowth(t);
  if (g <= 0) return;
  const [sx, sy] = PLACES.sprout;
  D.save(); D.translate(sx, sy); D.scale(1.9 * Math.max(0.05, g));
  drawSapling(D, 0.45 + 0.4 * clamp(g), 991, t);
  D.restore();
}
function gardenKidState(t) {
  const [kx, ky] = PLACES.kid;
  let pose = 'stand', hold = 'can', ph = t * 8;
  const up = prog(t, T.canTilt[0], T.canTilt[0] + 0.2), down = prog(t, T.canTilt[1], T.canTilt[1] + 0.25);
  const canTilt = ease.inOut(up) * (1 - ease.inOut(down)) * (0.9 + 0.12 * Math.sin(t * 22) * up * (1 - down));
  if (t > T.sprout + 0.12) { pose = 'cheer'; hold = null; ph = (t - T.sprout) * 7; }
  return { ...gardenKid, x: kx, y: ky, dir: 1, pose, hold, ph, canTilt, sad: t > T.canTilt[0] + 0.25 && t < T.leap[0] + 0.3 };
}

// ================================================================ efectos
function sparkle(D, x, y, k, size, seed, col = '#f6c945') {
  if (k <= 0 || k >= 1) return;
  const a = 1 - k;
  const r = size * ease.outBack(clamp(k * 2.5), 2);
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + seed;
    D.stroke([[x + Math.cos(ang) * r * 0.25, y + Math.sin(ang) * r * 0.25], [x + Math.cos(ang) * r, y + Math.sin(ang) * r]], col, 2.6, { seed: seed + i, alpha: a });
  }
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + seed + Math.PI / 4;
    D.stroke([[x + Math.cos(ang) * r * 0.2, y + Math.sin(ang) * r * 0.2], [x + Math.cos(ang) * r * 0.55, y + Math.sin(ang) * r * 0.55]], col, 1.8, { seed: seed + 9 + i, alpha: a * 0.8 });
  }
}
function dirtPuff(D, x, y, k, seed) {
  if (k <= 0 || k >= 1) return;
  const r = mulberry32(seed);
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * (0.1 + r() * 0.8), v = 20 + r() * 30;
    const px = x + Math.cos(a) * v * k, py = y + Math.sin(a) * v * k + 60 * k * k;
    D.shape(ellipsePts(px, py, 3.2 * (1 - k * 0.5), 2.6 * (1 - k * 0.5), 6), '#7a5534', { seed: seed + i, edge: 1, alpha: 1 - k });
  }
}
function splash(D, x, y, k, seed, col = '#9fd0f0', n = 7, size = 1) {
  if (k <= 0 || k >= 1) return;
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * (0.12 + r() * 0.76), v = (30 + r() * 30) * size;
    const px = x + Math.cos(a) * v * k, py = y + Math.sin(a) * v * k * 1.3 + 90 * k * k * size;
    D.shape(ellipsePts(px, py, 3.2 * size, 4.2 * size, 7), col, { seed: seed + i, edge: 1.4, alpha: 1 - k * k });
  }
  D.stroke(ellipsePts(x, y + 3, 16 + 36 * k * size, (5 + 10 * k) * size, 16).concat([[x + 16 + 36 * k * size, y + 3]]), '#e2f2fb', 2, { seed, alpha: (1 - k) * 0.9 });
}
function steam(D, x, y, t, seed) {
  for (let i = 0; i < 3; i++) {
    const ph = ((t * 0.6 + i / 3) % 1);
    const pts = [];
    for (let k = 0; k < 6; k++) {
      const yy = y - 40 - ph * 70 - k * 9;
      pts.push([x + (i - 1) * 12 + Math.sin(k * 1.2 + t * 3 + i) * 6, yy]);
    }
    D.stroke(pts, '#ffffff', 2.4, { seed: seed + i, alpha: Math.sin(ph * Math.PI) * 0.8 });
  }
}

// lluvia: trazos inclinados en espacio de mundo
function drawRain(D, t) {
  const k = prog(t, T.rain[0], T.rain[0] + 0.5) * (1 - prog(t, T.rain[1] - 0.5, T.rain[1]));
  if (k <= 0) return;
  const ctx = D.ctx;
  const r = mulberry32(Math.floor(t * 24));
  ctx.save();
  ctx.lineCap = 'round';
  const n = Math.floor(420 * k);
  for (let i = 0; i < n; i++) {
    const x = r() * (D.W + 200) - 100, y = r() * (D.H + 200) - 100;
    const L = 26 + r() * 30;
    ctx.strokeStyle = `rgba(70,105,150,${0.35 + r() * 0.4})`;
    ctx.lineWidth = 1.6 + r() * 1.8;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - L * 0.25, y + L); ctx.stroke();
  }
  // salpicaduras en el suelo
  for (let i = 0; i < Math.floor(60 * k); i++) {
    const x = r() * D.W, y = r() * D.H, rr = 4 + r() * 10;
    ctx.strokeStyle = `rgba(225,240,250,${0.35 + r() * 0.3})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(x, y, rr * 1.6, rr * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function speedLines(D, t) {
  const k = Math.sin(prog(t, T.whip[0] + 0.1, T.whip[1] - 0.15) * Math.PI);
  if (k <= 0.01) return;
  const ctx = D.ctx;
  const r = mulberry32(Math.floor(t * 12) + 5);
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = r() * D.W, y = r() * D.H;
    const L = 120 + r() * 380;
    ctx.strokeStyle = `rgba(255,252,240,${(0.35 + r() * 0.4) * k})`;
    ctx.lineWidth = 2 + r() * 4;
    ctx.beginPath(); ctx.moveTo(x, y - L / 2); ctx.lineTo(x + (r() - 0.5) * 8, y + L / 2); ctx.stroke();
  }
  ctx.restore();
}

// niebla del páramo: bandas horizontales de trazo suave que se deslizan
function drawFog(D, t) {
  const k = 1 - prog(t, 3.8, 6.8);
  if (k <= 0) return;
  const ctx = D.ctx;
  const banks = [[980, 560, 0], [1380, 655, 1], [860, 760, 2], [1300, 850, 3], [1100, 470, 4], [1500, 520, 5]];
  ctx.lineCap = 'round';
  for (const [bx, by, i] of banks) {
    const x = bx + t * (18 + i * 5) - 60;
    for (let j = 0; j < 5; j++) {
      const yy = by + (j - 2) * 11 + Math.sin(t * 0.6 + j + i) * 4;
      const L = 150 + ((i * 37 + j * 53) % 90);
      const x0 = x - L + j * 14, x1 = x + L - j * 10;
      const [a0, b0] = D.W2S(x0, yy), [a1, b1] = D.W2S(x1, yy + 3);
      ctx.strokeStyle = D._pat('#ffffff', { seed: 300 + i * 7 + j, angle: -0.2 }, 'soft');
      ctx.globalAlpha = (0.42 - Math.abs(j - 2) * 0.1) * k;
      ctx.lineWidth = (12 - Math.abs(j - 2) * 2.5) * D.cam.z;
      ctx.beginPath(); ctx.moveTo(a0, b0); ctx.quadraticCurveTo((a0 + a1) / 2, (b0 + b1) / 2 - 6 * D.cam.z, a1, b1); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

// ================================================================ oclusión (lógica de profundidad)
// Se recorre toda la película: si la copa o el tronco de un árbol que está DELANTE de un personaje
// (su base más abajo) lo taparía, ese árbol no se planta en el paisaje. Los árboles sembrados por la
// comunidad no se pueden quitar: sus conflictos se informan para ajustar la coreografía.
function actorBoxes(t) {
  const out = [];
  const bear = (b, name) => b && out.push({ name, x0: b.x - 105 * b.s, x1: b.x + 105 * b.s, y0: b.y - 125 * b.s, y: b.y });
  bear(cubState(t), 'osezno'); bear(momState(t), 'osa');
  for (const plan of crewPlans) {
    const p = personState(plan, t);
    if (p) out.push({ name: 'persona' + plan.c.seed, x0: p.x - 30 * p.s, x1: p.x + 30 * p.s, y0: p.y - 150 * p.s, y: p.y });
  }
  const gk = gardenKidState(t);
  out.push({ name: 'niño', x0: gk.x - 30 * gk.s, x1: gk.x + 30 * gk.s, y0: gk.y - 150 * gk.s, y: gk.y });
  const d = dropState(t);
  if (d && t > T.poolSplash) { const h = 64 * (d.s || 1); out.push({ name: 'gota', x0: d.x - h * 0.5, x1: d.x + h * 0.5, y0: d.y - h, y: d.y }); }
  return out;
}
function covers(tr, size, box) {
  if (tr.y <= box.y + 1) return false; // el árbol está detrás: el personaje se pinta encima, correcto
  const b = treeBox(tr.kind, size);
  const crown = !(tr.x + b.rx < box.x0 || tr.x - b.rx > box.x1 || tr.y + b.crownBottom < box.y0 || tr.y + b.top > box.y);
  const trunk = !(tr.x + b.trunkW < box.x0 || tr.x - b.trunkW > box.x1 || tr.y < box.y0 || tr.y - b.th > box.y);
  return crown || trunk;
}
export const occlusionReport = [];
{
  let removed = 0;
  for (let t = 0; t <= 40; t += 0.1) {
    for (const box of actorBoxes(t)) {
      for (const tr of LY.trees) {
        if (tr.hidden) continue;
        if (tr.t0 >= 0 && t < tr.t0 + tr.dur * 0.3) continue;
        if (covers(tr, tr.size, box)) { tr.hidden = true; removed++; }
      }
      for (const pl of plantings) {
        if (t < pl.t + 1.5) continue;
        if (covers(pl, 1.0, box)) occlusionReport.push(`${t.toFixed(1)}s siembra#${pl.i} tapa a ${box.name}`);
      }
    }
  }
  occlusionReport.unshift(`árboles retirados por tapar personajes: ${removed}`);
}

// ================================================================ cuadro
let assets = null;
export function initAssets() {
  if (assets) return assets;
  assets = { paper: makePaper(W, H), tooth: makeTooth(W, H), vig: makeVignette(W, H) };
  return assets;
}

export function drawFrame(D, t, frame) {
  const A = initAssets();
  const ctx = D.ctx;
  const cam = camera(t);
  D.setFrame(t, frame, cam, 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.drawImage(A.paper, 0, 0);

  // ---- fondo
  D.slow = true;
  drawSky(D, t);
  drawLand(D, t);
  drawForestFloor(D, t);
  drawRivers(D, t);
  drawGroundDetails(D, t);
  drawGarden(D, t);

  // ---- objetos ordenados por profundidad (y)
  const items = [];
  const view = [cam.x - W / 2 / cam.z - 400, cam.y - H / 2 / cam.z - 200, cam.x + W / 2 / cam.z + 400, cam.y + H / 2 / cam.z + 500];
  const inView = (x, y) => x > view[0] && x < view[2] && y > view[1] && y < view[3];
  for (const f of LY.frailejones) if (inView(f.x, f.y)) items.push([f.y, () => drawFrailejon(D, f, t)]);
  for (const s of LY.stumps) if (inView(s.x, s.y)) items.push([s.y, () => drawStump(D, s, t)]);
  if (cam.z > 0.5) {
    for (const u of LY.understory) {
      if (!inView(u.x, u.y)) continue;
      const g = u.t0 < 0 ? 1 : prog(t, u.t0 + u.dur * 0.6, u.t0 + u.dur * 1.4);
      if (g > 0) items.push([u.y - 0.5, () => drawUnderstory(D, u, t, g)]);
    }
  }
  for (const tr of LY.trees) {
    if (!inView(tr.x, tr.y)) continue;
    let g = 1;
    if (tr.t0 >= 0) g = ease.inOut(prog(t, tr.t0, tr.t0 + tr.dur));
    if (g <= 0) continue;
    items.push([tr.y, () => drawTree(D, tr, t, g)]);
  }
  for (const pl of plantings) {
    if (!inView(pl.x, pl.y)) continue;
    if (pl.i === 4 && t >= T.seedling && t < pl.t) {
      const drop = prog(t, T.seedling - 0.2, T.seedling);
      items.push([pl.y, () => drawBagSeedling(D, pl.x, pl.y - (1 - drop) * 34 - spring(t - T.seedling, 4, 8) * -3, 44, t, 1.15)]);
    }
    if (t < pl.t) continue;
    const g = 0.2 * ease.outBack(prog(t, pl.t, pl.t + 0.35), 2.5) + 0.8 * ease.inOut(prog(t, pl.t + 0.9, pl.t + 4.8));
    items.push([pl.y, () => drawTree(D, { x: pl.x, y: pl.y, kind: pl.kind, size: 1.0, seed: pl.seed }, t, g)]);
  }
  for (const h of LY.houses) if (inView(h.x, h.y)) items.push([h.y, () => drawHouse(D, h, t)]);
  if (inView(LY.church.x, LY.church.y)) items.push([LY.church.y, () => drawChurch(D, LY.church, t)]);
  items.push([PLACES.sprout[1] + 1, () => drawSprout(D, t)]);
  // personajes: se ordenan junto con el paisaje por su pie (y). Nadie queda "encima" de un árbol que está delante.
  const actorFns = [];
  const act = (y, fn) => actorFns.push([y, fn]);
  const cub = cubState(t), mom = momState(t);
  if (cub) act(cub.y, () => drawBear(D, cub, t));
  if (mom) act(mom.y, () => drawBear(D, mom, t));
  for (const plan of crewPlans) {
    const p = personState(plan, t);
    if (p && inView(p.x, p.y)) act(p.y + 1, () => drawPerson(D, p, t));
  }
  const gk = gardenKidState(t);
  if (inView(gk.x, gk.y)) act(gk.y, () => drawPerson(D, gk, t));
  const drop = dropState(t);
  if (drop) {
    // estela de la gota en el viaje veloz (en vez de líneas de velocidad)
    if (t > T.whip[0] + 0.1 && t < T.whip[1] - 0.05) {
      for (let k = 3; k >= 1; k--) {
        const g = dropState(t - k * 0.035);
        if (g) act(drop.y + 1.5, () => drawDrop(D, { ...g, alpha: 0.18 * (4 - k), eyes: 0, mood: 'neutral' }, t));
      }
    }
    act(t < T.land ? PLACES.hero[1] + 0.5 : drop.y + 2, () => drawDrop(D, drop, t));
  }
  const dew = dewState(t);
  if (dew) act(PLACES.sprout[1] + 5, () => drawDrop(D, dew, t));
  const all = items.map(([y, fn]) => [y, 0, fn]).concat(actorFns.map(([y, fn]) => [y, 1, fn]));
  all.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const [, isActor, fn] of all) { D.slow = !isActor; fn(); }
  D.slow = false;

  // ---- efectos en el mundo
  drawFog(D, t);
  const hb = birdState(t);
  if (hb) drawHummingbird(D, hb, t);
  // brillo al condensarse
  sparkle(D, PLACES.birth[0] + 22, PLACES.birth[1] + 10, prog(t, T.condense[1] - 0.2, T.condense[1] + 0.5), 20, 3, '#ffffff');
  splash(D, PLACES.moss[0], PLACES.moss[1], prog(t, T.land, T.land + 0.5), 31, '#9fd0f0', 6, 0.8);
  splash(D, PLACES.pool[0], PLACES.pool[1], prog(t, T.poolSplash, T.poolSplash + 0.6), 37);
  if (drop && t > T.stuck && t < 15.4) steam(D, drop.x, drop.y + 10, t, 55);
  for (const pl of plantings) {
    dirtPuff(D, pl.x, pl.y, prog(t, pl.t - 0.35, pl.t + 0.3), pl.seed);
    sparkle(D, pl.x, pl.y - 30, prog(t, pl.t, pl.t + 0.55), 26, pl.i);
  }
  // gotas de lluvia que alimentan a la gota
  if (t > T.revive[0] - 0.3 && t < T.revive[1]) {
    const st = LY.L1.at(LY.sStuck);
    [0.1, 0.45, 0.8].forEach((dt, i) => {
      const tt = T.revive[0] + dt;
      const u = prog(t, tt - 0.3, tt);
      if (u > 0 && u < 1) drawDrop(D, { x: st.x + (i - 1) * 6, y: st.y - 260 * (1 - u), s: 0.28, eyes: 0, mood: 'neutral', shadow: false }, t);
      splash(D, st.x, st.y - 10, prog(t, tt, tt + 0.35), 70 + i, '#9fd0f0', 5, 0.6);
    });
  }
  // frente del agua que regresa
  if (t > T.refill[0] && t < T.refill[1] + 0.3) {
    const s = Math.min(frontS(t), sL1);
    const p = LY.L1.at(s);
    splash(D, p.x, p.y, (t * 3) % 1, 80 + Math.floor(t * 3), '#bfe3f7', 5, 0.7);
  }
  // mariposas y pájaros en el corredor
  if (t > 25.5 && t < 34) {
    for (let i = 0; i < 4; i++) {
      const pl = plantings[i * 3 + 1];
      const bx = pl.x + Math.sin(t * 1.3 + i) * 50, by = pl.y - 90 + Math.cos(t * 1.7 + i * 2) * 30;
      drawButterfly(D, bx, by, 1.1, t, 400 + i, i % 2 ? '#f0b43c' : '#f2f2ea');
    }
  }
  if (t > 28.2 && t < 32) {
    for (let i = 0; i < 6; i++) {
      const u = prog(t, 28.2 + i * 0.12, 31.5);
      drawBird(D, lerp(860, 1600, u) + i * 24, 1760 + (i % 3) * 28 + Math.sin(u * 6 + i) * 18 - i * 6, 1.3, t, 500 + i);
    }
  }
  if (t > T.bearsMeet + 0.1 && t < T.bearsMeet + 1.6) {
    const k = prog(t, T.bearsMeet + 0.1, T.bearsMeet + 1.6);
    drawHeart(D, PLACES.meet[0] + 38, PLACES.meet[1] - 90 - k * 40, 1.6 * ease.outBack(clamp(k * 3)), 1 - k * k, 7);
  }
  // la regadera vacía: apenas una gotita
  {
    const u = prog(t, T.canTilt[0] + 0.2, T.canTilt[0] + 0.55);
    if (u > 0 && u < 1) {
      const [kx, ky] = PLACES.kid;
      D.shape(ellipsePts(kx + 44, ky - 48 + u * 44, 2.2, 3, 7), '#9fd0f0', { seed: 77, edge: 1 });
    }
  }
  // brote del huerto
  splash(D, PLACES.sprout[0], PLACES.sprout[1], prog(t, T.leap[1], T.leap[1] + 0.45), 90, '#9fd0f0', 6, 0.8);
  sparkle(D, PLACES.sprout[0], PLACES.sprout[1] - 34, prog(t, T.sprout, T.sprout + 0.6), 30, 11);
  // municipios que siembran (revelación)
  for (const m of LY.MUNIS) sparkle(D, m.x, m.y - 40, prog(t, m.t - 0.1, m.t + 0.7), 90, m.x, '#fff3b0');

  // ---- efectos de pantalla
  drawRain(D, t);
  grade(D, t);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(A.tooth, 0, 0);
  ctx.globalAlpha = 0.55;
  ctx.drawImage(A.vig, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // apertura desde el papel en blanco
  const fi = 1 - ease.inOut(prog(t, T.fadeIn[0], T.fadeIn[1]));
  if (fi > 0) {
    ctx.globalAlpha = fi;
    ctx.drawImage(A.paper, 0, 0);
    ctx.globalAlpha = 1;
  }
  drawTitles(D, t);
}

function grade(D, t) {
  const ctx = D.ctx;
  const layers = [
    ['#ffb877', 0.2 * (1 - prog(t, 3, 9)), 'multiply'],
    ['#e79a4f', 0.16 * prog(t, 11.8, 13.4) * (1 - prog(t, 16.0, 17.6)), 'multiply'],
    ['#7c98b8', 0.2 * prog(t, T.rain[0] - 0.2, T.rain[0] + 0.5) * (1 - prog(t, T.rain[1] - 0.6, T.rain[1] + 0.4)), 'multiply'],
    ['#ffd89a', 0.22 * prog(t, 35.2, 37.5), 'soft-light'],
  ];
  for (const [col, a, op] of layers) {
    if (a <= 0.002) continue;
    ctx.globalCompositeOperation = op;
    ctx.globalAlpha = a;
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, W, H);
  }
  // desaturación del potrero seco
  const ds = 0.24 * prog(t, 12.2, 13.6) * (1 - prog(t, 16.2, 18));
  if (ds > 0.002) {
    ctx.globalCompositeOperation = 'saturation';
    ctx.globalAlpha = ds;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

function drawTitles(D, t) {
  const ctx = D.ctx;
  if (t < T.title1 - 0.1) return;
  // banda de papel para los créditos
  const kb = ease.inOut(prog(t, T.credits - 0.4, T.credits + 0.3));
  if (kb > 0) {
    const g = ctx.createLinearGradient(0, H - 330, 0, H - 200);
    g.addColorStop(0, 'rgba(242,233,214,0)');
    g.addColorStop(1, `rgba(242,233,214,${0.92 * kb})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, H - 330, W, 330);
  }
  const ink = '#2f4a3a';
  const o = { mode: 'words', maxW: 960 };
  handText(D, 'Conectar el bosque es sembrar agua.', W / 2, 112, 80, ink, prog(t, T.title1, T.title1 + 0.45), { ...o, seed: 3, halo: 'rgba(250,246,236,0.9)' });
  handText(D, 'Sembrar agua es sembrar futuro.', W / 2, 206, 80, '#2f6f9a', prog(t, T.title2, T.title2 + 0.45), { ...o, seed: 4, halo: 'rgba(250,246,236,0.9)' });
  handText(D, 'Árboles para mi País', W / 2, H - 150, 78, '#3d6a3a', prog(t, T.credits, T.credits + 0.35), { ...o, seed: 6 });
  handText(D, '+261.000 árboles · 20 municipios de Cundinamarca', W / 2, H - 90, 42, '#4a3d30', prog(t, T.credits + 0.2, T.credits + 0.55), { ...o, seed: 7, font: 'PatrickHand' });
  handText(D, 'Fundación Parque Jaime Duque', W / 2, H - 42, 40, '#4a3d30', prog(t, T.credits + 0.3, T.credits + 0.65), { ...o, seed: 8, font: 'PatrickHand' });
}

export function makeRenderer() {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const D = new Pencil(ctx, W, H);
  return { canvas, ctx, D };
}
