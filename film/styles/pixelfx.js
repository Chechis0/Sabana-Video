// Detalles de videojuego para el pixel art: globos de emoción sobre los personajes y lluvia
// de un píxel. Todo se pinta alineado a la cuadrícula del lienzo pequeño.
import { W, H } from '../timeline.js';
import { PX, RW, RH } from '../style.js';
import { clamp, mulberry32, prog, ease } from '../core/math.js';
import { pixelText, layout } from './pixelfont.js';

// globo de diálogo con un signo (!, ?, …, ♥). (sx, sy): punta del globo en pantalla (1080×1920)
export function emote(ctx, sx, sy, glyph, k, o = {}) {
  if (k <= 0 || k >= 1) return;
  const pop = k < 0.12 ? ease.outBack(k / 0.12, 2.5) : k > 0.88 ? 1 - (k - 0.88) / 0.12 : 1;
  if (pop <= 0.05) return;
  const S = o.scale || 1; // en primeros planos el globo es el doble
  const L = layout(glyph);
  const gw = L.w, gh = 7;
  const bw = Math.max(9, gw + 4), bh = gh + 4;
  const cx = Math.round(sx / PX), tip = Math.round(sy / PX);
  // en la aparición el globo crece de abajo hacia arriba (dos cuadros)
  const h = Math.max(2, Math.round(bh * Math.min(1, pop)));
  const x0 = -Math.floor(bw / 2), y0 = -2 - h;
  const fill = o.fill || '#fffbea', ink = o.ink || '#1b1830';
  const R = (x, y, w, hh, c) => { ctx.fillStyle = c; ctx.fillRect((cx + x * S) * PX, (tip + y * S) * PX, w * S * PX, hh * S * PX); };
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // contorno (esquinas recortadas) y relleno
  R(x0 + 1, y0, bw - 2, h, ink);
  R(x0, y0 + 1, bw, h - 2, ink);
  R(x0 + 1, y0 + 1, bw - 2, h - 2, fill);
  // sombrita inferior del globo
  R(x0 + 1, y0 + h - 2, bw - 2, 1, o.shade || '#d8d2c0');
  // colita: se abre el borde de abajo y baja en punta
  R(-1, y0 + h - 1, 3, 1, fill);
  R(-1, y0 + h, 1, 1, ink); R(0, y0 + h, 1, 1, fill); R(1, y0 + h, 1, 1, ink);
  R(0, y0 + h + 1, 1, 1, ink);
  ctx.restore();
  if (pop >= 0.99) pixelText(ctx, glyph, cx + (S === 1 ? 0 : 0), tip + (y0 + 2 - 2) * S, 1, { color: o.color || '#e2453a', shadow: false, bounce: false, scale: S });
}

// lluvia de un píxel: rayitas inclinadas en tres capas (las cercanas más largas y claras)
export function pixelRain(ctx, t, k, camX = 0) {
  if (k <= 0.01) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  const layers = [[3, 120, '#9fb6d0', 0.45, 0.6], [5, 90, '#c6d8ea', 0.6, 1], [8, 40, '#e8f2fb', 0.75, 1.6]];
  const fr = Math.floor(t * 24);
  for (const [len, n0, col, al, sp] of layers) {
    const r = mulberry32(len * 977 + 13);
    const n = Math.floor(n0 * k);
    ctx.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const x0 = r() * (RW + 40), y0 = r() * RH;
      // caen 6 píxeles por cuadro (más rápido cerca), con un leve viento
      const y = (y0 + fr * 6 * sp) % (RH + len) - len;
      const x = Math.floor((x0 - fr * 1.5 * sp - camX * 0.002 * sp) % (RW + 40) + RW + 40) % (RW + 40) - 20;
      ctx.globalAlpha = al;
      for (let q = 0; q < len; q++) ctx.fillRect((x - Math.floor(q / 3)) * PX, (Math.floor(y) + q) * PX, PX, PX);
    }
  }
  ctx.restore();
}

// salpicaduras: coronitas de 3 píxeles que aparecen y se van
export function pixelSplashes(ctx, t, k, y0, y1) {
  if (k <= 0.01) return;
  const fr = Math.floor(t * 24);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#e8f2fb';
  const r = mulberry32(fr * 31 + 7);
  for (let i = 0; i < 45 * k; i++) {
    const x = Math.floor(r() * RW), y = Math.floor((y0 + r() * (y1 - y0)) / PX);
    const ph = r();
    ctx.globalAlpha = 0.7;
    if (ph < 0.5) { ctx.fillRect((x - 1) * PX, (y - 1) * PX, PX, PX); ctx.fillRect((x + 1) * PX, (y - 1) * PX, PX, PX); }
    else { ctx.fillRect((x - 2) * PX, (y - 2) * PX, PX, PX); ctx.fillRect((x + 2) * PX, (y - 2) * PX, PX, PX); ctx.fillRect(x * PX, (y - 3) * PX, PX, PX); }
  }
  ctx.restore();
}
