// La Gota: protagonista. Cuerpo translúcido que refracta el paisaje (se ve el mundo
// invertido dentro de ella), brillo especular, cáusticas y una cara muy expresiva.
import { createCanvas, Path2D } from '@napi-rs/canvas';
import { ellipsePts } from '../core/pencil.js';
import { clamp, lerp, ease, noise1, hrand, shade, rgba } from '../core/math.js';

// contorno de gota: base en (0,0), punta arriba; alto ≈ 46
export function dropOutline(n = 36, tip = 1) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = Math.sin(t) * Math.pow(Math.sin(t / 2), 1.1 * tip) * 1.04;
    const y = -Math.cos(t);
    pts.push([x * 21, -(23 - y * 23)]);
  }
  return pts;
}
const OUT = dropOutline();

let tmp = null;
function tmpCanvas(w, h) {
  if (!tmp || tmp.width < w || tmp.height < h) { tmp = createCanvas(Math.max(w, 64), Math.max(h, 64)); tmp.g = tmp.getContext('2d'); }
  return tmp;
}

// st: {x,y (pantalla, base), s (px por unidad), sx, sy, rot, eyes 0..1, look [dx,dy], mood, brow, alpha,
//      light (-1 izq, 1 der), glow (brillo mágico), shadow}
// mood: neutral | happy | joy | sad | o | worried | sleepy | determined
export function drawDrop(D, st, t) {
  if (!st || (st.alpha ?? 1) <= 0.01) return;
  const a = st.alpha ?? 1;
  const ctx = D.ctx;
  const S = st.s;
  const px = 46 * S * (st.sy || 1);
  D.save();
  D.translate(st.x, st.y);
  // sombrita de contacto
  if (st.shadow !== false) D.shape(ellipsePts(0, 1, 17, 4.5, 12), '#1f3b4f', { alpha: 0.28 * a, edge: 3, base: false, rim: false, seed: 40 });
  D.rotate(st.rot || 0);
  D.scale(S * (st.sx || 1), S * (st.sy || 1));
  const seed = 4242;
  const body = D.path(OUT, { seed, jitter: 0.7 });
  const bb = body.bb;
  const L = st.light ?? -1;
  // --- refracción: el paisaje de atrás, invertido y aumentado, dentro de la gota
  const main = D.mainCtx && ctx === D.mainCtx;
  if (main && px > 60 && a > 0.9) {
    const w = Math.ceil(bb[2] - bb[0] + 40), h = Math.ceil(bb[3] - bb[1] + 40);
    const x0 = Math.floor(bb[0] - 20), y0 = Math.floor(bb[1] - 20);
    const T = tmpCanvas(w, h);
    T.g.setTransform(1, 0, 0, 1, 0, 0);
    T.g.globalCompositeOperation = 'copy';
    T.g.drawImage(ctx.canvas, x0, y0, w, h, 0, 0, w, h);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clip(body);
    const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2 + (bb[3] - bb[1]) * 0.12;
    ctx.translate(cx, cy);
    ctx.scale(1.5, -1.5);
    ctx.globalAlpha = 0.9;
    ctx.filter = 'blur(1.5px) saturate(1.3)';
    ctx.drawImage(T, 0, 0, w, h, -(cx - x0), -(cy - y0) - (bb[3] - bb[1]) * 0.1, w, h);
    ctx.filter = 'none';
    ctx.restore();
  }
  // --- cuerpo translúcido
  const tint = st.tint || '#8ecdf0';
  D.fill(body, tint, { seed, angle: -0.35, edge: 2.6, alpha: (main && px > 60 ? 0.55 : 0.92) * a, baseAlpha: 0.5, rimAlpha: 0.7, knock: !(main && px > 60) });
  // volumen: más profundo abajo y del lado contrario a la luz
  const under = D.path(ellipsePts(-L * 8, -6, 21, 14, 16, 0.3 * -L), { seed: seed + 1 });
  ctx.save(); ctx.clip(body);
  D.fill(under, '#4f95cf', { seed: seed + 1, alpha: 0.55 * a, edge: 0, base: true, baseAlpha: 0.3, angle: -0.8 });
  // cáustica: la luz se concentra abajo, del lado opuesto al sol
  const cx0 = D.P(-L * 6, -6);
  const gr = ctx.createRadialGradient(cx0[0], cx0[1], 0, cx0[0], cx0[1], 14 * D.ps);
  gr.addColorStop(0, `rgba(235,252,255,${0.75 * a})`);
  gr.addColorStop(1, 'rgba(235,252,255,0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = gr;
  ctx.fillRect(bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  // borde luminoso (contraluz)
  if (st.rim) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.6 * st.rim * a;
    ctx.strokeStyle = '#fff4d8';
    ctx.lineWidth = D.lw(3);
    ctx.stroke(body);
    ctx.restore();
  }
  // brillos especulares: ventana curva (media luna junto al borde del lado de la luz) + punto
  const win = [];
  const side = L < 0 ? -1 : 1;
  for (let i = 0; i <= 12; i++) { const th = (200 + (i / 12) * 62) * Math.PI / 180; win.push([side * -Math.cos(th) * -16.2 * -1, -24 + Math.sin(th) * 16.2]); }
  for (let i = 12; i >= 0; i--) { const th = (206 + (i / 12) * 50) * Math.PI / 180; win.push([side * -Math.cos(th) * -12.4 * -1, -24.5 + Math.sin(th) * 12.4]); }
  D.shape(win, '#ffffff', { seed: seed + 2, edge: 1.2, alpha: 0.8 * a, rim: false, baseAlpha: 0.7 });
  D.shape(ellipsePts(L * 12.5, -17, 2, 2, 8), '#ffffff', { seed: seed + 3, edge: 0, alpha: 0.9 * a, baseAlpha: 0.9 });
  // --- cara
  face(D, st, a, seed);
  D.restore();
  if (st.glow) {
    const [gx, gy] = [st.x, st.y - 23 * S];
    const g2 = ctx.createRadialGradient(gx, gy, 0, gx, gy, 60 * S);
    g2.addColorStop(0, `rgba(210,240,255,${0.5 * st.glow})`);
    g2.addColorStop(1, 'rgba(210,240,255,0)');
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = g2; ctx.fillRect(gx - 60 * S, gy - 60 * S, 120 * S, 120 * S); ctx.restore();
  }
}

function face(D, st, a, seed) {
  const [lx, ly] = st.look || [0, 0];
  const eo = clamp(st.eyes ?? 1);
  const mood = st.mood || 'neutral';
  const ink = '#1f2230';
  const ex = 6.9, ey = -17.5 + ly * 1.6;
  const cx = lx * 3.2;
  for (const side of [-1, 1]) {
    const px = cx + side * ex, py = ey;
    if ((mood === 'joy') && eo > 0.5) {
      // ojos felices ^ ^
      D.stroke([[px - 3.8, py + 1.4], [px, py - 2.8], [px + 3.8, py + 1.4]], ink, 2.2, { seed: seed + 10 + side, alpha: a });
    } else if (eo < 0.12) {
      D.stroke([[px - 3.4, py + 0.6], [px, py + 1.9], [px + 3.4, py + 0.6]], ink, 1.9, { seed: seed + 12 + side, alpha: a });
    } else {
      const eh = 4.9 * eo;
      D.shape(ellipsePts(px, py + (1 - eo) * 1.5, 3.3, eh, 14), ink, { seed: seed + 14 + side, edge: 0.8, alpha: a, baseAlpha: 0.97, dense: true });
      if (eo > 0.45) {
        D.shape(ellipsePts(px - 1.1 + lx * 0.7, py - eh * 0.42, 1.3, 1.3, 8), '#ffffff', { seed: seed + 16 + side, edge: 0, alpha: a, baseAlpha: 1 });
        D.shape(ellipsePts(px + 1.2 + lx * 0.5, py + eh * 0.35, 0.65, 0.65, 6), '#ffffff', { seed: seed + 17 + side, edge: 0, alpha: 0.85 * a, baseAlpha: 1 });
      }
      // párpado superior (cansancio / tristeza)
      if (mood === 'sleepy' || mood === 'sad') {
        D.stroke([[px - 4, py - eh * 0.55], [px + 4, py - eh * 0.55 + side * 0]], ink, 1.4, { seed: seed + 19 + side, alpha: 0.8 * a });
      }
    }
    // cejas: b>0 tristeza/preocupación (extremo interior arriba), b<0 determinación
    const b = st.brow ?? (mood === 'sad' || mood === 'worried' ? 1 : mood === 'determined' ? -1 : mood === 'o' ? 0.5 : 0);
    if (b !== 0 || mood === 'happy' || mood === 'joy') {
      const by = py - 8 - (mood === 'o' ? 1.6 : 0) - (mood === 'joy' ? 0.8 : 0);
      const inner = [px - side * 3.4, by - (b > 0 ? 2.4 * b : b < 0 ? 1.8 * b : 0.3)];
      const outer = [px + side * 3.6, by + (b > 0 ? 0.8 * b : b < 0 ? 0.6 * b : 0.6)];
      D.stroke([inner, [(inner[0] + outer[0]) / 2, Math.min(inner[1], outer[1]) - 0.8], outer], ink, 1.5, { seed: seed + 18 + side, alpha: 0.85 * a });
    }
  }
  // mejillas
  const blush = st.blush ?? (mood === 'joy' ? 0.8 : mood === 'happy' ? 0.6 : 0.4);
  D.shape(ellipsePts(cx - 12, ey + 6.4, 3.6, 2.1, 10), '#f28f86', { seed: seed + 20, edge: 1.6, alpha: blush * a, rim: false });
  D.shape(ellipsePts(cx + 12, ey + 6.4, 3.6, 2.1, 10), '#f28f86', { seed: seed + 21, edge: 1.6, alpha: blush * a, rim: false });
  // boca
  const my = ey + 7.6;
  if (mood === 'joy') {
    D.shape([[cx - 4.4, my - 1], [cx + 4.4, my - 1], [cx + 2.8, my + 3.6], [cx, my + 4.2], [cx - 2.8, my + 3.6]], '#7a2f35', { seed: seed + 22, edge: 1, alpha: a });
    D.shape(ellipsePts(cx, my + 2.8, 1.8, 1, 8), '#e2787a', { seed: seed + 27, edge: 0, alpha: a });
  } else if (mood === 'happy') {
    D.stroke([[cx - 3.2, my], [cx, my + 2.4], [cx + 3.2, my]], ink, 1.6, { seed: seed + 23, alpha: a });
  } else if (mood === 'sad' || mood === 'worried') {
    D.stroke([[cx - 2.8, my + 2], [cx, my + 0.3], [cx + 2.8, my + 2]], ink, 1.5, { seed: seed + 24, alpha: a });
  } else if (mood === 'o') {
    D.shape(ellipsePts(cx, my + 1.2, 1.9, 2.5, 10), '#7a2f35', { seed: seed + 25, edge: 1, alpha: a });
  } else if (mood === 'determined') {
    D.stroke([[cx - 2.6, my + 0.8], [cx + 2.6, my + 0.2]], ink, 1.6, { seed: seed + 26, alpha: a });
  } else {
    D.stroke([[cx - 2, my + 0.8], [cx + 2, my + 0.8]], ink, 1.4, { seed: seed + 26, alpha: a });
  }
  // sudor (sequía)
  if (st.sweat) {
    const k = st.sweat;
    D.shape(ellipsePts(20, -36 + k * 9, 2.4, 3.6, 8), '#bfe3f7', { seed: seed + 30, edge: 1.2, alpha: a * clamp(1.4 - k) });
  }
  // lágrima
  if (st.tear) {
    const k = st.tear;
    D.shape(ellipsePts(cx + 7, ey + 5 + k * 8, 1.4, 2.2, 8), '#d8f0ff', { seed: seed + 31, edge: 0.8, alpha: a * clamp(1.5 - k) });
  }
}
