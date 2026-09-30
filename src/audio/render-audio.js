// Banda sonora original (120 BPM, Re mayor): tiple, marimba, pad, bajo y efectos, sincronizados al guion.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { T, plantTimes, DURATION, BEAT } from '../timeline.js';
import { MUNIS } from '../world/layout.js';
import { mulberry32 } from '../core/math.js';
import {
  SR, NOTE, Mix, strum, mallet, bell, pad, bass, kick, shaker, plink, glide, splash, whoosh, wind, trickle,
  chirp, buzz, cicadas, rain, rumble, thud, crunch, pop, clank, boing, reverb, writeWav, tipleNote,
} from './synth.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const mix = new Mix(DURATION + 0.5);
const bar = (i) => i * 2; // compás i empieza en 2i s
const N = NOTE;

// ---------------------------------------------------------------- acordes
const CH = {
  D: ['D3', 'A3', 'D4', 'F#4'],
  G: ['G3', 'B3', 'D4', 'G4'],
  A: ['A3', 'C#4', 'E4', 'A4'],
  Bm: ['B3', 'D4', 'F#4', 'B4'],
  Em: ['E3', 'G3', 'B3', 'E4'],
  DF: ['F#3', 'A3', 'D4', 'F#4'],
};
const BASS = { D: 'D2', G: 'G2', A: 'A2', Bm: 'B1', Em: 'E2', DF: 'F#2' };

function padChord(t, notes, dur, gain = 1, o = {}) {
  const [L, R] = pad(notes, dur, o);
  mix.addStereo(L, R, t, gain, 0.35);
}
// patrón de tiple estilo andino (síncopa 3+3+2 en corcheas)
function tipleBar(t0, chord, gain = 0.32, seed = 1) {
  const hits = [[0, false, 1], [0.75, true, 0.6], [1.5, false, 0.8], [2, false, 1], [2.75, true, 0.6], [3.5, false, 0.75]];
  hits.forEach(([b, up, g], k) => strum(mix, t0 + b * BEAT, CH[chord], { gain: gain * g, up, seed: seed * 10 + k, pan: 0.25, dur: 1.1 }));
}
function bassBar(t0, chord, gain = 0.45) {
  mix.add(bass(N(BASS[chord]), 0.95), t0, gain, -0.1, 0.05);
  mix.add(bass(N(BASS[chord]) * (chord === 'A' ? 1.5 : 1.5), 0.9), t0 + 2 * BEAT, gain * 0.8, -0.1, 0.05);
}
function shakerBar(t0, gain = 0.1, seed = 1) {
  for (let k = 0; k < 8; k++) mix.add(shaker(0.07, seed * 8 + k), t0 + k * BEAT * 0.5, gain * (k % 2 ? 1 : 0.55), 0.35, 0.05);
}
function kickBar(t0, gain = 0.35) {
  mix.add(kick(), t0, gain, 0, 0.02);
  mix.add(kick(), t0 + 2 * BEAT, gain * 0.8, 0, 0.02);
}
function melody(t0, notes, gain = 0.3, pan = -0.2, soft = 0) {
  // notes: [[nota, pulso, duración]]
  for (const [n, b, d = 1] of notes) mix.add(mallet(N(n), Math.max(0.6, d * BEAT + 0.6), { soft }), t0 + b * BEAT, gain, pan, 0.35);
}

// ================================================================ 1 · Páramo al amanecer (0–6 s)
mix.add(wind(8.5, 7, 420), 0, 0.22, -0.3, 0.1);
mix.add(wind(8, 8, 650), 0.3, 0.12, 0.4, 0.1);
padChord(0, ['D3', 'A3', 'E4', 'F#4', 'C#5'], 6.2, 0.9, { att: 2.2, rel: 1.5, cutoff: 1300 });
// condensación: brillo cristalino que sube
for (let k = 0; k < 7; k++) mix.add(bell(N(['A5', 'B5', 'D6', 'E6', 'F#6', 'A6', 'B6'][k]), 1.4, { ratio: 2, index: 1.2 }), T.condense[0] + k * 0.24, 0.06 + k * 0.01, -0.4 + k * 0.13, 0.5);
mix.add(plink(1500, 0.4), T.condense[1], 0.35, 0.1, 0.4);
mix.add(mallet(N('A5'), 1), T.condense[1] + 0.02, 0.18, 0.1, 0.4);
mix.add(plink(2200, 0.12), T.eyesOpen, 0.12, 0.1, 0.3); // parpadeo
mix.add(plink(2400, 0.1), T.eyesOpen + 0.36, 0.1, 0.1, 0.3);
melody(0, [['F#5', T.lookAround[0] / BEAT + 0.3, 0.5], ['A5', T.lookAround[0] / BEAT + 0.9, 0.5]], 0.14, 0.3, 0.3);
mix.add(glide(1300, 480, T.land - T.fall), T.fall, 0.13, 0.1, 0.3); // caída
mix.add(boing(220, 520, 0.3), T.land, 0.3, 0.05, 0.2);
mix.add(splash(0.35, 3, 2500), T.land, 0.3, 0.05, 0.2);
mix.add(boing(350, 700, 0.25), T.slideToPool[0] + 0.05, 0.15, 0, 0.2);
mix.add(splash(0.6, 4, 2200), T.poolSplash, 0.45, -0.05, 0.3);
[1.2, 2.9, 4.8].forEach((t, i) => mix.add(chirp(100 + i, 3), t, 0.05, i % 2 ? 0.7 : -0.7, 0.5));
// entrada del tiple (anacrusa)
strum(mix, 5.5, CH.D, { gain: 0.25, up: true, seed: 5 });

// ================================================================ 2 · Descenso por el bosque (6–12 s)
mix.add(trickle(8.2, 11, 26), 5.6, 0.32, -0.15, 0.2);
const themeA = [
  ['D', [['F#5', 0, 0.5], ['A5', 0.5, 0.5], ['B5', 1, 0.5], ['A5', 1.5, 0.5], ['F#5', 2, 0.5], ['E5', 2.5, 0.5], ['D5', 3, 0.5], ['E5', 3.5, 0.5]]],
  ['G', [['D5', 0, 0.5], ['B4', 0.5, 0.5], ['D5', 1, 0.5], ['E5', 1.5, 0.5], ['G5', 2, 1], ['F#5', 3, 0.5], ['E5', 3.5, 0.5]]],
  ['A', [['C#5', 0, 0.5], ['E5', 0.5, 0.5], ['A5', 1, 1], ['G5', 2, 0.5], ['F#5', 2.5, 0.5], ['E5', 3, 1]]],
];
themeA.forEach(([ch, mel], i) => {
  const t0 = bar(3 + i);
  tipleBar(t0, ch, 0.3, 3 + i);
  bassBar(t0, ch, 0.42);
  shakerBar(t0, 0.07, 3 + i);
  melody(t0, mel, 0.26, -0.25);
  padChord(t0, CH[ch], 2.1, 0.5, { att: 0.3, rel: 0.5, cutoff: 1200 });
});
// colibrí
mix.add(buzz(T.bird[1] - T.bird[0] - 0.2, 44), T.bird[0] + 0.1, 0.16, 0.5, 0.1);
[0.2, 0.9, 1.6, 2.2].forEach((d, i) => mix.add(chirp(200 + i, 2), T.bird[0] + d, 0.09, 0.5, 0.3));
[6.4, 7.2, 8.8, 10.9].forEach((t, i) => mix.add(chirp(300 + i, 4), t, 0.06, i % 2 ? -0.7 : 0.7, 0.5));
// osezno tomando agua (lengüetazos)
for (let k = 0; k < 6; k++) mix.add(splash(0.12, 50 + k, 1800), 9.25 + k * 0.16, 0.08, 0.35, 0.1);

// ================================================================ 3 · El potrero seco (12–16 s)
padChord(bar(6), ['B2', 'F#3', 'B3', 'C#4', 'D4'], 2.6, 0.9, { att: 0.4, rel: 1.4, cutoff: 900 });
padChord(bar(7), ['E3', 'G3', 'B3', 'F#4'], 2.8, 0.8, { att: 0.8, rel: 1.6, cutoff: 800 });
mix.add(cicadas(4.4, 21), 12.2, 0.05, 0.4, 0.1);
mix.add(wind(4.6, 17, 900), 11.8, 0.14, -0.4, 0.1);
melody(0, [['F#5', 12.5 / BEAT, 1], ['D5', 13.0 / BEAT, 1], ['B4', 13.6 / BEAT, 1.5], ['A4', 14.5 / BEAT, 1.5], ['F#4', 15.3 / BEAT, 2]], 0.2, -0.1, 0.5);
[12.9, 13.75, 14.7, 15.8].forEach((t) => { mix.add(kick(0.3, 70, 38), t, 0.22, 0, 0.1); mix.add(kick(0.3, 64, 36), t + 0.22, 0.14, 0, 0.1); });
mix.add(glide(700, 380, 0.7, { decay: 0.5 }), T.sadEyes, 0.07, 0.1, 0.4);
mix.add(whoosh(1.5, 3000, 6000, 71), T.stuck, 0.05, 0.1, 0.2); // vapor

// ================================================================ 4 · Llega una plántula (16–18 s)
mix.add(thud(51), T.seedling, 0.55, 0.05, 0.15);
mix.add(crunch(62), T.seedling + 0.02, 0.2, 0.05, 0.1);
mix.add(mallet(N('A5'), 1.6), T.peek, 0.24, 0.1, 0.5);
mix.add(bell(N('E6'), 1.6, { ratio: 2, index: 1 }), T.peek + 0.02, 0.06, 0.1, 0.5);
padChord(17.0, ['G3', 'B3', 'D4', 'A4'], 1.8, 0.9, { att: 0.9, rel: 0.4, cutoff: 1500 });
melody(0, [['G4', 17.4 / BEAT, 0.3], ['B4', 17.55 / BEAT, 0.3], ['D5', 17.7 / BEAT, 0.3], ['G5', 17.85 / BEAT, 0.6]], 0.18, -0.2);

// ================================================================ 5 · Siembra y crecimiento (18–28 s)
const plantNotes = ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'E6'];
plantTimes.forEach((t, i) => {
  mix.add(crunch(80 + i), t - 0.32, 0.16, i % 2 ? 0.3 : -0.3, 0.05);
  mix.add(pop(), t, 0.16, i % 2 ? 0.3 : -0.3, 0.2);
  mix.add(tipleNote(N(plantNotes[i]), 1.4, { bright: 0.8, seed: 400 + i }), t, 0.5, i % 2 ? 0.25 : -0.25, 0.35);
  mix.add(bell(N(plantNotes[i]) * 2, 0.9, { ratio: 3, index: 1 }), t + 0.01, 0.035, 0, 0.5);
});
const s5 = ['G', 'DF', 'Em', 'A', 'D'];
s5.forEach((ch, i) => {
  const t0 = bar(9 + i);
  padChord(t0, CH[ch], 2.2, 0.55 + i * 0.08, { att: 0.3, rel: 0.5, cutoff: 1300 + i * 150 });
  if (i >= 1) tipleBar(t0, ch, 0.14 + i * 0.05, 20 + i);
  if (i >= 1) bassBar(t0, ch, 0.3 + i * 0.04);
  if (i >= 2) shakerBar(t0, 0.06 + i * 0.01, 20 + i);
  if (i >= 3) kickBar(t0, 0.28);
});
// lluvia
mix.add(rain(T.rain[1] - T.rain[0] + 0.6, 31), T.rain[0] - 0.2, 0.34, 0, 0.1);
mix.add(rumble(2.2, 41), T.rain[0], 0.5, 0, 0.2);
[0.1, 0.45, 0.8].forEach((d, i) => {
  mix.add(plink(1100 + i * 250, 0.3), T.revive[0] + d, 0.3, 0.05, 0.4);
  mix.add(mallet(N(['A5', 'B5', 'D6'][i]), 1), T.revive[0] + d, 0.2, 0.05, 0.4);
});
// el agua regresa
mix.add(whoosh(2.6, 200, 1600, 72), T.refill[0], 0.3, 0, 0.2);
mix.add(trickle(8.6, 12, 40), T.refill[0], 0.4, 0.1, 0.2);
melody(bar(13), [['F#5', 0, 0.5], ['A5', 0.5, 0.5], ['D6', 1, 1], ['C#6', 2, 0.5], ['A5', 2.5, 0.5], ['B5', 3, 0.5], ['C#6', 3.5, 0.5]], 0.26, -0.2);
// ¡celebración!
strum(mix, T.cheer, ['D4', 'F#4', 'A4', 'D5', 'F#5'], { gain: 0.35, seed: 90, dur: 1.8 });
[0, 0.12, 0.24, 0.36].forEach((d, i) => mix.add(bell(N(['D6', 'F#6', 'A6', 'D7'][i]), 1.2), T.cheer + d, 0.05, -0.3 + i * 0.2, 0.5));
for (let k = 0; k < 8; k++) mix.add(chirp(500 + k, 3 + (k % 3)), 26 + k * 0.9, 0.06, k % 2 ? -0.6 : 0.6, 0.5);

// ================================================================ 6 · Conexión (28–34 s)
const themeB = [
  ['D', [['A5', 0, 1], ['F#5', 1, 0.5], ['A5', 1.5, 0.5], ['B5', 2, 0.5], ['A5', 2.5, 0.5], ['F#5', 3, 0.5], ['E5', 3.5, 0.5]]],
  ['Bm', [['D5', 0, 1], ['F#5', 1, 0.5], ['B5', 1.5, 0.5]]],
];
themeB.forEach(([ch, mel], i) => {
  const t0 = bar(14 + i);
  tipleBar(t0, ch, 0.3, 30 + i);
  bassBar(t0, ch, 0.42);
  shakerBar(t0, 0.09, 30 + i);
  kickBar(t0, 0.3);
  melody(t0, mel, 0.27, -0.25);
  padChord(t0, CH[ch], 2.1, 0.6, { att: 0.2, rel: 0.4, cutoff: 1600 });
});
// pasos de los osos
for (let t = T.bearsWalk[0] + 0.1; t < T.bearsMeet; t += 0.28) mix.add(kick(0.18, 80, 50), t, 0.06, 0.2, 0.05);
// reencuentro
mix.add(bell(N('F#6'), 2.2, { ratio: 2, index: 1.5 }), T.bearsMeet + 0.1, 0.1, 0, 0.6);
mix.add(bell(N('A6'), 2.2, { ratio: 2, index: 1.5 }), T.bearsMeet + 0.25, 0.08, 0.2, 0.6);
// el viaje veloz río abajo
mix.add(whoosh(T.whip[1] - T.whip[0] + 0.2, 250, 4000, 73), T.whip[0], 0.45, 0, 0.15);
const arp = ['B4', 'D5', 'F#5', 'B5', 'D5', 'F#5', 'A5', 'D6', 'G5', 'B5', 'D6', 'G6'];
arp.forEach((n, k) => mix.add(mallet(N(n), 0.7), T.whip[0] + 0.1 + k * 0.11, 0.16, -0.5 + k * 0.08, 0.3));
mix.add(trickle(2, 13, 60), T.whip[0], 0.35, 0, 0.2);
mix.add(bell(N('A3'), 3, { ratio: 1.4, index: 2 }), 31.9, 0.07, -0.6, 0.6); // campana de la iglesia del pueblo
// la regadera vacía (la música se detiene un instante)
mix.add(clank(), T.canTilt[0] + 0.15, 0.2, 0.15, 0.3);
mix.add(plink(900, 0.3), T.canTilt[0] + 0.55, 0.18, 0.15, 0.3);
mix.add(glide(500, 330, 0.35, { decay: 0.3 }), T.canTilt[0] + 0.6, 0.06, 0.15, 0.3);
// ¡salto de la gota!
mix.add(boing(300, 900, 0.4), T.leap[0], 0.32, 0, 0.3);
mix.add(splash(0.45, 8, 2600), T.leap[1], 0.4, 0.05, 0.3);
mix.add(pop(), T.sprout, 0.35, 0.05, 0.3);
[0, 0.1, 0.2].forEach((d, i) => mix.add(bell(N(['D6', 'F#6', 'A6'][i]), 1.2), T.sprout + d, 0.07, 0.1, 0.5));
strum(mix, T.sprout + 0.15, CH.G, { gain: 0.32, seed: 95 });
strum(mix, T.sprout + 0.45, CH.A, { gain: 0.3, seed: 96, up: true });
mix.add(bass(N('G2'), 0.8), T.sprout + 0.15, 0.35, -0.1, 0.05);
mix.add(bass(N('A2'), 0.8), T.sprout + 0.45, 0.35, -0.1, 0.05);

// ================================================================ 7 · Revelación (34–40 s)
mix.add(whoosh(2.4, 120, 900, 74), T.zoomOut[0] - 0.1, 0.35, 0, 0.3);
padChord(33.9, ['D2', 'D3', 'A3', 'D4', 'F#4', 'A4', 'E5'], 6.3, 1.25, { att: 1.2, rel: 2.2, cutoff: 1700 });
mix.add(bass(N('D2'), 3), 34.0, 0.4, 0, 0.1);
strum(mix, 34.0, ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5'], { gain: 0.3, seed: 97, dur: 2.5 });
melody(0, [['D6', 34.5 / BEAT, 1], ['C#6', 35.0 / BEAT, 1], ['A5', 35.5 / BEAT, 2]], 0.2, -0.2, 0.4);
// 20 destellos = 20 municipios
const pent = ['D6', 'E6', 'F#6', 'A6', 'B6', 'D7'];
const rr = mulberry32(2024);
MUNIS.forEach((m, i) => mix.add(bell(N(pent[Math.floor(rr() * pent.length)]), 1.6, { ratio: 2 + rr(), index: 1.5 }), m.t, 0.045, rr() * 1.6 - 0.8, 0.6));
for (let k = 0; k < 6; k++) mix.add(chirp(700 + k, 3), 35 + k * 0.7, 0.05, k % 2 ? -0.7 : 0.7, 0.5);
melody(0, [['F#5', T.title1 / BEAT, 1], ['A5', (T.title1 + 0.35) / BEAT, 1], ['E5', T.title2 / BEAT, 1], ['F#5', (T.title2 + 0.35) / BEAT, 1]], 0.16, 0.2, 0.5);
strum(mix, T.credits, ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5'], { gain: 0.36, seed: 98, dur: 2.2 });
mix.add(bass(N('D2'), 2), T.credits, 0.4, 0, 0.1);
mix.add(bell(N('D6'), 2.5, { ratio: 2, index: 1 }), T.credits + 0.05, 0.1, 0, 0.6);
mix.add(bell(N('A6'), 2.5, { ratio: 2, index: 1 }), T.credits + 0.3, 0.07, 0.3, 0.6);

// ================================================================ mezcla final
const [wL, wR] = reverb(mix.rL, mix.rR);
const L = new Float32Array(mix.n), R = new Float32Array(mix.n);
for (let i = 0; i < mix.n; i++) { L[i] = mix.L[i] + wL[i] * 0.9; R[i] = mix.R[i] + wR[i] * 0.9; }
// silencio breve y cómico cuando la regadera está vacía: se atenúa la música
// (el efecto ya está en la partitura: no hay tiple entre 31.95 y 32.5)
// normalización + limitador suave
let peak = 0;
for (let i = 0; i < mix.n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const g = 1.25 / peak;
const lim = (x) => Math.tanh(x * g) * 0.89;
const nOut = Math.round(DURATION * SR);
const oL = new Float32Array(nOut), oR = new Float32Array(nOut);
for (let i = 0; i < nOut; i++) {
  const fadeIn = Math.min(1, i / (SR * 0.4));
  const fadeOut = Math.min(1, (nOut - i) / (SR * 0.6));
  oL[i] = lim(L[i]) * fadeIn * fadeOut;
  oR[i] = lim(R[i]) * fadeIn * fadeOut;
}
const out = path.join(here, '../../out/banda_sonora.wav');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, writeWav(oL, oR));
console.log('audio listo:', out, `pico previo ${peak.toFixed(2)}`);
