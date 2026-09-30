// Ambientes (guion de color): cielo, sol, bruma, luz y etalonaje de cada momento.
// Se interpolan entre sí a lo largo de la película.
import { mix, lerp, clamp } from '../core/math.js';

export const ENV = {
  // amanecer en el páramo: lavanda arriba, durazno y oro en el horizonte, contraluz
  dawn: {
    skyTop: '#5d78b0', skyMid: '#e0a9a0', skyHor: '#ffd49a',
    sun: { az: -0.3, el: 0.26, col: '#ffcf86', halo: '#ff9e62', k: 1, r: 44 },
    hazeCol: '#efc8b0', hazeDist: 7140, hazeStart: 560, hazeMax: 0.55,
    rays: 0.55, rayCol: '#ffd6a0', bloom: 0.28, light: -1, backlight: 1, longShadow: 0.5,
    waterDeep: '#5a7fb0', waterSky: '#c9d4ec', fog: 0.8,
    grade: { sat: 1.16, con: 1.08, bri: 1, layers: [['#ff9a5a', 0.12, 'soft-light'], ['#3b3f7a', 0.1, 'soft-light']] },
  },
  // mañana en el bosque de niebla: verdes profundos, haces de luz
  forest: {
    skyTop: '#86acd6', skyMid: '#cfe2e2', skyHor: '#f3efd6',
    sun: { az: -0.42, el: 0.42, col: '#fff0c0', halo: '#ffe2a0', k: 1, r: 40 },
    hazeCol: '#c4d6c0', hazeDist: 3400, hazeStart: 630, hazeMax: 0.55, nearDark: 0.55, nearCol: '#16261c',
    rays: 0.5, rayCol: '#fff1c8', bloom: 0.22, light: -1, backlight: 0.35,
    waterDeep: '#3f86a8', waterSky: '#c6e6ee', fog: 0.35,
    grade: { sat: 1.1, con: 1.05, bri: 1, layers: [['#0c5a4a', 0.07, 'soft-light']] },
  },
  // mediodía en el potrero: cielo blanquecino, luz plana y dura, desaturado
  noon: {
    skyTop: '#a8bfd6', skyMid: '#e8e6da', skyHor: '#fbf4e0',
    sun: { az: 0.1, el: 0.62, col: '#ffffff', halo: '#fff4d0', k: 1, r: 52 },
    hazeCol: '#e6d8bc', hazeDist: 4080, hazeStart: 420, hazeMax: 0.55,
    rays: 0.15, rayCol: '#fff8e0', bloom: 0.35, light: 1, backlight: 0,
    waterDeep: '#5b8aa6', waterSky: '#e8efe8', fog: 0, dryBed: 1,
    grade: { sat: 0.84, con: 1.1, bri: 1.02, layers: [['#f0b060', 0.13, 'soft-light'], ['#fff2d8', 0.08, 'screen']] },
  },
  // el momento más triste: la luz se apaga
  low: {
    skyTop: '#8c95a6', skyMid: '#c9c3b6', skyHor: '#e0d5bf',
    sun: { az: 0.1, el: 0.62, col: '#f4efe4', halo: '#e8e0cf', k: 0.4, r: 46 },
    hazeCol: '#d6cebd', hazeDist: 3400, hazeStart: 420, hazeMax: 0.55,
    rays: 0, rayCol: '#ffffff', bloom: 0.1, light: 1, backlight: 0,
    waterDeep: '#5b8aa6', waterSky: '#d8dcd6', fog: 0, dryBed: 1,
    grade: { sat: 0.6, con: 1.06, bri: 0.94, layers: [['#40485a', 0.12, 'soft-light']] },
  },
  // esperanza: mañana dorada
  golden: {
    skyTop: '#7ea4d4', skyMid: '#f2d7a8', skyHor: '#ffe3a4',
    sun: { az: -0.5, el: 0.16, col: '#ffe0a0', halo: '#ffc070', k: 1, r: 46 },
    hazeCol: '#f2dcb4', hazeDist: 4080, hazeStart: 350, hazeMax: 0.55,
    rays: 0.45, rayCol: '#ffe2a8', bloom: 0.3, light: -1, backlight: 0.7, longShadow: 0.8,
    waterDeep: '#4f8ab4', waterSky: '#f6dfb4', fog: 0.1,
    grade: { sat: 1.12, con: 1.04, bri: 1, layers: [['#ffb45a', 0.12, 'soft-light']] },
  },
  // noche del time-lapse
  night: {
    skyTop: '#101a3a', skyMid: '#26345e', skyHor: '#3e4c74',
    sun: { az: 0, el: -0.5, col: '#ffffff', halo: '#ffffff', k: 0, r: 40 },
    moon: { az: 0.3, el: 0.5, k: 1 },
    hazeCol: '#2c3a60', hazeDist: 3060, hazeStart: 280, hazeMax: 0.55, stars: 1,
    rays: 0, rayCol: '#ffffff', bloom: 0.15, light: 1, backlight: 0,
    waterDeep: '#1f3558', waterSky: '#4e6a98', fog: 0.2,
    grade: { sat: 0.7, con: 1.1, bri: 0.62, layers: [['#1a2a60', 0.35, 'multiply']] },
  },
  // tormenta: gris azulado
  storm: {
    skyTop: '#586878', skyMid: '#7d8a94', skyHor: '#a4acae',
    sun: { az: -0.3, el: 0.3, col: '#ffffff', halo: '#ffffff', k: 0, r: 40 },
    hazeCol: '#8d989c', hazeDist: 2210, hazeStart: 210, hazeMax: 0.55,
    rays: 0, rayCol: '#ffffff', bloom: 0.08, light: -1, backlight: 0,
    waterDeep: '#3f6680', waterSky: '#9cb0ba', fog: 0.4,
    grade: { sat: 0.8, con: 1.06, bri: 0.9, layers: [['#2c4a66', 0.18, 'soft-light']] },
  },
  // después de la lluvia: todo brilla, arcoíris
  bright: {
    skyTop: '#5f97d6', skyMid: '#a9d0ea', skyHor: '#eef2dc',
    sun: { az: -0.55, el: 0.3, col: '#fff4d0', halo: '#ffe6a8', k: 1, r: 44 },
    hazeCol: '#d6e6e0', hazeDist: 4420, hazeStart: 420, hazeMax: 0.55,
    rays: 0.35, rayCol: '#fff4d0', bloom: 0.25, light: -1, backlight: 0.4, longShadow: 0.45,
    waterDeep: '#3f8cc0', waterSky: '#cdebf6', fog: 0.05, rainbow: 1,
    grade: { sat: 1.2, con: 1.05, bri: 1, layers: [['#40a060', 0.05, 'soft-light']] },
  },
  // tarde en el valle
  afternoon: {
    skyTop: '#6f9cd2', skyMid: '#bcd6e6', skyHor: '#f6e8c8',
    sun: { az: 0.45, el: 0.28, col: '#ffe8b8', halo: '#ffd490', k: 1, r: 44 },
    hazeCol: '#e6e0cc', hazeDist: 5100, hazeStart: 420, hazeMax: 0.55,
    rays: 0.3, rayCol: '#ffe8c0', bloom: 0.25, light: 1, backlight: 0.3, longShadow: 0.6,
    waterDeep: '#3f86b8', waterSky: '#d4e8ee', fog: 0,
    grade: { sat: 1.12, con: 1.04, bri: 1, layers: [['#ffb060', 0.08, 'soft-light']] },
  },
};

const COLS = ['skyTop', 'skyMid', 'skyHor', 'hazeCol', 'rayCol', 'waterDeep', 'waterSky', 'nearCol'];
const NUMS = ['longShadow', 'hazeDist', 'hazeStart', 'hazeMax', 'rays', 'bloom', 'light', 'backlight', 'fog', 'stars', 'rainbow', 'dryBed', 'nearDark'];
const DEF = { nearCol: '#1d2a1c', nearDark: 0 };

// mezcla de dos ambientes
export function blendEnv(a, b, k) {
  k = clamp(k);
  if (k <= 0) return { ...a };
  if (k >= 1) return { ...b };
  const o = { ...a };
  for (const c of COLS) o[c] = mix(a[c] ?? DEF[c], b[c] ?? DEF[c], k);
  for (const n of NUMS) o[n] = lerp(a[n] ?? DEF[n] ?? 0, b[n] ?? DEF[n] ?? 0, k);
  const sa = a.sun, sb = b.sun;
  o.sun = { az: lerp(sa.az, sb.az, k), el: lerp(sa.el, sb.el, k), col: mix(sa.col, sb.col, k), halo: mix(sa.halo, sb.halo, k), k: lerp(sa.k, sb.k, k), r: lerp(sa.r, sb.r, k) };
  if (a.moon || b.moon) {
    const ma = a.moon || { ...b.moon, k: 0 }, mb = b.moon || { ...a.moon, k: 0 };
    o.moon = { az: lerp(ma.az, mb.az, k), el: lerp(ma.el, mb.el, k), k: lerp(ma.k, mb.k, k) };
  }
  // etalonaje: parámetros interpolados y capas de color con pesos
  const ga = a.grade, gb = b.grade;
  o.grade = {
    sat: lerp(ga.sat, gb.sat, k), con: lerp(ga.con, gb.con, k), bri: lerp(ga.bri, gb.bri, k),
    layers: [...ga.layers.map(([c, al, op]) => [c, al * (1 - k), op]), ...gb.layers.map(([c, al, op]) => [c, al * k, op])],
  };
  return o;
}

export function gradeFilter(g) {
  return `saturate(${g.sat.toFixed(3)}) contrast(${g.con.toFixed(3)}) brightness(${g.bri.toFixed(3)})`;
}
