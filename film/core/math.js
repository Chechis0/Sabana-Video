// Utilidades matemáticas: azar determinista, ruido suave, easing y color.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(...nums) {
  let h = 2166136261 >>> 0;
  for (const n of nums) {
    const v = Math.floor(n * 1000) | 0;
    h ^= v & 0xff; h = Math.imul(h, 16777619);
    h ^= (v >>> 8) & 0xff; h = Math.imul(h, 16777619);
    h ^= (v >>> 16) & 0xff; h = Math.imul(h, 16777619);
    h ^= (v >>> 24) & 0xff; h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const hrand = (...n) => hash(...n) / 4294967296;

// Ruido de valor 1D suave (interpolación coseno) — determinista.
export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const a = hrand(i, seed) * 2 - 1;
  const b = hrand(i + 1, seed) * 2 - 1;
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}

// Ruido 2D de valor
export function noise2(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hrand(ix, iy, seed), b = hrand(ix + 1, iy, seed);
  const c = hrand(ix, iy + 1, seed), d = hrand(ix + 1, iy + 1, seed);
  return (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * 2 - 1;
}

export function fbm2(x, y, seed = 0, oct = 4) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    s += amp * noise2(x * f, y * f, seed + i * 17);
    f *= 2; amp *= 0.5;
  }
  return s;
}

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a));
// progreso normalizado de t dentro de [a,b]
export const prog = (t, a, b) => clamp((t - a) / (b - a));

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
  inBack: (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t,
};

// oscilador amortiguado: rebote de "squash & stretch"
export function spring(t, freq = 3, decay = 5) {
  if (t < 0) return 0;
  return Math.sin(t * freq * Math.PI * 2) * Math.exp(-t * decay);
}

// ---------- color ----------
const _cc = new Map();
export function hexToRgb(hex) {
  if (_cc.has(hex)) return _cc.get(hex);
  const h = hex.replace('#', '');
  const v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  _cc.set(hex, v);
  return v;
}
export function rgbToHex([r, g, b]) {
  const c = (x) => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
export function mix(h1, h2, t) {
  const a = hexToRgb(h1), b = hexToRgb(h2);
  return rgbToHex([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
}
export const shade = (hex, amt) => (amt >= 0 ? mix(hex, '#ffffff', amt) : mix(hex, '#1a1410', -amt));
export function rgba(hex, a = 1) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
// cuantiza para cachear patrones de color
export function quant(hex) {
  const [r, g, b] = hexToRgb(hex);
  const q = (x) => Math.min(255, Math.round(x / 12) * 12);
  return rgbToHex([q(r), q(g), q(b)]);
}

// ---------- geometría ----------
export function catmull(points, samplesPerSeg = 8, closed = false) {
  const out = [];
  const n = points.length;
  if (n < 2) return points.slice();
  const get = (i) => {
    if (closed) return points[(i + n) % n];
    return points[Math.max(0, Math.min(n - 1, i))];
  };
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let k = 0; k < samplesPerSeg; k++) {
      const t = k / samplesPerSeg, t2 = t * t, t3 = t2 * t;
      const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([x, y]);
    }
  }
  if (!closed) out.push(points[n - 1].slice());
  return out;
}

// Polilínea con longitud de arco para muestrear posiciones
export class Polyline {
  constructor(pts) {
    this.pts = pts;
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
      this.cum.push(this.cum[i - 1] + Math.hypot(dx, dy));
    }
    this.length = this.cum[this.cum.length - 1];
  }
  // posición y tangente a una distancia s
  at(s) {
    const { pts, cum } = this;
    s = clamp(s, 0, this.length);
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (cum[m] <= s) lo = m; else hi = m;
    }
    const segL = cum[hi] - cum[lo] || 1;
    const f = (s - cum[lo]) / segL;
    const a = pts[lo], b = pts[hi];
    const x = lerp(a[0], b[0], f), y = lerp(a[1], b[1], f);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return { x, y, tx: dx / l, ty: dy / l, nx: -dy / l, ny: dx / l };
  }
  // s más cercano a un punto (aprox)
  nearestS(x, y) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < this.pts.length; i++) {
      const d = (this.pts[i][0] - x) ** 2 + (this.pts[i][1] - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return this.cum[best];
  }
  // s correspondiente a una altura y (el río baja de arriba hacia abajo)
  sAtY(y) {
    const { pts, cum } = this;
    for (let i = 1; i < pts.length; i++) {
      if ((pts[i - 1][1] - y) * (pts[i][1] - y) <= 0) {
        const f = (y - pts[i - 1][1]) / ((pts[i][1] - pts[i - 1][1]) || 1);
        return lerp(cum[i - 1], cum[i], f);
      }
    }
    return y < pts[0][1] ? 0 : this.length;
  }
}
