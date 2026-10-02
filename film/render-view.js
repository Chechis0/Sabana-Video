// Composición de un cuadro a partir de una cámara, un ambiente y el estado de la historia.
import { createCanvas } from '@napi-rs/canvas';
import { Pencil } from './core/pencil.js';
import { makePaper, makeTooth, makeVignette } from './core/paper.js';
import { W, H } from './timeline.js';
import { Stage } from './engine/stage.js';
import { godRays, bloom, grade, paperPass, glow } from './engine/post.js';
import { drawSky, drawSun, drawMoon, drawStars, drawRainbow, drawSkyClouds } from './world/sky.js';
import { addWorld } from './world/world.js';
import { streamZ } from './world/geo.js';
import { gradeFilter } from './world/envs.js';
import { PENCIL, PIXEL, CARTOON, PAPER, scaledCanvas } from './style.js';
import { PixelD, quantize, upscale, mosaic, mosaicAt } from './styles/pixel.js';
import { CartoonD, cartoonPost } from './styles/cartoon.js';
import { PaperD, paperPost, paperBackdrop, paperSunRays } from './styles/paper.js';

let assets = null;
export function initAssets() {
  if (!assets) assets = PENCIL || PAPER ? { paper: makePaper(W, H), tooth: makeTooth(W, H), vig: makeVignette(W, H) } : { vig: makeVignette(W, H) };
  return assets;
}

// canvas: donde se dibuja (pequeño en pixel art); out: el cuadro de 1080×1920 que se codifica
export function makeRenderer() {
  if (PIXEL) {
    const canvas = scaledCanvas();
    const D = new PixelD(canvas.g, W, H);
    D.out = createCanvas(W, H);
    return { canvas, ctx: canvas.g, D, out: D.out };
  }
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const D = CARTOON ? new CartoonD(ctx, W, H) : PAPER ? new PaperD(ctx, W, H) : new Pencil(ctx, W, H);
  D.out = canvas;
  return { canvas, ctx, D, out: canvas };
}

// último paso de cada cuadro (pixel art: paleta + ampliación)
export function finishFrame(D, canvas, o = {}) {
  if (PIXEL) {
    // transición de mosaico (como en las consolas de 16 bits) al saltar en el tiempo
    const mz = mosaicAt(D.t);
    if (mz > 1) mosaic(canvas, mz);
    if (!process.env.PIXEL_RAW) quantize(canvas, o.spread ?? 10);
    upscale(canvas, D.out);
    // brillo suave sobre los píxeles (luz "HD-2D"): el sol, el agua y las luces respiran
    const g = Number(process.env.PIXEL_GLOW ?? 0.16);
    if (g > 0) bloom(D.out, { strength: g, radius: 9, contrast: 2.6 });
  }
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
  D.mainCtx = D.noRefract ? null : ctx;
  D.env = env;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  if (PENCIL) ctx.drawImage(A.paper, 0, 0);
  // cielo
  D.slow = true;
  drawSky(D, cam, env);
  if (PAPER) paperBackdrop(D, cam, env);
  drawStars(D, cam, env, t);
  drawMoon(D, cam, env);
  if (PAPER && env.sun && env.sun.k > 0.05) { const [sx, sy] = cam.dir(env.sun.az, env.sun.el); paperSunRays(ctx, sx, sy, env.sun.r ?? 46, env.sun.k, t); }
  const sun = drawSun(D, cam, env);
  drawRainbow(D, cam, env);
  if (!PENCIL) drawSkyClouds(D, cam, env, t, sun);
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
  const rays = env.rays * (PAPER ? 0.75 : PIXEL ? 0.9 : 1);
  if (sun && rays > 0.01) godRays(canvas, sun, { strength: rays, color: env.rayCol, threshold: env.rayTh ?? 0.7 });
  if (sun && env.sun.k > 0.05) glow(ctx, sun[0], sun[1], 260, env.sun.col, 0.25 * env.sun.k);
  canvas.data(); T0 = ph('rays', T0);
  bloom(canvas, { strength: (env.bloom ?? 0.2) * (PIXEL ? 0.8 : PAPER ? 0.7 : 1) });
  canvas.data(); T0 = ph('bloom', T0);
  if (PENCIL) {
    grade(canvas, { filter: gradeFilter({ ...env.grade, sat: env.grade.sat * 1.06, con: env.grade.con * 1.06 }), layers: env.grade.layers });
    canvas.data(); T0 = ph('grade', T0);
    paperPass(canvas, A, { vignette: env.vignette ?? 0.55 });
  } else if (PIXEL) {
    grade(canvas, { filter: gradeFilter({ ...env.grade, sat: env.grade.sat * 1.22, con: env.grade.con * 1.12 }), layers: env.grade.layers });
  } else if (CARTOON) {
    cartoonPost(canvas, A, env);
  } else if (PAPER) {
    paperPost(canvas, A, env);
  }
  canvas.data(); T0 = ph('post', T0);
  return { sun, stage };
}
