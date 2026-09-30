// Siembra del mundo: dónde está cada frailejón, árbol, helecho, tocón, roca y flor.
// Todo es determinista (semillas fijas).
import { clamp, hrand, mulberry32 } from '../core/math.js';
import { ZONE, streamZ, ground, zoneOf, scatter, STREAM_W, bed } from './geo.js';

const HALF = STREAM_W / 2;
const nearStream = (x, z, m) => Math.abs(z - streamZ(x)) < HALF + m;

// ---------------------------------------------------------------- páramo
export const HERO = { x: 640, z: streamZ(640) + 70, h: 1.25, seed: 11, flowers: true, tip: { a: 0.2, len: 118 }, hero: true };
export const frailejones = (() => {
  const out = [HERO];
  for (const p of scatter(101, -2500, 2950, -900, 6000, 190, (x, z, r) => zoneOf(x, z) === 'paramo' && !nearStream(x, z, 40) && r < 0.62)) {
    if (Math.hypot(p.x - HERO.x, (p.z - HERO.z) * 0.6) < 300) continue;
    // la cámara macro está delante del protagonista: nada entre ella y la hoja
    if (p.z < HERO.z + 60 && Math.abs(p.x - HERO.x) < 700) continue;
    out.push({ x: p.x, z: p.z, h: 0.7 + p.r * 0.7, seed: p.seed % 997, flowers: p.r < 0.35 });
  }
  return out;
})();
export const tussocks = scatter(102, -2500, 3000, -900, 5000, 110, (x, z, r) => zoneOf(x, z) === 'paramo' && !nearStream(x, z, 20) && r < 0.8);

// ---------------------------------------------------------------- bosques
const KINDS_A = ['encenillo', 'roble', 'encenillo', 'cucharo', 'aliso', 'roble', 'yarumo', 'helecho', 'helecho', 'siete'];
const KINDS_B = ['roble', 'aliso', 'encenillo', 'siete', 'yarumo', 'cucharo', 'helecho'];
function forest(seed, zone, kinds, cell) {
  const out = [];
  for (const p of scatter(seed, ZONE[zone][0] - 400, ZONE[zone][1] + 400, -700, 6000, cell, (x, z, r) => zoneOf(x, z) === zone && !nearStream(x, z, 70))) {
    // lejos: la copa continua del bosque (en el terreno) reemplaza los árboles sueltos
    const off = p.z - streamZ(p.x);
    if (off > 2300 || (off > 1250 && p.r > 0.25)) continue;
    // delante del cauce: pocos árboles (para no tapar la acción) y helechos
    const front = p.z < streamZ(p.x);
    if (front && p.r > 0.35) continue;
    const kind = front && p.r < 0.25 ? 'helecho' : kinds[Math.floor(hrand(p.seed) * kinds.length)];
    out.push({ x: p.x, z: p.z, kind, seed: p.seed % 100000 });
  }
  return out;
}
export const treesA = forest(201, 'forestA', KINDS_A, 230);
export const treesB = forest(202, 'forestB', KINDS_B, 250).concat(
  // fragmento de bosque en lo alto de la ladera (refugio de la osa)
  scatter(204, 4700, 6300, 0, 3000, 230, (x, z, r) => zoneOf(x, z) === 'forestB' && z - streamZ(x) > 700 && r < 0.8)
    .map((p) => ({ x: p.x, z: p.z, kind: KINDS_B[Math.floor(hrand(p.seed) * KINDS_B.length)], seed: p.seed % 100000 })),
);

// árboles sueltos que sobrevivieron en el potrero (pocos, lejos)
export const loneTrees = [
  { x: 7900, z: 2600, kind: 'roble', seed: 5501 },
  { x: 8500, z: 3500, kind: 'aliso', seed: 5502 },
];

// ---------------------------------------------------------------- potrero talado
export const stumps = scatter(301, ZONE.gap[0] - 200, ZONE.gap[1] + 100, -500, 2600, 210, (x, z, r) => zoneOf(x, z) === 'gap' && !nearStream(x, z, 40) && r < 0.5)
  .map((p) => ({ ...p, sc: 0.8 + p.r * 0.8 }));
export const dryTufts = scatter(302, ZONE.gap[0], ZONE.gap[1], -600, 3000, 120, (x, z, r) => zoneOf(x, z) === 'gap' && !nearStream(x, z, 20) && r < 0.7);

// ---------------------------------------------------------------- sotobosque
// helechos: detrás del cauce muchos; delante sólo algunos lejos del borde (no tapan la acción)
export const ferns = scatter(401, ZONE.forestA[0], ZONE.forestB[1], -650, 900, 120, (x, z, r) => {
  const zn = zoneOf(x, z);
  const off = z - streamZ(x);
  if (off < 0 && (off > -HALF - 200 || r > 0.3)) return false;
  return (zn === 'forestA' || zn === 'forestB') && !nearStream(x, z, 25) && r < 0.75;
});
export const rocks = scatter(402, -2000, 15000, -500, 600, 260, (x, z, r) => !nearStream(x, z, 8) && r < 0.35 && Math.abs(z - streamZ(x)) < HALF + 160);
export const flowers = scatter(403, -2000, 15000, -600, 1200, 90, (x, z, r) => {
  const zn = zoneOf(x, z);
  return !nearStream(x, z, 15) && r < (zn === 'paramo' ? 0.35 : zn === 'valley' ? 0.3 : 0.12);
}).map((p) => ({ ...p, col: ['#e8d24a', '#d9584a', '#f2f0e6', '#9b6ac7', '#ef8fb0'][Math.floor(p.r * 50) % 5] }));

// ---------------------------------------------------------------- pueblo
export const houses = (() => {
  const out = [];
  const r = mulberry32(501);
  for (let k = 0; k < 16; k++) {
    const x = 8250 + k * 190 + r() * 80;
    const off = (k % 3 === 0 ? -1 : 1) * (HALF + 260 + r() * 900);
    if (off < 0 && x < 9200) continue; // la cámara pasa por delante del río: sin casas que tapen
    out.push({ x, z: streamZ(x) + off, seed: 600 + k, w: 180 + r() * 100 });
  }
  return out;
})();
export const church = { x: 9350, z: streamZ(9350) + 900, seed: 650 };
export const valleyTrees = scatter(503, 7700, 11500, -600, 3000, 330, (x, z, r) => !nearStream(x, z, 90) && r < 0.3)
  .map((p) => ({ x: p.x, z: p.z, kind: ['aliso', 'roble', 'siete'][Math.floor(p.r * 30) % 3], seed: p.seed % 100000 }))
  .filter((p) => !houses.some((h) => Math.abs(h.x - p.x) < 200 && Math.abs(h.z - p.z) < 200) && !(Math.abs(p.x - 8620) < 400 && p.z < streamZ(p.x)));

// orilla cercana del bosque: rocas con musgo y helechos bajos (primer plano, sin tapar el agua)
export const nearBank = scatter(405, ZONE.forestA[0], ZONE.forestB[1], -420, -40, 70, (x, z, r) => {
  const zn = zoneOf(x, z);
  const off = z - streamZ(x);
  return (zn === 'forestA' || zn === 'forestB') && off < -HALF - 25 && off > -HALF - 330 && r < 0.55;
}).map((p) => ({ ...p, rock: p.r < 0.2 }));
