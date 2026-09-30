// Motor de "lápiz de color": texturas de trazos, bordes granulados y líneas temblorosas.
// Todo se proyecta a espacio de pantalla para que el grano del lápiz tenga siempre
// el mismo tamaño, sin importar el zoom de la cámara (como si se redibujara cada cuadro).
import { createCanvas, Path2D, Image } from '@napi-rs/canvas';
import { mulberry32, hash, hrand, noise1, shade, rgba, quant, hexToRgb, clamp, mix } from './math.js';

const TILE = 300;
const PAPER = '#f2e9d6';
const MAX_TILES = Number(process.env.MAX_TILES || 1400);

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
  const N = (layer === 'base' ? (isLine ? 520 : isSoft ? 1300 : 2600) : isLine ? 160 : 700) * (TILE * TILE) / (240 * 240) | 0;
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
    g.fillStyle = `rgba(0,0,0,${isLine ? 0.8 : isSoft ? 0.14 : 0.3})`;
    g.fillRect(0, 0, TILE, TILE);
  }
  for (let i = 0; i < N; i++) {
    const cross = !isLine && rnd() < 0.12;
    const x = rnd() * TILE, y = rnd() * TILE;
    const L = (isLine ? 10 : 12) + rnd() * (isLine ? 16 : 34);
    const a = angle + (cross ? 0.75 : 0) + (rnd() - 0.5) * 0.42;
    const w = isLine ? 1 + rnd() * 1.6 : 0.7 + rnd() * 1.4;
    const al = isSoft ? 0.16 + rnd() * 0.32 : 0.22 + rnd() * 0.5;
    drawStroke(x, y, L, a, w, al, (rnd() - 0.5) * 10);
  }
  if (layer === 'base') {
    // "diente" del papel
    g.globalCompositeOperation = 'destination-out';
    const S = (isLine ? 2200 : 5200) * (TILE * TILE) / (240 * 240) | 0;
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
  dg.fillStyle = shade(color, -0.2); dg.fillRect(0, 0, TILE, TILE);
  dg.globalCompositeOperation = 'destination-in';
  dg.drawImage(strokeMask(angle, (variant + 1) % 3, kind, 'dark'), 0, 0);
  g.drawImage(dark, 0, 0);
  const light = createCanvas(TILE, TILE), lg = light.getContext('2d');
  lg.fillStyle = shade(color, 0.2); lg.fillRect(0, 0, TILE, TILE);
  lg.globalCompositeOperation = 'destination-in';
  lg.drawImage(strokeMask(angle, (variant + 2) % 3, kind, 'light'), 0, 0);
  g.globalAlpha = 0.7;
  g.drawImage(light, 0, 0);
  return c;
}

// Mosaico de "grano" independiente del color: el papel que asoma entre trazos (1 - base),
// los trazos más oscuros (presión) y los más claros, ya compuestos. Se pinta encima de un
// relleno plano: el resultado equivale al mosaico teñido, sin un mosaico por cada color.
const HOLES = [0.8, 0.55, 0.3, 0.12];
function makeGrain(angle, variant, kind, hi) {
  const mB = strokeMask(angle, variant, kind, 'base');
  const c = createCanvas(TILE, TILE), g = c.getContext('2d');
  const layer = (col, mask, alpha, clipBase) => {
    const l = createCanvas(TILE, TILE), lg = l.getContext('2d');
    lg.fillStyle = col; lg.fillRect(0, 0, TILE, TILE);
    lg.globalCompositeOperation = mask ? 'destination-in' : 'destination-out';
    lg.drawImage(mask || mB, 0, 0);
    if (clipBase) { lg.globalCompositeOperation = 'destination-in'; lg.drawImage(mB, 0, 0); }
    g.globalAlpha = alpha;
    g.drawImage(l, 0, 0);
  };
  layer(PAPER, null, HOLES[hi], false);
  layer('#1a1410', strokeMask(angle, (variant + 1) % 3, kind, 'dark'), kind === 'line' ? 0.3 : 0.24, true);
  layer('#ffffff', strokeMask(angle, (variant + 2) % 3, kind, 'light'), 0.17, true);
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
    this.grains = new Map();
    this.pending = [];
    this.M = [1, 0, 0, 1, 0, 0];
    this.stack = [];
    this.cam = { x: W / 2, y: H / 2, z: 1, rot: 0 };
    this.boil = 0;
    this.t = 0;
    this.jitterAmp = 1;
    // bruma atmosférica: los objetos lejanos se funden con el color del cielo
    this.haze = null; // { col, k }
  }

  // color con bruma (cuantizada para no multiplicar los mosaicos en caché)
  col(c) {
    const h = this.haze;
    if (!h) return c;
    // sombra del primer plano (sotobosque) y bruma de lo lejano
    if (h.dk > 0.04) c = mix(c, h.dcol, Math.round(clamp(h.dk) * 7) / 7);
    if (h.k > 0.04) c = mix(c, h.col, Math.round(clamp(h.k) * 9) / 9);
    return c;
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
    if (e) {
      // LRU: lo usado recientemente pasa al final
      if (e.img) { this.pats.delete(key); this.pats.set(key, e); }
    } else {
      e = { pat: null };
      this.pats.set(key, e);
      // memoria acotada: se descartan los mosaicos menos usados
      if (this.pats.size > MAX_TILES) {
        let drop = this.pats.size - MAX_TILES + 64;
        for (const [k, v] of this.pats) { if (drop <= 0) break; if (v.img) { this.pats.delete(k); drop--; } }
      }
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

  // mosaico (imagen) + desplazamiento, para rellenar con recorte + drawImage (mucho más
  // rápido que un patrón de Skia en CPU)
  _tile(color, o, kind) {
    const seed = o.seed ?? 0;
    const b = o.still ? 0 : this.boil;
    const v = (b + (seed | 0)) % 3;
    this.pattern(color, o.angle ?? -1.05, v, kind);
    const e = this.pats.get(quant(color) + '|' + canonAngle(o.angle ?? -1.05) + '|' + v + '|' + kind);
    if (!e || !e.img) return null;
    const an = o.anchor || this.P(0, 0);
    return { img: e.img, ox: an[0] + hrand(b, seed, 1) * TILE, oy: an[1] + hrand(b, seed, 2) * TILE };
  }

  // mosaico de grano (independiente del color) para un nivel de papel hf
  _grain(o, kind, hf) {
    const seed = o.seed ?? 0;
    const b = o.still ? 0 : this.boil;
    const v = (b + (seed | 0)) % 3;
    const ab = canonAngle(o.angle ?? -1.05);
    let hi = 0, bd = Infinity;
    HOLES.forEach((h, i) => { const d = Math.abs(h - hf); if (d < bd) { bd = d; hi = i; } });
    const key = ab + '|' + v + '|' + kind + '|' + hi;
    let e = this.grains.get(key);
    if (!e) {
      e = { img: null };
      this.grains.set(key, e);
      const tile = makeGrain(ab, v, kind, hi);
      const img = new Image();
      this.pending.push(new Promise((res) => {
        img.onload = () => { e.img = img; e.pat = this.ctx.createPattern(img, 'repeat'); res(); };
        img.onerror = () => res();
      }));
      img.src = tile.encodeSync('png');
    }
    if (!e.img) return null;
    const an = o.anchor || this.P(0, 0);
    return { img: e.img, pat: e.pat, ox: an[0] + hrand(b, seed, 1) * TILE, oy: an[1] + hrand(b, seed, 2) * TILE };
  }

  // pinta el mosaico dentro del trazado, sólo en su caja
  _tileFill(path, bb, tl, times = 1) {
    const ctx = this.ctx;
    const x0 = Math.max(bb[0], -2), y0 = Math.max(bb[1], -2), x1 = Math.min(bb[2], this.W + 2), y1 = Math.min(bb[3], this.H + 2);
    if (x1 <= x0 || y1 <= y0) return;
    ctx.save();
    ctx.clip(path);
    const { img, ox, oy } = tl;
    const gx0 = Math.floor((x0 - ox) / TILE), gy0 = Math.floor((y0 - oy) / TILE);
    for (let gy = gy0; oy + gy * TILE < y1; gy++) {
      for (let gx = gx0; ox + gx * TILE < x1; gx++) {
        const tx = ox + gx * TILE, ty = oy + gy * TILE;
        const sx = Math.max(0, x0 - tx), sy = Math.max(0, y0 - ty);
        const ex = Math.min(TILE, x1 - tx), ey = Math.min(TILE, y1 - ty);
        const w = ex - sx, h = ey - sy;
        if (w <= 0 || h <= 0) continue;
        for (let k = 0; k < times; k++) ctx.drawImage(img, sx, sy, w, h, tx + sx, ty + sy, w, h);
      }
    }
    ctx.restore();
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
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const [sx, sy] = this.P(pts[i][0], pts[i][1]);
      const k = seed * 3.7 + i * fr;
      const x = sx + j * noise1(k, b * 31 + 1), y = sy + j * noise1(k + 50, b * 31 + 2);
      sp[i] = [x, y];
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
    }
    const p = o.into || new Path2D();
    if (o.into && p.bb) p.bb = [Math.min(p.bb[0], bx0 - 2), Math.min(p.bb[1], by0 - 2), Math.max(p.bb[2], bx1 + 2), Math.max(p.bb[3], by1 + 2)];
    else p.bb = [bx0 - 2, by0 - 2, bx1 + 2, by1 + 2];
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
  // relleno plano + grano de lápiz encima (recortado a la forma) + borde deshilachado
  fill(path, color, o = {}) {
    const ctx = this.ctx;
    color = this.col(color);
    const a = o.alpha ?? 1;
    const bb = path.bb || [0, 0, this.W, this.H];
    const kind = o.soft ? 'soft' : 'fill';
    const ba = o.baseAlpha ?? 0.22;
    let fillA, hf;
    if (o.knock && o.base !== false) { fillA = a; hf = 1 - ba; }
    else if (o.base === false) { fillA = a * (o.soft ? 0.42 : 0.72); hf = 0.18; }
    else { fillA = a * (ba + (1 - ba) * 0.72); hf = (1 - ba) * 0.3; }
    if (o.dense) { fillA = Math.min(1, fillA * 1.15); hf *= 0.3; }
    ctx.globalAlpha = fillA;
    ctx.fillStyle = color;
    ctx.fill(path);
    const tl = this._grain(o, kind, hf);
    if (tl) { ctx.globalAlpha = a; this._tileFill(path, bb, tl, 1); }
    const e = o.edge ?? 5;
    if (e > 0) {
      ctx.lineJoin = 'round';
      ctx.globalAlpha = a * (o.edgeAlpha ?? 0.7) * 0.42;
      ctx.strokeStyle = color;
      ctx.lineWidth = this.lw(e);
      ctx.stroke(path);
      if (o.rim !== false) {
        ctx.globalAlpha = a * (o.rimAlpha ?? 0.32) * 0.85;
        ctx.strokeStyle = shade(color, -0.25);
        ctx.lineWidth = this.lw(1.2);
        ctx.stroke(path);
      }
    }
    ctx.globalAlpha = 1;
  }

  // línea de grafito / lápiz de color (las finas van en color plano: se ven iguales y cuestan menos)
  line(path, color, width = 1.8, o = {}) {
    const ctx = this.ctx;
    color = this.col(color);
    const w = o.abs ? width : this.lw(width);
    const a = o.alpha ?? 0.85;
    ctx.globalAlpha = a * 0.85;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(path);
    if (w >= 2.6 || o.textured) {
      // grano sobre los trazos gruesos (papel que asoma y presión)
      const g = this._grain({ ...o, angle: o.angle ?? 0.3 }, 'fill', 0.55);
      if (g && g.pat) {
        g.pat.setTransform({ a: 1, b: 0, c: 0, d: 1, e: g.ox, f: g.oy });
        ctx.globalAlpha = a;
        ctx.strokeStyle = g.pat;
        ctx.stroke(path);
      }
    }
    ctx.globalAlpha = 1;
  }

  // varias formas unidas en un solo trazado (una sola pasada de relleno)
  multi(list, color, o = {}) {
    let p = null;
    list.forEach((pts, i) => { p = this.path(pts, { ...o, seed: (o.seed ?? 0) + i, into: p }); });
    if (p) this.fill(p, color, o);
    return p;
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
