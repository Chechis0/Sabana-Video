// Papel recortado en stop-motion: cada forma es una pieza de cartulina de color con fibras,
// un canto de corte que atrapa la luz y una sombra suave sobre lo que tiene detrás (como
// un diorama pegado en capas). Las piezas tiemblan un poco cada dos cuadros, igual que
// cuando se animan a mano frente a la cámara.
import { createCanvas } from '@napi-rs/canvas';
import { FlatD } from './flat.js';
import { TILE } from '../core/pencil.js';
import { W, H } from '../timeline.js';
import { clamp, mix, hrand, mulberry32, shade } from '../core/math.js';
import { grade } from '../engine/post.js';
import { gradeFilter } from '../world/envs.js';

// fibras del papel (independientes del color): claras y oscuras, más motas
function makeFiber(seed = 5) {
  const c = createCanvas(TILE, TILE);
  const g = c.getContext('2d');
  const r = mulberry32(seed);
  g.lineCap = 'round';
  const fiber = (x, y, L, a, col, w) => {
    for (let ox = -TILE; ox <= TILE; ox += TILE) for (let oy = -TILE; oy <= TILE; oy += TILE) {
      g.strokeStyle = col; g.lineWidth = w;
      g.beginPath();
      g.moveTo(x + ox, y + oy);
      g.quadraticCurveTo(x + ox + Math.cos(a + 0.5) * L * 0.5, y + oy + Math.sin(a + 0.5) * L * 0.5, x + ox + Math.cos(a) * L, y + oy + Math.sin(a) * L);
      g.stroke();
    }
  };
  // manchas suaves (la cartulina no es pareja)
  for (let i = 0; i < 70; i++) {
    const x = r() * TILE, y = r() * TILE, rr = 20 + r() * 60;
    for (let ox = -TILE; ox <= TILE; ox += TILE) for (let oy = -TILE; oy <= TILE; oy += TILE) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr);
      const light = r() < 0.5;
      gr.addColorStop(0, light ? 'rgba(255,255,250,0.07)' : 'rgba(60,40,20,0.05)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x + ox - rr, y + oy - rr, rr * 2, rr * 2);
    }
  }
  for (let i = 0; i < 900; i++) {
    const light = r() < 0.6;
    fiber(r() * TILE, r() * TILE, 4 + r() * 14, r() * Math.PI * 2, light ? `rgba(255,255,248,${0.1 + r() * 0.16})` : `rgba(50,35,20,${0.05 + r() * 0.08})`, 0.5 + r() * 0.7);
  }
  for (let i = 0; i < 2200; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${0.08 + r() * 0.12})` : `rgba(40,28,16,${0.04 + r() * 0.07})`;
    g.fillRect(r() * TILE, r() * TILE, 0.8 + r(), 0.8 + r());
  }
  return c;
}

export class PaperD extends FlatD {
  constructor(ctx, Wd, Hd) {
    super(ctx, Wd, Hd);
    this.paper = true;
    this.noRefract = true; // la gota es de cartulina azul (no de vidrio)
    this.fiber = makeFiber();
    this.jitterAmp = 0.45; // cortes a mano: bordes apenas irregulares (fijos)
    this.wobble = 0.7; // temblor de stop-motion (px)
  }

  scaleNow() {
    const m = this.M;
    const ident = m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1;
    if (!ident) return this.ps;
    const f = this.camF || 1400;
    return this.depth ? clamp(f / this.depth, 0.05, 4) : 1;
  }

  // la pieza entera se corre un poquito cada dos cuadros (sin deformarse)
  path(pts, o = {}) {
    const amp = o.still ? 0 : this.wobble;
    const q = { ...o, still: true };
    if (amp <= 0) return super.path(pts, q);
    const seed = (o.pieceSeed ?? o.seed ?? 0) | 0, b = this.boil;
    const dx = (hrand(seed, b, 11) - 0.5) * 2 * amp, dy = (hrand(seed, b, 12) - 0.5) * 2 * amp;
    const m = this.M;
    m[4] += dx; m[5] += dy;
    const p = super.path(pts, q);
    m[4] -= dx; m[5] -= dy;
    return p;
  }

  // varias formas unidas son una sola pieza: se mueven juntas
  multi(list, color, o = {}) {
    let p = null;
    const ps = o.seed ?? 0;
    list.forEach((pts, i) => { p = this.path(pts, { ...o, seed: ps + i, pieceSeed: ps, into: p }); });
    if (p) this.fill(p, color, o);
    return p;
  }

  _shadow(k, alpha) {
    const ctx = this.ctx;
    const L = this.env?.light ?? -1;
    ctx.shadowColor = `rgba(30,20,10,${alpha.toFixed(3)})`;
    ctx.shadowBlur = 9 * k;
    ctx.shadowOffsetX = -L * 4 * k;
    ctx.shadowOffsetY = 6 * k;
  }
  _noShadow() {
    const ctx = this.ctx;
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  }

  fill(path, color, o = {}) {
    const ctx = this.ctx;
    const a = clamp(this.alphaOf(o));
    const c = this.col(color);
    const hk = this.haze ? clamp(this.haze.k) : 0;
    const solid = !o.shading && o.base !== false && (o.edge ?? 5) > 0 && a > 0.5;
    const k = clamp(Math.pow(this.scaleNow(), 0.5), 0.3, 2.4) * (this.lift ?? 1);
    if ((solid || o.shading) && o.shadow !== false) this._shadow(o.shading ? k * 0.45 : k, (o.shading ? 0.25 : 0.42) * (1 - hk * 0.8) * a);
    ctx.globalAlpha = a;
    ctx.fillStyle = c;
    ctx.fill(path);
    this._noShadow();
    // fibras de la cartulina
    if (a > 0.35 && o.fiber !== false) {
      const an = o.anchor || this.P(0, 0);
      ctx.globalAlpha = a * (0.75 - hk * 0.4);
      this._tileFill(path, path.bb || [0, 0, W, H], { img: this.fiber, ox: an[0] + hrand(o.seed ?? 0, 1) * TILE, oy: an[1] + hrand(o.seed ?? 0, 2) * TILE });
    }
    // canto del corte: una línea clara que atrapa la luz
    if (solid && o.cut !== false) {
      ctx.globalAlpha = a * 0.5 * (1 - hk * 0.6);
      ctx.strokeStyle = mix(c, '#fffaf0', 0.5);
      ctx.lineWidth = clamp(1.3 * k, 0.6, 2.4);
      ctx.lineJoin = 'round';
      ctx.stroke(path);
    }
    ctx.globalAlpha = 1;
  }

  // tiras de papel: con su sombrita si son anchas
  line(path, color, width = 1.8, o = {}) {
    const ctx = this.ctx;
    const w = o.abs ? width : this.lw(width);
    const a = clamp((o.alpha ?? 0.85) * 1.05);
    const hk = this.haze ? clamp(this.haze.k) : 0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (w >= 2.2 && a > 0.5 && o.shadow !== false) {
      const k = clamp(Math.pow(this.scaleNow(), 0.5), 0.3, 2) * 0.5;
      this._shadow(k, 0.28 * (1 - hk * 0.8) * a);
    }
    ctx.globalAlpha = a;
    ctx.strokeStyle = this.col(color);
    ctx.lineWidth = w;
    ctx.stroke(path);
    this._noShadow();
    ctx.globalAlpha = 1;
  }
}

// el cielo es un fondo de cartulina pintada: se le pone la fibra encima
export function paperBackdrop(D, cam, env) {
  const ctx = D.ctx;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 0.4;
  for (let y = 0; y < H; y += TILE) for (let x = 0; x < W; x += TILE) ctx.drawImage(D.fiber, x, y);
  ctx.restore();
}

// luz de estudio cálida, color de cartulina y viñeta de lente
export function paperPost(canvas, A, env) {
  const g = env.grade || { sat: 1, con: 1, bri: 1 };
  grade(canvas, { filter: gradeFilter({ ...g, sat: g.sat * 1.04, con: g.con * 1.02, bri: g.bri }), layers: [...(g.layers || []).map(([c, a, op]) => [c, a * 0.7, op]), ['#ffcf90', 0.08, 'soft-light']] });
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.55;
  ctx.drawImage(A.vig, 0, 0, W, H);
  ctx.restore();
}

// lluvia de papel: gotas de cartulina azul con su brillo y sombrita (se mueven cada dos cuadros)
export function paperRain(ctx, t, k) {
  if (k <= 0.01) return;
  const f2 = Math.floor(t * 12); // a 12 cuadros por segundo, como el stop-motion
  const r = mulberry32(99);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const n = Math.floor(70 * k);
  for (let i = 0; i < n; i++) {
    const depth = 0.6 + r() * 0.9;
    const x0 = r() * (W + 200) - 100, y0 = r() * (H + 300);
    const y = (y0 + f2 * 95 * depth) % (H + 300) - 150;
    const x = x0 - (f2 * 18 * depth) % 300 + (r() - 0.5) * 4;
    const s = 9 * depth;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.18);
    ctx.shadowColor = 'rgba(20,30,50,0.35)'; ctx.shadowBlur = 4 * depth; ctx.shadowOffsetX = 4 * depth; ctx.shadowOffsetY = 5 * depth;
    ctx.beginPath();
    ctx.moveTo(0, -s * 2.1);
    ctx.bezierCurveTo(s * 0.9, -s * 0.6, s, s * 0.9, 0, s);
    ctx.bezierCurveTo(-s, s * 0.9, -s * 0.9, -s * 0.6, 0, -s * 2.1);
    ctx.fillStyle = depth > 1.1 ? '#9fd2f2' : '#b9dcef';
    ctx.globalAlpha = 0.95;
    ctx.fill();
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.ellipse(-s * 0.35, -s * 0.1, s * 0.18, s * 0.35, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// sol de cartulina: corona de picos detrás del disco
export function paperSunRays(ctx, x, y, r, k, t) {
  if (k <= 0.02) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(x, y);
  ctx.rotate(Math.floor(t * 6) * 0.02);
  ctx.globalAlpha = 0.85 * k;
  ctx.shadowColor = 'rgba(120,70,20,0.35)'; ctx.shadowBlur = 10; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 7;
  const n = 18;
  ctx.beginPath();
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const rr = i % 2 ? r * 1.35 : r * 1.9;
    i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffd36a';
  ctx.fill();
  ctx.restore();
}
