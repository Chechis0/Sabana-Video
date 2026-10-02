// Pincel plano: base de los estilos pixel, caricatura y papel. Usa la misma interfaz que
// el lápiz (shape, stroke, shadeIn, multi…) pero sin texturas de trazo: cada estilo
// decide cómo se ve el relleno y el borde.
import { Pencil } from '../core/pencil.js';
import { clamp, mix } from '../core/math.js';

export class FlatD extends Pencil {
  constructor(ctx, W, H) {
    super(ctx, W, H);
    this.flat = true;
    this.jitterAmp = 0;
  }

  // bruma y sombra cercana continuas (no hace falta cuantizar: no hay mosaicos por color)
  col(c) {
    const h = this.haze;
    if (!h) return c;
    if (h.dk > 0.01) c = mix(c, h.dcol, clamp(h.dk));
    if (h.k > 0.01) c = mix(c, h.col, clamp(h.k));
    return c;
  }

  // opacidad equivalente a la del lápiz: lo "sin base" era sombreado translúcido
  alphaOf(o) {
    const a = o.alpha ?? 1;
    if (o.base === false) return a * (o.soft ? 0.5 : 0.8);
    return a;
  }

  fill(path, color, o = {}) {
    const ctx = this.ctx;
    ctx.globalAlpha = clamp(this.alphaOf(o));
    ctx.fillStyle = this.col(color);
    ctx.fill(path);
    ctx.globalAlpha = 1;
  }

  lineWidth(width, o) { return o.abs ? width : this.lw(width); }

  line(path, color, width = 1.8, o = {}) {
    const ctx = this.ctx;
    ctx.globalAlpha = clamp((o.alpha ?? 0.85) * 0.95);
    ctx.strokeStyle = this.col(color);
    ctx.lineWidth = this.lineWidth(width, o);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(path);
    ctx.globalAlpha = 1;
  }

  shadeIn(clipPath, pts, color, o = {}) {
    const ctx = this.ctx;
    ctx.save();
    ctx.clip(clipPath);
    this.fill(this.path(pts, o), color, { edge: 0, base: false, ...o, shading: true });
    ctx.restore();
  }

  // el texto a mano pide un "patrón": aquí es el color plano
  _pat(color) { return color; }
  pattern() { return null; }
  async flush() {}
}
