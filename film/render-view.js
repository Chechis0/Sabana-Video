// Composición de un cuadro a partir de una cámara, un ambiente y el estado de la historia.
import { createCanvas } from '@napi-rs/canvas';
import { Pencil } from './core/pencil.js';
import { makePaper, makeTooth, makeVignette } from './core/paper.js';
import { W, H } from './timeline.js';
import { Stage } from './engine/stage.js';
import { godRays, bloom, grade, paperPass, glow } from './engine/post.js';
import { drawSky, drawSun, drawMoon, drawStars, drawRainbow } from './world/sky.js';
import { addWorld } from './world/world.js';
import { streamZ } from './world/geo.js';
import { gradeFilter } from './world/envs.js';

let assets = null;
export function initAssets() {
  if (!assets) assets = { paper: makePaper(W, H), tooth: makeTooth(W, H), vig: makeVignette(W, H) };
  return assets;
}

export function makeRenderer() {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const D = new Pencil(ctx, W, H);
  return { canvas, ctx, D };
}

// S: estado (personajes, siembra, etc.). extra(stage): añade objetos propios del plano.
export const PHASE = {};
const ph = (k, t0) => { PHASE[k] = (PHASE[k] || 0) + performance.now() - t0; return performance.now(); };
export function renderView(D, canvas, cam, env, t, frame, S = {}, extra = null, overlay = null) {
  const A = initAssets();
  let T0 = performance.now();
  const ctx = canvas.getContext('2d');
  D.setFrame(t, frame, { x: W / 2, y: H / 2, z: 1 }, 2);
  D.ctx = ctx;
  D.mainCtx = ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.drawImage(A.paper, 0, 0);
  // cielo
  D.slow = true;
  drawSky(D, cam, env);
  drawStars(D, cam, env, t);
  drawMoon(D, cam, env);
  const sun = drawSun(D, cam, env);
  drawRainbow(D, cam, env);
  T0 = ph('sky', T0);
  // mundo
  D.shadowK = env.longShadow || 0;
  D.shadowDir = (env.light ?? -1) < 0 ? 1 : -1;
  const stage = new Stage(cam, env, streamZ);
  addWorld(stage, cam, env, t, S);
  if (extra) extra(stage, D);
  T0 = ph('build', T0);
  stage.render(D);
  canvas.data(); T0 = ph('stage', T0);
  D.slow = false;
  if (overlay) overlay(D, ctx, sun);
  // luz
  if (sun && env.rays > 0.01) godRays(canvas, sun, { strength: env.rays, color: env.rayCol, threshold: env.rayTh ?? 0.7 });
  if (sun && env.sun.k > 0.05) glow(ctx, sun[0], sun[1], 260, env.sun.col, 0.25 * env.sun.k);
  canvas.data(); T0 = ph('rays', T0);
  bloom(canvas, { strength: env.bloom ?? 0.2 });
  canvas.data(); T0 = ph('bloom', T0);
  grade(canvas, { filter: gradeFilter({ ...env.grade, sat: env.grade.sat * 1.06, con: env.grade.con * 1.06 }), layers: env.grade.layers });
  canvas.data(); T0 = ph('grade', T0);
  paperPass(canvas, A, { vignette: env.vignette ?? 0.55 });
  canvas.data(); T0 = ph('paper', T0);
  return { sun, stage };
}
