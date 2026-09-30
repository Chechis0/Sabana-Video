// Arma el escenario de un cuadro: cordilleras, terreno, quebrada y toda la vegetación.
import { clamp, ease, prog, hrand } from '../core/math.js';
import { streamZ, ground, zoneOf, bed } from './geo.js';
import { addRanges } from './sky.js';
import { addTerrain } from './terrain.js';
import { addStream } from './water.js';
import * as POP from './populate.js';
import { drawTree, drawFrailejon, drawTussock, drawFern, drawStump, drawFlower, drawRock } from './flora.js';
import { drawHouse, drawChurch } from './town.js';

// ¿está en pantalla? devuelve la proyección de la base
function projBase(cam, x, z, r, h) {
  const d = z - cam.z;
  if (d < cam.near + 5) return null;
  const P = cam.project(x, ground(x, z), z);
  if (!P) return null;
  const rs = r * P[2], hs = h * P[2];
  if (P[0] + rs < -60 || P[0] - rs > 1140 || P[1] + 40 < 0 || P[1] - hs > 1980) return null;
  return P;
}

export function addWorld(stage, cam, env, t, S = {}) {
  addRanges(stage, cam, env);
  addTerrain(stage, cam, env);
  addStream(stage, cam, env, t);
  const light = env.light ?? -1;
  // frailejones
  for (const f of POP.frailejones) {
    const P = projBase(cam, f.x, f.z, 160 * f.h, 330 * f.h);
    if (!P) continue;
    if (S.hideHero && f === POP.HERO) continue;
    const o = f.hero ? { light, backlight: env.backlight ?? 0, sway: 0, dew: S.dew ?? 0 } : { light, backlight: env.backlight ?? 0 };
    stage.addAt(f.x, f.z, (D) => drawFrailejon(D, f, P, t, o), { tag: 'frailejon' });
  }
  for (const p of POP.tussocks) {
    const P = projBase(cam, p.x, p.z, 50, 70);
    if (!P || P[2] * 60 < 3) continue;
    stage.addAt(p.x, p.z, (D) => drawTussock(D, P, p.seed, t, '#c4ab60', 50 + p.r * 40), { tag: 'tussock' });
  }
  // árboles de los bosques
  const trees = POP.treesA.concat(POP.treesB, POP.loneTrees, POP.valleyTrees, S.planted || []);
  for (const tr of trees) {
    const P = projBase(cam, tr.x, tr.z, 700, 1600);
    if (!P) continue;
    const g = tr.g ? tr.g(t) : 1;
    if (g <= 0) continue;
    if (tr.g && g > 0.3 && tr.z - cam.z < 520 && Math.abs(P[0] - 540) < 520) continue;
    stage.addAt(tr.x, tr.z, (D) => drawTree(D, tr, P, t, { light, g, moss: tr.x < 6600 }), { tag: 'tree' });
  }
  for (const p of POP.ferns) {
    const P = projBase(cam, p.x, p.z, 120, 120);
    if (!P || P[2] * 100 < 6) continue;
    stage.addAt(p.x, p.z, (D) => drawFern(D, P, p.seed, t, p.r < 0.4 ? '#4f8a3e' : '#5f9a48', 0.7 + p.r * 0.6), { tag: 'fern' });
  }
  for (const p of POP.nearBank) {
    const P = projBase(cam, p.x, p.z, 80, 60);
    if (!P || P[2] * 60 < 6) continue;
    if (p.rock) stage.addAt(p.x, p.z, (D) => drawRock(D, P, p.seed, 0.45 + p.r, '#7c7a66'), { tag: 'rock' });
    else stage.addAt(p.x, p.z, (D) => drawFern(D, P, p.seed, t, p.r < 0.4 ? '#4a7f3a' : '#5a9046', 0.35 + p.r * 0.35), { tag: 'fern' });
  }
  for (const p of POP.stumps) {
    const P = projBase(cam, p.x, p.z, 60, 60);
    if (!P) continue;
    stage.addAt(p.x, p.z, (D) => drawStump(D, P, p.seed, p.sc), { tag: 'stump' });
  }
  for (const p of POP.dryTufts) {
    const P = projBase(cam, p.x, p.z, 40, 40);
    if (!P || P[2] * 40 < 3) continue;
    const green = env.green || 0;
    stage.addAt(p.x, p.z, (D) => drawTussock(D, P, p.seed, t, green > 0.5 ? '#86ad52' : '#cfae70', 30 + p.r * 20), { tag: 'tuft' });
  }
  for (const p of POP.rocks) {
    const P = projBase(cam, p.x, p.z, 50, 40);
    if (!P) continue;
    stage.addAt(p.x, p.z, (D) => drawRock(D, P, p.seed, 0.6 + p.r), { tag: 'rock' });
  }
  for (const h of POP.houses) {
    const P = projBase(cam, h.x, h.z, 300, 260);
    if (!P) continue;
    stage.addAt(h.x, h.z, (D) => drawHouse(D, P, h.seed, t, { w: h.w }), { tag: 'house' });
  }
  {
    const c = POP.church;
    const P = projBase(cam, c.x, c.z, 300, 600);
    if (P) stage.addAt(c.x, c.z, (D) => drawChurch(D, P, c.seed, t), { tag: 'house' });
  }
  for (const p of POP.flowers) {
    const P = projBase(cam, p.x, p.z, 10, 30);
    if (!P || P[2] * 26 < 3) continue;
    const zn = zoneOf(p.x, p.z);
    if (zn === 'gap' && (env.green || 0) < 0.6) continue;
    stage.addAt(p.x, p.z, (D) => drawFlower(D, P, p.seed, p.col, t), { tag: 'flower' });
  }
}
