// Banda sonora original del filminuto (41 s, 120 BPM, Re mayor). Todo sintetizado aquí:
// quena, tiple, marimba, arpa, cuerdas, coro, bajo, bombo y los efectos, sincronizados al guion.
//   node film/audio/score.js  →  out/v4/banda_sonora.wav
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { T, plantTimes, BEAT, dropX } from '../story.js';
import { FALLS } from '../world/geo.js';
import { mulberry32 } from '../core/math.js';
import {
  SR, NOTE, Mix, strum, mallet, bell, pad, bass, kick, shaker, plink, glide, splash, whoosh, wind, trickle,
  chirp, buzz, cicadas, rain, rumble, thud, crunch, pop, clank, boing, reverb, writeWav, tipleNote,
  quena, choir, strings, bombo, thunder, crickets, whimper, harp, riser,
} from './synth.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DUR = 41;
const mix = new Mix(DUR + 1);
const N = NOTE;

const CH = {
  D: ['D3', 'A3', 'D4', 'F#4'], G: ['G3', 'B3', 'D4', 'G4'], A: ['A3', 'C#4', 'E4', 'A4'], Bm: ['B3', 'D4', 'F#4', 'B4'],
  Em: ['E3', 'G3', 'B3', 'E4'], DF: ['F#3', 'A3', 'D4', 'F#4'], Dm: ['D3', 'A3', 'D4', 'F4'], Bb: ['Bb3', 'D4', 'F4', 'Bb4'],
  Gm: ['G3', 'Bb3', 'D4', 'G4'], A7: ['A3', 'C#4', 'G4', 'A4'], Dmaj9: ['D3', 'A3', 'E4', 'F#4', 'C#5'],
};
const BASS = { D: 'D2', G: 'G2', A: 'A2', Bm: 'B1', Em: 'E2', DF: 'F#2', Dm: 'D2', Bb: 'Bb1', Gm: 'G2', A7: 'A2' };
// NOTE no entiende bemoles: se traducen
const fix = (n) => n.replace('Bb', 'A#').replace('Eb', 'D#');
const F = (n) => N(fix(n));

const padChord = (t, notes, dur, gain = 1, o = {}) => { const [L, R] = pad(notes.map(fix), dur, o); mix.addStereo(L, R, t, gain, 0.35); };
const strChord = (t, notes, dur, gain = 1, o = {}) => { const [L, R] = strings(notes.map(fix), dur, o); mix.addStereo(L, R, t, gain, 0.4); };
const choirChord = (t, notes, dur, gain = 1, o = {}) => { const [L, R] = choir(notes.map(fix), dur, o); mix.addStereo(L, R, t, gain, 0.5); };
function tipleBar(t0, chord, gain = 0.3, seed = 1) {
  // bambuco: acentos 3+3+2 en corcheas
  const hits = [[0, false, 1], [0.75, true, 0.6], [1.5, false, 0.8], [2, false, 1], [2.75, true, 0.6], [3.5, false, 0.75]];
  hits.forEach(([b, up, g], k) => strum(mix, t0 + b * BEAT, CH[chord].map(fix), { gain: gain * g, up, seed: seed * 10 + k, pan: 0.25, dur: 1.1 }));
}
function bassBar(t0, chord, gain = 0.45) {
  mix.add(bass(F(BASS[chord]), 0.95), t0, gain, -0.1, 0.05);
  mix.add(bass(F(BASS[chord]) * 1.5, 0.9), t0 + 2 * BEAT, gain * 0.8, -0.1, 0.05);
}
function shakerBar(t0, gain = 0.1, seed = 1) { for (let k = 0; k < 8; k++) mix.add(shaker(0.07, seed * 8 + k), t0 + k * BEAT * 0.5, gain * (k % 2 ? 1 : 0.55), 0.35, 0.05); }
function drumBar(t0, gain = 0.35) { mix.add(bombo(), t0, gain, 0, 0.1); mix.add(kick(0.3), t0 + 1.5 * BEAT, gain * 0.5, 0, 0.05); mix.add(bombo(0.6, 110), t0 + 2 * BEAT, gain * 0.7, 0, 0.1); }
function melody(t0, notes, gain = 0.3, pan = -0.2, soft = 0) { for (const [n, b, d = 1] of notes) mix.add(mallet(F(n), Math.max(0.6, d * BEAT + 0.6), { soft }), t0 + b * BEAT, gain, pan, 0.35); }
function flute(t0, notes, gain = 0.3, pan = 0.1, o = {}) { for (const [n, b, d = 1] of notes) mix.add(quena(F(n), d * BEAT * 0.95, { seed: Math.round(b * 7 + 3), ...o }), t0 + b * BEAT, gain, pan, 0.55); }
function harpArp(t0, notes, step = 0.08, gain = 0.25, pan = -0.3) { notes.forEach((n, i) => mix.add(harp(F(n)), t0 + i * step, gain, pan + i * 0.04, 0.5)); }

// ================================================================ 1 · Rocío (0–4 s)
mix.add(wind(9, 7, 420), 0, 0.2, -0.3, 0.1);
mix.add(wind(8, 8, 700), 0.4, 0.1, 0.4, 0.1);
padChord(0, CH.Dmaj9, 4.6, 0.9, { att: 1.6, rel: 1.4, cutoff: 1400 });
// el rocío se junta: campanitas que suben
['A5', 'B5', 'D6', 'E6', 'F#6', 'A6', 'B6', 'D7'].forEach((n, k) => mix.add(bell(N(n), 1.5, { ratio: 2, index: 1.1 }), T.condense[0] + k * 0.13, 0.05 + k * 0.008, -0.5 + k * 0.14, 0.55));
mix.add(plink(1700, 0.4), T.condense[1], 0.3, 0.1, 0.4);
mix.add(plink(2300, 0.12), T.eyesOpen, 0.13, 0.1, 0.3);
mix.add(plink(2500, 0.1), T.eyesOpen + 0.42, 0.1, 0.1, 0.3);
// la quena saluda al sol
flute(0, [['A4', T.lookSun[0] / BEAT, 0.7], ['D5', T.lookSun[0] / BEAT + 0.7, 0.6], ['E5', T.lookSun[0] / BEAT + 1.3, 0.5], ['F#5', T.lookSun[0] / BEAT + 1.8, 1.6]], 0.26, 0.15);
[1.1, 2.4, 3.0].forEach((t, i) => mix.add(chirp(100 + i, 3), t, 0.045, i % 2 ? 0.7 : -0.7, 0.5));
// se estira… y cae
mix.add(glide(900, 1250, T.fall - T.wobble[0], { vib: 0.03 }), T.wobble[0], 0.04, 0.1, 0.3);
mix.add(glide(1400, 420, T.land - T.fall), T.fall, 0.13, 0.1, 0.3);
mix.add(boing(200, 480, 0.3), T.land, 0.3, 0.05, 0.2);
mix.add(splash(0.35, 3, 2200), T.land, 0.22, 0.05, 0.2);
mix.add(boing(320, 700, 0.25), T.slide[0] + 0.05, 0.14, 0, 0.2);
mix.add(splash(0.6, 4, 2400), T.slide[1], 0.42, -0.05, 0.3);

// ================================================================ 2 · Revelación del páramo (4–6 s)
mix.add(bombo(1.4, 70), 4.0, 0.55, 0, 0.3);
strum(mix, 4.0, ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5'], { gain: 0.36, seed: 4, dur: 2.2 });
strChord(4.0, ['D3', 'A3', 'F#4', 'A4', 'D5'], 2.4, 1.1, { att: 0.5, rel: 0.8 });
flute(4.0, [['F#5', 0, 1], ['A5', 1, 0.5], ['B5', 1.5, 0.5], ['A5', 2, 1], ['F#5', 3, 1]], 0.3, 0.1);
mix.add(trickle(7, 11, 24), 4.6, 0.25, -0.15, 0.2);

// ================================================================ 3 · Bosque (6–12 s)
const themeA = [
  ['D', [['F#5', 0, 0.5], ['A5', 0.5, 0.5], ['B5', 1, 0.5], ['A5', 1.5, 0.5], ['F#5', 2, 0.5], ['E5', 2.5, 0.5], ['D5', 3, 0.5], ['E5', 3.5, 0.5]]],
  ['G', [['D5', 0, 0.5], ['B4', 0.5, 0.5], ['D5', 1, 0.5], ['E5', 1.5, 0.5], ['G5', 2, 1], ['F#5', 3, 0.5], ['E5', 3.5, 0.5]]],
  ['A', [['C#5', 0, 0.5], ['E5', 0.5, 0.5], ['A5', 1, 1], ['G5', 2, 0.5], ['F#5', 2.5, 0.5], ['E5', 3, 1]]],
];
[6, 8, 10].forEach((t0, i) => {
  const [ch, mel] = themeA[i];
  tipleBar(t0, ch, 0.3, 3 + i);
  bassBar(t0, ch, 0.42);
  shakerBar(t0, 0.07, 3 + i);
  if (i !== 2) melody(t0, mel, 0.24, -0.25);
  padChord(t0, CH[ch], 2.1, 0.45, { att: 0.3, rel: 0.5, cutoff: 1200 });
});
// cascadas: "¡uiii!" justo cuando la gota pasa por cada una
{
  const cross = [];
  for (const [fx] of FALLS) {
    for (let t = 5.2; t < 34; t += 0.01) {
      const a = dropX(t), b = dropX(t + 0.01);
      if (a != null && b != null && a < fx && b >= fx) { cross.push(t); break; }
    }
  }
  cross.forEach((t, i) => { mix.add(glide(700, 1500, 0.3, { vib: 0.02 }), t - 0.12, 0.07, 0.1, 0.3); mix.add(splash(0.4, 20 + i, 2600), t + 0.12, 0.22, 0.1, 0.3); });
  console.log('cascadas en', cross.map((t) => t.toFixed(2)).join(' '));
}
// colibrí
mix.add(buzz(T.bird[1] - T.bird[0] - 0.2, 44), T.bird[0] + 0.1, 0.15, 0.5, 0.1);
[0.25, 0.8, 1.3].forEach((d, i) => mix.add(chirp(200 + i, 2), T.bird[0] + d, 0.08, 0.5, 0.3));
// osezno bebiendo, lo mira, sonríe
for (let k = 0; k < 5; k++) mix.add(splash(0.1, 50 + k, 1700), 10.05 + k * 0.15, 0.07, 0.35, 0.1);
mix.add(whimper(0.35, 600, 760, 3), 10.7, 0.12, 0.3, 0.3);
melody(10, [['A5', 1.6, 0.5], ['C#6', 2.2, 0.5], ['E6', 2.8, 1]], 0.2, 0.3);
[6.5, 7.4, 8.9, 11.1].forEach((t, i) => mix.add(chirp(300 + i, 4), t, 0.05, i % 2 ? -0.7 : 0.7, 0.5));

// ================================================================ 4 · El potrero seco (12–16.5 s)
// el ritmo se apaga; queda un zumbido de calor
padChord(12.0, CH.Dm, 2.4, 0.8, { att: 0.3, rel: 1.2, cutoff: 900 });
padChord(14.0, ['Bb2', 'F3', 'D4'], 2.3, 0.75, { att: 0.6, rel: 1.4, cutoff: 800 });
padChord(16.0, ['G2', 'D3', 'Bb3'], 1.2, 0.5, { att: 0.3, rel: 0.8, cutoff: 700 });
mix.add(cicadas(4.8, 21), 11.9, 0.05, 0.4, 0.1);
mix.add(wind(5.2, 17, 1000), 11.8, 0.13, -0.4, 0.1);
[12.9, 13.9, 14.9, 15.9].forEach((t) => { mix.add(kick(0.3, 70, 38), t, 0.2, 0, 0.1); mix.add(kick(0.3, 64, 36), t + 0.24, 0.12, 0, 0.1); });
flute(0, [['D5', 13.1 / BEAT, 1], ['C5', 13.6 / BEAT, 0.5], ['A#4', 13.85 / BEAT, 0.5], ['A4', 14.1 / BEAT, 2], ['G4', 15.1 / BEAT, 1], ['A#4', 15.6 / BEAT, 1], ['A4', 16.1 / BEAT, 2]], 0.24, -0.1, { vib: 0.016 });
mix.add(whoosh(2, 3000, 6500, 71), 13.1, 0.05, 0.1, 0.2); // vapor
mix.add(whimper(0.7, 560, 380, 2), 15.5, 0.16, -0.4, 0.4);

// ================================================================ 5 · La niña (16.5–19.2 s)
mix.add(riser(0.5, 200, 900, 14), T.shadow - 0.3, 0.05, 0, 0.3);
mix.add(bell(N('A5'), 2, { ratio: 2, index: 0.8 }), T.wake, 0.12, 0.1, 0.6);
mix.add(mallet(N('A5'), 1.6, { soft: 1 }), T.wake + 0.02, 0.16, 0.1, 0.6);
strChord(17.0, ['G3', 'B3', 'D4', 'A4'], 2.2, 1.0, { att: 0.8, rel: 0.6 });
harpArp(T.place[0], ['G4', 'B4', 'D5', 'G5', 'A5', 'B5', 'D6'], 0.09, 0.22);
mix.add(thud(51), T.place[1] - 0.05, 0.3, 0.05, 0.15);
strum(mix, T.wave, CH.D.map(fix), { gain: 0.3, seed: 18, dur: 1.4 });
strChord(18.4, ['A3', 'C#4', 'E4', 'A4'], 1.3, 1.0, { att: 0.4, rel: 0.3 });
// la comunidad llega: el ritmo vuelve de a poco
[18.5, 18.75, 19.0, 19.125, 19.25, 19.375].forEach((t, i) => mix.add(shaker(0.07, 60 + i), t, 0.06 + i * 0.01, 0.3, 0.05));
mix.add(bombo(0.8, 90), 19.0, 0.3, 0, 0.1);

// ================================================================ 6 · Sembrar (19.2–23 s)
const plantNotes = ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5'];
plantTimes.forEach((t, i) => {
  mix.add(crunch(80 + i), t - 0.3, 0.14, i % 2 ? 0.3 : -0.3, 0.05);
  mix.add(pop(), t, 0.14, i % 2 ? 0.3 : -0.3, 0.2);
  mix.add(tipleNote(N(plantNotes[i]), 1.4, { bright: 0.85, seed: 400 + i }), t, 0.5, i % 2 ? 0.25 : -0.25, 0.35);
  mix.add(bell(N(plantNotes[i]) * 2, 0.9, { ratio: 3, index: 1 }), t + 0.01, 0.03, 0, 0.5);
});
['G', 'D', 'Em', 'A'].forEach((ch, i) => {
  const tb = 19.0 + i * 2;
  padChord(tb, CH[ch], 2.1, 0.6 + i * 0.08, { att: 0.3, rel: 0.5, cutoff: 1300 + i * 150 });
  if (tb < 23) { tipleBar(tb, ch, 0.22 + i * 0.04, 20 + i); bassBar(tb, ch, 0.38 + i * 0.03); shakerBar(tb, 0.08, 20 + i); drumBar(tb, 0.24 + i * 0.03); }
});

// ================================================================ 7 · El tiempo (23–26 s)
// arpegios que se aceleran como un reloj de días
{
  const arp = ['D5', 'F#5', 'A5', 'D6', 'A5', 'F#5'];
  let t = 23.0, step = 0.25;
  let k = 0;
  while (t < 25.9) {
    mix.add(mallet(N(arp[k % arp.length]), 0.6), t, 0.13 + 0.06 * ((t - 23) / 3), -0.4 + (k % 6) * 0.16, 0.4);
    t += step; step = Math.max(0.085, step * 0.955); k++;
  }
}
strChord(23.0, ['D3', 'A3', 'D4', 'F#4'], 1.1, 0.8);
strChord(23.8, ['B2', 'F#3', 'B3', 'D4'], 0.9, 0.7);
strChord(24.6, ['G2', 'D3', 'G3', 'B3'], 0.8, 0.8);
strChord(25.2, ['A2', 'E3', 'A3', 'C#4'], 0.95, 1.0);
mix.add(crickets(1.2, 9), 23.7, 0.12, 0.3, 0.3);
mix.add(riser(1.6, 150, 4000, 15), 24.4, 0.13, 0, 0.3);
mix.add(rumble(1.4, 42), 24.8, 0.25, 0, 0.2);

// ================================================================ 8 · Lluvia (26–28.2 s)
mix.add(thunder(3.4, 7), T.thunder, 0.5, 0.25, 0.3);
mix.add(thunder(2.4, 11), T.thunder + 0.55, 0.25, -0.3, 0.3);
mix.add(rain(3.6, 31), 26.0, 0.36, 0, 0.15);
padChord(26.0, ['B1', 'F#2', 'B2', 'D3'], 2.2, 0.8, { att: 0.2, rel: 0.6, cutoff: 700 });
for (let k = 0; k < 6; k++) mix.add(bombo(0.5, 70), 26.5 + k * 0.25, 0.1 + k * 0.03, 0, 0.1); // redoble
[0, 0.3, 0.6].forEach((d, i) => {
  mix.add(plink(1100 + i * 260, 0.3), T.refill[0] + d, 0.3, 0.05, 0.4);
  mix.add(mallet(N(['A5', 'B5', 'D6'][i]), 1), T.refill[0] + d, 0.22, 0.05, 0.4);
});
mix.add(riser(0.8, 300, 6000, 16), 27.2, 0.14, 0, 0.3);

// ================================================================ 9 · El agua vuelve · reencuentro (28–32 s): clímax
mix.add(bombo(1.2, 80), 28.0, 0.6, 0, 0.3);
mix.add(whoosh(2.4, 200, 1800, 72), 28.1, 0.28, 0, 0.2);
mix.add(trickle(4, 12, 40), 28.2, 0.35, 0.1, 0.2);
const climax = [['D', 28], ['Bm', 30]];
climax.forEach(([ch, t0], i) => {
  tipleBar(t0, ch, 0.32, 30 + i);
  bassBar(t0, ch, 0.46);
  shakerBar(t0, 0.09, 30 + i);
  drumBar(t0, 0.36);
  strChord(t0, CH[ch], 2.1, 1.0, { att: 0.2, rel: 0.4 });
});
flute(28, [['F#5', 0, 1], ['A5', 1, 0.5], ['B5', 1.5, 0.5], ['A5', 2, 1], ['F#5', 3, 1], ['G5', 4, 0.5], ['F#5', 4.5, 0.5], ['E5', 5, 1], ['D5', 6, 1], ['E5', 7, 1]], 0.34, 0.1);
melody(28, [['D6', 0, 0.5], ['A5', 2, 0.5], ['B5', 4, 0.5], ['F#5', 6, 0.5]], 0.14, -0.3);
// el abrazo
mix.add(bell(N('F#6'), 2.4, { ratio: 2, index: 1.5 }), T.meet + 0.05, 0.1, 0, 0.6);
mix.add(bell(N('A6'), 2.4, { ratio: 2, index: 1.5 }), T.meet + 0.2, 0.08, 0.2, 0.6);
harpArp(T.meet, ['D5', 'F#5', 'A5', 'D6', 'F#6'], 0.07, 0.2, 0.2);
for (let k = 0; k < 8; k++) mix.add(chirp(500 + k, 3 + (k % 3)), 29.4 + k * 0.4, 0.06, k % 2 ? -0.6 : 0.6, 0.5);
for (let t = T.cubRun[0]; t < T.meet; t += 0.16) mix.add(kick(0.15, 90, 60), t, 0.05, -0.2, 0.05); // pasitos
mix.add(splash(0.3, 60, 2400), 30.05, 0.18, -0.1, 0.2); // el osezno cruza la quebrada

// ================================================================ 10 · Río abajo · huerto (32–35 s)
tipleBar(32, 'G', 0.28, 40); bassBar(32, 'G', 0.42); shakerBar(32, 0.08, 40); drumBar(32, 0.3);
mix.add(trickle(3.2, 14, 36), 32.0, 0.3, 0.1, 0.2);
mix.add(whoosh(1.2, 250, 4200, 73), T.whip[0], 0.4, 0, 0.15);
['B4', 'D5', 'G5', 'B5', 'D6', 'G6', 'B6'].forEach((n, k) => mix.add(mallet(N(n), 0.7), T.whip[0] + 0.1 + k * 0.1, 0.15, -0.5 + k * 0.15, 0.3));
mix.add(bell(N('A3'), 3, { ratio: 1.4, index: 2 }), 33.0, 0.08, -0.6, 0.6); // campana de la iglesia
// la regadera vacía: silencio cómico
mix.add(clank(), T.canTilt[0] + 0.15, 0.2, 0.15, 0.3);
mix.add(plink(900, 0.3), T.canTilt[0] + 0.5, 0.16, 0.15, 0.3);
mix.add(glide(500, 330, 0.35, { decay: 0.3 }), T.canTilt[0] + 0.55, 0.06, 0.15, 0.3);
mix.add(boing(300, 900, 0.4), T.leap[0], 0.3, 0, 0.3);
mix.add(splash(0.45, 8, 2600), T.leap[1], 0.38, 0.05, 0.3);
mix.add(pop(), T.sprout, 0.35, 0.05, 0.3);
[0, 0.1, 0.2].forEach((d, i) => mix.add(bell(N(['D6', 'F#6', 'A6'][i]), 1.2), T.sprout + d, 0.07, 0.1, 0.5));
strum(mix, T.sprout + 0.05, CH.A.map(fix), { gain: 0.32, seed: 95, dur: 1.2 });

// ================================================================ 11 · Revelación: la cuenca es un árbol (35–41 s)
mix.add(riser(1.2, 200, 3000, 17), 34.9, 0.12, 0, 0.4);
mix.add(whoosh(1.4, 120, 900, 74), 35.0, 0.3, 0, 0.3);
choirChord(35.0, ['D4', 'A4', 'F#5'], 6.0, 0.8, { att: 1.0, rel: 2.5 });
mix.add(bombo(1.6, 60), 36.0, 0.6, 0, 0.4);
strum(mix, 36.0, ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5'], { gain: 0.34, seed: 97, dur: 2.5 });
strChord(36.0, ['D2', 'D3', 'A3', 'F#4', 'A4', 'E5'], 5.0, 0.75, { att: 0.6, rel: 2.2 });
mix.add(bass(N('D2'), 3), 36.0, 0.42, 0, 0.1);
flute(36, [['A5', 0, 1], ['B5', 1, 0.5], ['A5', 1.5, 0.5], ['F#5', 2, 1], ['E5', 3, 0.5], ['F#5', 3.5, 0.5], ['D5', 4, 3]], 0.3, 0.1);
// 20 destellos = 20 municipios
{
  const pent = ['D6', 'E6', 'F#6', 'A6', 'B6', 'D7'];
  const rr = mulberry32(2024);
  for (let i = 0; i < 20; i++) mix.add(bell(N(pent[Math.floor(rr() * pent.length)]), 1.6, { ratio: 2 + rr(), index: 1.5 }), T.map + 1.0 + i * 0.1 + (i % 3) * 0.04, 0.04, rr() * 1.6 - 0.8, 0.6);
}
harpArp(T.title1 - 0.05, ['D5', 'F#5', 'A5', 'D6'], 0.09, 0.16, -0.2);
harpArp(T.title2 - 0.05, ['E5', 'A5', 'C#6', 'E6'], 0.09, 0.16, 0.2);
// acorde final (Re mayor con novena) que queda sonando
strum(mix, T.credits, ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5'], { gain: 0.36, seed: 98, dur: 2.2 });
padChord(T.credits, ['D3', 'A3', 'E4', 'F#4', 'A4'], 3.2, 1.0, { att: 0.3, rel: 2.2, cutoff: 1800 });
mix.add(bass(N('D2'), 2.5), T.credits, 0.4, 0, 0.1);
mix.add(bell(N('D6'), 2.6, { ratio: 2, index: 1 }), T.credits + 0.05, 0.1, 0, 0.6);
mix.add(bell(N('A6'), 2.6, { ratio: 2, index: 1 }), T.credits + 0.3, 0.07, 0.3, 0.6);
for (let k = 0; k < 5; k++) mix.add(chirp(700 + k, 3), 37.5 + k * 0.6, 0.04, k % 2 ? -0.7 : 0.7, 0.5);

// ================================================================ mezcla final
const [wL, wR] = reverb(mix.rL, mix.rR, { room: 0.86, damp: 0.28 });
const L = new Float32Array(mix.n), R = new Float32Array(mix.n);
for (let i = 0; i < mix.n; i++) { L[i] = mix.L[i] + wL[i] * 0.95; R[i] = mix.R[i] + wR[i] * 0.95; }
let peak = 0;
for (let i = 0; i < mix.n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const g = 1.3 / peak;
const lim = (x) => Math.tanh(x * g) * 0.9;
const nOut = Math.round(DUR * SR);
const oL = new Float32Array(nOut), oR = new Float32Array(nOut);
for (let i = 0; i < nOut; i++) {
  const fadeIn = Math.min(1, i / (SR * 0.25));
  const fadeOut = Math.min(1, (nOut - i) / (SR * 0.9));
  oL[i] = lim(L[i]) * fadeIn * fadeOut;
  oR[i] = lim(R[i]) * fadeIn * fadeOut;
}
const out = path.join(here, '../../out/v4/banda_sonora.wav');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, writeWav(oL, oR));
console.log('audio listo:', out, `pico previo ${peak.toFixed(2)}`);
