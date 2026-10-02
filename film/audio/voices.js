// Instrumentos de las otras versiones, también sintetizados aquí:
//   chip (pixel art): pulsos con tramo variable, triángulo de 4 bits, ruido LFSR, arpegios
//   caricatura: pizzicato, metales, clarinete, xilófono, timbales, platillo, silbato de émbolo
//   papel: caja de música, kalimba, ukelele, silbido, palmas, papel que cruje
import { SR, NOTE, noise, pluckString, env, onePoleLP, onePoleHP, svfBand } from './synth.js';
import { mulberry32 } from '../core/math.js';

const TAU = Math.PI * 2;
const F = (n) => (typeof n === 'number' ? n : NOTE(n.replace('Bb', 'A#').replace('Eb', 'D#')));

// ================================================================ CHIP
// pulso sin aliasing (polyBLEP): duty 0.125 / 0.25 / 0.5 como en las consolas de 8 bits
function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
export function pulse(freq, dur, { duty = 0.5, att = 0.003, dec = 0.12, sus = 0.65, rel = 0.05, vib = 0, vibDelay = 0.16, vibRate = 5.8, slide = 0, slideTime = 0.05, sweep = 0, steps = 16 } = {}) {
  const f0 = F(freq);
  const n = Math.round((dur + rel) * SR);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const vk = vib ? Math.min(1, Math.max(0, (t - vibDelay) / 0.15)) : 0;
    let f = f0 * (1 + vib * vk * Math.sin(TAU * vibRate * t));
    if (slide) f *= Math.pow(2, (slide * Math.exp(-t / slideTime)) / 12);
    if (sweep) f *= Math.pow(2, (sweep * t) / 12);
    const dt = f / SR;
    ph += dt; ph -= Math.floor(ph);
    let s = (ph < duty ? 1 : -1);
    s += blep(ph, dt);
    let p2 = ph - duty; if (p2 < 0) p2 += 1;
    s -= blep(p2, dt);
    // envolvente en escalones (volumen de 4 bits)
    let e = t < att ? t / att : t < dur ? sus + (1 - sus) * Math.exp(-(t - att) / dec) : (sus) * Math.max(0, 1 - (t - dur) / rel);
    e = Math.round(e * steps) / steps;
    out[i] = s * e * 0.32;
  }
  return out;
}
// triángulo de 4 bits (el bajo de las consolas: áspero y redondo a la vez)
export function tri(freq, dur, { rel = 0.02, slide = 0, slideTime = 0.03 } = {}) {
  const f0 = F(freq);
  const n = Math.round((dur + rel) * SR);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let f = f0;
    if (slide) f *= Math.pow(2, (slide * Math.exp(-t / slideTime)) / 12);
    ph += f / SR; ph -= Math.floor(ph);
    const v = ph < 0.5 ? ph * 4 - 1 : 3 - ph * 4;
    const q = Math.round((v + 1) * 7.5) / 7.5 - 1;
    const e = t < dur ? 1 : Math.max(0, 1 - (t - dur) / rel);
    out[i] = q * e * 0.5;
  }
  onePoleLP(out, 9000);
  return out;
}
// ruido LFSR de 15 bits; `rate`: frecuencia del reloj (más alta = más brillante)
export function lfsr(dur, { rate = 12000, decay = 0.08, short = false, seed = 1, pitchDrop = 0 } = {}) {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  let reg = 1 + (seed % 32000);
  let acc = 0, v = 1;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const r = rate * (pitchDrop ? Math.exp(-t / pitchDrop) * 0.7 + 0.3 : 1);
    acc += r / SR;
    while (acc >= 1) {
      acc -= 1;
      const bit = (reg ^ (reg >> (short ? 6 : 1))) & 1;
      reg = (reg >> 1) | (bit << 14);
      v = reg & 1 ? 1 : -1;
    }
    const e = Math.round(Math.exp(-t / decay) * 15) / 15;
    out[i] = v * e * 0.3;
  }
  return out;
}
export function chipKick() {
  const n = Math.round(0.22 * SR);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 45 + 180 * Math.exp(-t / 0.025);
    ph += f / SR; ph -= Math.floor(ph);
    const v = ph < 0.5 ? ph * 4 - 1 : 3 - ph * 4;
    out[i] = (Math.round((v + 1) * 7.5) / 7.5 - 1) * Math.exp(-t / 0.09) * 0.75;
  }
  return out;
}
export function chipSnare(seed = 3) {
  const a = lfsr(0.16, { rate: 9000, decay: 0.045, seed });
  const b = tri(220, 0.03, { slide: 7 });
  for (let i = 0; i < b.length && i < a.length; i++) a[i] += b[i] * 0.6;
  return a;
}
export function chipHat(seed = 5, open = false) { return lfsr(open ? 0.14 : 0.04, { rate: 30000, decay: open ? 0.06 : 0.012, seed, short: false }); }
// arpegio de acorde (una sola voz que salta entre las notas muy rápido)
export function chipArp(notes, dur, { rate = 1 / 48, duty = 0.25, dec = 0.25, sus = 0.55 } = {}) {
  const fs = notes.map(F);
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const k = Math.floor(t / rate) % fs.length;
    const f = fs[k];
    const dt = f / SR;
    ph += dt; ph -= Math.floor(ph);
    let s = ph < duty ? 1 : -1;
    s += blep(ph, dt);
    let p2 = ph - duty; if (p2 < 0) p2 += 1;
    s -= blep(p2, dt);
    let e = sus + (1 - sus) * Math.exp(-t / dec);
    e *= Math.min(1, (n - i) / (SR * 0.02));
    out[i] = s * (Math.round(e * 15) / 15) * 0.26;
  }
  return out;
}
// efectos clásicos
export function coin() {
  const a = pulse('B5', 0.07, { duty: 0.5, dec: 1, sus: 1, rel: 0.001 });
  const b = pulse('E6', 0.32, { duty: 0.5, dec: 0.12, sus: 0, rel: 0.02 });
  const out = new Float32Array(a.length + b.length);
  out.set(a, 0); out.set(b, a.length - 10);
  return out;
}
export function jump(f0 = 'C5', semis = 14, dur = 0.16) { return pulse(f0, dur, { duty: 0.25, sweep: semis / dur, dec: 0.2, sus: 0.6, rel: 0.02 }); }
export function powerUp(root = 'C5', steps = 12, step = 0.035) {
  const ints = [0, 4, 7, 12, 4, 7, 12, 16, 7, 12, 16, 19, 12, 16, 19, 24];
  const out = new Float32Array(Math.round((steps * step + 0.2) * SR));
  const f0 = F(root);
  for (let k = 0; k < steps; k++) {
    const b = pulse(f0 * Math.pow(2, ints[k % ints.length] / 12), step * 1.05, { duty: 0.5, dec: 0.5, sus: 0.8, rel: 0.004 });
    const i0 = Math.round(k * step * SR);
    for (let i = 0; i < b.length && i0 + i < out.length; i++) out[i0 + i] += b[i] * (0.6 + 0.4 * k / steps);
  }
  return out;
}
export function blip(freq = 1250, dur = 0.028) { return pulse(freq, dur, { duty: 0.5, dec: 1, sus: 1, rel: 0.004 }); }
// eco de cinta (clásico en las melodías chip)
export function echo(buf, delay = 0.18, fb = 0.35, n = 3) {
  const d = Math.round(delay * SR);
  const out = new Float32Array(buf.length + d * n);
  out.set(buf);
  let g = 1;
  for (let k = 1; k <= n; k++) { g *= fb; for (let i = 0; i < buf.length; i++) out[i + d * k] += buf[i] * g; }
  return out;
}

// ================================================================ CARICATURA
export function pizz(freq, dur = 0.7) {
  const o = pluckString(F(freq), dur, { t60: 0.45, bright: 0.45, seed: Math.round(F(freq)) });
  onePoleLP(o, 3200);
  for (let i = 0; i < o.length; i++) o[i] *= 1.4;
  return o;
}
// metales: sierra con filtro que se abre al atacar (brillo de trompeta) y vibrato tardío
export function brass(freq, dur, { att = 0.04, bright = 1, vib = 0.007, rel = 0.12, seed = 1 } = {}) {
  const f0 = F(freq);
  const n = Math.round((dur + rel) * SR);
  const out = new Float32Array(n);
  const r = mulberry32(seed);
  let ph = r(), ph2 = r(), lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const vk = Math.min(1, Math.max(0, (t - 0.2) / 0.2));
    const f = f0 * (1 + vib * vk * Math.sin(TAU * 5.2 * t)) * (1 - 0.01 * Math.exp(-t / 0.03));
    ph += f / SR; ph -= Math.floor(ph);
    ph2 += (f * 1.003) / SR; ph2 -= Math.floor(ph2);
    const saw = (ph * 2 - 1) + (ph2 * 2 - 1) * 0.7;
    const a = Math.min(1, t / att);
    const e = t < dur ? a * (0.82 + 0.18 * Math.exp(-t / 0.1)) : Math.max(0, 1 - (t - dur) / rel);
    const fc = f0 * (1.2 + bright * (2.2 * e + 3 * Math.exp(-t / 0.08)));
    const k = 1 - Math.exp((-TAU * Math.min(fc, 9000)) / SR);
    lp += k * (saw - lp);
    out[i] = Math.tanh(lp * 1.6) * e * 0.4;
  }
  return out;
}
// clarinete: armónicos impares, soplo suave
export function clarinet(freq, dur, { vib = 0.008, rel = 0.1, seed = 2 } = {}) {
  const f0 = F(freq);
  const n = Math.round((dur + rel) * SR);
  const out = new Float32Array(n);
  const nz = noise(n, seed);
  svfBand(nz, () => f0 * 3, 0.4);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const vk = Math.min(1, Math.max(0, (t - 0.18) / 0.2));
    ph += (f0 * (1 + vib * vk * Math.sin(TAU * 5 * t))) / SR;
    const s = Math.sin(TAU * ph) + 0.42 * Math.sin(3 * TAU * ph) + 0.22 * Math.sin(5 * TAU * ph) + 0.1 * Math.sin(7 * TAU * ph);
    const a = Math.min(1, t / 0.035);
    const e = t < dur ? a : Math.max(0, 1 - (t - dur) / rel);
    out[i] = (s * 0.42 + nz[i] * 0.6) * e * 0.5;
  }
  return out;
}
export function xylo(freq, dur = 0.7) {
  const f0 = F(freq);
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  const nz = noise(400, Math.round(f0));
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = (Math.sin(TAU * f0 * t) * Math.exp(-t / 0.22) + 0.45 * Math.sin(TAU * f0 * 3.93 * t) * Math.exp(-t / 0.05) + 0.15 * Math.sin(TAU * f0 * 9.2 * t) * Math.exp(-t / 0.012) + (i < 400 ? nz[i] * 0.4 * (1 - i / 400) : 0)) * 0.55;
  }
  for (let i = 0; i < n; i++) out[i] *= env(i, n, 0, 600);
  return out;
}
export function timpani(freq, dur = 1.6, seed = 4) {
  const f0 = F(freq);
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  const nz = noise(n, seed);
  onePoleLP(nz, 900);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = f0 * (1 + 0.04 * Math.exp(-t / 0.05));
    out[i] = (Math.sin(TAU * f * t) * Math.exp(-t / 0.7) + 0.5 * Math.sin(TAU * f * 1.5 * t) * Math.exp(-t / 0.35) + 0.3 * Math.sin(TAU * f * 1.98 * t) * Math.exp(-t / 0.25) + nz[i] * 1.5 * Math.exp(-t / 0.03)) * 0.7;
  }
  return out;
}
export function cymbal(dur = 2.2, seed = 6) {
  const n = Math.round(dur * SR);
  const b = noise(n, seed);
  onePoleHP(b, 3500);
  const c = noise(n, seed + 1);
  svfBand(c, () => 7200, 0.3);
  for (let i = 0; i < n; i++) { const t = i / SR; b[i] = (b[i] * 0.7 + c[i] * 0.8) * Math.exp(-t / (dur * 0.33)) * Math.min(1, i / 40); }
  return b;
}
export function snare(seed = 8) {
  const n = Math.round(0.25 * SR);
  const b = noise(n, seed);
  svfBand(b, () => 2400, 0.7);
  for (let i = 0; i < n; i++) { const t = i / SR; b[i] = b[i] * 2.2 * Math.exp(-t / 0.06) + Math.sin(TAU * 185 * t) * Math.exp(-t / 0.04) * 0.6; }
  return b;
}
export function woodblock(freq = 900) {
  const n = Math.round(0.18 * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; out[i] = (Math.sin(TAU * freq * t) + 0.4 * Math.sin(TAU * freq * 2.71 * t)) * Math.exp(-t / 0.025) * 0.7; }
  return out;
}
export function slideWhistle(f0, f1, dur, { vib = 0.01, curve = 1 } = {}) {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  const nz = noise(n, 77);
  svfBand(nz, () => 2000, 0.5);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, u = Math.pow(i / n, curve);
    const f = f0 * Math.pow(f1 / f0, u) * (1 + vib * Math.sin(TAU * 6 * t));
    ph += f / SR;
    const e = Math.min(1, t / 0.02) * Math.min(1, (n - i) / (SR * 0.03));
    out[i] = (Math.sin(TAU * ph) + nz[i] * 0.15) * e * 0.45;
  }
  return out;
}
// tuba / fagot: bajo con caña
export function tuba(freq, dur = 0.5) {
  const o = brass(freq, dur, { att: 0.02, bright: 0.35, vib: 0, rel: 0.06 });
  onePoleLP(o, 1500);
  for (let i = 0; i < o.length; i++) o[i] *= 1.6;
  return o;
}
// "wah-wah" de trombón triste (la regadera vacía)
export function wahwah(notes = ['A#3', 'A3', 'G#3', 'G3'], step = 0.32) {
  const out = new Float32Array(Math.round((notes.length * step + 0.6) * SR));
  notes.forEach((nn, k) => {
    const last = k === notes.length - 1;
    const b = brass(nn, last ? step * 2.2 : step * 0.95, { bright: 0.5, vib: last ? 0.025 : 0.004, att: 0.04 });
    // la sordina: filtro que abre y cierra
    let lp = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      const fc = 500 + 1600 * (0.5 + 0.5 * Math.sin(TAU * (last ? 4 : 2.2) * t - 1.5));
      const kk = 1 - Math.exp((-TAU * fc) / SR);
      lp += kk * (b[i] - lp);
      b[i] = lp * 1.5;
    }
    const i0 = Math.round(k * step * SR);
    for (let i = 0; i < b.length && i0 + i < out.length; i++) out[i0 + i] += b[i];
  });
  return out;
}

// ================================================================ PAPEL
export function musicBox(freq, dur = 1.8) {
  const f0 = F(freq);
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = (Math.sin(TAU * f0 * t) * Math.exp(-t / 0.6) + 0.35 * Math.sin(TAU * f0 * 1.003 * t) * Math.exp(-t / 0.5)
      + 0.25 * Math.sin(TAU * f0 * 5.4 * t) * Math.exp(-t / 0.06) + 0.12 * Math.sin(TAU * f0 * 2.76 * t) * Math.exp(-t / 0.15)) * Math.min(1, i / 30) * 0.5;
  }
  for (let i = 0; i < n; i++) out[i] *= env(i, n, 0, 900);
  return out;
}
export function kalimba(freq, dur = 1.2) {
  const f0 = F(freq);
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  const nz = noise(300, Math.round(f0) + 3);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = (Math.sin(TAU * f0 * t) * Math.exp(-t / 0.5) + 0.3 * Math.sin(TAU * f0 * 6.27 * t) * Math.exp(-t / 0.03) + 0.08 * Math.sin(TAU * f0 * 2 * t) * Math.exp(-t / 0.2) + (i < 300 ? nz[i] * 0.25 * (1 - i / 300) : 0)) * 0.6;
  }
  for (let i = 0; i < n; i++) out[i] *= env(i, n, 0, 800);
  return out;
}
export function uke(freq, dur = 1.2, seed = 1) {
  const o = pluckString(F(freq), dur, { t60: 1.1, bright: 0.5, seed });
  onePoleLP(o, 5000);
  return o;
}
export function whistle(freq, dur, { vib = 0.012, rel = 0.08, seed = 4 } = {}) {
  const f0 = F(freq);
  const n = Math.round((dur + rel) * SR);
  const out = new Float32Array(n);
  const nz = noise(n, seed);
  svfBand(nz, () => f0, 0.25);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const vk = Math.min(1, Math.max(0, (t - 0.15) / 0.2));
    ph += (f0 * (1 + vib * vk * Math.sin(TAU * 5.6 * t)) * (1 - 0.02 * Math.exp(-t / 0.04))) / SR;
    const a = Math.min(1, t / 0.04);
    const e = t < dur ? a : Math.max(0, 1 - (t - dur) / rel);
    out[i] = (Math.sin(TAU * ph) * 0.9 + nz[i] * 0.5) * e * 0.4;
  }
  return out;
}
export function clap(seed = 1) {
  const n = Math.round(0.2 * SR);
  const b = noise(n, seed);
  svfBand(b, () => 1300, 0.6);
  const hits = [0, 0.009, 0.017, 0.028];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let e = 0;
    for (const h of hits) if (t >= h) e = Math.max(e, Math.exp(-(t - h) / (h === 0.028 ? 0.05 : 0.006)));
    b[i] *= e * 2;
  }
  return b;
}
// papel que cruje: ruido agudo con chasquidos dispersos
export function rustle(dur = 0.6, seed = 9, density = 160) {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  const r = mulberry32(seed);
  const nz = noise(n, seed);
  onePoleHP(nz, 1800);
  let g = 0;
  for (let i = 0; i < n; i++) {
    if (r() < density / SR) g = 0.4 + r() * 0.8;
    g *= 0.9985;
    const u = i / n;
    out[i] = nz[i] * g * Math.sin(Math.PI * u) * 0.8;
  }
  return out;
}
// tijeras: dos clics metálicos
export function snip(seed = 3) {
  const n = Math.round(0.14 * SR);
  const out = new Float32Array(n);
  const nz = noise(n, seed);
  svfBand(nz, () => 5200, 0.3);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = nz[i] * (Math.exp(-t / 0.004) + 0.8 * (t > 0.07 ? Math.exp(-(t - 0.07) / 0.005) : 0)) * 1.6;
  }
  return out;
}
// armonio: lengüetas (cuadrada y sierra suaves) — acordes del papel
export function harmonium(notes, dur, { att = 0.15, rel = 0.4 } = {}) {
  const n = Math.round(dur * SR);
  const L = new Float32Array(n), R = new Float32Array(n);
  notes.forEach((nn, k) => {
    const f0 = F(nn);
    let p1 = k * 0.13, p2 = k * 0.37;
    const pan = (k / Math.max(1, notes.length - 1) - 0.5) * 0.6;
    const gl = Math.cos(((pan + 1) * Math.PI) / 4), gr = Math.sin(((pan + 1) * Math.PI) / 4);
    for (let i = 0; i < n; i++) {
      p1 += f0 / SR; p1 -= Math.floor(p1);
      p2 += (f0 * 1.004) / SR; p2 -= Math.floor(p2);
      const s = (p1 < 0.5 ? 0.6 : -0.6) + (p2 * 2 - 1) * 0.5;
      L[i] += s * gl; R[i] += s * gr;
    }
  });
  onePoleLP(L, 1400); onePoleLP(L, 1800); onePoleLP(R, 1400); onePoleLP(R, 1800);
  const g = 0.11 / Math.sqrt(notes.length);
  for (let i = 0; i < n; i++) { const e = env(i, n, att * SR, rel * SR) * g * (1 + 0.06 * Math.sin(TAU * 4.8 * i / SR)); L[i] *= e; R[i] *= e; }
  return [L, R];
}
