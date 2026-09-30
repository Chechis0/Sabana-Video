// Sintetizador mínimo en JavaScript: todo el sonido del filminuto se genera aquí (música original).
import { mulberry32 } from '../core/math.js';

export const SR = 48000;
const TAU = Math.PI * 2;

export const NOTE = (() => {
  const names = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };
  return (n) => {
    const m = /^([A-G]#?)(-?\d)$/.exec(n);
    const semi = names[m[1]] + (Number(m[2]) - 4) * 12;
    return 440 * Math.pow(2, semi / 12);
  };
})();

// ---------------------------------------------------------------- mezcla
export class Mix {
  constructor(seconds) {
    const n = Math.ceil(seconds * SR);
    this.n = n;
    this.L = new Float32Array(n); this.R = new Float32Array(n);
    this.rL = new Float32Array(n); this.rR = new Float32Array(n);
  }
  add(buf, t, gain = 1, pan = 0, rev = 0.25) {
    const i0 = Math.round(t * SR);
    const a = ((pan + 1) * Math.PI) / 4;
    const gl = gain * Math.cos(a) * Math.SQRT2, gr = gain * Math.sin(a) * Math.SQRT2;
    const { L, R, rL, rR, n } = this;
    for (let i = 0; i < buf.length; i++) {
      const j = i0 + i;
      if (j < 0) continue;
      if (j >= n) break;
      const v = buf[i];
      L[j] += v * gl; R[j] += v * gr;
      if (rev) { rL[j] += v * gl * rev; rR[j] += v * gr * rev; }
    }
  }
  addStereo(bl, br, t, gain = 1, rev = 0.2) {
    const i0 = Math.round(t * SR);
    for (let i = 0; i < bl.length; i++) {
      const j = i0 + i;
      if (j < 0 || j >= this.n) continue;
      this.L[j] += bl[i] * gain; this.R[j] += br[i] * gain;
      this.rL[j] += bl[i] * gain * rev; this.rR[j] += br[i] * gain * rev;
    }
  }
}

// ---------------------------------------------------------------- utilidades
const env = (i, n, att, rel) => {
  const a = att > 0 ? Math.min(1, i / att) : 1;
  const r = rel > 0 ? Math.min(1, (n - i) / rel) : 1;
  return Math.max(0, Math.min(a, r));
};
function onePoleLP(buf, cutoff) {
  const k = 1 - Math.exp((-TAU * cutoff) / SR);
  let y = 0;
  for (let i = 0; i < buf.length; i++) { y += k * (buf[i] - y); buf[i] = y; }
  return buf;
}
function onePoleHP(buf, cutoff) {
  const k = Math.exp((-TAU * cutoff) / SR);
  let x1 = 0, y = 0;
  for (let i = 0; i < buf.length; i++) { y = k * (y + buf[i] - x1); x1 = buf[i]; buf[i] = y; }
  return buf;
}
// filtro de estado variable (pasa-banda) con frecuencia variable
function svfBand(buf, fcFn, q = 0.7) {
  let low = 0, band = 0;
  for (let i = 0; i < buf.length; i++) {
    const fc = fcFn(i);
    const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 6)) / SR);
    const high = buf[i] - low - q * band;
    band += f * high;
    low += f * band;
    buf[i] = band;
  }
  return buf;
}
export function noise(n, seed = 1) {
  const r = mulberry32(seed);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) b[i] = r() * 2 - 1;
  return b;
}

// ---------------------------------------------------------------- instrumentos
// cuerda pulsada (Karplus-Strong con retardo fraccional): base del tiple
export function pluckString(freq, dur, { t60 = 2.2, bright = 0.6, seed = 1 } = {}) {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  const period = SR / freq - 0.5;
  const M = Math.ceil(period) + 4;
  const buf = new Float32Array(M * 2);
  const size = buf.length;
  const r = mulberry32(seed);
  const g = Math.pow(10, -3 / (t60 * freq));
  // excitación: ráfaga de ruido filtrada según brillo
  const exLen = Math.ceil(period);
  let lp = 0;
  const kx = 0.2 + bright * 0.8;
  let w = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    let ex = 0;
    if (i < exLen) { lp += kx * ((r() * 2 - 1) - lp); ex = lp; }
    const rp = w - period;
    const ri = Math.floor(rp), fr = rp - ri;
    const a = buf[(ri + size * 4) % size], b = buf[(ri + 1 + size * 4) % size];
    const y = a + (b - a) * fr;
    const filt = 0.5 * (y + prev);
    prev = y;
    buf[w % size] = ex + g * filt;
    out[i] = y;
    w++;
  }
  // un poco de cuerpo (resonancia de caja) y fade final
  for (let i = 0; i < n; i++) out[i] *= env(i, n, 8, 2400);
  return out;
}

// tiple: 3 cuerdas por orden, levemente desafinadas (coro)
export function tipleNote(freq, dur, o = {}) {
  const a = pluckString(freq, dur, { ...o, seed: (o.seed || 1) * 3 + 1 });
  const b = pluckString(freq * 1.0028, dur, { ...o, seed: (o.seed || 1) * 3 + 2, bright: (o.bright ?? 0.6) * 0.8 });
  const c = pluckString(freq * 2 * 0.9985, dur, { ...o, seed: (o.seed || 1) * 3 + 3, t60: (o.t60 ?? 2.2) * 0.6 });
  for (let i = 0; i < a.length; i++) a[i] = (a[i] + b[i] * 0.8 + c[i] * 0.35) * 0.45;
  return a;
}

// rasgueo: notas escalonadas (abajo/arriba)
export function strum(mix, t, notes, { gain = 0.5, up = false, spread = 0.012, dur = 1.6, pan = 0, bright = 0.55, seed = 1, rev = 0.25 } = {}) {
  const ns = up ? notes.slice().reverse() : notes;
  ns.forEach((n, i) => {
    const f = typeof n === 'number' ? n : NOTE(n);
    mix.add(tipleNote(f, dur, { bright, seed: seed * 17 + i, t60: 1.6 }), t + i * spread, gain * (up ? 0.7 : 1), pan + (i - ns.length / 2) * 0.06, rev);
  });
}

// marimba / kalimba
export function mallet(freq, dur = 1.2, { soft = 0 } = {}) {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const a = Math.min(1, i / (SR * 0.002));
    out[i] = a * (Math.sin(TAU * freq * t) * Math.exp(-t / (0.45 + soft * 0.4))
      + 0.28 * Math.sin(TAU * freq * 3.98 * t) * Math.exp(-t / 0.07)
      + 0.08 * Math.sin(TAU * freq * 9.1 * t) * Math.exp(-t / 0.012));
  }
  for (let i = 0; i < n; i++) out[i] *= env(i, n, 0, 1200);
  return out;
}

// campanita FM (brillos)
export function bell(freq, dur = 2, { ratio = 3.5, index = 3 } = {}) {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const I = index * Math.exp(-t / 0.35);
    out[i] = Math.sin(TAU * freq * t + I * Math.sin(TAU * freq * ratio * t)) * Math.exp(-t / (dur * 0.35)) * Math.min(1, i / 60);
  }
  return out;
}

// pad cálido (tabla de onda con armónicos suaves, voces desafinadas)
const TABLE = (() => {
  const N = 4096, tb = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) {
    let v = 0;
    for (let k = 1; k <= 9; k++) v += Math.sin((TAU * k * i) / N) / Math.pow(k, 1.3);
    tb[i] = v * 0.6;
  }
  return tb;
})();
export function pad(notes, dur, { att = 0.8, rel = 1.2, cutoff = 1600, detune = 0.004, seed = 1 } = {}) {
  const n = Math.round(dur * SR);
  const L = new Float32Array(n), R = new Float32Array(n);
  const r = mulberry32(seed);
  const N = 4096;
  for (const note of notes) {
    const f0 = typeof note === 'number' ? note : NOTE(note);
    for (let v = 0; v < 3; v++) {
      const f = f0 * (1 + (v - 1) * detune);
      let ph = r();
      const vib = 4.5 + r() * 1.5, vph = r() * TAU;
      const pan = (v - 1) * 0.6;
      const gl = Math.cos(((pan + 1) * Math.PI) / 4), gr = Math.sin(((pan + 1) * Math.PI) / 4);
      for (let i = 0; i < n; i++) {
        const fi = f * (1 + 0.0025 * Math.sin((TAU * vib * i) / SR + vph));
        ph += fi / SR;
        ph -= Math.floor(ph);
        const x = ph * N, xi = x | 0;
        const s = TABLE[xi] + (TABLE[xi + 1] - TABLE[xi]) * (x - xi);
        L[i] += s * gl; R[i] += s * gr;
      }
    }
  }
  onePoleLP(L, cutoff); onePoleLP(L, cutoff * 1.5);
  onePoleLP(R, cutoff); onePoleLP(R, cutoff * 1.5);
  const a = att * SR, rl = rel * SR;
  const g = 0.12 / Math.sqrt(notes.length);
  for (let i = 0; i < n; i++) { const e = env(i, n, a, rl) * g; L[i] *= e; R[i] *= e; }
  return [L, R];
}

export function bass(freq, dur = 1.2) {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = Math.min(1, i / 200) * Math.exp(-t / 0.9);
    const s = Math.sin(TAU * freq * t) + 0.25 * Math.sin(TAU * freq * 2 * t) + 0.08 * Math.sin(TAU * freq * 3 * t);
    out[i] = Math.tanh(s * 1.2) * e;
  }
  for (let i = 0; i < n; i++) out[i] *= env(i, n, 0, 1500);
  return out;
}

export function kick(dur = 0.4, f0 = 110, f1 = 45) {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = f1 + (f0 - f1) * Math.exp(-t / 0.04);
    ph += f / SR;
    out[i] = Math.sin(TAU * ph) * Math.exp(-t / 0.13);
  }
  return out;
}

export function shaker(dur = 0.08, seed = 1) {
  const b = noise(Math.round(dur * SR), seed);
  onePoleHP(b, 5000);
  for (let i = 0; i < b.length; i++) b[i] *= Math.pow(1 - i / b.length, 2) * Math.min(1, i / 120);
  return b;
}

// ---------------------------------------------------------------- efectos
export function plink(f = 1400, dur = 0.35) {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f1 = f * (1 + 0.6 * (1 - Math.exp(-t / 0.02)));
    ph += f1 / SR;
    out[i] = Math.sin(TAU * ph) * Math.exp(-t / 0.08) * Math.min(1, i / 30);
  }
  return out;
}
export function glide(f0, f1, dur, { vib = 0, decay = 0 } = {}) {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, u = i / n;
    const f = f0 * Math.pow(f1 / f0, u) * (1 + vib * Math.sin(TAU * 7 * t));
    ph += f / SR;
    out[i] = Math.sin(TAU * ph) * env(i, n, 300, 1500) * (decay ? Math.exp(-t / decay) : 1);
  }
  return out;
}
export function splash(dur = 0.5, seed = 3, bright = 3000) {
  const n = Math.round(dur * SR);
  const b = noise(n, seed);
  svfBand(b, (i) => bright * (1 - 0.6 * (i / n)), 0.9);
  for (let i = 0; i < n; i++) b[i] *= Math.exp(-(i / SR) / (dur * 0.3)) * Math.min(1, i / 100) * 1.5;
  // burbujitas
  const r = mulberry32(seed + 9);
  for (let k = 0; k < 6; k++) {
    const p = plink(900 + r() * 1600, 0.12);
    const o = Math.floor(r() * n * 0.6);
    for (let i = 0; i < p.length && o + i < n; i++) b[o + i] += p[i] * 0.25;
  }
  return b;
}
export function whoosh(dur, f0 = 300, f1 = 3000, seed = 5) {
  const n = Math.round(dur * SR);
  const b = noise(n, seed);
  svfBand(b, (i) => f0 * Math.pow(f1 / f0, i / n), 0.5);
  for (let i = 0; i < n; i++) b[i] *= Math.sin((Math.PI * i) / n) ** 1.5 * 1.2;
  return b;
}
export function wind(dur, seed = 7, base = 500) {
  const n = Math.round(dur * SR);
  const b = noise(n, seed);
  const r = mulberry32(seed);
  const p1 = r() * TAU, p2 = r() * TAU;
  svfBand(b, (i) => base * (1 + 0.5 * Math.sin((TAU * 0.13 * i) / SR + p1) + 0.3 * Math.sin((TAU * 0.31 * i) / SR + p2)), 1.2);
  for (let i = 0; i < n; i++) b[i] *= env(i, n, SR * 1.2, SR * 1.2) * (0.7 + 0.3 * Math.sin((TAU * 0.2 * i) / SR + p2));
  return b;
}
export function trickle(dur, seed = 11, density = 22) {
  const n = Math.round(dur * SR);
  const b = noise(n, seed);
  onePoleHP(b, 1800); onePoleLP(b, 6000);
  for (let i = 0; i < n; i++) b[i] *= 0.07;
  const r = mulberry32(seed);
  const cnt = Math.floor(dur * density);
  for (let k = 0; k < cnt; k++) {
    const p = plink(700 + r() * 2200, 0.05 + r() * 0.06);
    const o = Math.floor(r() * n);
    const g = 0.15 + r() * 0.3;
    for (let i = 0; i < p.length && o + i < n; i++) b[o + i] += p[i] * g;
  }
  for (let i = 0; i < n; i++) b[i] *= env(i, n, SR * 0.4, SR * 0.5);
  return b;
}
export function chirp(seed = 1, notes = 4) {
  const r = mulberry32(seed);
  const parts = [];
  let total = 0;
  for (let k = 0; k < notes; k++) {
    const d = 0.05 + r() * 0.07;
    const f0 = 2600 + r() * 1800, f1 = f0 * (0.8 + r() * 0.7);
    parts.push([glide(f0, f1, d), total]);
    total += d + 0.02 + r() * 0.05;
  }
  const out = new Float32Array(Math.round((total + 0.1) * SR));
  for (const [p, o] of parts) { const i0 = Math.round(o * SR); for (let i = 0; i < p.length; i++) out[i0 + i] += p[i] * 0.5; }
  return out;
}
export function buzz(dur, f = 46) {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  const b = noise(n, 99);
  svfBand(b, () => 380, 0.8);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = b[i] * (0.6 + 0.4 * Math.sin(TAU * f * t)) * env(i, n, 900, 900) * 1.6;
  }
  return out;
}
export function cicadas(dur, seed = 21) {
  const n = Math.round(dur * SR);
  const b = noise(n, seed);
  svfBand(b, () => 5200, 0.25);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    b[i] *= (0.5 + 0.5 * Math.sin(TAU * 38 * t)) * (0.6 + 0.4 * Math.sin(TAU * 0.7 * t)) * env(i, n, SR * 0.8, SR * 0.8);
  }
  return b;
}
export function rain(dur, seed = 31) {
  const n = Math.round(dur * SR);
  const b = noise(n, seed);
  onePoleHP(b, 900); onePoleLP(b, 7000);
  for (let i = 0; i < n; i++) b[i] *= 0.35 * env(i, n, SR * 0.6, SR * 0.8);
  const r = mulberry32(seed);
  for (let k = 0; k < dur * 60; k++) {
    const p = plink(1500 + r() * 3000, 0.03);
    const o = Math.floor(r() * n);
    const g = (0.08 + r() * 0.2) * env(o, n, SR * 0.6, SR * 0.8);
    for (let i = 0; i < p.length && o + i < n; i++) b[o + i] += p[i] * g;
  }
  return b;
}
export function rumble(dur, seed = 41) {
  const n = Math.round(dur * SR);
  const b = noise(n, seed);
  onePoleLP(b, 90); onePoleLP(b, 120);
  for (let i = 0; i < n; i++) b[i] *= 9 * Math.sin((Math.PI * i) / n) ** 2;
  return b;
}
export function thud(seed = 51) {
  const k = kick(0.3, 90, 40);
  const nz = noise(k.length, seed);
  onePoleLP(nz, 900);
  for (let i = 0; i < k.length; i++) k[i] = k[i] * 0.9 + nz[i] * 0.5 * Math.exp(-i / (SR * 0.03));
  return k;
}
export function crunch(seed = 61) {
  const n = Math.round(0.28 * SR);
  const out = new Float32Array(n);
  const r = mulberry32(seed);
  for (let g = 0; g < 4; g++) {
    const o = Math.floor(r() * n * 0.7);
    const len = Math.floor(SR * (0.02 + r() * 0.03));
    const nz = noise(len, seed + g);
    onePoleLP(nz, 1500 + r() * 1500);
    for (let i = 0; i < len && o + i < n; i++) out[o + i] += nz[i] * Math.exp(-i / (len * 0.3)) * 0.9;
  }
  return out;
}
export function pop() {
  const g = glide(260, 900, 0.07);
  const out = new Float32Array(Math.round(0.12 * SR));
  for (let i = 0; i < g.length; i++) out[i] = g[i] * Math.exp(-i / (SR * 0.03));
  return out;
}
export function clank() {
  const a = bell(740, 0.5, { ratio: 1.41, index: 5 });
  const b = bell(1130, 0.35, { ratio: 2.76, index: 3 });
  for (let i = 0; i < b.length; i++) a[i] += b[i] * 0.6;
  return a;
}
export function boing(f0 = 300, f1 = 700, dur = 0.35) {
  return glide(f0, f1, dur, { vib: 0.06, decay: dur * 0.6 });
}

// ---------------------------------------------------------------- reverberación (Freeverb simplificado)
export function reverb(inL, inR, { room = 0.84, damp = 0.3 } = {}) {
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((x) => Math.round((x * SR) / 44100));
  const apT = [556, 441, 341, 225].map((x) => Math.round((x * SR) / 44100));
  const run = (inp, spread) => {
    const n = inp.length;
    const out = new Float32Array(n);
    for (const d0 of combT) {
      const d = d0 + spread;
      const buf = new Float32Array(d);
      let idx = 0, store = 0;
      for (let i = 0; i < n; i++) {
        const y = buf[idx];
        store = y * (1 - damp) + store * damp;
        buf[idx] = inp[i] + store * room;
        out[i] += y;
        idx = (idx + 1) % d;
      }
    }
    for (const d0 of apT) {
      const d = d0 + spread;
      const buf = new Float32Array(d);
      let idx = 0;
      for (let i = 0; i < n; i++) {
        const b = buf[idx];
        const x = out[i];
        buf[idx] = x + b * 0.5;
        out[i] = b - x;
        idx = (idx + 1) % d;
      }
    }
    for (let i = 0; i < n; i++) out[i] *= 0.12;
    return out;
  };
  return [run(inL, 0), run(inR, 23)];
}

export function writeWav(L, R) {
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * 32767))), 44 + i * 4);
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * 32767))), 46 + i * 4);
  }
  return buf;
}
