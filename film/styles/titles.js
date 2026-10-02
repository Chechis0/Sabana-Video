// Títulos finales de cada estilo (sobre el mapa-árbol). El texto es el mismo en todas las
// versiones; cambia cómo aparece.
import { W, H } from '../timeline.js';
import { clamp, prog, ease, noise1 } from '../core/math.js';
import '../text.js'; // registra las tipografías
import { T } from '../story.js';
import { PX, RW, RH } from '../style.js';
import { pixelText } from './pixelfont.js';
import { paperLetters } from './book.js';

export const LINES = {
  s1: ['Conectar el bosque', 'es sembrar agua.'],
  s2: ['Sembrar agua es', 'sembrar futuro.'],
  title: 'Árboles para mi País',
  credits: ['+261.000 árboles', '20 municipios de Cundinamarca', 'Fundación Parque Jaime Duque', 'Creado por: Sergio Pardo Osorio'],
};

// tiempos de aparición de cada línea (los usa también la música para los "blips" del texto)
export const PIXEL_TYPE = [
  { text: LINES.s1[0], t0: T.title1, t1: T.title1 + 0.42 },
  { text: LINES.s1[1], t0: T.title1 + 0.42, t1: T.title1 + 0.8 },
  { text: LINES.s2[0], t0: T.title2, t1: T.title2 + 0.38 },
  { text: LINES.s2[1], t0: T.title2 + 0.38, t1: T.title2 + 0.76 },
  { text: LINES.title, t0: T.credits, t1: T.credits + 0.32 },
  { text: LINES.credits[0], t0: T.credits + 0.32, t1: T.credits + 0.5 },
  { text: LINES.credits[1], t0: T.credits + 0.5, t1: T.credits + 0.78 },
  { text: LINES.credits[2], t0: T.credits + 0.78, t1: T.credits + 1.02 },
  { text: LINES.credits[3], t0: T.credits + 1.02, t1: T.credits + 1.3 },
];

// franja oscura con borde tramado (para que el texto se lea sobre el mapa)
function band(ctx, y0, y1, k, top) {
  if (k <= 0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0e1630';
  ctx.globalAlpha = 0.42 * k;
  ctx.fillRect(0, y0 * PX, W, (y1 - y0) * PX);
  // dos filas de tramado en el borde
  const edge = top ? y1 : y0 - 2;
  for (let r = 0; r < 2; r++) {
    for (let x = 0; x < RW; x++) {
      const on = top ? (r === 0 ? (x % 2 === 0) : (x % 4 === 1)) : (r === 1 ? (x % 2 === 0) : (x % 4 === 1));
      if (on) ctx.fillRect(x * PX, (edge + r) * PX, PX, PX);
    }
  }
  ctx.restore();
}

export function pixelTitles(D, t) {
  const ctx = D.ctx;
  if (t < T.title1 - 0.1) return;
  band(ctx, 0, 100, clamp((t - T.title1 + 0.15) / 0.3), true);
  band(ctx, 290, RH, clamp((t - T.credits + 0.3) / 0.3), false);
  const st = [
    { y: 6, s: 2, color: '#fff6d8', outline: '#1d2a3a', hi: '#ffffff' },
    { y: 28, s: 2, color: '#fff6d8', outline: '#1d2a3a', hi: '#ffffff' },
    { y: 52, s: 2, color: '#a8e4ff', outline: '#123049', hi: '#e8fbff' },
    { y: 74, s: 2, color: '#a8e4ff', outline: '#123049', hi: '#e8fbff' },
    { y: 296, s: 2, color: '#c8f08c', outline: '#13301b', hi: '#f2ffd8' },
    { y: 322, s: 1, color: '#ffe7a0', outline: '#1d2a3a', hi: '#fffbe6' },
    { y: 336, s: 1, color: '#fff6d8', outline: '#1d2a3a', hi: '#ffffff' },
    { y: 350, s: 1, color: '#fff6d8', outline: '#1d2a3a', hi: '#ffffff' },
    { y: 366, s: 1, color: '#a8e4ff', outline: '#123049', hi: '#e8fbff' },
  ];
  PIXEL_TYPE.forEach((L, i) => {
    const k = prog(t, L.t0, L.t1);
    if (k <= 0) return;
    const o = st[i];
    pixelText(ctx, L.text, RW / 2, o.y, k, { scale: o.s, color: o.color, outline: o.outline, hi: o.hi });
  });
  // cursor de diálogo que parpadea al terminar cada frase
  const blink = Math.floor(t * 3) % 2 === 0;
  if (blink && t > T.title2 + 0.8 && t < T.credits) pixelText(ctx, '▼', RW - 12, 92, 1, { color: '#fff6d8', outline: '#1d2a3a', bounce: false });
}

// ------------------------------------------------------------------ caricatura: letras gorditas
// con tinta, sombra de color y entrada con rebote (palabra por palabra)
export function bubbleText(ctx, str, cx, y, size, k, o = {}) {
  const font = o.font || 'PatrickHand';
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `${size}px ${font}`;
  ctx.textBaseline = 'alphabetic';
  const words = str.split(' ');
  const space = ctx.measureText(' ').width;
  const ws = words.map((w) => ctx.measureText(w).width);
  let total = ws.reduce((a, b) => a + b, 0) + space * (words.length - 1);
  let sc0 = 1;
  if (o.maxW && total > o.maxW) { sc0 = o.maxW / total; }
  let x = cx - (total * sc0) / 2;
  const fat = size * (o.fat ?? 0.1);
  words.forEach((w, i) => {
    const appear = clamp(k * (words.length + 1.2) - i);
    const ww = ws[i] * sc0;
    if (appear > 0) {
      const sc = ease.outBack(appear, 2.6) * sc0;
      const wob = (o.wobble ?? 1) * 0.03 * noise1(i * 1.7 + (o.seed ?? 0), 4) + (1 - appear) * -0.25;
      ctx.save();
      ctx.translate(x + ww / 2, y);
      ctx.rotate(wob);
      ctx.scale(sc, sc * (1 + 0.12 * (1 - appear)));
      ctx.lineJoin = 'round';
      const px = -ws[i] / 2;
      // sombra de color, tinta gruesa, cuerpo gordito y brillo
      if (o.shadow) { ctx.fillStyle = o.shadow; ctx.strokeStyle = o.shadow; ctx.lineWidth = fat * 2 + (o.ink ?? 10); ctx.strokeText(w, px + size * 0.05, size * 0.07); ctx.fillText(w, px + size * 0.05, size * 0.07); }
      ctx.strokeStyle = o.inkCol || '#1c1a2e'; ctx.lineWidth = fat * 2 + (o.ink ?? 10); ctx.strokeText(w, px, 0);
      ctx.strokeStyle = o.color; ctx.lineWidth = fat * 2; ctx.strokeText(w, px, 0);
      ctx.fillStyle = o.color; ctx.fillText(w, px, 0);
      if (o.hi) { ctx.save(); ctx.beginPath(); ctx.rect(px - fat * 2, -size, ws[i] + fat * 4, size * 0.42); ctx.clip(); ctx.globalAlpha = 0.55; ctx.fillStyle = o.hi; ctx.fillText(w, px, 0); ctx.restore(); }
      ctx.restore();
    }
    x += ww + space * sc0;
  });
  ctx.restore();
}

export function cartoonTitles(D, t) {
  const ctx = D.ctx;
  if (t < T.title1 - 0.1) return;
  // velo suave arriba y abajo para leer
  const kt = clamp((t - T.title1 + 0.3) / 0.6), kb = clamp((t - T.credits + 0.4) / 0.6);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (kt > 0) { const g = ctx.createLinearGradient(0, 0, 0, 520); g.addColorStop(0, `rgba(20,30,60,${0.45 * kt})`); g.addColorStop(1, 'rgba(20,30,60,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 520); }
  if (kb > 0) { const g = ctx.createLinearGradient(0, H - 470, 0, H); g.addColorStop(0, 'rgba(20,30,60,0)'); g.addColorStop(0.4, `rgba(20,30,60,${0.45 * kb})`); g.addColorStop(1, `rgba(20,30,60,${0.6 * kb})`); ctx.fillStyle = g; ctx.fillRect(0, H - 470, W, 470); }
  ctx.restore();
  const big = { maxW: 1000, fat: 0.05, ink: 11 };
  const k1 = prog(t, T.title1, T.title1 + 0.7), k2 = prog(t, T.title2, T.title2 + 0.7);
  bubbleText(ctx, LINES.s1[0], W / 2, 118, 96, clamp(k1 * 2), { ...big, color: '#fff8e4', shadow: '#2f6f9a', hi: '#ffffff', seed: 1 });
  bubbleText(ctx, LINES.s1[1], W / 2, 214, 96, clamp(k1 * 2 - 1), { ...big, color: '#fff8e4', shadow: '#2f6f9a', hi: '#ffffff', seed: 2 });
  bubbleText(ctx, LINES.s2[0], W / 2, 322, 96, clamp(k2 * 2), { ...big, color: '#a6e3ff', shadow: '#1f4f7a', hi: '#e8fbff', seed: 3 });
  bubbleText(ctx, LINES.s2[1], W / 2, 418, 96, clamp(k2 * 2 - 1), { ...big, color: '#a6e3ff', shadow: '#1f4f7a', hi: '#e8fbff', seed: 4 });
  bubbleText(ctx, 'Árboles para mi País', W / 2, H - 230, 104, prog(t, T.credits, T.credits + 0.4), { maxW: 980, fat: 0.08, ink: 14, color: '#c8f08c', shadow: '#2f6a3a', hi: '#f4ffe0', seed: 3 });
  const sm = { maxW: 1000, fat: 0.05, ink: 9 };
  bubbleText(ctx, '+261.000 árboles · 20 municipios de Cundinamarca', W / 2, H - 152, 46, prog(t, T.credits + 0.25, T.credits + 0.6), { ...sm, color: '#fff3c4', seed: 4, wobble: 0.4 });
  bubbleText(ctx, 'Fundación Parque Jaime Duque', W / 2, H - 98, 46, prog(t, T.credits + 0.4, T.credits + 0.75), { ...sm, color: '#ffffff', seed: 5, wobble: 0.4 });
  bubbleText(ctx, 'Creado por: Sergio Pardo Osorio', W / 2, H - 40, 50, prog(t, T.credits + 0.6, T.credits + 1.0), { ...sm, color: '#a6e3ff', seed: 6, wobble: 0.4 });
}

// ------------------------------------------------------------------ papel: letras recortadas
export function paperTitles(D, t) {
  const ctx = D.ctx;
  if (t < T.title1 - 0.1) return;
  const f = D.fiber;
  const o1 = { colors: ['#2f5a3a', '#3f7a4a'], seed: 1, fiber: f, t, maxW: 980 };
  const o2 = { colors: ['#2f6f9a', '#3f86c8'], seed: 2, fiber: f, t, maxW: 980 };
  const k1 = prog(t, T.title1, T.title1 + 0.7), k2 = prog(t, T.title2, T.title2 + 0.7);
  paperLetters(ctx, LINES.s1[0], W / 2, 128, 100, clamp(k1 * 2), o1);
  paperLetters(ctx, LINES.s1[1], W / 2, 228, 100, clamp(k1 * 2 - 1), o1);
  paperLetters(ctx, LINES.s2[0], W / 2, 338, 100, clamp(k2 * 2), o2);
  paperLetters(ctx, LINES.s2[1], W / 2, 438, 100, clamp(k2 * 2 - 1), o2);
  paperLetters(ctx, LINES.title, W / 2, H - 236, 112, prog(t, T.credits, T.credits + 0.45), { colors: ['#e86a4a', '#f2a03c', '#3f8f5a', '#3f86c8'], seed: 3, fiber: f, t, maxW: 1000 });
  const sm = { font: 'PatrickHand', colors: ['#4a3420'], fiber: f, t, maxW: 1000, mode: 'words' };
  paperLetters(ctx, '+261.000 árboles · 20 municipios de Cundinamarca', W / 2, H - 156, 46, prog(t, T.credits + 0.3, T.credits + 0.65), { ...sm, seed: 4 });
  paperLetters(ctx, 'Fundación Parque Jaime Duque', W / 2, H - 100, 48, prog(t, T.credits + 0.45, T.credits + 0.8), { ...sm, seed: 5 });
  paperLetters(ctx, 'Creado por: Sergio Pardo Osorio', W / 2, H - 42, 52, prog(t, T.credits + 0.6, T.credits + 1.0), { ...sm, colors: ['#2f6f9a'], seed: 6 });
}
