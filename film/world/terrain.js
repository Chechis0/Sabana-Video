// Suelo: cortes del terreno paralelos al cauce (como capas de papel recortado),
// coloreados por zona; mechones de pasto en el borde de cada corte.
import { W, H } from '../timeline.js';
import { clamp, lerp, mix, shade, noise1, hrand, mulberry32 } from '../core/math.js';
import { ground, streamZ, zoneOf, STREAM_W, bed } from './geo.js';
import { ellipsePts } from '../core/pencil.js';

const HALF = STREAM_W / 2;
// desplazamientos fijos respecto al cauce (estables cuadro a cuadro)
export const BEHIND = [8, 22, 42, 70, 105, 150, 205, 270, 350, 450, 570, 720, 900, 1120, 1400, 1750, 2200, 2750, 3450, 4300].map((o) => HALF + o);
export const FRONT = [10, 30, 60, 100, 150, 220, 310, 420, 560, 740, 980].map((o) => -HALF - o);

// colores del suelo por zona (el potrero cambia con la restauración: env.green 0..1)
export function groundColor(zone, env, off) {
  const far = clamp((off - 600) / 3000);
  switch (zone) {
    case 'paramo': return mix(mix('#a99a55', '#8f8a50', far), env.paramoTint || '#a99a55', 0);
    case 'forestA': case 'forestB': return mix('#3f5f35', '#4f6e44', far);
    case 'gap': {
      const dry = mix('#c7a268', '#b89663', far);
      const green = mix('#7f9f4c', '#88a257', far);
      // el corredor sembrado (cerca del cauce) reverdece primero; la ladera sólo un poco
      const g = (env.green || 0) * (off < 900 && off > -700 ? 1 : 0.35);
      return mix(dry, green, g);
    }
    default: return mix('#95a656', '#8e9e5a', far);
  }
}

// color del pasto en el borde de cada corte
function grassColor(zone, env, off) {
  switch (zone) {
    case 'paramo': return '#cdb56a';
    case 'forestA': case 'forestB': return '#5f8a45';
    case 'gap': return mix('#d8b878', '#8fb657', (env.green || 0) * (off < 900 && off > -700 ? 1 : 0.35));
    default: return '#a8bf62';
  }
}

// copa continua del bosque lejano (festones de copas sobre la ladera)
const CANOPY_OFF = 1250;
function canopyH(x, off) {
  const w = 260 + 60 * noise1(off / 500, 4);
  const u = x / w + off * 0.37;
  const bump = Math.pow(Math.abs(Math.sin(Math.PI * u)), 0.45);
  return 650 + 260 * noise1(x / 900 + off, 6) + 170 * bump;
}

// dibuja un corte del terreno a un desplazamiento `off` del cauce; el corte llega
// hasta el borde del siguiente corte más cercano (nextOff), no hasta abajo de la pantalla
export function drawSlice(D, cam, env, off, idx, nextOff) {
  const zAt = (x) => streamZ(x) + off;
  const dMid = zAt(cam.x) - cam.z;
  if (dMid < cam.near + 5) return;
  // paso de muestreo fijo en el mundo (no "nada" al mover la cámara)
  let step = dMid < 300 ? 8 : dMid < 700 ? 16 : dMid < 1500 ? 32 : dMid < 3000 ? 64 : 128;
  const canopy = off > CANOPY_OFF;
  if (canopy) step = Math.min(step, 60);
  // rango de X cubierto: se calcula con la distancia mínima (el cauce serpentea)
  const [xa, xb] = cam.xRange(dMid + 140, 320);
  const x0 = Math.floor(xa / step) * step, x1 = Math.ceil(xb / step) * step;
  const top = [];
  const zMin = cam.z + cam.near + 20;
  for (let x = x0; x <= x1; x += step) {
    // si el corte pasa por detrás de la cámara, se adelanta al plano cercano (sin huecos)
    const z = Math.max(zAt(x), zMin);
    const zone = zoneOf(x, z);
    const gy = ground(x, z);
    const forest = canopy && (zone === 'forestA' || zone === 'forestB');
    const p = cam.project(x, gy + (forest ? canopyH(x, off) : 0), z);
    if (!p) continue;
    let by = H + 80;
    if (nextOff !== undefined) {
      const z2 = Math.max(streamZ(x) + nextOff, zMin);
      const q = cam.project(x, ground(x, z2), z2);
      if (q) by = Math.min(H + 80, Math.max(q[1], p[1]) + 50);
    }
    top.push({ x, sx: p[0], sy: p[1], s: p[2], zone: forest ? 'canopy' : zone, by });
  }
  if (top.length < 2) return;
  // tramos por zona
  const segs = [];
  let cur = null;
  for (let i = 0; i < top.length; i++) {
    const q = top[i];
    if (!cur || cur.zone !== q.zone) {
      if (cur) cur.pts.push(q); // solapa un punto para no dejar huecos
      cur = { zone: q.zone, pts: [] };
      segs.push(cur);
    }
    cur.pts.push(q);
  }
  const vary = ((idx * 7) % 5 - 2) * 0.035;
  for (const sg of segs) {
    if (sg.pts.length < 2) continue;
    const poly = sg.pts.map((q) => [q.sx, q.sy]);
    for (let i = sg.pts.length - 1; i >= 0; i--) poly.push([sg.pts[i].sx, sg.pts[i].by]);
    if (sg.zone === 'canopy') {
      D.shape(poly, shade('#2f5233', vary), { seed: 300 + idx * 13, smooth: true, edge: 3, angle: -0.62 + idx * 0.3, jitter: 0.5, knock: true, baseAlpha: 0.5 });
      // luces en las copas del lado del sol
      const L = env.light ?? -1;
      const caps = [];
      for (let i = 1; i < sg.pts.length - 1; i++) {
        const q = sg.pts[i], a = sg.pts[i - 1], b = sg.pts[i + 1];
        if (q.sy <= a.sy && q.sy <= b.sy) {
          const r = Math.max(4, (b.sx - a.sx) * 1.1);
          caps.push(ellipsePts(q.sx + L * r * 0.25, q.sy + r * 0.55, r, r * 0.55, 10, 0, 0.2, i));
        }
      }
      if (caps.length) D.multi(caps, '#5d8a4c', { seed: 330 + idx, edge: 0, base: false, alpha: 0.75, angle: -1.05 });
      continue;
    }
    const col = shade(groundColor(sg.zone, env, off), vary);
    D.shape(poly, col, { seed: 300 + idx * 13 + (sg.zone.length * 3), smooth: true, edge: 3, angle: [-0.2, 0.3, -0.62][idx % 3], jitter: 0.6, still: false, knock: true, rimAlpha: 0.5, baseAlpha: 0.5 });
  }
  // mechones de pasto sobre el borde (sólo en cortes cercanos)
  if (dMid < 2600) {
    const r0 = Math.floor(x0 / 60);
    for (let k = r0; k * 60 <= x1; k++) {
      const hx = k * 60 + hrand(k, off) * 60;
      const z = zAt(hx);
      const zone = zoneOf(hx, z);
      if (zone === 'forestA' || zone === 'forestB') { if (hrand(k, off, 2) < 0.5) continue; }
      const p = cam.project(hx, ground(hx, z), z);
      if (!p || p[0] < -40 || p[0] > W + 40) continue;
      const s = p[2];
      const hgt = (zone === 'paramo' ? 34 : zone === 'gap' ? 18 + 12 * (env.green || 0) : 22) * (0.6 + hrand(k, off, 3) * 0.8) * s;
      if (hgt < 2.5) continue;
      const gc = grassColor(zone, env, off);
      D.save();
      D.translate(p[0], p[1] + 2);
      const n = hgt > 14 ? 5 : 3;
      for (let b = 0; b < n; b++) {
        const a = -Math.PI / 2 + (b - (n - 1) / 2) * 0.28 + 0.12 * noise1(D.t * 0.8 + k * 0.3, b);
        const L = hgt * (0.7 + 0.3 * hrand(k, b, off));
        D.stroke([[0 + (b - 2) * 1.5, 0], [Math.cos(a) * L * 0.5, Math.sin(a) * L * 0.55], [Math.cos(a) * L, Math.sin(a) * L]], shade(gc, (b % 2) * -0.15), Math.max(1.2, Math.min(3, s * 2.4)), { seed: k * 7 + b, alpha: 0.85 });
      }
      D.restore();
    }
  }
}

export function addTerrain(stage, cam, env) {
  // de lejos a cerca
  const all = BEHIND.slice().reverse().concat(FRONT);
  const vis = all.filter((off) => streamZ(cam.x) + off - cam.z >= cam.near + 5);
  vis.forEach((off, i) => {
    const d = streamZ(cam.x) + off - cam.z;
    const next = vis[i + 1];
    stage.add(d, (D) => drawSlice(D, cam, env, off, all.indexOf(off), next), { tag: 'slice' });
  });
}
