// Geografía del mundo (vista lateral). La quebrada corre de izquierda a derecha y baja:
// páramo → bosque de niebla (cascadas) → potrero talado → bosque → valle con el pueblo.
// Unidades ≈ centímetros. Z = 0 es el cauce; Z > 0 hacia el fondo.
import { clamp, lerp, noise1, fbm2, mulberry32 } from '../core/math.js';

export const ZONE = {
  paramo: [-4000, 1500],
  forestA: [1500, 4200],
  gap: [4200, 6200],
  forestB: [6200, 7700],
  valley: [7700, 20000],
};

const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };

// cascadas: [x, caída, ancho]
export const FALLS = [
  [1900, 150, 40], [2350, 120, 34], [2850, 190, 42], [3330, 140, 36], [3800, 170, 40],
  [6600, 130, 34], [7000, 150, 36], [7400, 120, 34],
];

// cota del lecho de la quebrada (sharp=false: versión suavizada para las laderas)
export function bed(x, sharp = true) {
  // pendiente suave de fondo
  // pendiente por tramos (integrada, sin saltos)
  const segs = [[-1e9, 0.04], [4200, 0.02], [6200, 0.04], [7700, 0.02], [9200, 0]];
  let y = 2450;
  for (let i = 0; i < segs.length; i++) {
    const a = Math.max(segs[i][0], i === 0 ? 0 : segs[i][0]), b = i + 1 < segs.length ? segs[i + 1][0] : 1e9;
    const lo = i === 0 ? 0 : a;
    if (x > lo) y -= (Math.min(x, b) - lo) * segs[i][1];
    else if (i === 0) y -= (x - 0) * segs[0][1];
  }
  for (const [fx, h, w] of FALLS) y -= h * smooth((x - fx) / (sharp ? w : 700) + 0.5);
  // ondulación leve (pozos)
  if (sharp) y += 6 * noise1(x / 160, 3);
  return y - 1900; // valle ≈ 0
}

// eje de la quebrada en Z (meandros)
export function streamZ(x) {
  return 70 * Math.sin(x / 820 + 0.6) + 35 * Math.sin(x / 290 + 2.1);
}
export const STREAM_W = 110;

// laderas: detrás (dz>0) sube hacia la montaña; delante sube poco. El páramo es una meseta.
function side(dz, x) {
  const k = x < 1300 ? 0.3 : x < 2100 ? lerp(0.3, 1, (x - 1300) / 800) : 1;
  if (dz > 0) return 18 + (0.06 * dz + 0.000018 * dz * dz) * k;
  const a = -dz;
  return 14 + 0.07 * a + 0.00002 * a * a;
}

export function ground(x, z) {
  const zs = streamZ(x);
  const dz = z - zs;
  const b = bed(x);
  const half = STREAM_W / 2;
  let y;
  if (Math.abs(dz) < half) y = b - 8 * (1 - (dz / half) ** 2);
  else {
    const e = Math.abs(dz) - half;
    // junto al cauce manda el lecho (con sus saltos); más lejos, la ladera suave
    const bs = bed(x, false);
    const base = lerp(b, bs, smooth(e / 320));
    y = base + side(Math.sign(dz) * e, x) * smooth(e / 50);
    // orillas rocosas: bordes algo más altos que el agua en las cascadas
    y = Math.max(y, b + 10 * smooth(e / 20));
  }
  // colinas suaves lejos del cauce
  const far = clamp((dz - 300) / 1800) * (x < 1300 ? 0.5 : 1);
  if (far > 0) y += 200 * far * fbm2(x / 1400, z / 1400, 5, 3);
  return y;
}

// el borde del bosque B sube en diagonal por la ladera: en lo alto hay un fragmento
// de bosque más cerca (allí espera la osa)
export function gapEnd(off) {
  return ZONE.gap[1] - clamp((off - 150) * 2.0, 0, 1300);
}
export function zoneOf(x, z = 0) {
  const off = z - streamZ(x);
  const xx = x + 220 * noise1(z / 700 + x / 3000, 9) + 90 * noise1(z / 170, 10);
  if (xx < ZONE.paramo[1]) return 'paramo';
  if (xx < ZONE.forestA[1]) return 'forestA';
  if (xx < gapEnd(off)) return 'gap';
  if (xx < ZONE.forestB[1] + (off > 150 ? 400 : 0)) return 'forestB';
  return 'valley';
}

// muestreo determinista tipo Poisson (rejilla con jitter)
export function scatter(seed, x0, x1, z0, z1, cell, keep = () => true) {
  const r = mulberry32(seed);
  const out = [];
  for (let z = z0; z < z1; z += cell) {
    for (let x = x0; x < x1; x += cell) {
      const px = x + r() * cell, pz = z + r() * cell;
      const extra = r();
      if (keep(px, pz, extra)) out.push({ x: px, z: pz, r: extra, seed: Math.floor(r() * 1e6) });
    }
  }
  return out;
}

export { smooth };
