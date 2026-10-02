// Libro pop-up (versión de papel): la película abre con una portada de cartulina cuya página
// se da vuelta para mostrar la historia, y el salto en el tiempo es otro pase de página.
// También: letras recortadas en papel (portada y créditos).
import { createCanvas } from '@napi-rs/canvas';
import { W, H } from '../timeline.js';
import { clamp, ease, prog, lerp, mix, hrand, noise1, mulberry32 } from '../core/math.js';
import { TILE } from '../core/pencil.js';
import { ellipsePts, rectPts } from '../core/pencil.js';
import { drawDrop } from '../world/drop.js';
import '../text.js';

export const COVER = { hold: 0.42, turn: [0.42, 1.0] };
export const TURNS = [{ cut: 23.0, a: 22.72, b: 23.3 }];

let page = null;
export function pageBuffer() {
  if (!page) { page = createCanvas(W, H); page.g = page.getContext('2d'); }
  return page;
}

// ¿hay pase de página en t? → { u (0..1 del giro), tOut, tIn } o portada
export function bookAt(t) {
  if (t < COVER.turn[1]) return { cover: true, u: prog(t, COVER.turn[0], COVER.turn[1]) };
  for (const P of TURNS) if (t >= P.a && t < P.b) return { u: prog(t, P.a, P.b), tOut: Math.min(t, P.cut - 0.01), tIn: Math.max(t, P.cut) };
  return null;
}

// la hoja `img` gira sobre el lomo (borde izquierdo) y se levanta hacia la cámara
export function pageTurn(ctx, img, u) {
  if (u >= 1) return;
  const th = ease.inOutSine(clamp(u)) * Math.PI * 0.5 * 0.985;
  const c = Math.cos(th), s = Math.sin(th);
  const Dv = 2.4 * W;
  const proj = (uu) => {
    const X = uu * W * c, Z = uu * W * s + 0.07 * W * Math.sin(Math.PI * uu) * s;
    const f = Dv / (Dv - Z);
    return [W / 2 + (X - W / 2) * f, f];
  };
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  // sombra que la hoja proyecta sobre la página de abajo
  const [xe] = proj(1);
  if (s > 0.02) {
    const g = ctx.createLinearGradient(Math.max(0, xe), 0, Math.max(0, xe) + 420 * s + 60, 0);
    g.addColorStop(0, `rgba(30,20,10,${0.5 * s})`);
    g.addColorStop(1, 'rgba(30,20,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(Math.max(0, xe), 0, 480, H);
  }
  // la hoja, en franjas verticales con perspectiva
  const N = 60;
  let prev = proj(0);
  for (let i = 0; i < N; i++) {
    const nx = proj((i + 1) / N);
    const x0 = prev[0], x1 = nx[0], f = prev[1];
    if (x1 > x0 + 0.01) {
      const hh = H * f, top = H / 2 - (H / 2) * f;
      ctx.drawImage(img, (i / N) * W, 0, W / N, H, x0, top, x1 - x0 + 0.9, hh);
      // luz: la hoja se oscurece al girar; brillo suave en el doblez
      const uu = (i + 0.5) / N;
      const shadeA = 0.42 * s * (0.6 + 0.4 * uu) - 0.12 * Math.sin(Math.PI * uu) * s;
      if (shadeA > 0) { ctx.fillStyle = `rgba(25,18,10,${shadeA})`; ctx.fillRect(x0, top, x1 - x0 + 0.9, hh); }
      else { ctx.fillStyle = `rgba(255,250,235,${-shadeA})`; ctx.fillRect(x0, top, x1 - x0 + 0.9, hh); }
    }
    prev = nx;
  }
  // canto de la hoja (el grosor del papel)
  if (s > 0.05 && xe > 0) {
    const f = proj(1)[1];
    ctx.fillStyle = '#f3ead6';
    ctx.fillRect(xe - 3, H / 2 - (H / 2) * f, 4, H * f);
  }
  // pliegue del lomo
  const gs = ctx.createLinearGradient(0, 0, 70, 0);
  gs.addColorStop(0, `rgba(30,20,10,${0.35 * (1 - u * 0.5)})`);
  gs.addColorStop(1, 'rgba(30,20,10,0)');
  ctx.fillStyle = gs;
  ctx.fillRect(0, 0, 70, H);
  ctx.restore();
}

// ------------------------------------------------------------------ letras de papel
let tmp = null;
function tmpCanvas(n) {
  if (!tmp || tmp.width < n) { tmp = createCanvas(n, n); tmp.g = tmp.getContext('2d'); }
  return tmp;
}
// cada letra es una pieza recortada: borde blanco, color, fibra y sombra; aparece de un salto
export function paperLetters(ctx, str, cx, y, size, k, o = {}) {
  const font = o.font || 'CaveatBold';
  const cols = o.colors || ['#e86a4a'];
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `${size}px ${font}`;
  const chars = [...str];
  const ws = chars.map((c) => ctx.measureText(c).width * (o.spacing ?? 1));
  let total = ws.reduce((a, b) => a + b, 0);
  const sc0 = o.maxW && total > o.maxW ? o.maxW / total : 1;
  let x = cx - (total * sc0) / 2;
  const n = chars.length;
  const boil = Math.floor((o.t ?? 0) * 12);
  const fiber = o.fiber;
  const S = Math.ceil(size * 1.8);
  const T = tmpCanvas(S);
  chars.forEach((ch, i) => {
    const w = ws[i] * sc0;
    const wi = chars.slice(0, i).filter((c) => c === ' ').length;
    const appear = o.mode === 'words' ? clamp(k * (str.split(' ').length + 1.2) - wi) : clamp(k * (n + 4) - i);
    if (ch !== ' ' && appear > 0) {
      // a saltos de stop-motion: 0 → grande → normal
      const st = appear < 0.34 ? 0.55 : appear < 0.67 ? 1.18 : 1;
      const rot = (hrand(i, o.seed ?? 1) - 0.5) * 0.16 + (hrand(i, boil, 3) - 0.5) * 0.03;
      const jx = (hrand(i, boil, 5) - 0.5) * 1.4, jy = (hrand(i, boil, 6) - 0.5) * 1.4;
      // la letra en una capa: borde de papel blanco + color + fibra
      const g = T.g;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.clearRect(0, 0, S, S);
      g.font = `${size}px ${font}`;
      g.textBaseline = 'alphabetic';
      g.lineJoin = 'round';
      const bx = (S - ws[i] / (o.spacing ?? 1)) / 2, by = S * 0.68;
      g.strokeStyle = o.border || '#fffaf0';
      g.lineWidth = size * 0.13;
      g.strokeText(ch, bx, by);
      g.fillStyle = cols[(i + (o.seed ?? 0)) % cols.length];
      g.fillText(ch, bx, by);
      if (fiber) {
        g.globalCompositeOperation = 'source-atop';
        g.globalAlpha = 0.8;
        g.drawImage(fiber, (i * 37) % (TILE - S > 0 ? TILE - S : 1), 0, Math.min(S, TILE), Math.min(S, TILE), 0, 0, S, S);
      }
      ctx.save();
      ctx.translate(x + w / 2 + jx, y + jy);
      ctx.rotate(rot);
      ctx.scale(st * sc0, st * sc0);
      ctx.shadowColor = 'rgba(40,25,10,0.45)';
      ctx.shadowBlur = size * 0.12;
      ctx.shadowOffsetX = size * 0.06;
      ctx.shadowOffsetY = size * 0.09;
      ctx.drawImage(T, 0, 0, S, S, -S / 2, -S * 0.68, S, S);
      ctx.restore();
    }
    x += w;
  });
  ctx.restore();
}

// ------------------------------------------------------------------ portada
export function drawCover(D, cv, t) {
  const g = cv.g;
  const prevCtx = D.ctx;
  D.ctx = g;
  D.haze = null;
  D.depth = 600;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  // cartulina kraft con fibras
  g.fillStyle = '#d8bf93';
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.9;
  for (let y = 0; y < H; y += TILE) for (let x = 0; x < W; x += TILE) g.drawImage(D.fiber, x, y);
  g.globalAlpha = 1;
  // marco de papel verde
  const frame = rectPts(60, 60, W - 120, H - 120, 3);
  D.shape(frame, '#3f7a4a', { seed: 3, smooth: false, still: true });
  D.shape(rectPts(84, 84, W - 168, H - 168, 3), '#f4ead6', { seed: 4, smooth: false, still: true });
  // cielo, sol y montañas de papel
  D.shape(rectPts(108, 108, W - 216, 1100, 3), '#a9d6ea', { seed: 5, smooth: false, still: true });
  // el sol asoma detrás de las montañas (no tapa el título)
  const sun = ellipsePts(800, 690, 96, 96, 26);
  D.shape(sun, '#ffd36a', { seed: 6 });
  D.shape(ellipsePts(800, 690, 70, 70, 22), '#ffe9a6', { seed: 7 });
  const hill = (y0, amp, col, seed) => {
    const pts = [];
    for (let i = 0; i <= 24; i++) { const x = 108 + (i / 24) * (W - 216); pts.push([x, y0 - amp * (0.6 + 0.4 * Math.sin(i * 0.7 + seed)) * Math.sin((i / 24) * Math.PI)]); }
    pts.push([W - 108, H - 108], [108, H - 108]);
    D.shape(pts, col, { seed, smooth: true });
  };
  hill(820, 260, '#8fb35a', 11);
  hill(1000, 200, '#5f9a4a', 12);
  // la quebrada serpentea hacia abajo
  const river = [];
  for (let i = 0; i <= 20; i++) { const u = i / 20; river.push([540 + Math.sin(u * 5) * 160 * u, 900 + u * 900]); }
  const rl = river.map(([x, y], i) => [x - 18 - i * 3, y]), rr = river.map(([x, y], i) => [x + 18 + i * 3, y]).reverse();
  hill(1300, 160, '#3f7a3c', 13);
  D.shape(rl.concat(rr), '#5aa8dc', { seed: 14 });
  // arbolitos de papel
  const r = mulberry32(5);
  for (let i = 0; i < 9; i++) {
    const x = 160 + r() * (W - 320), y = 1150 + r() * 520;
    if (Math.abs(x - (540 + Math.sin(((y - 900) / 900) * 5) * 160 * ((y - 900) / 900))) < 90) continue;
    D.shape(rectPts(x - 8, y - 70, 16, 70, 1), '#6b4a2e', { seed: 20 + i, smooth: false });
    D.shape(ellipsePts(x, y - 110, 62, 70, 14, 0, 0.12, i), ['#2f6a3a', '#4f8f3c', '#3a7a44'][i % 3], { seed: 30 + i });
  }
  // la gota protagonista
  drawDrop(D, { x: 540, y: 1560, s: 4.2, sx: 1, sy: 1, eyes: 1, look: [0.2, -0.4], mood: 'happy', shadow: true, light: -1, rim: 0, blush: 0.8 }, t);
  D.ctx = prevCtx;
  // título de cartulina
  paperLetters(g, 'Sembrar', W / 2, 330, 170, 1, { colors: ['#e86a4a', '#f2a03c', '#3f8f5a', '#3f86c8'], seed: 1, fiber: D.fiber, t });
  paperLetters(g, 'agua', W / 2, 520, 200, 1, { colors: ['#3f86c8', '#5aa8dc', '#2f6f9a'], seed: 2, fiber: D.fiber, t });
  paperLetters(g, 'Árboles para mi País', W / 2, H - 230, 78, 1, { font: 'CaveatBold', colors: ['#2f5a3a'], border: '#fffaf0', seed: 3, fiber: D.fiber, t, maxW: 760 });
}
