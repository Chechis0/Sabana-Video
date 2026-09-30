// Guion del filminuto (41 s, 120 BPM). Todo lo que ocurre es función del tiempo:
// la gota, los osos, la comunidad, el caudal de la quebrada, la siembra y la luz.
import { clamp, lerp, ease, prog, spring, noise1, hrand, mulberry32, mix } from './core/math.js';
import { pchip } from './core/interp.js';
import { bed, streamZ, ground, STREAM_W } from './world/geo.js';
import { ENV, blendEnv } from './world/envs.js';
import { HERO } from './world/populate.js';

export const BEAT = 0.5;
const HALF = STREAM_W / 2;

// ------------------------------------------------------------------ tiempos
export const T = {
  // 1 · Rocío (macro en el páramo)
  condense: [0.15, 1.2], eyesOpen: 1.35, lookSun: [1.75, 2.6], wobble: [2.75, 3.3], fall: 3.35,
  // 2 · Caída y páramo
  land: 3.85, slide: [4.15, 4.6], reveal: [4.4, 6.0],
  // 3 · Bosque
  ride: [5.2, 12.0], bird: [7.7, 9.3], bears: [10.0, 11.7],
  // 4 · Potrero
  stuck: 12.8, evap: [13.0, 15.1], apart: [15.1, 16.5],
  // 5 · La niña
  shadow: 16.55, wake: 17.0, place: [17.35, 18.0], wave: 18.2, arrive: [18.4, 19.2],
  // 6 · Sembrar
  plant0: 19.5, plantN: 8,
  // 7 · El tiempo
  lapse: [23.0, 26.0],
  // 8 · Lluvia
  thunder: 26.0, rainIn: [26.0, 26.5], refill: [27.0, 27.9], flow: 28.2, rainOut: [28.6, 29.4],
  // 9 · Reencuentro
  front: [28.2, 30.6], cubRun: [29.4, 30.6], meet: 30.6, cheer: 30.9,
  // 10 · Río abajo
  whip: [32.0, 33.0], canTilt: [33.2, 33.8], leap: [33.85, 34.35], sprout: 34.5,
  // 11 · Revelación
  rise: [35.0, 36.2], map: 36.0, title1: 37.1, title2: 37.9, credits: 38.9,
  end: 41,
};
export const plantTimes = Array.from({ length: T.plantN }, (_, i) => T.plant0 + i * BEAT);

// ------------------------------------------------------------------ lugares (x mundo, off = z respecto al cauce)
export const X = {
  hero: 640, spring: 700, forest: 1500, gap: 4200, stuck: 4600, forestB: 6200, meet: 5250, meetOff: -210,
  cubEdge: 4330, momEdge: 5090, garden: 8620,
};
export const zAt = (x, off = 0) => streamZ(x) + off;
export const gy = (x, off = 0) => ground(x, zAt(x, off));

// ------------------------------------------------------------------ agua
// frente de agua en el potrero: antes de la lluvia muere en X.stuck
export function waterFront(t) {
  if (t < T.ride[1]) return X.stuck + 60;
  if (t < T.stuck) return lerp(X.stuck + 60, X.stuck + 8, ease.outQuad(prog(t, T.ride[1], T.stuck)));
  if (t < T.flow) return X.stuck + 8;
  if (t < T.front[1]) return lerp(X.stuck + 8, X.forestB + 300, ease.inOutSine(prog(t, T.flow, T.front[1])));
  return 1e9;
}
export function water(t) {
  const front = waterFront(t);
  const after = clamp((t - T.front[1]) / 1.5);
  return (x) => {
    if (x < X.spring - 20) return 0;
    if (x < X.spring + 60) return prog(x, X.spring - 20, X.spring + 60);
    if (x < X.gap) return 1;
    if (x < X.forestB) {
      // en el potrero el cauce se adelgaza hasta secarse
      if (x > front) return 0;
      const thin = t < T.flow ? lerp(1, 0.18, prog(x, X.gap, X.stuck)) : 1;
      return thin * clamp((front - x) / 60);
    }
    // aguas abajo: poca agua hasta que se restaura el corredor
    return lerp(0.22, 1, after);
  };
}

// ------------------------------------------------------------------ restauración
export function green(t) {
  if (t < T.lapse[0]) return 0;
  if (t < T.lapse[1]) return 0.75 * ease.inOut(prog(t, T.lapse[0] + 0.3, T.lapse[1]));
  return lerp(0.75, 1, prog(t, T.lapse[1], T.meet));
}
// crecimiento escalonado (se ve como un time-lapse)
function lapseGrowth(t, seed) {
  if (t < T.lapse[0]) return 0;
  const u = prog(t, T.lapse[0] + 0.2 + hrand(seed) * 0.3, T.lapse[1] - 0.1);
  const steps = 7;
  const q = Math.floor(u * steps) / steps + ease.outBack(clamp((u * steps) % 1 * 3), 2) / steps;
  return clamp(u >= 1 ? 1 : q);
}
const KINDS = ['roble', 'aliso', 'encenillo', 'siete', 'cucharo', 'roble', 'encenillo', 'aliso'];
// siembras protagonistas (a la vista durante el plano 6) y el resto del corredor
export const plantings = (() => {
  const out = [];
  const heroX = [4480, 4700, 4880, 5060, 5240, 5420, 5600, 5780];
  const heroOff = [150, -175, 210, -150, 540, -190, 140, -165];
  heroX.forEach((x, i) => out.push({ i, x, off: heroOff[i], t: plantTimes[i], kind: KINDS[i], seed: 7100 + i * 13, hero: true }));
  // la plántula de la niña, junto a la gota
  out.push({ i: 99, x: X.stuck + 42, off: 70, t: T.place[1], kind: 'encenillo', seed: 7777, hero: true, girl: true });
  const r = mulberry32(88);
  for (let k = 0; k < 44; k++) {
    const x = X.gap + 60 + r() * (X.forestB - X.gap - 120);
    const front = r() < 0.3;
    const off = front ? -(HALF + 160 + r() * 300) : HALF + 110 + r() * 800;
    if (Math.abs(x - X.stuck) < 120 && Math.abs(off) < 260) continue;
    if (front && Math.abs(x - X.meet) < 420) continue;
    if (Math.abs(x - X.meet) < 330 && off < 700) continue; // claro del reencuentro
    out.push({ i: 200 + k, x, off, t: T.lapse[0] - 0.01, kind: KINDS[k % KINDS.length], seed: 7300 + k * 7 });
  }
  return out;
})();
export function plantGrowth(p, t) {
  if (t < p.t) return 0;
  const g0 = Math.min(0.195, 0.19 * ease.outBack(prog(t, p.t, p.t + 0.35), 2.2));
  if (t < T.lapse[0]) return g0;
  const lg = lapseGrowth(t, p.seed);
  const after = prog(t, T.lapse[1], T.meet + 0.5);
  return clamp(lerp(0.19, 0.86, lg) + 0.14 * ease.inOut(after));
}
export function plantedTrees() {
  return plantings.map((p) => ({ x: p.x, z: zAt(p.x, p.off), kind: p.kind, seed: p.seed, g: (t) => plantGrowth(p, t) }));
}

// ------------------------------------------------------------------ la Gota
const blinkAt = (t, off = 0, period = 2.9) => {
  const ph = (t + off) % period;
  return ph < 0.13 ? Math.abs(ph - 0.065) / 0.065 : 1;
};
function lookKeys(t, keys) {
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

// punta de la hoja del frailejón protagonista (mundo)
export function heroTip() {
  const f = HERO;
  const th = 150 * f.h;
  const a = f.tip.a, L = f.tip.len * f.h;
  const lx = L * Math.cos(a) + 0.12 * L * Math.sin(a), ly = L * Math.sin(a) - 0.12 * L * Math.cos(a);
  return { x: f.x + lx, y: ground(f.x, f.z) + th - ly, z: f.z - 8 };
}

// recorrido de la gota río abajo: x(t) por tramos (rápido en cascadas, lento en pozos)
const rideKeys = [
  [T.slide[1], X.spring + 40], [5.2, X.spring + 110], [6.2, 1150], [7.4, 1960], [7.8, 2020], [9.2, 2200],
  [9.6, 2400], [10.1, 2950], [10.4, 3040], [11.4, 3200], [11.8, 3520], [12.4, 4150], [T.stuck, X.stuck],
];
const rideX = pchip(rideKeys.map((k) => k[0]), rideKeys.map((k) => k[1]));
const followKeys = [
  [T.flow, X.stuck], [28.8, X.stuck + 120], [29.6, X.stuck + 600], [30.4, 5520], [31.2, 5900], [32.0, 6250],
  [32.5, 6900], [33.0, 7700], [33.4, 8300], [33.85, 8560],
];
const followX = pchip(followKeys.map((k) => k[0]), followKeys.map((k) => k[1]));

export function dropX(t) {
  if (t < T.slide[1]) return null;
  if (t < T.stuck) return rideX(t);
  if (t < T.flow) return X.stuck;
  if (t < T.leap[0]) return followX(Math.min(t, followKeys[followKeys.length - 1][0]));
  return null;
}

// estado de la gota: posición en el mundo + expresión
export function dropState(t) {
  const tip = heroTip();
  if (t < T.condense[0]) return null;
  if (t < T.fall) {
    const g = prog(t, T.condense[0], T.condense[1]);
    const s = 0.08 + 0.92 * ease.outCubic(g) + 0.05 * spring(t - T.condense[1], 2.2, 4) * (t > T.condense[1] ? 1 : 0);
    const wob = 0.08 * Math.sin(t * 11) * (1 - g);
    let sx = 1 + wob, sy = 1 - wob;
    let eyes = t < T.eyesOpen ? 0 : ease.outBack(clamp((t - T.eyesOpen) / 0.18));
    if (t > T.eyesOpen + 0.4 && t < T.eyesOpen + 0.52) eyes = 0.1;
    const look = lookKeys(t, [[T.eyesOpen, 0, 0.2], [T.lookSun[0], -0.2, 0], [T.lookSun[0] + 0.25, -1, -0.5], [T.lookSun[1], -1, -0.5], [T.wobble[0], 0.2, 0.9], [T.fall, 0, 1]]);
    // anticipación: se estira antes de soltarse
    const ant = prog(t, T.wobble[0], T.fall);
    sx *= 1 - 0.12 * Math.sin(ant * Math.PI * 3) * ant;
    sy *= 1 + 0.2 * ant;
    const mood = t < T.eyesOpen + 0.55 ? 'neutral' : t < T.lookSun[1] ? 'joy' : t < T.wobble[0] + 0.2 ? 'happy' : 'o';
    const S = Math.max(0.02, s);
    // cuelga de la punta: la base baja según tamaño y estiramiento
    return { x: tip.x, y: tip.y - 46 * S * sy * 0.92, z: tip.z, s: S, sx, sy, eyes, look, mood, shadow: false, rim: 1, hang: true };
  }
  const M = { x: tip.x, z: tip.z, y: gy(X.hero + 90, 58) + 12 };
  if (t < T.land) {
    const u = prog(t, T.fall, T.land);
    return { x: tip.x, y: lerp(tip.y - 46 * 1.2, M.y, u * u), z: tip.z, s: 1, sx: 0.8, sy: 1.28, eyes: 1, look: [0, 1], mood: 'o', shadow: false, rim: 1 };
  }
  if (t < T.slide[0]) {
    const u = t - T.land;
    const sq = spring(u, 3.2, 6) * 0.45;
    return { ...M, s: 1, sx: 1 + sq, sy: 1 - sq, eyes: u < 0.14 ? 0.1 : 1, look: [0.3, 0], mood: u < 0.14 ? 'neutral' : 'joy', rim: 1 };
  }
  if (t < T.slide[1]) {
    const u = ease.inOut(prog(t, T.slide[0], T.slide[1]));
    const P = { x: X.spring + 40, z: zAt(X.spring + 40, 0), y: bed(X.spring + 40) + 5 };
    return { x: lerp(M.x, P.x, u), y: lerp(M.y, P.y, u) + Math.sin(u * Math.PI) * 30, z: lerp(M.z, P.z, u), s: 1, sx: 0.9, sy: 1.12, rot: 0.4 * Math.sin(u * Math.PI), eyes: 1, look: [0.6, 0.4], mood: 'joy', rim: 1 };
  }
  // ---- sobre el agua
  if (t < T.leap[0]) {
    const x = dropX(t);
    const z = zAt(x, 0);
    let y = bed(x) + 5;
    let size = 1, sx = 1, sy = 1, rot = 0.1 * Math.sin(t * 5.3), mood = 'joy', eyes = blinkAt(t, 0.7);
    let look = [0.7, 0.2], bob = 2.5 * Math.abs(Math.sin(t * 6.5)), sweat = 0, brow, tear = 0;
    // en las cascadas salta
    const v = (dropX(t + 0.02) - dropX(t - 0.02)) / 0.04;
    if (t < T.stuck) {
      if (t > T.bird[0] && t < T.bird[1]) { look = [0.9, -0.6]; mood = 'joy'; }
      else if (t > T.bears[0] && t < T.bears[1]) { look = [0.4, -0.5]; mood = t > 10.7 ? 'joy' : 'o'; }
      else if (t > 11.9) {
        const k = prog(t, 11.9, T.stuck);
        mood = k < 0.4 ? 'o' : 'worried';
        look = [0.9, 0.3];
        bob *= 1 - k; rot *= 1 - k;
      }
      if (Math.abs(v) > 900) { sx = 0.86; sy = 1.2; rot += 0.3; }
    } else if (t < T.flow) {
      // atascada en el barro: se evapora, luego llega la niña, luego la lluvia la recarga
      bob = 0; rot = 0.03 * Math.sin(t * 2);
      size = lerp(1, 0.48, ease.inOut(prog(t, T.evap[0], T.evap[1])));
      mood = 'worried'; look = [0.3, 0.2];
      if (t > T.evap[0]) { mood = 'sad'; sweat = ((t - T.evap[0]) * 1.4) % 1; look = [-0.2, 0.4]; }
      eyes = t < T.evap[0] + 0.8 ? blinkAt(t, 0.2, 2.2) : lerp(1, 0, prog(t, T.evap[0] + 1.2, T.evap[1] - 0.1));
      if (t > T.evap[1]) { eyes = 0; sweat = 0; mood = 'sad'; }
      if (t > T.wake) {
        eyes = ease.outBack(prog(t, T.wake, T.wake + 0.3));
        mood = t < T.place[1] ? 'o' : 'happy';
        look = lookKeys(t, [[T.wake, 0, -1], [T.place[0], 0.3, -0.9], [T.place[1], 0.8, -0.3], [T.wave, -0.6, -0.6], [19.4, 0.5, -0.4]]);
        if (t > 19.4) { look = [0.9, -0.2]; eyes = blinkAt(t, 0.3, 2.4); }
      }
      if (t > T.lapse[0]) { mood = 'happy'; look = [0, -0.6]; eyes = blinkAt(t, 0.1, 1.2); }
      if (t > T.rainIn[0]) { mood = 'o'; look = [0, -1]; eyes = 1; }
      if (t > T.refill[0]) {
        // tres gotas de lluvia la recargan
        const bumps = [T.refill[0], T.refill[0] + 0.3, T.refill[0] + 0.6];
        let sq = 0;
        size = 0.48;
        for (const b of bumps) if (t > b) { size += 0.175; sq += spring(t - b, 3, 6) * 0.3; }
        sx = 1 + sq; sy = 1 - sq;
        mood = 'joy'; look = [0, -0.7];
      }
    } else {
      // río abajo con el agua que regresa
      mood = 'joy'; look = [0.9, 0.1];
      if (t > T.meet - 0.4 && t < T.meet + 0.8) look = [-0.4, -0.5];
      if (t > T.whip[0]) { sx = 0.88; sy = 1.16; rot = 0.25; }
      if (t > T.canTilt[0]) { look = [-0.6, -0.4]; mood = t < T.canTilt[1] ? 'o' : 'determined'; }
    }
    return { x, y: y + bob, z, s: size, sx, sy, rot, eyes, look, mood, sweat, brow, tear, float: true };
  }
  // ---- salto al huerto
  const J = { x: followX(T.leap[0]), y: bed(followX(T.leap[0])) + 5, z: zAt(followX(T.leap[0]), 0) };
  const G = seedSpot();
  if (t < T.leap[1]) {
    const u = prog(t, T.leap[0], T.leap[1]);
    return { x: lerp(J.x, G.x, u), y: lerp(J.y, G.y, u) + Math.sin(u * Math.PI) * 130, z: lerp(J.z, G.z, u), s: 1, sx: 0.9, sy: 1.12, rot: Math.PI * 2 * ease.inOut(u), eyes: 1, look: [0.5, 0.5], mood: 'joy' };
  }
  if (t < T.sprout) {
    const u = prog(t, T.leap[1], T.sprout);
    const sq = spring(t - T.leap[1], 3, 5) * 0.35;
    return { ...G, s: 1, sx: 1 + sq + u * 0.4, sy: Math.max(0.05, 1 - sq - u * 0.95), eyes: u < 0.5 ? 1 : 0.1, look: [0, 0], mood: 'joy', alpha: 1 - u * u };
  }
  return null;
}

// ------------------------------------------------------------------ huerto escolar del pueblo
export function seedSpot() {
  const x = X.garden + 40, off = -250;
  return { x, z: zAt(x, off), y: gy(x, off) };
}
export const gardenKid = { x: X.garden - 30, off: -255, ruana: '#3f8a6a', hat: 'straw', skin: '#9b6444', seed: 21, kid: true };
export function gardenKidState(t) {
  const up = prog(t, T.canTilt[0], T.canTilt[0] + 0.2), down = prog(t, T.canTilt[1], T.canTilt[1] + 0.25);
  const canTilt = ease.inOut(up) * (1 - ease.inOut(down));
  let pose = 'hold', hold = 'can', mood = 'smile';
  if (t > T.canTilt[0] + 0.3 && t < T.leap[1]) mood = 'sad';
  if (t > T.sprout + 0.1) { pose = 'cheer'; hold = null; mood = 'joy'; }
  return { ...gardenKid, pose, hold, canTilt, mood, ph: (t - T.sprout) * 7, dir: 1 };
}

// ------------------------------------------------------------------ osos
export function cubState(t) {
  const st = { seed: 61, cub: true, dir: 1, walk: 0, moving: 0, headDip: 0, sit: 0, eyes: blinkAt(t, 1.1, 3.3), mood: 'neutral', size: 0.55 };
  const pool = { x: 3150, off: 88 };
  if (t < 9.6) return null;
  if (t < T.bears[1] + 0.3) {
    // bebe en el pozo; la gota pasa frente a su nariz
    const dip = t < 10.55 ? 0.9 + 0.1 * Math.sin(t * 13) : t < 10.8 ? lerp(0.9, 0.1, prog(t, 10.55, 10.8)) : 0.1;
    return { ...st, ...pool, dir: -1, headDip: dip, mood: t > 10.8 ? 'happy' : 'neutral', look: 0.5 };
  }
  const edge = { x: X.cubEdge, off: -300 };
  if (t < 15.0) return null;
  if (t >= 19.2 && t < T.cubRun[0]) return null;
  if (t < T.cubRun[0]) {
    const sit = ease.inOut(prog(t, 15.7, 16.2));
    const mood = t < T.lapse[0] ? 'sad' : 'neutral';
    return { ...st, ...edge, dir: 1, sit, headDip: 0.15 * sit, headUp: 0.15 * (1 - sit), mood };
  }
  if (t < T.meet) {
    // corre por el corredor nuevo y cruza la quebrada de un salto
    const u = ease.inOutSine(prog(t, T.cubRun[0], T.meet));
    const x = lerp(edge.x, X.meet - 75, u);
    const off = lerp(edge.off, X.meetOff, u);
    return { ...st, x, off, dir: 1, walk: t * 14, run: 1 - prog(t, T.meet - 0.15, T.meet), moving: 0, mood: 'happy' };
  }
  const k = prog(t, T.meet, T.meet + 0.3);
  return { ...st, x: X.meet - 75, off: X.meetOff, dir: 1, nuzzle: k, mood: 'happy', eyes: t > T.meet + 0.2 && t < T.meet + 1.3 ? 0.1 : st.eyes };
}
export function momState(t) {
  const st = { seed: 71, dir: -1, walk: 0, moving: 0, headDip: 0, sit: 0, eyes: blinkAt(t, 0.4, 3.7), mood: 'neutral', size: 1 };
  const pool = { x: 3330, off: 250 };
  const edge = { x: X.momEdge, off: 760 };
  if (t < 9.6) return null;
  if (t < T.bears[1] + 0.3) return { ...st, ...pool, dir: -1, headDip: 0, look: -0.3 };
  if (t < T.meet - 1.8) return { ...st, ...edge, dir: -1, walk: t * 5, moving: t > 15.1 && t < 15.9 ? 0.6 : 0, headUp: 0.1, mood: t < T.lapse[0] ? 'sad' : 'neutral' };
  if (t < T.meet) {
    const u = ease.inOut(prog(t, T.meet - 1.8, T.meet));
    return { ...st, x: lerp(edge.x, X.meet + 70, u), off: lerp(edge.off, X.meetOff + 10, u), dir: -1, walk: t * 11, run: 0.6, moving: 1 - prog(t, T.meet - 0.15, T.meet), mood: 'happy' };
  }
  const k = prog(t, T.meet, T.meet + 0.3);
  return { ...st, x: X.meet + 70, off: X.meetOff + 10, dir: -1, headDip: 0.35 * k, mood: 'happy', eyes: t > T.meet + 0.2 && t < T.meet + 1.3 ? 0.1 : st.eyes };
}

// ------------------------------------------------------------------ colibrí
export function birdState(t) {
  if (t > T.bird[0] && t < T.bird[1]) {
    const x = dropX(t);
    const u = prog(t, T.bird[0], T.bird[1]);
    let ox, oy;
    if (u < 0.22) { const k = ease.outCubic(u / 0.22); ox = lerp(320, 70, k); oy = lerp(220, 70, k); }
    else if (u < 0.8) { ox = 70 + Math.sin(t * 3) * 10; oy = 70 + Math.sin(t * 4.3) * 8; }
    else { const k = ease.inCubic((u - 0.8) / 0.2); ox = lerp(70, 420, k); oy = lerp(70, 320, k); }
    return { x: x + ox, y: bed(x) + 5 + oy, z: zAt(x, -20), dir: -1, s: 1.1, tilt: u > 0.8 ? -0.4 : 0.05 * Math.sin(t * 6) };
  }
  return null;
}

// ------------------------------------------------------------------ la comunidad
export const GIRL = { ruana: '#e0603a', skin: '#b07a52', seed: 15, kid: true, braids: true, hat: null, ribbon: '#f2c233' };
export function girlState(t) {
  if (t < T.shadow - 0.4) return null;
  const x = X.stuck + 78, off = 32;
  if (t < T.lapse[0]) {
    let pose = 'kneel', hold = t < T.place[1] ? 'seedling' : null;
    let lookUp = 0, mood = 'smile', dir = -1;
    if (t < T.shadow) return { ...GIRL, x: x + 120 * (1 - prog(t, T.shadow - 0.4, T.shadow)), off, pose: 'walk', ph: t * 10, dir, hold: 'seedling', kneel: 0 };
    const kneel = ease.inOut(prog(t, T.shadow, T.shadow + 0.35));
    if (t > T.place[0] && t < T.place[1]) pose = 'plant';
    if (t > T.wave && t < T.arrive[1]) { pose = 'wave'; dir = -1; }
    if (t > T.arrive[1]) { pose = 'plant'; }
    return { ...GIRL, x, off, pose, ph: t * 6, dir, hold, kneel, lookUp, mood };
  }
  if (t < T.cheer) return null;
  return { ...GIRL, x: X.meet - 260, off: 360, pose: 'cheer', ph: (t - T.cheer) * 7, dir: 1 };
}

const CREW = [
  { ruana: '#3f7f9a', hat: 'straw', skin: '#a8714b', seed: 31, hold: 'shovel' },
  { ruana: '#d9a53a', hat: 'felt', skin: '#8d5a3b', seed: 32, hold: 'seedling' },
  { ruana: '#8a4a6a', hat: 'straw', skin: '#c08a60', seed: 33, hold: 'shovel' },
  { ruana: '#5b5a98', hat: 'felt', skin: '#9b6444', seed: 34, hold: 'seedling' },
  { ruana: '#6a8a3a', hat: 'straw', skin: '#b07a52', seed: 35, hold: 'shovel', kid: true },
  { ruana: '#c0504a', hat: 'felt', skin: '#8a5a40', seed: 36, hold: 'seedling' },
];
// cada persona siembra las plantas i ≡ k (mod 6) del plano 6 y luego celebra en el corredor
export const crewPlans = CREW.map((c, k) => {
  const mine = plantings.filter((p) => p.hero && !p.girl && p.i % CREW.length === k);
  const wps = []; // [t, x, off, pose]
  const startX = X.stuck + 180 + k * 95, startOff = 560 + (k % 2) * 110;
  // bajan despacio por la ladera (plano de la niña)… y al corte ya están sembrando
  wps.push([T.arrive[0] + k * 0.08, startX, startOff, 'walk']);
  wps.push([19.19, startX - 30, startOff - 90, 'walk']);
  let first = true;
  for (const p of mine) {
    const side = p.off > 0 ? 1 : -1;
    const sx = p.x - 42, so = p.off + side * 6;
    if (first) { wps.push([19.2, sx - 60, so, 'walk']); first = false; }
    const at = (tt) => Math.max(tt, wps[wps.length - 1][0] + 0.02);
    wps.push([at(p.t - 0.55), sx, so, 'walk']);
    wps.push([at(p.t - 0.5), sx, so, 'dig']);
    wps.push([at(p.t), sx, so, 'plant']);
    wps.push([at(p.t + 0.3), sx, so, 'stand']);
  }
  const last = wps[wps.length - 1];
  wps.push([Math.max(last[0] + 0.1, T.lapse[0]), last[1], last[2], 'gone']);
  // en el reencuentro: a lo largo del corredor, celebrando
  const cx = X.meet - 520 + k * 170, co = 480 + (k % 2) * 120;
  wps.push([T.cheer - 0.01, cx, co, 'stand']);
  wps.push([T.cheer, cx, co, 'cheer']);
  wps.push([99, cx, co, 'cheer']);
  return { c, wps, mine };
});
export function personState(plan, t) {
  const { c, wps } = plan;
  if (t < wps[0][0]) return null;
  let i = 0;
  while (i < wps.length - 1 && t >= wps[i + 1][0]) i++;
  const a = wps[i], b = wps[Math.min(i + 1, wps.length - 1)];
  if (a[3] === 'gone') return null;
  const u = b[0] > a[0] ? prog(t, a[0], b[0]) : 1;
  let x = a[1], off = a[2], pose = a[3], dir = 1;
  if (a[3] === 'walk' && (Math.abs(b[1] - a[1]) > 2 || Math.abs(b[2] - a[2]) > 2)) {
    x = lerp(a[1], b[1], u); off = lerp(a[2], b[2], u);
    dir = b[1] >= a[1] ? 1 : -1;
  } else if (a[3] === 'walk') pose = 'stand';
  let hold = c.hold;
  if (pose === 'cheer') hold = null;
  if (c.hold === 'seedling' && plan.mine.length && t > plan.mine[plan.mine.length - 1].t) hold = null;
  return { ...c, x, off, dir, pose, hold, ph: t * (pose === 'dig' ? 12 : pose === 'cheer' ? 7 : pose === 'plant' ? 8 : 10), kneel: pose === 'plant' ? 1 : 0 };
}

// ------------------------------------------------------------------ guion de color
const K = (t, name) => [t, name];
const COLOR_SCRIPT = [
  K(0, 'dawn'), K(4.8, 'dawn'), K(6.6, 'forest'), K(11.4, 'forest'), K(12.9, 'noon'), K(15.0, 'noon'), K(16.6, 'low'),
  K(17.3, 'golden'), K(22.9, 'golden'),
  // time-lapse: atardecer, noche, amanecer, día, nubes
  K(23.35, 'dusk'), K(23.8, 'night'), K(24.4, 'night'), K(24.8, 'dawn'), K(25.2, 'forest'), K(25.9, 'storm'),
  K(28.3, 'storm'), K(29.3, 'bright'), K(32.0, 'bright'), K(33.2, 'afternoon'), K(41, 'afternoon'),
];
ENV.dusk = blendEnv(ENV.golden, ENV.night, 0.35);
ENV.dusk.skyHor = '#ff9a60'; ENV.dusk.skyMid = '#c07a8a';
export function envAt(t) {
  let i = 0;
  while (i < COLOR_SCRIPT.length - 2 && t >= COLOR_SCRIPT[i + 1][0]) i++;
  const [t0, a] = COLOR_SCRIPT[i], [t1, b] = COLOR_SCRIPT[i + 1];
  const e = blendEnv(ENV[a], ENV[b], ease.inOutSine(prog(t, t0, t1)));
  e.green = green(t);
  e.water = water(t);
  return e;
}
