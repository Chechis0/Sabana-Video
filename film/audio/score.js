// Banda sonora original del filminuto (41 s, 120 BPM, Re mayor). Todo sintetizado aquí,
// sincronizado al guion. La composición es la misma en todas las versiones; cambian los
// instrumentos y algunos efectos según el estilo (STYLE):
//   pencil  → quena, tiple, marimba, arpa, cuerdas, coro, bajo y bombo (versión 4)
//   pixel   → chip: pulsos, triángulo, ruido, arpegios, eco; más una capa suave de cuerdas
//   cartoon → orquesta de caricatura: clarinete, pizzicato, xilófono, tuba, metales, timbales
//   paper   → artesanal: silbido, tiple, kalimba, caja de música, armonio, palmas y papel
//   node film/audio/score.js  →  <carpeta del estilo>/banda_sonora.wav
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { T, plantTimes, BEAT, dropX } from '../story.js';
import { FALLS } from '../world/geo.js';
import { mulberry32 } from '../core/math.js';
import {
  SR, NOTE, Mix, strum, mallet, bell, pad, bass, kick, shaker, plink, glide, splash, whoosh, wind, trickle,
  chirp, buzz, cicadas, rain, rumble, thud, crunch, pop, clank, boing, reverb, writeWav, tipleNote,
  quena, choir, strings, bombo, thunder, crickets, whimper, harp, riser, onePoleLP,
} from './synth.js';
import {
  pulse, tri, lfsr, chipKick, chipSnare, chipHat, chipArp, coin, jump, powerUp, blip, echo,
  pizz, brass, clarinet, xylo, timpani, cymbal, snare, woodblock, slideWhistle, tuba, wahwah,
  musicBox, kalimba, uke, whistle, clap, rustle, snip, harmonium,
} from './voices.js';
import { PENCIL, PIXEL, CARTOON, PAPER, OUT_DIR } from '../style.js';
import { PIXEL_TYPE } from '../styles/titles.js';

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
const up = (n, oct = 1) => fix(n).replace(/(-?\d)$/, (d) => String(Number(d) + oct));

// ================================================================ voces según el estilo
const padChord = (t, notes, dur, gain = 1, o = {}) => {
  if (PIXEL) {
    // colchón: pulsos suaves con eco + un poco del pad cálido (la capa "de cine")
    notes.forEach((n, k) => { const b = pulse(fix(n), dur, { duty: 0.5, att: Math.min(0.4, o.att ?? 0.3), dec: 1, sus: 1, rel: Math.min(0.6, o.rel ?? 0.5) }); onePoleLP(b, 1800); mix.add(b, t, gain * 0.1, (k - notes.length / 2) * 0.2, 0.45); });
    const [L, R] = pad(notes.map(fix), dur, o); mix.addStereo(L, R, t, gain * 0.45, 0.35);
    return;
  }
  if (PAPER) { const [L, R] = harmonium(notes.map(fix), dur, { att: o.att ?? 0.3, rel: o.rel ?? 0.6 }); mix.addStereo(L, R, t, gain * 0.95, 0.35); return; }
  if (CARTOON) { const [L, R] = strings(notes.map(fix), dur, o); mix.addStereo(L, R, t, gain * 0.85, 0.4); return; }
  const [L, R] = pad(notes.map(fix), dur, o); mix.addStereo(L, R, t, gain, 0.35);
};
const strChord = (t, notes, dur, gain = 1, o = {}) => {
  if (PIXEL) {
    notes.forEach((n, k) => mix.add(pulse(fix(n), dur, { duty: 0.25, att: 0.08, dec: 0.4, sus: 0.6, rel: 0.3, vib: 0.008 }), t, gain * 0.075, (k - notes.length / 2) * 0.25, 0.45));
    const [L, R] = strings(notes.map(fix), dur, o); mix.addStereo(L, R, t, gain * 0.55, 0.4);
    return;
  }
  if (PAPER) {
    const [L, R] = harmonium(notes.map(fix), dur, { att: 0.12, rel: 0.5 }); mix.addStereo(L, R, t, gain * 0.7, 0.35);
    const [L2, R2] = strings(notes.map(fix), dur, o); mix.addStereo(L2, R2, t, gain * 0.4, 0.4);
    return;
  }
  const [L, R] = strings(notes.map(fix), dur, o); mix.addStereo(L, R, t, gain, 0.4);
  // caricatura: trompas que doblan el acorde en los momentos grandes
  if (CARTOON && gain >= 0.95) notes.slice(-3).forEach((n, k) => mix.add(brass(fix(n), Math.min(dur, 2.2), { bright: 0.45, att: 0.12, seed: k + 3 }), t, 0.07, (k - 1) * 0.3, 0.5));
};
const choirChord = (t, notes, dur, gain = 1, o = {}) => {
  const vowel = PAPER ? [450, 850, 2500] : undefined;
  const [L, R] = choir(notes.map(fix), dur, { ...o, ...(vowel ? { vowel } : {}) });
  mix.addStereo(L, R, t, gain * (PIXEL ? 0.6 : 1), 0.5);
  if (PIXEL) notes.forEach((n, k) => { const b = pulse(fix(n), dur, { duty: 0.5, att: 0.6, dec: 1, sus: 1, rel: 1.5, vib: 0.006 }); onePoleLP(b, 2200); mix.add(b, t, gain * 0.08, (k - 1) * 0.3, 0.5); });
};
// rasgueo (tiple) → pixel: arpegio; caricatura: pizzicato; papel: tiple + ukelele
function vStrum(t, notes, { gain = 0.5, up: upStroke = false, seed = 1, dur = 1.6, pan = 0 } = {}) {
  if (PIXEL) { mix.add(chipArp(notes.map(fix), Math.min(dur, 1.4), { rate: 1 / 40, duty: 0.25, dec: 0.18, sus: 0.25 }), t, gain * 0.7, pan, 0.3); return; }
  if (CARTOON) {
    notes.forEach((n, i) => mix.add(pizz(fix(n), 0.8), t + i * 0.02, gain * 0.55, pan + (i - notes.length / 2) * 0.1, 0.35));
    notes.slice(-3).forEach((n, i) => mix.add(harp(F(up(n))), t + 0.05 + i * 0.04, gain * 0.25, 0.3, 0.45));
    return;
  }
  strum(mix, t, notes.map(fix), { gain, up: upStroke, seed, dur, pan });
  if (PAPER) notes.slice(-2).forEach((n, i) => mix.add(uke(fix(up(n)), 0.9, seed + i), t + 0.03 + i * 0.015, gain * 0.35, -pan + 0.2, 0.3));
}
function tipleBar(t0, chord, gain = 0.3, seed = 1) {
  // bambuco: acentos 3+3+2 en corcheas
  const hits = [[0, false, 1], [0.75, true, 0.6], [1.5, false, 0.8], [2, false, 1], [2.75, true, 0.6], [3.5, false, 0.75]];
  hits.forEach(([b, upS, g], k) => {
    const t = t0 + b * BEAT;
    if (PIXEL) { mix.add(chipArp(CH[chord].map(fix).map((n) => up(n)), 0.2, { rate: 1 / 60, duty: 0.125, dec: 0.08, sus: 0.0 }), t, gain * g * 0.9, 0.25, 0.25); return; }
    if (CARTOON) {
      const notes = CH[chord].map(fix);
      if (k % 3 === 0) mix.add(pizz(notes[0], 0.6), t, gain * g * 0.9, -0.2, 0.3);
      else notes.slice(1).forEach((n, i) => mix.add(pizz(n, 0.5), t + i * 0.008, gain * g * 0.42, 0.25, 0.3));
      if (upS) mix.add(woodblock(k % 2 ? 1150 : 900), t, gain * 0.25, 0.4, 0.2);
      return;
    }
    strum(mix, t, CH[chord].map(fix), { gain: gain * g, up: upS, seed: seed * 10 + k, pan: 0.25, dur: 1.1 });
    if (PAPER && (k === 1 || k === 4)) mix.add(clap(seed * 10 + k), t, gain * 0.45, -0.3, 0.25);
  });
}
function bassBar(t0, chord, gain = 0.45) {
  const f = F(BASS[chord]);
  if (PIXEL) { mix.add(tri(f, 0.42, { slide: -2 }), t0, gain * 0.95, 0, 0.03); mix.add(tri(f * 1.5, 0.4), t0 + 2 * BEAT, gain * 0.8, 0, 0.03); mix.add(tri(f * 2, 0.15), t0 + 3.5 * BEAT, gain * 0.5, 0, 0.03); return; }
  if (CARTOON) { mix.add(tuba(f, 0.42), t0, gain * 1.05, -0.1, 0.08); mix.add(tuba(f * 1.5, 0.4), t0 + 2 * BEAT, gain * 0.85, -0.1, 0.08); return; }
  mix.add(bass(f, 0.95), t0, gain, -0.1, 0.05);
  mix.add(bass(f * 1.5, 0.9), t0 + 2 * BEAT, gain * 0.8, -0.1, 0.05);
}
function shakerBar(t0, gain = 0.1, seed = 1) {
  for (let k = 0; k < 8; k++) {
    const t = t0 + k * BEAT * 0.5;
    if (PIXEL) mix.add(chipHat(seed * 8 + k, k % 4 === 3), t, gain * (k % 2 ? 1 : 0.55) * 1.1, 0.35, 0.05);
    else mix.add(shaker(0.07, seed * 8 + k), t, gain * (k % 2 ? 1 : 0.55), 0.35, 0.05);
  }
}
function drumBar(t0, gain = 0.35) {
  if (PIXEL) { mix.add(chipKick(), t0, gain * 0.9, 0, 0.05); mix.add(chipKick(), t0 + 1.5 * BEAT, gain * 0.5, 0, 0.05); mix.add(chipSnare(Math.round(t0 * 10)), t0 + 2 * BEAT, gain * 0.7, 0, 0.1); return; }
  if (CARTOON) { mix.add(bombo(0.7, 80), t0, gain * 0.8, 0, 0.1); mix.add(snare(Math.round(t0 * 10)), t0 + 2 * BEAT, gain * 0.35, 0.1, 0.15); mix.add(kick(0.3), t0 + 1.5 * BEAT, gain * 0.4, 0, 0.05); return; }
  mix.add(bombo(), t0, gain, 0, 0.1); mix.add(kick(0.3), t0 + 1.5 * BEAT, gain * 0.5, 0, 0.05); mix.add(bombo(0.6, 110), t0 + 2 * BEAT, gain * 0.7, 0, 0.1);
  if (PAPER) mix.add(clap(Math.round(t0 * 7)), t0 + 2 * BEAT, gain * 0.5, 0.2, 0.2);
}
// nota de marimba (contracanto)
function vMallet(t, f, dur, gain, pan, rev = 0.35, soft = 0) {
  if (PIXEL) { mix.add(echo(pulse(f, Math.min(dur, 0.35), { duty: 0.125, dec: 0.12, sus: 0.15, rel: 0.05 }), 0.25, 0.3, 2), t, gain * 0.8, pan, rev * 0.8); return; }
  if (CARTOON) { mix.add(xylo(f, Math.max(0.5, dur)), t, gain * 1.1, pan, rev); return; }
  if (PAPER) { mix.add(kalimba(f, Math.max(0.8, dur)), t, gain * 1.1, pan, rev); return; }
  mix.add(mallet(f, dur, { soft }), t, gain, pan, rev);
}
function melody(t0, notes, gain = 0.3, pan = -0.2, soft = 0) { for (const [n, b, d = 1] of notes) vMallet(t0 + b * BEAT, F(n), Math.max(0.6, d * BEAT + 0.6), gain, pan, 0.35, soft); }
// melodía principal (quena)
function flute(t0, notes, gain = 0.3, pan = 0.1, o = {}) {
  for (const [n, b, d = 1] of notes) {
    const t = t0 + b * BEAT, f = F(n), dd = d * BEAT * 0.95, seed = Math.round(b * 7 + 3);
    if (PIXEL) mix.add(echo(pulse(f, dd, { duty: 0.25, vib: 0.014, dec: 0.25, sus: 0.72, rel: 0.05, slide: -1.2, slideTime: 0.03 }), 0.188, 0.32, 2), t, gain * 0.95, pan, 0.3);
    else if (CARTOON) mix.add(clarinet(f, dd, { seed }), t, gain * 1.05, pan, 0.45);
    else if (PAPER) mix.add(whistle(f * 2, dd, { seed }), t, gain * 0.62, pan, 0.5);
    else mix.add(quena(f, dd, { seed, ...o }), t, gain, pan, 0.55);
  }
}
function harpArp(t0, notes, step = 0.08, gain = 0.25, pan = -0.3) {
  notes.forEach((n, i) => {
    const t = t0 + i * step;
    if (PIXEL) mix.add(pulse(F(n) * 2, 0.12, { duty: 0.5, dec: 0.06, sus: 0, rel: 0.02 }), t, gain * 0.55, pan + i * 0.04, 0.5);
    else if (PAPER) mix.add(musicBox(F(n) * 2, 1.4), t, gain * 0.7, pan + i * 0.04, 0.5);
    else mix.add(harp(F(n)), t, gain, pan + i * 0.04, 0.5);
  });
}
function vBell(t, f, dur, o, gain, pan, rev) {
  if (PIXEL) { mix.add(echo(pulse(f, 0.08, { duty: 0.5, dec: 0.08, sus: 0, rel: 0.02 }), 0.12, 0.35, 3), t, gain * 1.1, pan, rev * 0.6); return; }
  if (PAPER) { mix.add(musicBox(f, Math.min(dur, 2)), t, gain * 1.2, pan, rev); return; }
  mix.add(bell(f, dur, o), t, gain, pan, rev);
}

// ================================================================ 1 · Rocío (0–4 s)
if (PIXEL) mix.add((() => { const b = lfsr(9, { rate: 1800, decay: 99, seed: 7 }); onePoleLP(b, 700); for (let i = 0; i < b.length; i++) b[i] *= 0.5 * Math.min(1, i / (SR * 2)) * Math.min(1, (b.length - i) / (SR * 2)); return b; })(), 0, 0.25, -0.2, 0.1);
else {
  mix.add(wind(9, 7, 420), 0, 0.2, -0.3, 0.1);
  mix.add(wind(8, 8, 700), 0.4, 0.1, 0.4, 0.1);
}
padChord(0, CH.Dmaj9, 4.6, 0.9, { att: 1.6, rel: 1.4, cutoff: 1400 });
// el rocío se junta: campanitas que suben
['A5', 'B5', 'D6', 'E6', 'F#6', 'A6', 'B6', 'D7'].forEach((n, k) => vBell(T.condense[0] + k * 0.13, N(n), 1.5, { ratio: 2, index: 1.1 }, 0.05 + k * 0.008, -0.5 + k * 0.14, 0.55));
if (PIXEL) {
  mix.add(blip(1760, 0.06), T.condense[1], 0.28, 0.1, 0.3);
  mix.add(blip(2350, 0.03), T.eyesOpen, 0.15, 0.1, 0.2);
  mix.add(blip(2640, 0.03), T.eyesOpen + 0.42, 0.12, 0.1, 0.2);
  mix.add(jump('A5', 7, 0.1), 1.42, 0.12, 0.2, 0.2); // el globo "!"
} else {
  mix.add(plink(1700, 0.4), T.condense[1], 0.3, 0.1, 0.4);
  mix.add(plink(2300, 0.12), T.eyesOpen, 0.13, 0.1, 0.3);
  mix.add(plink(2500, 0.1), T.eyesOpen + 0.42, 0.1, 0.1, 0.3);
}
if (PAPER) mix.add(rustle(0.8, 3, 120), 0.0, 0.12, -0.3, 0.2);
// la quena saluda al sol
flute(0, [['A4', T.lookSun[0] / BEAT, 0.7], ['D5', T.lookSun[0] / BEAT + 0.7, 0.6], ['E5', T.lookSun[0] / BEAT + 1.3, 0.5], ['F#5', T.lookSun[0] / BEAT + 1.8, 1.6]], 0.26, 0.15);
if (!PIXEL) [1.1, 2.4, 3.0].forEach((t, i) => mix.add(chirp(100 + i, 3), t, 0.045, i % 2 ? 0.7 : -0.7, 0.5));
else [1.1, 2.4, 3.0].forEach((t, i) => mix.add(pulse(N('E7'), 0.05, { duty: 0.125, sweep: 40, dec: 0.05, sus: 0 }), t, 0.05, i % 2 ? 0.7 : -0.7, 0.4));
// se estira… y cae
if (CARTOON) {
  mix.add(slideWhistle(700, 1300, T.fall - T.wobble[0], { vib: 0.02 }), T.wobble[0], 0.12, 0.1, 0.3);
  mix.add(slideWhistle(1500, 380, T.land - T.fall, { curve: 0.7 }), T.fall, 0.3, 0.1, 0.3);
  mix.add(boing(200, 480, 0.3), T.land, 0.4, 0.05, 0.2);
  mix.add(timpani('D2', 1.0), T.land, 0.35, 0, 0.2);
  mix.add(splash(0.35, 3, 2200), T.land, 0.18, 0.05, 0.2);
  mix.add(boing(320, 700, 0.25), T.slide[0] + 0.05, 0.2, 0, 0.2);
  mix.add(splash(0.6, 4, 2400), T.slide[1], 0.42, -0.05, 0.3);
} else if (PIXEL) {
  mix.add(pulse(900, T.fall - T.wobble[0], { duty: 0.5, sweep: 4, dec: 1, sus: 0.5, vib: 0.03 }), T.wobble[0], 0.04, 0.1, 0.2);
  mix.add(pulse(1400, T.land - T.fall, { duty: 0.25, sweep: -40, dec: 1, sus: 0.8 }), T.fall, 0.11, 0.1, 0.2);
  mix.add(jump('C4', 12, 0.14), T.land, 0.28, 0.05, 0.2);
  mix.add(lfsr(0.3, { rate: 7000, decay: 0.08, seed: 3 }), T.land, 0.2, 0.05, 0.2);
  mix.add(jump('E4', 9, 0.1), T.slide[0] + 0.05, 0.16, 0, 0.2);
  mix.add(lfsr(0.5, { rate: 9000, decay: 0.14, seed: 4 }), T.slide[1], 0.32, -0.05, 0.3);
} else {
  mix.add(glide(900, 1250, T.fall - T.wobble[0], { vib: 0.03 }), T.wobble[0], 0.04, 0.1, 0.3);
  mix.add(glide(1400, 420, T.land - T.fall), T.fall, 0.13, 0.1, 0.3);
  mix.add(boing(200, 480, 0.3), T.land, 0.3, 0.05, 0.2);
  mix.add(splash(0.35, 3, 2200), T.land, 0.22, 0.05, 0.2);
  mix.add(boing(320, 700, 0.25), T.slide[0] + 0.05, 0.14, 0, 0.2);
  mix.add(splash(0.6, 4, 2400), T.slide[1], 0.42, -0.05, 0.3);
}

// ================================================================ 2 · Revelación del páramo (4–6 s)
if (PIXEL) mix.add(chipKick(), 4.0, 0.6, 0, 0.3);
else mix.add(bombo(1.4, 70), 4.0, 0.55, 0, 0.3);
if (CARTOON) { mix.add(cymbal(2.4, 4), 4.0, 0.16, 0.2, 0.4); mix.add(timpani('D2', 1.6), 4.0, 0.4, 0, 0.3); }
if (PAPER) mix.add(rustle(0.9, 11, 220), 4.0, 0.18, 0.3, 0.2);
vStrum(4.0, ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5'], { gain: 0.36, seed: 4, dur: 2.2 });
strChord(4.0, ['D3', 'A3', 'F#4', 'A4', 'D5'], 2.4, 1.1, { att: 0.5, rel: 0.8 });
flute(4.0, [['F#5', 0, 1], ['A5', 1, 0.5], ['B5', 1.5, 0.5], ['A5', 2, 1], ['F#5', 3, 1]], 0.3, 0.1);
if (PIXEL) { const r = mulberry32(24); for (let k = 0; k < 40; k++) mix.add(blip(2000 + r() * 2400, 0.012), 4.6 + r() * 7, 0.03, r() * 1.4 - 0.7, 0.3); }
else mix.add(trickle(7, 11, 24), 4.6, 0.25, -0.15, 0.2);

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
  cross.forEach((t, i) => {
    if (PIXEL) { mix.add(pulse(700, 0.3, { duty: 0.25, sweep: 36, dec: 0.4, sus: 0.6 }), t - 0.12, 0.06, 0.1, 0.2); mix.add(lfsr(0.35, { rate: 8000, decay: 0.1, seed: 20 + i }), t + 0.12, 0.16, 0.1, 0.3); }
    else if (CARTOON) { mix.add(slideWhistle(700, 1600, 0.3), t - 0.12, 0.12, 0.1, 0.3); mix.add(splash(0.4, 20 + i, 2600), t + 0.12, 0.22, 0.1, 0.3); }
    else { mix.add(glide(700, 1500, 0.3, { vib: 0.02 }), t - 0.12, 0.07, 0.1, 0.3); mix.add(splash(0.4, 20 + i, 2600), t + 0.12, 0.22, 0.1, 0.3); }
  });
  console.log('cascadas en', cross.map((t) => t.toFixed(2)).join(' '));
}
// colibrí
if (PIXEL) mix.add(pulse(46, T.bird[1] - T.bird[0] - 0.2, { duty: 0.125, dec: 1, sus: 0.6, vib: 0.05, vibRate: 30, vibDelay: 0 }), T.bird[0] + 0.1, 0.08, 0.5, 0.1);
else mix.add(buzz(T.bird[1] - T.bird[0] - 0.2, 44), T.bird[0] + 0.1, 0.15, 0.5, 0.1);
[0.25, 0.8, 1.3].forEach((d, i) => mix.add(PIXEL ? pulse(N('D7'), 0.06, { duty: 0.125, sweep: 50, dec: 0.05, sus: 0 }) : chirp(200 + i, 2), T.bird[0] + d, PIXEL ? 0.06 : 0.08, 0.5, 0.3));
// osezno bebiendo, lo mira, sonríe
for (let k = 0; k < 5; k++) mix.add(PIXEL ? lfsr(0.08, { rate: 6000, decay: 0.03, seed: 50 + k }) : splash(0.1, 50 + k, 1700), 10.05 + k * 0.15, 0.07, 0.35, 0.1);
mix.add(PIXEL ? pulse(600, 0.35, { duty: 0.25, sweep: 8, dec: 0.3, sus: 0.5, vib: 0.03 }) : whimper(0.35, 600, 760, 3), 10.7, PIXEL ? 0.06 : 0.12, 0.3, 0.3);
melody(10, [['A5', 1.6, 0.5], ['C#6', 2.2, 0.5], ['E6', 2.8, 1]], 0.2, 0.3);
if (!PIXEL) [6.5, 7.4, 8.9, 11.1].forEach((t, i) => mix.add(chirp(300 + i, 4), t, 0.05, i % 2 ? -0.7 : 0.7, 0.5));

// ================================================================ 4 · El potrero seco (12–16.5 s)
// el ritmo se apaga; queda un zumbido de calor
padChord(12.0, CH.Dm, 2.4, 0.8, { att: 0.3, rel: 1.2, cutoff: 900 });
padChord(14.0, ['Bb2', 'F3', 'D4'], 2.3, 0.75, { att: 0.6, rel: 1.4, cutoff: 800 });
padChord(16.0, ['G2', 'D3', 'Bb3'], 1.2, 0.5, { att: 0.3, rel: 0.8, cutoff: 700 });
if (PIXEL) mix.add(lfsr(4.8, { rate: 22000, decay: 99, short: true, seed: 21 }), 11.9, 0.03, 0.4, 0.1);
else { mix.add(cicadas(4.8, 21), 11.9, 0.05, 0.4, 0.1); mix.add(wind(5.2, 17, 1000), 11.8, 0.13, -0.4, 0.1); }
[12.9, 13.9, 14.9, 15.9].forEach((t) => {
  if (PIXEL) { mix.add(chipKick(), t, 0.25, 0, 0.1); mix.add(chipKick(), t + 0.24, 0.14, 0, 0.1); }
  else if (CARTOON) { mix.add(timpani('D2', 0.6), t, 0.22, 0, 0.1); mix.add(timpani('D2', 0.5), t + 0.24, 0.12, 0, 0.1); }
  else { mix.add(kick(0.3, 70, 38), t, 0.2, 0, 0.1); mix.add(kick(0.3, 64, 36), t + 0.24, 0.12, 0, 0.1); }
});
flute(0, [['D5', 13.1 / BEAT, 1], ['C5', 13.6 / BEAT, 0.5], ['A#4', 13.85 / BEAT, 0.5], ['A4', 14.1 / BEAT, 2], ['G4', 15.1 / BEAT, 1], ['A#4', 15.6 / BEAT, 1], ['A4', 16.1 / BEAT, 2]], 0.24, -0.1, { vib: 0.016 });
mix.add(PIXEL ? lfsr(2, { rate: 14000, decay: 0.7, seed: 71 }) : whoosh(2, 3000, 6500, 71), 13.1, PIXEL ? 0.03 : 0.05, 0.1, 0.2); // vapor
mix.add(PIXEL ? pulse(560, 0.7, { duty: 0.25, sweep: -6, dec: 0.5, sus: 0.6, vib: 0.03 }) : whimper(0.7, 560, 380, 2), 15.5, PIXEL ? 0.07 : 0.16, -0.4, 0.4);
if (PIXEL) [12.88, 15.32].forEach((t) => mix.add(blip(880, 0.05), t, 0.12, 0, 0.2)); // globos "…" y "?"

// ================================================================ 5 · La niña (16.5–19.2 s)
mix.add(PIXEL ? pulse(200, 0.5, { duty: 0.5, sweep: 30, dec: 1, sus: 0.6 }) : riser(0.5, 200, 900, 14), T.shadow - 0.3, PIXEL ? 0.03 : 0.05, 0, 0.3);
vBell(T.wake, N('A5'), 2, { ratio: 2, index: 0.8 }, 0.12, 0.1, 0.6);
vMallet(T.wake + 0.02, N('A5'), 1.6, 0.16, 0.1, 0.6, 1);
if (PIXEL) mix.add(jump('A5', 7, 0.1), 16.64, 0.14, 0.2, 0.2); // globo "!"
strChord(17.0, ['G3', 'B3', 'D4', 'A4'], 2.2, 1.0, { att: 0.8, rel: 0.6 });
harpArp(T.place[0], ['G4', 'B4', 'D5', 'G5', 'A5', 'B5', 'D6'], 0.09, 0.22);
mix.add(PIXEL ? chipKick() : thud(51), T.place[1] - 0.05, 0.3, 0.05, 0.15);
vStrum(T.wave, CH.D, { gain: 0.3, seed: 18, dur: 1.4 });
strChord(18.4, ['A3', 'C#4', 'E4', 'A4'], 1.3, 1.0, { att: 0.4, rel: 0.3 });
// la comunidad llega: el ritmo vuelve de a poco
[18.5, 18.75, 19.0, 19.125, 19.25, 19.375].forEach((t, i) => mix.add(PIXEL ? chipHat(60 + i) : shaker(0.07, 60 + i), t, 0.06 + i * 0.01, 0.3, 0.05));
mix.add(PIXEL ? chipKick() : bombo(0.8, 90), 19.0, 0.3, 0, 0.1);
if (PAPER) mix.add(rustle(0.7, 19, 200), 18.3, 0.12, -0.3, 0.2);

// ================================================================ 6 · Sembrar (19.2–23 s)
const plantNotes = ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5'];
plantTimes.forEach((t, i) => {
  const pan = i % 2 ? 0.3 : -0.3;
  if (PIXEL) {
    mix.add(lfsr(0.12, { rate: 3000, decay: 0.04, seed: 80 + i }), t - 0.3, 0.12, pan, 0.05); // pala
    // cada siembra es una "moneda" afinada que sube
    const f = N(plantNotes[i]) * 2;
    mix.add(pulse(f, 0.06, { duty: 0.5, dec: 1, sus: 1, rel: 0.002 }), t, 0.14, pan, 0.2);
    mix.add(pulse(f * 1.335, 0.3, { duty: 0.5, dec: 0.1, sus: 0, rel: 0.02 }), t + 0.06, 0.14, pan, 0.25);
    return;
  }
  mix.add(crunch(80 + i), t - 0.3, 0.14, pan, 0.05);
  mix.add(pop(), t, 0.14, pan, 0.2);
  if (CARTOON) { mix.add(xylo(N(plantNotes[i]) * 2, 0.7), t, 0.32, pan * 0.8, 0.35); mix.add(pizz(N(plantNotes[i]), 0.6), t, 0.3, pan * 0.8, 0.3); }
  else if (PAPER) { mix.add(kalimba(N(plantNotes[i]) * 2, 1.2), t, 0.34, pan * 0.8, 0.35); mix.add(tipleNote(N(plantNotes[i]), 1.2, { bright: 0.7, seed: 400 + i }), t, 0.3, pan * 0.8, 0.35); mix.add(snip(90 + i), t - 0.12, 0.08, pan, 0.1); }
  else mix.add(tipleNote(N(plantNotes[i]), 1.4, { bright: 0.85, seed: 400 + i }), t, 0.5, pan * 0.8, 0.35);
  vBell(t + 0.01, N(plantNotes[i]) * 2, 0.9, { ratio: 3, index: 1 }, 0.03, 0, 0.5);
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
    const g = 0.13 + 0.06 * ((t - 23) / 3);
    if (CARTOON && k % 2 === 0) mix.add(woodblock(k % 4 ? 1000 : 1300), t, g * 0.8, -0.4 + (k % 6) * 0.16, 0.2); // tic-tac
    vMallet(t, N(arp[k % arp.length]), 0.6, g, -0.4 + (k % 6) * 0.16, 0.4);
    t += step; step = Math.max(0.085, step * 0.955); k++;
  }
}
strChord(23.0, ['D3', 'A3', 'D4', 'F#4'], 1.1, 0.8);
strChord(23.8, ['B2', 'F#3', 'B3', 'D4'], 0.9, 0.7);
strChord(24.6, ['G2', 'D3', 'G3', 'B3'], 0.8, 0.8);
strChord(25.2, ['A2', 'E3', 'A3', 'C#4'], 0.95, 1.0);
if (PIXEL) { const b = pulse(4200, 1.2, { duty: 0.125, dec: 1, sus: 0.5, vib: 0.4, vibRate: 18, vibDelay: 0 }); mix.add(b, 23.7, 0.025, 0.3, 0.3); }
else mix.add(crickets(1.2, 9), 23.7, 0.12, 0.3, 0.3);
mix.add(PIXEL ? pulse(150, 1.6, { duty: 0.5, sweep: 30, dec: 1, sus: 0.5 }) : riser(1.6, 150, 4000, 15), 24.4, PIXEL ? 0.05 : 0.13, 0, 0.3);
mix.add(rumble(1.4, 42), 24.8, 0.25, 0, 0.2);

// ================================================================ 8 · Lluvia (26–28.2 s)
mix.add(thunder(3.4, 7), T.thunder, PIXEL ? 0.32 : 0.5, 0.25, 0.3);
mix.add(thunder(2.4, 11), T.thunder + 0.55, PIXEL ? 0.16 : 0.25, -0.3, 0.3);
if (PIXEL) { mix.add(lfsr(1.2, { rate: 2200, decay: 0.5, seed: 9 }), T.thunder, 0.4, 0.2, 0.3); mix.add(chipKick(), T.thunder, 0.5, 0, 0.3); }
if (CARTOON) { mix.add(cymbal(2.6, 9), T.thunder, 0.22, 0.1, 0.4); for (let k = 0; k < 10; k++) mix.add(timpani('A1', 0.4, 20 + k), T.thunder + 0.05 + k * 0.06, 0.1 + k * 0.012, 0, 0.2); }
if (PAPER) mix.add(rustle(1.6, 27, 420), T.thunder, 0.3, 0.2, 0.3);
if (PIXEL) { const b = lfsr(3.6, { rate: 16000, decay: 99, seed: 31 }); onePoleLP(b, 5000); for (let i = 0; i < b.length; i++) b[i] *= Math.min(1, i / (SR * 0.4)) * Math.min(1, (b.length - i) / (SR * 0.8)); mix.add(b, 26.0, 0.12, 0, 0.15); }
else mix.add(rain(3.6, 31), 26.0, 0.36, 0, 0.15);
padChord(26.0, ['B1', 'F#2', 'B2', 'D3'], 2.2, 0.8, { att: 0.2, rel: 0.6, cutoff: 700 });
for (let k = 0; k < 6; k++) mix.add(PIXEL ? chipSnare(70 + k) : CARTOON ? snare(70 + k) : bombo(0.5, 70), 26.5 + k * 0.25, (0.1 + k * 0.03) * (PIXEL ? 0.7 : CARTOON ? 0.6 : 1), 0, 0.1); // redoble
[0, 0.3, 0.6].forEach((d, i) => {
  if (PIXEL) { mix.add(coin(), T.refill[0] + d, 0.13 + i * 0.03, 0.05, 0.3); return; }
  mix.add(plink(1100 + i * 260, 0.3), T.refill[0] + d, 0.3, 0.05, 0.4);
  vMallet(T.refill[0] + d, N(['A5', 'B5', 'D6'][i]), 1, 0.22, 0.05, 0.4);
});
if (PIXEL) mix.add(powerUp('D5', 14, 0.04), 27.25, 0.2, 0, 0.3); // ¡se recarga!
else mix.add(riser(0.8, 300, 6000, 16), 27.2, 0.14, 0, 0.3);

// ================================================================ 9 · El agua vuelve · reencuentro (28–32 s): clímax
mix.add(PIXEL ? chipKick() : bombo(1.2, 80), 28.0, 0.6, 0, 0.3);
if (CARTOON) { mix.add(cymbal(2.8, 12), 28.0, 0.2, -0.2, 0.4); mix.add(timpani('D2', 1.4), 28.0, 0.45, 0, 0.3); }
mix.add(PIXEL ? lfsr(2.4, { rate: 5000, decay: 0.8, seed: 72 }) : whoosh(2.4, 200, 1800, 72), 28.1, PIXEL ? 0.12 : 0.28, 0, 0.2);
if (!PIXEL) mix.add(trickle(4, 12, 40), 28.2, 0.35, 0.1, 0.2);
const climax = [['D', 28], ['Bm', 30]];
climax.forEach(([ch, t0], i) => {
  tipleBar(t0, ch, 0.32, 30 + i);
  bassBar(t0, ch, 0.46);
  shakerBar(t0, 0.09, 30 + i);
  drumBar(t0, 0.36);
  strChord(t0, CH[ch], 2.1, 1.0, { att: 0.2, rel: 0.4 });
});
flute(28, [['F#5', 0, 1], ['A5', 1, 0.5], ['B5', 1.5, 0.5], ['A5', 2, 1], ['F#5', 3, 1], ['G5', 4, 0.5], ['F#5', 4.5, 0.5], ['E5', 5, 1], ['D5', 6, 1], ['E5', 7, 1]], 0.34, 0.1);
// caricatura: los metales doblan la melodía en el clímax (fanfarria)
if (CARTOON) [['F#4', 0, 1], ['A4', 1, 0.5], ['B4', 1.5, 0.5], ['A4', 2, 1], ['F#4', 3, 1], ['G4', 4, 0.5], ['F#4', 4.5, 0.5], ['E4', 5, 1], ['D4', 6, 1], ['E4', 7, 1]].forEach(([n, b, d], k) => mix.add(brass(n, d * BEAT * 0.9, { bright: 0.8, seed: 40 + k }), 28 + b * BEAT, 0.11, -0.25, 0.45));
melody(28, [['D6', 0, 0.5], ['A5', 2, 0.5], ['B5', 4, 0.5], ['F#5', 6, 0.5]], 0.14, -0.3);
// el abrazo
vBell(T.meet + 0.05, N('F#6'), 2.4, { ratio: 2, index: 1.5 }, 0.1, 0, 0.6);
vBell(T.meet + 0.2, N('A6'), 2.4, { ratio: 2, index: 1.5 }, 0.08, 0.2, 0.6);
harpArp(T.meet, ['D5', 'F#5', 'A5', 'D6', 'F#6'], 0.07, 0.2, 0.2);
if (PIXEL) { ['D5', 'F#5', 'A5', 'D6', 'A5', 'D6'].forEach((n, k) => mix.add(pulse(n, 0.09, { duty: 0.5, dec: 1, sus: 1, rel: 0.01 }), T.meet + 0.75 + k * 0.1, 0.12, 0, 0.3)); } // "1-up" del ♥
if (!PIXEL) for (let k = 0; k < 8; k++) mix.add(chirp(500 + k, 3 + (k % 3)), 29.4 + k * 0.4, 0.06, k % 2 ? -0.6 : 0.6, 0.5);
for (let t = T.cubRun[0]; t < T.meet; t += 0.16) mix.add(PIXEL ? chipKick() : kick(0.15, 90, 60), t, PIXEL ? 0.035 : 0.05, -0.2, 0.05); // pasitos
mix.add(PIXEL ? lfsr(0.3, { rate: 8000, decay: 0.1, seed: 60 }) : splash(0.3, 60, 2400), 30.05, 0.18, -0.1, 0.2); // el osezno cruza la quebrada

// ================================================================ 10 · Río abajo · huerto (32–35 s)
tipleBar(32, 'G', 0.28, 40); bassBar(32, 'G', 0.42); shakerBar(32, 0.08, 40); drumBar(32, 0.3);
if (!PIXEL) mix.add(trickle(3.2, 14, 36), 32.0, 0.3, 0.1, 0.2);
mix.add(PIXEL ? lfsr(1.2, { rate: 4000, decay: 0.4, seed: 73 }) : whoosh(1.2, 250, 4200, 73), T.whip[0], PIXEL ? 0.2 : 0.4, 0, 0.15);
if (PAPER) mix.add(rustle(0.9, 33, 300), T.whip[0], 0.2, 0, 0.2);
['B4', 'D5', 'G5', 'B5', 'D6', 'G6', 'B6'].forEach((n, k) => vMallet(T.whip[0] + 0.1 + k * 0.1, N(n), 0.7, 0.15, -0.5 + k * 0.15, 0.3));
vBell(33.0, N('A3'), 3, { ratio: 1.4, index: 2 }, 0.08, -0.6, 0.6); // campana de la iglesia
// la regadera vacía: silencio cómico
if (CARTOON) {
  mix.add(clank(), T.canTilt[0] + 0.15, 0.2, 0.15, 0.3);
  mix.add(wahwah(['A#3', 'A3', 'G#3', 'G3'], 0.13), T.canTilt[0] + 0.3, 0.2, 0.15, 0.3); // trombón triste
  mix.add(slideWhistle(500, 1700, 0.45, { curve: 0.6 }), T.leap[0], 0.28, 0, 0.3);
  mix.add(splash(0.45, 8, 2600), T.leap[1], 0.38, 0.05, 0.3);
  mix.add(cymbal(1.2, 15), T.sprout, 0.1, 0.2, 0.3);
} else if (PIXEL) {
  mix.add(lfsr(0.15, { rate: 2500, decay: 0.05, seed: 74 }), T.canTilt[0] + 0.15, 0.2, 0.15, 0.3);
  mix.add(pulse(900, 0.25, { duty: 0.125, sweep: -24, dec: 0.2, sus: 0.3 }), T.canTilt[0] + 0.5, 0.1, 0.15, 0.3);
  mix.add(blip(880, 0.05), 33.47, 0.1, 0.15, 0.2); // globo "?"
  mix.add(jump('C5', 19, 0.22), T.leap[0], 0.28, 0, 0.3);
  mix.add(lfsr(0.4, { rate: 9000, decay: 0.12, seed: 8 }), T.leap[1], 0.3, 0.05, 0.3);
} else {
  mix.add(clank(), T.canTilt[0] + 0.15, 0.2, 0.15, 0.3);
  mix.add(plink(900, 0.3), T.canTilt[0] + 0.5, 0.16, 0.15, 0.3);
  mix.add(glide(500, 330, 0.35, { decay: 0.3 }), T.canTilt[0] + 0.55, 0.06, 0.15, 0.3);
  mix.add(boing(300, 900, 0.4), T.leap[0], 0.3, 0, 0.3);
  mix.add(splash(0.45, 8, 2600), T.leap[1], 0.38, 0.05, 0.3);
}
if (PIXEL) mix.add(coin(), T.sprout, 0.3, 0.05, 0.3);
else mix.add(pop(), T.sprout, 0.35, 0.05, 0.3);
[0, 0.1, 0.2].forEach((d, i) => vBell(T.sprout + d, N(['D6', 'F#6', 'A6'][i]), 1.2, {}, 0.07, 0.1, 0.5));
vStrum(T.sprout + 0.05, CH.A, { gain: 0.32, seed: 95, dur: 1.2 });

// ================================================================ 11 · Revelación: la cuenca es un árbol (35–41 s)
mix.add(PIXEL ? pulse(200, 1.2, { duty: 0.5, sweep: 40, dec: 1, sus: 0.5 }) : riser(1.2, 200, 3000, 17), 34.9, PIXEL ? 0.05 : 0.12, 0, 0.4);
mix.add(PIXEL ? lfsr(1.4, { rate: 3000, decay: 0.5, seed: 74 }) : whoosh(1.4, 120, 900, 74), 35.0, PIXEL ? 0.14 : 0.3, 0, 0.3);
if (PAPER) mix.add(rustle(1.4, 35, 260), 35.0, 0.2, 0, 0.3);
choirChord(35.0, ['D4', 'A4', 'F#5'], 6.0, 0.8, { att: 1.0, rel: 2.5 });
mix.add(PIXEL ? chipKick() : bombo(1.6, 60), 36.0, 0.6, 0, 0.4);
if (CARTOON) { mix.add(cymbal(3.2, 18), 36.0, 0.22, 0, 0.5); mix.add(timpani('D2', 2.2), 36.0, 0.5, 0, 0.4); }
vStrum(36.0, ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5'], { gain: 0.34, seed: 97, dur: 2.5 });
strChord(36.0, ['D2', 'D3', 'A3', 'F#4', 'A4', 'E5'], 5.0, 0.75, { att: 0.6, rel: 2.2 });
mix.add(PIXEL ? tri(N('D2'), 2.6) : bass(N('D2'), 3), 36.0, 0.42, 0, 0.1);
flute(36, [['A5', 0, 1], ['B5', 1, 0.5], ['A5', 1.5, 0.5], ['F#5', 2, 1], ['E5', 3, 0.5], ['F#5', 3.5, 0.5], ['D5', 4, 3]], 0.3, 0.1);
// 20 destellos = 20 municipios
{
  const pent = ['D6', 'E6', 'F#6', 'A6', 'B6', 'D7'];
  const rr = mulberry32(2024);
  for (let i = 0; i < 20; i++) vBell(T.map + 1.0 + i * 0.1 + (i % 3) * 0.04, N(pent[Math.floor(rr() * pent.length)]), 1.6, { ratio: 2 + rr(), index: 1.5 }, 0.04, rr() * 1.6 - 0.8, 0.6);
}
harpArp(T.title1 - 0.05, ['D5', 'F#5', 'A5', 'D6'], 0.09, 0.16, -0.2);
harpArp(T.title2 - 0.05, ['E5', 'A5', 'C#6', 'E6'], 0.09, 0.16, 0.2);
// pixel: cada letra que aparece hace "bip" (como el texto de los juegos)
if (PIXEL) {
  for (const L of PIXEL_TYPE) {
    const n = [...L.text].length;
    for (let i = 0; i < n; i++) {
      const ch = [...L.text][i];
      if (ch === ' ') continue;
      if (i % 2) continue;
      mix.add(blip(1100 + (i % 3) * 90, 0.02), L.t0 + (i / n) * (L.t1 - L.t0), 0.035, 0.1, 0.2);
    }
  }
}
// acorde final (Re mayor con novena) que queda sonando
vStrum(T.credits, ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5'], { gain: 0.36, seed: 98, dur: 2.2 });
padChord(T.credits, ['D3', 'A3', 'E4', 'F#4', 'A4'], 3.2, 1.0, { att: 0.3, rel: 2.2, cutoff: 1800 });
mix.add(PIXEL ? tri(N('D2'), 1.8, { rel: 0.6 }) : bass(N('D2'), 2.5), T.credits, 0.4, 0, 0.1);
vBell(T.credits + 0.05, N('D6'), 2.6, { ratio: 2, index: 1 }, 0.1, 0, 0.6);
vBell(T.credits + 0.3, N('A6'), 2.6, { ratio: 2, index: 1 }, 0.07, 0.3, 0.6);
if (CARTOON) { mix.add(brass('D4', 1.6, { bright: 1, seed: 90 }), T.credits, 0.1, -0.2, 0.5); mix.add(brass('F#4', 1.6, { bright: 1, seed: 91 }), T.credits, 0.09, 0, 0.5); mix.add(brass('A4', 1.6, { bright: 1, seed: 92 }), T.credits, 0.08, 0.2, 0.5); mix.add(cymbal(2.6, 30), T.credits, 0.12, 0, 0.5); }
if (!PIXEL) for (let k = 0; k < 5; k++) mix.add(chirp(700 + k, 3), 37.5 + k * 0.6, 0.04, k % 2 ? -0.7 : 0.7, 0.5);
// caricatura: el iris se cierra con un "¡ta-da!"
if (CARTOON) { mix.add(xylo('D6', 0.4), 40.35, 0.22, 0, 0.3); mix.add(xylo('A6', 0.6), 40.5, 0.24, 0, 0.3); mix.add(timpani('D2', 0.8), 40.5, 0.3, 0, 0.3); }

// ================================================================ mezcla final
const [wL, wR] = reverb(mix.rL, mix.rR, { room: PIXEL ? 0.78 : 0.86, damp: PIXEL ? 0.4 : 0.28 });
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
const out = path.join(here, '../..', OUT_DIR, 'banda_sonora.wav');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, writeWav(oL, oR));
console.log('audio listo:', out, `pico previo ${peak.toFixed(2)}`);
