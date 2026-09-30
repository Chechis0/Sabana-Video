// Motor de "lápiz de color": texturas de trazos, bordes granulados y líneas temblorosas.
// Todo se proyecta a espacio de pantalla para que el grano del lápiz tenga siempre
// el mismo tamaño, sin importar el zoom de la cámara (como si se redibujara cada cuadro).
import { createCanvas, Path2D, Image } from '@napi-rs/canvas';
import { mulberry32, hash, hrand, noise1, shade, rgba, quant, hexToRgb, clamp } from './math.js';

const TILE = 240;

// Máscaras de trazos (en escala de grises) compartidas por todos los colores:
// se generan una vez por ángulo/variante/tipo y luego se "tiñen".
const masks = new Map();
function strokeMask(angle, variant, kind, layer) {
  const key = angle + '|' + variant + '|' + kind + '|' + layer;
  let m = masks.get(key);
  if (m) return m;
  const c = createCanvas(TILE, TILE);
  const g = c.getContext('2d');
  const rnd = mulberry32(hash(Math.round(angle * 100), variant, kind.length, layer.length));
  const isLine = kind === 'line', isSoft = kind === 'soft';
  g.lineCap = 'round';
  const N = layer === 'base' ? (isLine ? 520 : isSoft ? 900 : 1500) : isLine ? 160 : 420;
  const drawStroke = (x, y, L, a, w, al, bend) => {
    const dx = (Math.cos(a) * L) / 2, dy = (Math.sin(a) * L) / 2;
    for (let ox = -TILE; ox <= TILE; ox += TILE) {
      for (let oy = -TILE; oy <= TILE; oy += TILE) {
        const cx = x + ox, cy = y + oy;
        if (cx + L < 0 || cx - L > TILE || cy + L < 0 || cy - L > TILE) continue;
        g.strokeStyle = `rgba(0,0,0,${al * 0.55})`;
        g.lineWidth = w * 0.6;
        g.beginPath();
        g.moveTo(cx - dx, cy - dy);
        g.quadraticCurveTo(cx + (bend * -dy) / L, cy + (bend * dx) / L, cx + dx, cy + dy);
        g.stroke();
        g.strokeStyle = `rgba(0,0,0,${al})`;
        g.lineWidth = w;
        g.beginPath();
        g.moveTo(cx - dx * 0.62, cy - dy * 0.62);
        g.quadraticCurveTo(cx + (bend * -dy) / L, cy + (bend * dx) / L, cx + dx * 0.62, cy + dy * 0.62);
        g.stroke();
      }
    }
  };
  if (layer === 'base') {
    g.fillStyle = `rgba(0,0,0,${isLine ? 0.8 : isSoft ? 0.12 : 0.2})`;
    g.fillRect(0, 0, TILE, TILE);
  }
  for (let i = 0; i < N; i++) {
    const cross = !isLine && rnd() < 0.07;
    const x = rnd() * TILE, y = rnd() * TILE;
    const L = (isLine ? 10 : 22) + rnd() * (isLine ? 16 : 58);
    const a = angle + (cross ? 0.6 : 0) + (rnd() - 0.5) * 0.36;
    const w = isLine ? 1 + rnd() * 1.6 : 0.7 + rnd() * 1.5;
    const al = isSoft ? 0.18 + rnd() * 0.35 : 0.3 + rnd() * 0.55;
    drawStroke(x, y, L, a, w, al, (rnd() - 0.5) * 10);
  }
  if (layer === 'base') {
    // "diente" del papel
    g.globalCompositeOperation = 'destination-out';
    const S = isLine ? 2200 : 4200;
    for (let k = 0; k < S; k++) {
      const r = 0.35 + rnd() * rnd() * 1.5;
      g.fillStyle = `rgba(0,0,0,${0.2 + rnd() * 0.6})`;
      g.beginPath();
      g.ellipse(rnd() * TILE, rnd() * TILE, r * 1.6, r, 0.2, 0, Math.PI * 2);
      g.fill();
    }
  }
  masks.set(key, c);
  return c;
}

function makeTile(color, angle, variant, kind) {
  const c = createCanvas(TILE, TILE);
  const g = c.getContext('2d');
  // capa base: color con la cobertura de la máscara
  g.fillStyle = color;
  g.fillRect(0, 0, TILE, TILE);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(strokeMask(angle, variant, kind, 'base'), 0, 0);
  // trazos más oscuros y más claros (variación de presión) solo donde ya hay color
  g.globalCompositeOperation = 'source-atop';
  const dark = createCanvas(TILE, TILE), dg = dark.getContext('2d');
  dg.fillStyle = shade(color, -0.32); dg.fillRect(0, 0, TILE, TILE);
  dg.globalCompositeOperation = 'destination-in';
  dg.drawImage(strokeMask(angle, (variant + 1) % 3, kind, 'dark'), 0, 0);
  g.drawImage(dark, 0, 0);
  const light = createCanvas(TILE, TILE), lg = light.getContext('2d');
  lg.fillStyle = shade(color, 0.3); lg.fillRect(0, 0, TILE, TILE);
  lg.globalCompositeOperation = 'destination-in';
  lg.drawImage(strokeMask(angle, (variant + 2) % 3, kind, 'light'), 0, 0);
  g.globalAlpha = 0.7;
  g.drawImage(light, 0, 0);
  return c;
}

const ANGLES = [-1.45, -1.05, -0.62, -0.2, 0.3, 0.8];
function canonAngle(a) {
  // normaliza a (-π/2, π/2] y elige el ángulo canónico más cercano
  while (a > Math.PI / 2) a -= Math.PI;
  while (a <= -Math.PI / 2) a += Math.PI;
  let best = ANGLES[0], bd = Infinity;
  for (const c of ANGLES) {
    const d = Math.min(Math.abs(a - c), Math.PI - Math.abs(a - c));
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export class Pencil {
  constructor(ctx, W, H) {
    this.ctx = ctx;
    this.W = W; this.H = H;
    this.pats = new Map();
    this.pending = [];
    this.M = [1, 0, 0, 1, 0, 0];
    this.stack = [];
    this.cam = { x: W / 2, y: H / 2, z: 1, rot: 0 };
    this.boil = 0;
    this.t = 0;
    this.jitterAmp = 1;
  }

  setFrame(t, frame, cam, boilEvery = 2) {
    this.t = t; this.frame = frame;
    this.cam = { rot: 0, ...cam };
    this.boilFast = Math.floor(frame / boilEvery);
    this.boilSlow = Math.floor(frame / (boilEvery * 2));
    this.boil = this.boilFast;
    this.M = [1, 0, 0, 1, 0, 0];
    this.stack.length = 0;
    this._cr = Math.cos(this.cam.rot); this._sr = Math.sin(this.cam.rot);
  }

  // el paisaje "hierve" a la mitad de velocidad que los personajes (menos parpadeo, mejor compresión)
  set slow(v) { this.boil = v ? this.boilSlow : this.boilFast; }

  // ---------- transformaciones locales (personajes) ----------
  save() { this.stack.push(this.M.slice()); }
  restore() { this.M = this.stack.pop(); }
  translate(x, y) { const m = this.M; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; }
  scale(sx, sy = sx) { const m = this.M; m[0] *= sx; m[1] *= sx; m[2] *= sy; m[3] *= sy; }
  rotate(a) {
    const m = this.M, c = Math.cos(a), s = Math.sin(a);
    const [a0, b0, c0, d0] = m;
    m[0] = a0 * c + c0 * s; m[1] = b0 * c + d0 * s;
    m[2] = -a0 * s + c0 * c; m[3] = -b0 * s + d0 * c;
  }
  // mundo -> pantalla
  W2S(wx, wy) {
    const c = this.cam;
    const dx = (wx - c.x) * c.z, dy = (wy - c.y) * c.z;
    return [dx * this._cr - dy * this._sr + this.W / 2, dx * this._sr + dy * this._cr + this.H / 2];
  }
  // local -> pantalla
  P(x, y) {
    const m = this.M;
    return this.W2S(m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]);
  }
  toWorld(x, y) { const m = this.M; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  // escala efectiva local->pantalla
  get ps() { const m = this.M; return this.cam.z * Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])); }
  lw(base) { return base * clamp(Math.sqrt(this.ps), 0.42, 1.35); }

  visible(x, y, r) {
    const [sx, sy] = this.P(x, y);
    const R = r * this.ps + 20;
    return sx + R > 0 && sx - R < this.W && sy + R > 0 && sy - R < this.H;
  }

  // ---------- texturas ----------
  // Los mosaicos se generan una sola vez; primero se usan como patrón de lienzo (lento)
  // y en cuanto termina la decodificación asíncrona se cambian por un patrón de imagen (rápido).
  pattern(color, angle = -1.05, variant = 0, kind = 'fill') {
    const col = quant(color);
    const ab = canonAngle(angle);
    const key = col + '|' + ab + '|' + variant + '|' + kind;
    let e = this.pats.get(key);
    if (!e) {
      e = { pat: null };
      this.pats.set(key, e);
      const tile = makeTile(col, ab, variant, kind);
      const img = new Image();
      this.pending.push(new Promise((res) => {
        img.onload = () => { e.pat = this.ctx.createPattern(img, 'repeat'); e.img = img; res(); };
        img.onerror = () => res();
      }));
      img.src = tile.encodeSync('png');
    }
    return e.pat;
  }

  async flush() {
    if (!this.pending.length) return;
    const p = this.pending;
    this.pending = [];
    await Promise.all(p);
  }

  _pat(color, o, kind) {
    const seed = o.seed ?? 0;
    const b = o.still ? 0 : this.boil;
    const v = (b + (seed | 0)) % 3;
    const pat = this.pattern(color, o.angle ?? -1.05, v, kind);
    // mientras el mosaico se decodifica se usa un color plano (el cuadro se vuelve a dibujar)
    if (!pat) return rgba(color, kind === 'soft' ? 0.3 : 0.7);
    const an = o.anchor || this.P(0, 0);
    const ox = an[0] + hrand(b, seed, 1) * TILE, oy = an[1] + hrand(b, seed, 2) * TILE;
    pat.setTransform({ a: 1, b: 0, c: 0, d: 1, e: ox, f: oy });
    return pat;
  }

  // ---------- construcción de trazados ----------
  // pts en coordenadas locales. jitter en px de pantalla (tiembla con el "boil").
  path(pts, o = {}) {
    const closed = o.closed ?? true;
    const smooth = o.smooth ?? true;
    const seed = o.seed ?? 0;
    const j = (o.jitter ?? 1.1) * this.jitterAmp * clamp(this.ps, 0.35, 1.25);
    const b = o.still ? 0 : this.boil;
    const n = pts.length;
    const sp = new Array(n);
    const fr = o.jfreq ?? 0.45;
    for (let i = 0; i < n; i++) {
      const [sx, sy] = this.P(pts[i][0], pts[i][1]);
      const k = seed * 3.7 + i * fr;
      sp[i] = [sx + j * noise1(k, b * 31 + 1), sy + j * noise1(k + 50, b * 31 + 2)];
    }
    const p = new Path2D();
    if (!smooth || n < 3) {
      p.moveTo(sp[0][0], sp[0][1]);
      for (let i = 1; i < n; i++) p.lineTo(sp[i][0], sp[i][1]);
      if (closed) p.closePath();
      return p;
    }
    if (closed) {
      const m0 = [(sp[n - 1][0] + sp[0][0]) / 2, (sp[n - 1][1] + sp[0][1]) / 2];
      p.moveTo(m0[0], m0[1]);
      for (let i = 0; i < n; i++) {
        const a = sp[i], c = sp[(i + 1) % n];
        p.quadraticCurveTo(a[0], a[1], (a[0] + c[0]) / 2, (a[1] + c[1]) / 2);
      }
      p.closePath();
    } else {
      p.moveTo(sp[0][0], sp[0][1]);
      for (let i = 1; i < n - 1; i++) {
        const a = sp[i], c = sp[i + 1];
        p.quadraticCurveTo(a[0], a[1], (a[0] + c[0]) / 2, (a[1] + c[1]) / 2);
      }
      p.lineTo(sp[n - 1][0], sp[n - 1][1]);
    }
    return p;
  }

  // ---------- pintar ----------
  fill(path, color, o = {}) {
    const ctx = this.ctx;
    const pat = this._pat(color, o, o.soft ? 'soft' : 'fill');
    ctx.globalAlpha = o.alpha ?? 1;
    if (o.knock) {
      // tapa lo que queda detrás (papel limpio) — las formas opacas no se transparentan
      ctx.fillStyle = o.knock === true ? '#f2e9d6' : o.knock;
      ctx.fill(path);
    }
    if (o.base !== false) {
      // capa base plana muy suave: evita que se vea "calado" en exceso
      ctx.fillStyle = rgba(color, o.baseAlpha ?? 0.22);
      ctx.fill(path);
    }
    ctx.fillStyle = pat;
    ctx.fill(path);
    if (o.dense) ctx.fill(path);
    const e = o.edge ?? 5;
    if (e > 0) {
      // borde deshilachado: textura suave más ancha + un filo algo más oscuro (presión del lápiz)
      ctx.globalAlpha = (o.alpha ?? 1) * (o.edgeAlpha ?? 0.7);
      ctx.strokeStyle = this._pat(color, { ...o, seed: (o.seed ?? 0) + 5 }, 'soft');
      ctx.lineWidth = this.lw(e);
      ctx.lineJoin = 'round';
      ctx.stroke(path);
      if (o.rim !== false) {
        ctx.globalAlpha = (o.alpha ?? 1) * (o.rimAlpha ?? 0.32);
        ctx.strokeStyle = this._pat(shade(color, -0.22), { ...o, seed: (o.seed ?? 0) + 3, angle: 0.3 }, 'line');
        ctx.lineWidth = this.lw(1.3);
        ctx.stroke(path);
      }
    }
    ctx.globalAlpha = 1;
  }

  // línea de grafito / lápiz de color
  line(path, color, width = 1.8, o = {}) {
    const ctx = this.ctx;
    const pat = this._pat(color, { ...o, angle: o.angle ?? 0.3 }, 'line');
    ctx.globalAlpha = o.alpha ?? 0.85;
    ctx.strokeStyle = pat;
    ctx.lineWidth = o.abs ? width : this.lw(width);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(path);
    ctx.globalAlpha = 1;
  }

  // atajo: forma rellena + contorno opcional
  shape(pts, color, o = {}) {
    const p = this.path(pts, o);
    this.fill(p, color, o);
    if (o.outline) this.line(o.outlinePath ? this.path(pts, { ...o, seed: (o.seed ?? 0) + 9 }) : p, o.outline, o.lw ?? 1.6, { alpha: o.outlineAlpha ?? 0.7, seed: o.seed });
    return p;
  }

  // trazo abierto
  stroke(pts, color, width = 2, o = {}) {
    const p = this.path(pts, { ...o, closed: false });
    this.line(p, color, width, o);
    return p;
  }

  // sombreado: rellena con otra textura recortada a un trazado
  shadeIn(clipPath, pts, color, o = {}) {
    const ctx = this.ctx;
    ctx.save();
    ctx.clip(clipPath);
    this.fill(this.path(pts, o), color, { edge: 0, base: false, ...o });
    ctx.restore();
  }
}

// ---------- generadores de formas (coordenadas locales) ----------
export function ellipsePts(cx, cy, rx, ry, n = 22, rot = 0, irr = 0, seed = 0) {
  const out = [];
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + irr * noise1(i * 0.9 + seed * 5.1, seed + 3) + irr * 0.5 * noise1(i * 2.3, seed + 7);
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}

export function rectPts(x, y, w, h, n = 3) {
  const out = [];
  const edge = (x0, y0, x1, y1) => { for (let i = 0; i < n; i++) { const t = i / n; out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); } };
  edge(x, y, x + w, y); edge(x + w, y, x + w, y + h); edge(x + w, y + h, x, y + h); edge(x, y + h, x, y);
  return out;
}

export { TILE };
