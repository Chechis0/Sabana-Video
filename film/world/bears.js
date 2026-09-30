// Oso andino (de anteojos): la osa y su osezno. Vista lateral, mirando a la derecha (dir=1).
// b = { x, y (pantalla, pie), s (px/unidad), dir, walk (fase), moving 0..1, run 0..1, sit 0..1,
//       headDip 0..1 (beber), headUp (mirar arriba), look, eyes, mood, nuzzle 0..1, light }
import { ellipsePts } from '../core/pencil.js';
import { clamp, lerp, ease, noise1, shade } from '../core/math.js';
import { castShadow } from './flora.js';

const FUR = '#2b2420', FUR2 = '#3b312b', FUR_FAR = '#1f1a17', CREAM = '#e8d2a2', CREAM2 = '#d7b98a';

export function drawBear(D, b, t) {
  const seed = b.seed || 61;
  const S = b.s;
  D.save();
  D.translate(b.x, b.y);
  D.scale(S * (b.dir || 1), S);
  const ph = b.walk || 0, mv = b.moving ?? 0, run = b.run || 0;
  const sit = b.sit || 0;
  const bob = (Math.abs(Math.sin(ph)) * 3 * mv + Math.abs(Math.sin(ph)) * 7 * run);
  const L = (b.light ?? -1) * (b.dir || 1);
  const big = S * 150 > 160; // en pantalla: detalle de pelaje
  // sombra
  castShadow(D, 78, 10, seed, 0.32, '#1d2616', 1);
  const leg = (x0, phase, far, front) => {
    const amp = 16 * mv + 26 * run;
    const sw = Math.sin(ph + phase) * amp;
    const lift = Math.max(0, Math.cos(ph + phase)) * (7 * mv + 14 * run);
    const col = far ? FUR_FAR : FUR;
    const top = front ? -46 : -42;
    const pts = [[x0 - 12, top], [x0 + 12, top], [x0 + 10 + sw * 0.5, -10 - lift], [x0 + 13 + sw, -lift], [x0 - 10 + sw, -lift], [x0 - 11 + sw * 0.5, -10 - lift]];
    D.shape(pts, col, { seed: seed + x0 + (far ? 3 : 0), knock: true, angle: -1.3, edge: 2.6, jitter: 0.7 });
    // garras
    if (big) D.stroke([[x0 + 9 + sw, -lift - 1], [x0 + 15 + sw, -lift + 1]], '#8c7a60', 1.4, { seed: seed + x0 + 9, alpha: 0.7 });
  };
  const bodyY = -52 - bob + sit * 10;
  if (sit < 0.5) {
    leg(-42, Math.PI, true, false);
    leg(36, 0, true, true);
  }
  // cuerpo (con joroba en los hombros)
  D.save();
  D.translate(0, bodyY);
  D.rotate(-sit * 0.55 + run * 0.04 * Math.sin(ph * 2));
  const bodyPts = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    let rx = 64, ry = 36;
    let x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    if (y < 0 && x > 5) y *= 1 + 0.18 * Math.sin(((x - 5) / 59) * Math.PI); // joroba
    if (x < -40) x += (x + 40) * -0.1;
    bodyPts.push([x, y]);
  }
  const body = D.shape(bodyPts, FUR, { seed: seed + 1, knock: true, angle: -1.0, edge: 3.2, jitter: 1 });
  // luz sobre el lomo y sombra en la panza
  D.shadeIn(body, ellipsePts(L * 10 - 4, -22, 52, 16, 14), '#5a4a40', { seed: seed + 2, alpha: 0.6, angle: -0.5 });
  D.shadeIn(body, ellipsePts(0, 26, 60, 14, 12), '#15110f', { seed: seed + 3, alpha: 0.7, angle: -0.8 });
  if (big) {
    // pelaje: trazos
    for (let k = 0; k < 14; k++) {
      const x = -54 + k * 8, y = -20 + (k % 3) * 12;
      D.stroke([[x, y], [x + 6, y + 5]], '#4a3e36', 1.3, { seed: seed + 20 + k, alpha: 0.55 });
    }
  }
  D.shape(ellipsePts(-64, -10, 8, 7, 8), FUR2, { seed: seed + 4, knock: true }); // colita
  D.restore();
  if (sit < 0.5) {
    leg(-34, 0, false, false);
    leg(44, Math.PI, false, true);
  } else {
    // sentado: ancas y patas delanteras rectas
    D.shape(ellipsePts(-30, -18, 30, 20, 12), FUR, { seed: seed + 40, knock: true });
    D.shape([[28, -48], [44, -48], [46, 0], [30, 0]], FUR, { seed: seed + 41, knock: true, smooth: false });
    D.shape([[18, -44], [30, -44], [32, 0], [20, 0]], FUR_FAR, { seed: seed + 42, knock: true, smooth: false });
  }
  // pechera crema (babero)
  D.shape(ellipsePts(52, -44 - bob - sit * 22, 12, 16, 12, 0.3), CREAM, { seed: seed + 15, alpha: 0.95, edge: 2, knock: true });
  // cabeza
  const dip = b.headDip || 0, up = b.headUp || 0;
  const nz = b.nuzzle || 0;
  const hx = 64 + dip * 14 + nz * 10, hy = -76 - bob + dip * 50 - sit * 30 - up * 10 + nz * 18;
  D.save();
  D.translate(hx, hy);
  D.rotate(dip * 0.6 - up * 0.45 + nz * 0.35 + (b.headTilt || 0));
  // orejas
  D.shape(ellipsePts(-14, -28, 10, 9, 10), FUR, { seed: seed + 5, knock: true });
  D.shape(ellipsePts(10, -30, 10, 9, 10), FUR, { seed: seed + 6, knock: true });
  if (big) {
    D.shape(ellipsePts(-14, -28, 5, 4.5, 8), '#4a3a32', { seed: seed + 16, edge: 0 });
    D.shape(ellipsePts(10, -30, 5, 4.5, 8), '#4a3a32', { seed: seed + 17, edge: 0 });
  }
  const head = D.shape(ellipsePts(0, -4, 31, 27, 20, 0, 0.05, seed + 7), FUR, { seed: seed + 7, knock: true, angle: -1.1, edge: 3 });
  D.shadeIn(head, ellipsePts(L * 8, -18, 22, 10, 10), '#56463c', { seed: seed + 18, alpha: 0.6 });
  // anteojos: medialuna crema alrededor del ojo y franja hacia el hocico
  D.shadeIn(head, [[2, -22], [14, -26], [26, -18], [32, -4], [26, 8], [16, 2], [10, -8], [4, -12]], CREAM, { seed: seed + 8, angle: -0.6, alpha: 0.95 });
  D.shadeIn(head, [[-6, -14], [0, -24], [6, -18], [4, -8]], CREAM2, { seed: seed + 19, angle: -0.6, alpha: 0.8 });
  // hocico
  D.shape(ellipsePts(29, 6, 17, 12, 14, -0.1), CREAM, { seed: seed + 9, knock: true, angle: -0.8 });
  D.shape(ellipsePts(43, 1, 6.5, 5.5, 10), '#161211', { seed: seed + 10, edge: 1.5, dense: true }); // nariz
  D.shape(ellipsePts(41, -0.5, 2, 1.4, 6), '#8a8a8a', { seed: seed + 11, edge: 0, alpha: 0.7 });
  // boca (sonrisa suave si está feliz)
  const mood = b.mood || 'neutral';
  if (mood === 'happy') D.stroke([[30, 12], [36, 15], [42, 11]], '#3d2b25', 1.6, { seed: seed + 12, alpha: 0.85 });
  else D.stroke([[31, 12], [37, 13], [42, 11]], '#3d2b25', 1.4, { seed: seed + 12, alpha: 0.8 });
  // ojo
  const eo = b.eyes ?? 1;
  const ex = 15 + (b.look || 0) * 1.5, ey = -11;
  if (mood === 'happy' && eo > 0.5) {
    D.stroke([[ex - 4.5, ey + 1], [ex, ey - 3], [ex + 4.5, ey + 1]], '#140f0e', 2, { seed: seed + 13 });
  } else if (eo > 0.2) {
    const er = b.cub ? 5 : 3.8;
    D.shape(ellipsePts(ex, ey, er, er * 1.1 * eo, 12), '#140f0e', { seed: seed + 13, edge: 1, dense: true });
    D.shape(ellipsePts(ex - er * 0.35, ey - er * 0.45, er * 0.36, er * 0.36, 6), '#ffffff', { seed: seed + 14, edge: 0, baseAlpha: 0.95 });
    if (mood === 'sad') D.stroke([[ex - 5, ey - 7], [ex + 4, ey - 9.5]], '#140f0e', 1.5, { seed: seed + 21, alpha: 0.8 });
  } else {
    D.stroke([[ex - 4, ey + 1], [ex, ey + 3], [ex + 4, ey + 1]], '#140f0e', 1.8, { seed: seed + 13 });
  }
  D.restore();
  D.restore();
}
