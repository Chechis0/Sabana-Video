// Caricatura: colores planos y saturados, contornos de tinta de grosor variable (más gruesos
// cerca, más finos y del color del aire a lo lejos), sombras duras (cel) y luz de cine.
import { FlatD } from './flat.js';
import { W, H } from '../timeline.js';
import { clamp, mix, shade } from '../core/math.js';
import { grade } from '../engine/post.js';
import { gradeFilter } from '../world/envs.js';

const INK = '#1c1a2e';

const CHAR = new Set(['drop', 'bear', 'person', 'bird']);
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255; };

export class CartoonD extends FlatD {
  constructor(ctx, Wd, Hd) {
    super(ctx, Wd, Hd);
    this.cartoon = true;
    this.noRefract = true; // la gota es un personaje de dibujos: opaca, con tinta
    this.inkK = 1;
  }
  // los personajes llevan una línea más gruesa y más oscura que el fondo
  wrapItem(it, draw) {
    const c = CHAR.has(it.o.tag);
    this.charInk = c;
    this.terrain = it.o.tag === 'slice';
    draw();
    this.charInk = false;
    this.terrain = false;
  }

  // escala efectiva del objeto en pantalla: la de su transformación local o, si se dibuja
  // directamente en pantalla (terreno), la de su distancia a la cámara
  scaleNow() {
    const m = this.M;
    const ident = m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1;
    if (!ident) return this.ps;
    const f = this.camF || 1400;
    return this.depth ? clamp(f / this.depth, 0.05, 4) : 1;
  }

  inkW(o) {
    const s = this.scaleNow();
    const base = o.inkW ?? (this.charInk ? 3.2 : 2.6);
    return clamp(base * Math.pow(s, 0.55), 0.7, this.charInk ? 7 : 5.5) * this.inkK;
  }

  inkColor(fill) {
    // tinta oscura teñida del color del objeto (el terreno, con línea de color); con la bruma se aclara
    return this.col(mix(fill, INK, this.charInk ? 0.85 : this.terrain ? 0.5 : 0.72));
  }

  wantsInk(o) {
    if (o.ink === false || o.shading) return false;
    if (o.base === false) return false;
    if ((o.edge ?? 5) <= 0) return false;
    if ((o.alpha ?? 1) < 0.55) return false;
    const h = this.haze;
    if (h && h.k > 0.62) return false; // fondo pintado: sin líneas
    return true;
  }

  fill(path, color, o = {}) {
    const ctx = this.ctx;
    const a = clamp(this.alphaOf(o));
    if (this.wantsInk(o)) {
      // la tinta va detrás (doble de ancho): queda por fuera y las uniones no se ven
      const w = this.inkW(o) * (this.terrain ? 0.7 : 1);
      const hk = this.haze ? clamp(this.haze.k * 1.4) : 0;
      ctx.globalAlpha = a * (1 - hk * 0.75);
      ctx.strokeStyle = this.inkColor(color);
      ctx.lineWidth = w * 2;
      ctx.lineJoin = 'round';
      ctx.stroke(path);
    }
    ctx.globalAlpha = a;
    ctx.fillStyle = this.col(color);
    ctx.fill(path);
    ctx.globalAlpha = 1;
  }

  line(path, color, width = 1.8, o = {}) {
    const ctx = this.ctx;
    const w = o.abs ? width : this.lw(width);
    const a = clamp((o.alpha ?? 0.85) * 1.05);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // trazos gruesos (ramas, tallos): con borde de tinta
    if (w >= 3.2 && o.ink !== false && lum(color) < 0.7 && !(this.haze && this.haze.k > 0.62)) {
      ctx.globalAlpha = a;
      ctx.strokeStyle = this.inkColor(color);
      ctx.lineWidth = w + this.inkW(o) * 1.6;
      ctx.stroke(path);
    }
    ctx.globalAlpha = a;
    ctx.strokeStyle = this.col(color);
    ctx.lineWidth = w;
    ctx.stroke(path);
    ctx.globalAlpha = 1;
  }
}

// etalonaje de caricatura: color vivo y limpio, contraste firme, viñeta suave
export function cartoonPost(canvas, A, env) {
  const g = env.grade || { sat: 1, con: 1, bri: 1 };
  grade(canvas, { filter: gradeFilter({ ...g, sat: g.sat * 1.22, con: g.con * 1.08, bri: (g.bri ?? 1) * 1.02 }), layers: (g.layers || []).map(([c, a, op]) => [c, a * 0.8, op]) });
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = (env.vignette ?? 0.55) * 0.45;
  ctx.drawImage(A.vig, 0, 0, W, H);
  ctx.restore();
}
