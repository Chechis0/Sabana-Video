// Geografía del mundo: una sola pintura vertical (como un rollo de paisaje).
// Arriba el cielo y el páramo, luego el bosque, el potrero fragmentado y abajo la sabana con el pueblo.
// Vista completa, la red de quebradas + corredores forma un árbol: copa, tronco y raíces.
import { catmull, Polyline, noise1, mulberry32, hrand, clamp, lerp } from '../core/math.js';
import { T, plantTimes } from '../timeline.js';

export const WORLD = { x0: 0, x1: 3040, y0: -760, y1: 5200 };
export const CENTER_X = 1520;

export function ridgeY(x) {
  return 470 + 0.00024 * (x - 1520) ** 2 + 30 * noise1(x / 150, 3) + 12 * noise1(x / 46, 4);
}
// medio ancho de la "isla" de paisaje sobre el papel (bordes orgánicos, esquinas suaves)
export function halfW(y, side = 1) {
  const k = clamp((y - 860) / 760);
  const top = 1 - k * k * (3 - 2 * k);
  return 1450 - 190 * top + 40 * noise1(y / 260, side > 0 ? 21 : 24) + 14 * noise1(y / 70, side > 0 ? 25 : 26);
}
export const insideLand = (x, y, pad = 0) => Math.abs(x - 1520) < halfW(y, x > 1520 ? 1 : -1) - pad;
export function paramoBottom(x) {
  return ridgeY(x) + 540 + 70 * noise1(x / 240, 5);
}

// ---------- red hídrica ----------
function edge(name, ctrl, w0, w1, o = {}) {
  const pts = catmull(ctrl, 12);
  return { name, ctrl, pts, poly: new Polyline(pts), w0, w1, ...o };
}

export const rivers = {
  L1: edge('L1', [[1180, 965], [1192, 1070], [1158, 1215], [1212, 1380], [1172, 1545], [1224, 1720], [1196, 1880], [1172, 2040], [1150, 2180]], 7, 24, { hero: true }),
  L2: edge('L2', [[430, 1250], [560, 1430], [740, 1640], [940, 1930], [1150, 2180]], 6, 20),
  L: edge('L', [[1150, 2180], [1280, 2350], [1410, 2500], [1520, 2640]], 28, 36),
  C: edge('C', [[1600, 760], [1575, 1000], [1625, 1260], [1565, 1560], [1605, 1860], [1545, 2250], [1520, 2640]], 6, 26),
  R1: edge('R1', [[1900, 930], [1880, 1150], [1940, 1400], [1900, 1650], [1960, 1880], [1930, 2070]], 6, 20),
  R2: edge('R2', [[2620, 1250], [2480, 1450], [2320, 1650], [2120, 1870], [1930, 2070]], 6, 20),
  R: edge('R', [[1930, 2070], [1800, 2290], [1650, 2470], [1520, 2640]], 28, 36),
  T0: edge('T0', [[1520, 2640], [1548, 2850], [1494, 3080], [1552, 3330], [1500, 3580], [1525, 3800]], 46, 56),
  tw1: edge('tw1', [[330, 1700], [520, 1745], [740, 1640]], 4, 8),
  tw2: edge('tw2', [[880, 1320], [1010, 1440], [1172, 1545]], 4, 8),
  tw3: edge('tw3', [[2260, 1090], [2090, 1290], [1940, 1400]], 4, 8),
  tw4: edge('tw4', [[2730, 1980], [2480, 2060], [2200, 2090], [1930, 2070]], 4, 10),
  tw5: edge('tw5', [[360, 2140], [640, 2120], [900, 2110], [1150, 2180]], 4, 10),
  RL: edge('RL', [[1525, 3800], [1400, 3960], [1250, 4120], [1050, 4300], [820, 4470], [600, 4600]], 30, 9, { root: true }),
  RLm: edge('RLm', [[1525, 3800], [1470, 4000], [1395, 4190], [1330, 4400], [1290, 4650]], 28, 9, { root: true }),
  RRm: edge('RRm', [[1525, 3800], [1590, 4000], [1680, 4220], [1760, 4440], [1800, 4660]], 28, 9, { root: true }),
  RR: edge('RR', [[1525, 3800], [1680, 3950], [1880, 4100], [2120, 4270], [2420, 4460]], 30, 9, { root: true }),
};
export const riverList = Object.values(rivers);

// La quebrada de la gota: tramo seco (potrero) en L1
export const GAP = { y0: 1590, y1: 2070 };
export const L1 = rivers.L1.poly;
export const sGap0 = L1.sAtY(GAP.y0);
export const sGap1 = L1.sAtY(GAP.y1);
export const sStuck = L1.sAtY(1742);
export const sFront0 = L1.sAtY(1800); // hasta dónde llega el hilito de agua al comienzo

// Camino completo de la gota: L1 → L → T0 → RLm
function concat(...edges) {
  const out = [];
  for (const e of edges) for (const p of e.pts) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 0.5) out.push(p);
  }
  return out;
}
export const dropPath = new Polyline(concat(rivers.L1, rivers.L, rivers.T0, rivers.RLm));
export const sPathGardenJump = dropPath.sAtY(4270);

// ---------- lugares clave ----------
export const PLACES = {
  hero: [1146, 812], // frailejón protagonista (base del tronco)
  birth: [1214, 657], // punta de hoja donde se condensa la gota
  moss: [1196, 880],
  pool: [1180, 962],
  bearA: [1300, 1405], // oso bebiendo
  bearEdge: [1010, 1445],
  bearB: [1318, 2118],
  meet: [1228, 2094],
  garden: [1236, 4318],
  kid: [1188, 4304],
  sprout: [1246, 4312],
  town: [1600, 4360],
};

// ---------- utilidades espaciales ----------
const riverSamples = [];
for (const e of riverList) {
  const n = e.pts.length;
  e.pts.forEach((p, i) => riverSamples.push([p[0], p[1], lerp(e.w0, e.w1, i / (n - 1)) / 2]));
}
export function distToRiver(x, y) {
  let best = Infinity;
  for (const [rx, ry, hw] of riverSamples) {
    const d = Math.hypot(rx - x, ry - y) - hw;
    if (d < best) best = d;
  }
  return best;
}
export function riverWidthAt(e, s) {
  return lerp(e.w0, e.w1, s / e.poly.length);
}

// ---------- municipios (20 puntos de siembra en la revelación final) ----------
export const MUNIS = [
  [560, 1480], [880, 1780], [1320, 1300], [1820, 1250], [2300, 1450], [2560, 1700], [2120, 1980], [760, 2050],
  [1600, 1840], [1400, 2400], [1700, 2400], [1500, 2980], [1560, 3420], [1180, 4020], [1880, 4060], [880, 4380],
  [2240, 4300], [460, 1880], [2700, 2100], [1980, 1580],
].map(([x, y], i) => ({ x, y, t: T.leafOut[0] + 0.15 + i * 0.1 }));

function muniTime(x, y) {
  let best = Infinity;
  for (const m of MUNIS) {
    const tt = m.t + Math.hypot(m.x - x, m.y - y) / 1500;
    if (tt < best) best = tt;
  }
  return best;
}

// ---------- coberturas de bosque (celdas circulares que se unen) ----------
// t0 < 0 : existe desde el inicio. Si no, aparece en t0 durante `dur` s.
export const forestCells = [];
const rng = mulberry32(20240921);

function inGap(e, y) {
  const gaps = {
    L1: [[GAP.y0, GAP.y1]],
    L2: [[1470, 1820]],
    C: [[1640, 2170]],
    R1: [[1340, 1700]],
    R2: [[1480, 1760]],
    tw1: [[0, 9999]],
    tw4: [[2000, 2100]],
    T0: [[2860, 3520]],
  };
  const g = gaps[e.name];
  if (e.root) return true;
  if (!g) return false;
  return g.some(([a, b]) => y >= a && y <= b);
}

// tiempos de siembra en el corredor (L1): cada plántula tiene su lugar
export const plantings = plantTimes.map((t, i) => {
  const s = lerp(sGap0 + 20, sGap1 - 30, i / (plantTimes.length - 1));
  const p = L1.at(s);
  const side = i % 2 === 0 ? -1 : 1;
  const d = 108 + (i % 3) * 14;
  const kinds = ['roble', 'aliso', 'siete', 'encenillo', 'roble', 'siete', 'aliso', 'encenillo', 'roble', 'siete', 'aliso', 'roble'];
  return { t, x: p.x + p.nx * d * side, y: p.y + p.ny * d * side, side, kind: kinds[i], i, seed: 900 + i };
});

// la plántula que la niña deja junto a la gota (escena 4) es la siembra #4
{
  const p = L1.at(sStuck);
  // queda un poco detrás de la gota: al crecer le da sombra sin taparla
  plantings[4].x = p.x - p.nx * 46;
  plantings[4].y = p.y - 14;
  plantings[4].kind = 'siete';
}

function addBand(e, step, dmin, dmax, rmin, rmax) {
  const L = e.poly.length;
  for (let s = 0; s < L; s += step) {
    const p = e.poly.at(s);
    if (p.y < paramoBottom(p.x) + 30) continue;
    if (e.name === 'L1' && p.y < 1090) continue;
    for (const side of [-1, 0, 1]) {
      if (side === 0 && (e.root || rng() < 0.3)) continue;
      const d = side === 0 ? 0 : lerp(dmin, dmax, rng());
      const r = side === 0 ? rmin * 0.9 : lerp(rmin, rmax, rng());
      const x = p.x + p.nx * d * side, y = p.y + p.ny * d * side;
      let t0 = -1, dur = 1;
      if (inGap(e, p.y)) {
        if (e.name === 'L1') {
          // el corredor reverdece siguiendo la siembra
          let near = plantings[0], bd = Infinity;
          for (const pl of plantings) { const dd = Math.hypot(pl.x - x, pl.y - y); if (dd < bd) { bd = dd; near = pl; } }
          t0 = near.t + 0.9 + rng() * 0.8; dur = 2.6;
        } else {
          t0 = muniTime(x, y); dur = 0.9;
        }
      }
      forestCells.push({ x, y, r, t0, dur, band: e.name, root: !!e.root });
    }
  }
}
for (const e of riverList) {
  if (e.root) addBand(e, 70, 20, 90, 40, 70);
  else if (e.name.startsWith('tw')) addBand(e, 70, 20, 110, 55, 90);
  else if (e.name === 'T0') addBand(e, 60, 40, 150, 70, 120);
  else addBand(e, 58, 30, 170, 70, 125);
}

// Copa: elipse grande que se llena al final (más algunos parches remanentes desde el inicio)
export const CROWN = { cx: 1520, cy: 1760, rx: 1270, ry: 930 };
export function inCrown(x, y, pad = 0) {
  const u = (x - CROWN.cx) / (CROWN.rx + pad), v = (y - CROWN.cy) / (CROWN.ry + pad);
  return u * u + v * v < 1 && y > paramoBottom(x) - 10 && y < 2650;
}
const remnants = [[700, 1560, 170], [2300, 1330, 150], [1850, 1780, 150], [980, 2260, 140], [2150, 2250, 130], [1380, 1180, 140], [1750, 1100, 150], [2520, 1560, 110], [560, 1760, 110]];
for (const [x, y, r] of remnants) {
  for (let k = 0; k < 6; k++) {
    const a = rng() * Math.PI * 2, d = rng() * r * 0.7;
    forestCells.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.8, r: r * (0.45 + rng() * 0.35), t0: -1, dur: 1, band: 'remnant' });
  }
}
for (let y = CROWN.cy - CROWN.ry; y < 2700; y += 120) {
  for (let x = CROWN.cx - CROWN.rx; x < CROWN.cx + CROWN.rx; x += 130) {
    const jx = x + (rng() - 0.5) * 70, jy = y + (rng() - 0.5) * 70;
    if (!inCrown(jx, jy, 30)) continue;
    // no taparle el potrero de la gota antes de tiempo
    if (Math.abs(jx - 1190) < 260 && jy > GAP.y0 - 40 && jy < GAP.y1 + 40) continue;
    forestCells.push({ x: jx, y: jy, r: 105 + rng() * 45, t0: muniTime(jx, jy), dur: 0.9, band: 'crown' });
  }
}
// tronco: banda ancha a lo largo de T0 al final
for (let s = 0; s < rivers.T0.poly.length; s += 70) {
  const p = rivers.T0.poly.at(s);
  for (const side of [-1, 1]) {
    const d = 140 + rng() * 90;
    const x = p.x + p.nx * d * side, y = p.y + p.ny * d * side;
    forestCells.push({ x, y, r: 90 + rng() * 40, t0: muniTime(x, y), dur: 0.9, band: 'trunk' });
  }
}

export function cellRadius(c, t) {
  if (c.t0 < 0) return c.r;
  const k = clamp((t - c.t0) / c.dur);
  if (k <= 0) return 0;
  // crece con un pequeño rebote
  const e = 1 - Math.pow(1 - k, 3);
  return c.r * (e + 0.08 * Math.sin(k * Math.PI));
}

// ---------- árboles (íconos de pie) ----------
// la copa (que se dibuja "de pie", hacia arriba) no debe tapar el agua
function crownHidesRiver(x, y, size) {
  const H = 190 * size, rx = 62 * size;
  for (let yy = y - H; yy <= y - 20; yy += 22) {
    for (const xx of [x - rx, x - rx / 2, x, x + rx / 2, x + rx]) {
      if (distToRiver(xx, yy) < 16) return true;
    }
  }
  return false;
}
// claros donde actúan los personajes (las copas no los tapan)
function hidesStage(x, y, size) {
  const spots = [PLACES.bearA, PLACES.bearEdge, PLACES.bearB, PLACES.meet, [PLACES.meet[0] + 72, PLACES.meet[1]]];
  for (const [sx, sy] of spots) {
    if (Math.abs(x - sx) < 120 && y > sy - 40 && y < sy + 230 * size) return true;
  }
  return false;
}
export const trees = [];
const TREE_KINDS = ['roble', 'aliso', 'siete', 'encenillo', 'roble', 'cucharo'];
const treeGrid = new Map();
function farFromTrees(x, y, dmin) {
  const gx = Math.floor(x / 100), gy = Math.floor(y / 100);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const b = treeGrid.get((gx + i) + ',' + (gy + j));
    if (b) for (const t of b) if (Math.hypot(t.x - x, (t.y - y) * 1.4) < dmin) return false;
  }
  return true;
}
function addTree(tr) {
  trees.push(tr);
  const k = Math.floor(tr.x / 100) + ',' + Math.floor(tr.y / 100);
  if (!treeGrid.has(k)) treeGrid.set(k, []);
  treeGrid.get(k).push(tr);
}
for (const c of forestCells) {
  const n = c.band === 'crown' ? 3 : c.band === 'trunk' ? 2 : c.band === 'remnant' ? 2 : c.root ? 1 : 2;
  for (let k = 0; k < n; k++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * c.r * 0.85;
    const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d * 0.8;
    if (distToRiver(x, y) < 30) continue;
    if (y < paramoBottom(x) + 40) continue;
    if (Math.hypot(x - PLACES.pool[0], y - PLACES.pool[1]) < 170) continue;
    if (c.band === 'L1' && y > GAP.y0 - 10 && y < GAP.y1) continue; // el corredor se siembra a mano
    const size = c.root ? 0.6 + rng() * 0.2 : 0.85 + rng() * 0.45;
    if (!farFromTrees(x, y, 62 * size)) continue;
    if (crownHidesRiver(x, y, size)) continue;
    if (hidesStage(x, y, size)) continue;
    const kind = TREE_KINDS[Math.floor(rng() * TREE_KINDS.length)];
    const t0 = c.t0 < 0 ? -1 : c.t0 + rng() * 0.35;
    addTree({ x, y, kind, size, seed: Math.floor(rng() * 1e6), t0, dur: c.t0 < 0 ? 1 : c.dur * 1.1 });
  }
}
// árboles del potrero de la gota que crecen después de la siembra (relleno natural, más pequeños)
for (let i = 0; i < 26; i++) {
  const s = lerp(sGap0, sGap1, rng());
  const p = L1.at(s);
  const side = rng() < 0.5 ? -1 : 1;
  const d = 150 + rng() * 170;
  const x = p.x + p.nx * d * side, y = p.y + p.ny * d * side;
  let near = plantings[0], bd = Infinity;
  for (const pl of plantings) { const dd = Math.hypot(pl.x - x, pl.y - y); if (dd < bd) { bd = dd; near = pl; } }
  if (!farFromTrees(x, y, 55)) continue;
  if (crownHidesRiver(x, y, 0.8)) continue;
  addTree({ x, y, kind: TREE_KINDS[i % TREE_KINDS.length], size: 0.65 + rng() * 0.35, seed: 5000 + i, t0: near.t + 1.6 + rng() * 1.8, dur: 2.4 });
}

// ---------- frailejones ----------
export const frailejones = [];
// grupo compuesto a mano para la escena del nacimiento
const HERO_GROUP = [
  [1146, 812, 1.5, true, 77], [1022, 722, 0.95, true, 78], [1296, 748, 1.12, false, 79], [1318, 930, 1.05, true, 80],
  [1015, 902, 1.18, false, 81], [1392, 640, 0.7, true, 82], [952, 618, 0.62, false, 83], [1235, 585, 0.55, true, 84],
  [1080, 560, 0.48, false, 85], [1450, 820, 0.9, false, 86], [930, 790, 0.8, true, 87],
];
for (const [x, y, h, fl, seed] of HERO_GROUP) frailejones.push({ x, y, h, seed, flowers: fl, hero: seed === 77, tip: seed === 77 ? PLACES.birth : null });
const nearHero = (x, y) => x > 880 && x < 1520 && y > 530 && y < 1060;
// siluetas pequeñas sobre la cresta
for (let x = 140; x < 2900; x += 30 + rng() * 40) {
  const y = ridgeY(x) + 14 + rng() * 40;
  if (!insideLand(x, y, 40)) continue;
  if (nearHero(x, y) && y > 560) continue;
  frailejones.push({ x, y, h: 0.3 + rng() * 0.22, seed: Math.floor(rng() * 1e6), flowers: rng() < 0.3 });
}
for (let y = 520; y < 1250; y += 95) {
  for (let x = 120; x < 2920; x += 120) {
    const jx = x + (rng() - 0.5) * 90, jy = y + (rng() - 0.5) * 60;
    if (jy < ridgeY(jx) + 60 || jy > paramoBottom(jx) - 20) continue;
    if (!insideLand(jx, jy, 50)) continue;
    if (distToRiver(jx, jy) < 30) continue;
    if (nearHero(jx, jy)) continue;
    if (rng() < 0.3) continue;
    frailejones.push({ x: jx, y: jy, h: 0.6 + rng() * 0.5, seed: Math.floor(rng() * 1e6), flowers: rng() < 0.4 });
  }
}

// ---------- tocones y pasto seco en los huecos ----------
export const stumps = [];
for (let i = 0; i < 16; i++) {
  const y = lerp(GAP.y0 + 30, GAP.y1 - 20, rng());
  const p = L1.at(L1.sAtY(y));
  const side = rng() < 0.5 ? -1 : 1;
  const d = 70 + rng() * 240;
  const x = p.x + p.nx * d * side, yy = p.y + p.ny * d * side;
  if (plantings.some((pl) => Math.hypot(pl.x - x, pl.y - yy) < 95)) continue;
  stumps.push({ x, y: yy, s: 0.7 + rng() * 0.5, seed: 300 + i });
}
for (let i = 0; i < 40; i++) {
  const x = 300 + rng() * 2440, y = 1200 + rng() * 2300;
  if (distToRiver(x, y) < 60) continue;
  const inAnyCell = forestCells.some((c) => c.t0 < 0 && Math.hypot(c.x - x, c.y - y) < c.r);
  if (inAnyCell) continue;
  if (y < paramoBottom(x) + 20) continue;
  stumps.push({ x, y, s: 0.6 + rng() * 0.4, seed: 400 + i });
}

// ---------- sabana: parcelas de cultivo ----------
export const fields = [];
{
  const cols = ['#c9c46c', '#a9bb62', '#d8c381', '#b6c77a', '#cdb46a', '#9fb468', '#dccd8d'];
  const angles = [-1.05, -0.2, 0.55, -1.4, 0.2];
  for (let y = 2700; y < 4900; y += 170) {
    for (let x = 180; x < 2900; x += 230) {
      const jx = x + (rng() - 0.5) * 60, jy = y + (rng() - 0.5) * 50;
      const w = 170 + rng() * 120, h = 110 + rng() * 90;
      const cx = jx + w / 2, cy = jy + h / 2;
      if (inCrown(cx, cy, 80)) continue;
      // el valle se desvanece en papel hacia abajo y a los lados
      const edgeFade = Math.hypot((cx - 1520) / 1400, (cy - 3900) / 1050);
      if (edgeFade > 1.02) continue;
      if (Math.abs(cx - PLACES.town[0]) < 330 && Math.abs(cy - PLACES.town[1]) < 170) continue;
      fields.push({ x: jx, y: jy, w, h, rot: (rng() - 0.5) * 0.25, color: cols[Math.floor(rng() * cols.length)], angle: angles[Math.floor(rng() * angles.length)], seed: Math.floor(rng() * 1e5) });
    }
  }
}

// ---------- pueblo ----------
export const houses = [];
{
  const [tx, ty] = PLACES.town;
  for (let i = 0; i < 34; i++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng());
    const x = tx + Math.cos(a) * d * 300, y = ty + Math.sin(a) * d * 140;
    if (distToRiver(x, y) < 45) continue;
    if (Math.hypot(x - tx, y - ty) < 70) continue; // plaza
    if (houses.some((h) => Math.abs(h.x - x) < 70 && Math.abs(h.y - y) < 40)) continue;
    houses.push({ x, y, w: 62 + rng() * 34, seed: 700 + i, roof: rng() < 0.8 ? '#c7643f' : '#b8553a' });
  }
  // fincas dispersas
  for (let i = 0; i < 16; i++) {
    const x = 350 + rng() * 2340, y = 2750 + rng() * 1900;
    if (inCrown(x, y, 60) || distToRiver(x, y) < 70) continue;
    const edgeFade = Math.hypot((x - 1520) / 1400, (y - 3900) / 1050);
    if (edgeFade > 0.95) continue;
    houses.push({ x, y, w: 55 + rng() * 20, seed: 800 + i, roof: '#c7643f' });
  }
}
export const church = { x: PLACES.town[0] + 10, y: PLACES.town[1] - 50 };

// nubes (en el cielo)
export const clouds = [
  { x: 820, y: 180, s: 1.2, seed: 1 }, { x: 2250, y: 110, s: 1.5, seed: 2 }, { x: 1580, y: -60, s: 1.1, seed: 3 },
  { x: 380, y: 360, s: 0.9, seed: 4 }, { x: 2700, y: 360, s: 0.9, seed: 5 },
];

// ---------- sotobosque (helechos, arbustos, flores) ----------
export const understory = [];
for (const c of forestCells) {
  if (c.root) continue;
  const n = c.band === 'L1' || c.band === 'L' ? 5 : 1;
  for (let k = 0; k < n; k++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * c.r * 0.9;
    const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d * 0.8;
    if (distToRiver(x, y) < 22) continue;
    if (y < paramoBottom(x) + 30) continue;
    const r = rng();
    const kind = r < 0.4 ? 'fern' : r < 0.7 ? 'bush' : 'flowers';
    understory.push({ x, y, kind, s: 0.7 + rng() * 0.6, seed: Math.floor(rng() * 1e6), t0: c.t0, dur: c.dur, cell: c });
  }
}
