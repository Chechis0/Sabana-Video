// Texto escrito a mano con relleno de lápiz: cada letra aparece con un pequeño rebote.
import { GlobalFonts } from '@napi-rs/canvas';
import path from 'path';
import { fileURLToPath } from 'url';
import { clamp, ease, hrand, noise1, prog } from './core/math.js';

const here = path.dirname(fileURLToPath(import.meta.url));
GlobalFonts.registerFromPath(path.join(here, '../assets/fonts/Caveat-Bold.ttf'), 'CaveatBold');
GlobalFonts.registerFromPath(path.join(here, '../assets/fonts/PatrickHand-Regular.ttf'), 'PatrickHand');

// escribe `str` centrado en (cx, y). k: progreso 0..1 de aparición (letra por letra)
export function handText(D, str, cx, y, size, color, k, o = {}) {
  const ctx = D.ctx;
  const font = o.font || 'CaveatBold';
  ctx.font = `${size}px ${font}`;
  ctx.textBaseline = 'alphabetic';
  const chars = [...str];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) * (o.spacing ?? 1);
  let x = cx - total / 2;
  const n = chars.length;
  const pat = D._pat(color, { seed: o.seed ?? 5, angle: -1.0, anchor: [0, 0] }, 'fill');
  const rimPat = D._pat(color, { seed: (o.seed ?? 5) + 1, angle: 0.4, anchor: [0, 0] }, 'line');
  for (let i = 0; i < n; i++) {
    const c = chars[i];
    const w = widths[i] * (o.spacing ?? 1);
    const appear = clamp(k * (n + 6) - i) / 1; // ola de letras
    const a = clamp(appear * 1.6);
    if (a <= 0) { x += w; continue; }
    const sc = ease.outBack(clamp(appear), 2.2);
    const wob = noise1(i * 0.7 + D.boil * 0.9, 3) * 0.05;
    const jy = noise1(i * 1.3 + D.boil * 1.1, 4) * 1.4;
    ctx.save();
    ctx.translate(x + w / 2, y + jy);
    ctx.rotate(wob + (1 - clamp(appear)) * -0.3);
    ctx.scale(sc, sc);
    ctx.globalAlpha = a * (o.alpha ?? 1);
    if (o.halo) {
      ctx.lineWidth = size * 0.16;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = o.halo;
      ctx.strokeText(c, -widths[i] / 2, 0);
    }
    ctx.fillStyle = pat;
    ctx.fillText(c, -widths[i] / 2, 0);
    ctx.fillText(c, -widths[i] / 2, 0);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = rimPat;
    ctx.strokeText(c, -widths[i] / 2, 0);
    ctx.restore();
    x += w;
  }
  ctx.globalAlpha = 1;
  return total;
}
