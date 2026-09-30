// Cada cuadro de la película: plano → cámara → ambiente → personajes → efectos → post.
import { W, H } from './timeline.js';
import { clamp, lerp, ease, prog, spring, noise1, hrand, mulberry32, mix } from './core/math.js';
import { ellipsePts } from './core/pencil.js';
import { renderView, initAssets } from './render-view.js';
import { shotAt } from './cameras.js';
import {
  T, X, envAt, dropState, cubState, momState, birdState, girlState, crewPlans, personState, plantedTrees,
  plantings, plantGrowth, zAt, gy, gardenKidState, seedSpot, heroTip, dropX, water,
} from './story.js';
import { bed, ground, streamZ, STREAM_W } from './world/geo.js';
import { drawDrop } from './world/drop.js';
import { drawBear } from './world/bears.js';
import { drawPerson, drawHummingbird, drawButterfly, drawBird, drawHeart, drawBagSeedling } from './world/people.js';
import { drawSapling } from './world/flora.js';
import { drawGardenBed, drawCloud } from './world/town.js';
import { drawShafts, drawMotes, drawFleck } from './engine/light.js';
import { sparkle, dirtPuff, splash, steam, rain, rainSplashes, lightning } from './effects.js';
import { glow } from './engine/post.js';
import { drawMap } from './map.js';

const PLANTED = plantedTrees();
const HALF = STREAM_W / 2;

// grietas del potrero seco (sobre el plano del suelo)
const CRACKS = (() => {
  const out = [];
  const r = mulberry32(606);
  for (let i = 0; i < 260; i++) {
    let x = X.gap + 50 + r() * (X.forestB - X.gap - 100);
    let off = -650 + r() * 1500;
    if (Math.abs(off) < HALF + 10) off += Math.sign(off || 1) * (HALF + 10);
    const pts = [[x, off]];
    let a = r() * Math.PI * 2;
    const n = 3 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) { a += (r() - 0.5) * 1.5; x += Math.cos(a) * (18 + r() * 26); off += Math.sin(a) * (14 + r() * 20); pts.push([x, off]); }
    out.push({ pts, x: pts[0][0], off: pts[0][1], seed: i });
  }
  return out;
})();

// ambiente propio de cada plano (sol del time-lapse, relámpagos, lluvia, arcoíris)
function tuneEnv(env, t, shot) {
  env.rain = clamp(prog(t, T.rainIn[0], T.rainIn[1])) * (1 - prog(t, T.rainOut[0], T.rainOut[1]));
  if (shot.name === 'tiempo') {
    // el sol cruza el cielo: se pone a la derecha, noche, sale por la izquierda
    const u = t;
    let az, el, k = 1;
    if (u < 23.8) { const q = prog(u, 23.0, 23.8); az = lerp(-0.1, 0.62, q); el = lerp(0.3, -0.06, ease.inQuad(q)); }
    else if (u < 24.6) { az = 0.7; el = -0.3; k = 0; }
    else { const q = prog(u, 24.6, 25.5); az = lerp(-0.62, -0.05, q); el = lerp(-0.06, 0.4, ease.outQuad(q)); }
    env.sun = { ...env.sun, az, el, k: env.sun.k };
    if (env.moon) env.moon = { az: lerp(-0.5, 0.5, prog(u, 23.7, 24.8)), el: 0.35 + 0.1 * Math.sin(prog(u, 23.7, 24.8) * Math.PI), k: env.moon.k };
    env.stars = Math.max(env.stars || 0, clamp(1 - Math.abs(u - 24.2) / 0.6));
    env.clouds = prog(u, 24.9, 26.0);
  }
  if (t >= T.thunder - 0.2 && t < 29.0) env.clouds = Math.max(env.clouds || 0, 1 - prog(t, 28.4, 29.2));
  if (shot.name === 'reencuentro' || shot.name === 'recarga') {
    env.rainbowX = W * 0.66; env.rainbowR = 900; env.rainbowDrop = 420;
  }
  // el potrero seco quema: sin bruma verde, más blanco
  return env;
}

function addActors(stage, cam, env, t, shot) {
  const L = env.light ?? -1;
  const proj = (x, y, z) => cam.project(x, y, z);
  // ---------------- la Gota
  const d = dropState(t);
  if (d) {
    stage.addAt(d.x, d.z, (D) => {
      const P = proj(d.x, d.y, d.z);
      if (!P) return;
      // ondas en el agua alrededor
      if (d.float) {
        const k = (t * 1.3) % 1;
        const rr = (22 + 26 * k) * P[2];
        const ring = ellipsePts(P[0], P[1] + 2 * P[2], rr, rr * 0.28, 20);
        D.stroke(ring.concat([ring[0]]), '#eefaff', 1.8, { seed: 7, alpha: 0.7 * (1 - k), abs: true });
      }
      drawDrop(D, { ...d, x: P[0], y: P[1], s: P[2] * (d.s || 1), light: L, rim: (env.backlight ?? 0) * (d.rim ?? 0.6), glow: d.glow }, t);
    }, { bias: -3, tag: 'drop' });
    // vapor mientras se evapora
    if (t > T.evap[0] && t < T.evap[1] + 0.5) {
      stage.addAt(d.x, d.z - 1, (D) => {
        const P = proj(d.x, d.y + 20 * d.s, d.z);
        if (P) steam(D, P[0], P[1], P[2] * d.s, t, 55, 1 - prog(t, T.evap[1], T.evap[1] + 0.5));
      }, { bias: -4, tag: 'fx' });
    }
  }
  // gotitas de lluvia que la recargan
  if (t > T.refill[0] - 0.35 && t < T.refill[1] + 0.2) {
    [0, 0.3, 0.6].forEach((dt, i) => {
      const tt = T.refill[0] + dt;
      const u = prog(t, tt - 0.3, tt);
      const x = X.stuck + (i - 1) * 3, z = zAt(X.stuck, 0);
      stage.addAt(x, z, (D) => {
        if (u > 0 && u < 1) {
          const P = proj(x, bed(X.stuck) + 5 + 260 * (1 - u), z);
          if (P) drawDrop(D, { x: P[0], y: P[1], s: P[2] * 0.3, eyes: 0, mood: 'neutral', shadow: false, light: L }, t);
        }
        const P2 = proj(X.stuck, bed(X.stuck) + 30, z);
        if (P2) splash(D, P2[0], P2[1], P2[2] * 0.7, prog(t, tt, tt + 0.35), 70 + i);
      }, { bias: -5, tag: 'fx' });
    });
  }
  // ---------------- caída en el musgo y el pozo
  if (t > T.land && t < T.slide[1] + 0.8) {
    const tip = heroTip();
    stage.addAt(tip.x, tip.z, (D) => {
      const P = proj(tip.x, gy(X.hero + 90, 58) + 12, tip.z);
      if (P) splash(D, P[0], P[1], P[2] * 1.1, prog(t, T.land, T.land + 0.5), 31, '#cfeefe', 7);
      const Q = proj(X.spring + 40, bed(X.spring + 40) + 5, zAt(X.spring + 40, 0));
      if (Q) splash(D, Q[0], Q[1], Q[2] * 1.3, prog(t, T.slide[1], T.slide[1] + 0.6), 37);
    }, { bias: -5, tag: 'fx' });
  }
  // ---------------- musgo del nacimiento (cojín de musgo al pie del frailejón)
  if (t < 7) {
    const mx = X.hero + 90, mo = 58;
    stage.addAt(mx, zAt(mx, mo), (D) => {
      const P = proj(mx, gy(mx, mo), zAt(mx, mo));
      if (!P) return;
      D.save(); D.translate(P[0], P[1]); D.scale(P[2]);
      const sq = t > T.land && t < T.slide[0] ? spring(t - T.land, 3, 6) * 0.15 : 0;
      D.scale(1 + sq, 1 - sq);
      const m = D.shape(ellipsePts(0, -8, 62, 20, 18, 0, 0.12, 3), '#6f8f3c', { seed: 811, knock: true, angle: -0.6 });
      D.shadeIn(m, ellipsePts(-12, -18, 40, 10, 12), '#9ab85a', { seed: 812, alpha: 0.9 });
      for (let k = 0; k < 9; k++) D.stroke([[-50 + k * 12, -8], [-48 + k * 12, -22 - (k % 3) * 3]], '#8aa84a', 1.6, { seed: 813 + k, alpha: 0.8 });
      D.restore();
    }, { bias: -1, tag: 'moss' });
  }
  // ---------------- osos
  for (const b of [cubState(t), momState(t)]) {
    if (!b) continue;
    const z = zAt(b.x, b.off);
    stage.addAt(b.x, z, (D) => {
      const P = proj(b.x, Math.max(ground(b.x, z), bed(b.x) + 4) + (b.lift || 0), z);
      if (P) drawBear(D, { ...b, x: P[0], y: P[1], s: P[2] * (b.size || 1), light: L }, t);
    }, { tag: 'bear' });
  }
  // ---------------- colibrí
  const hb = birdState(t);
  if (hb) stage.addAt(hb.x, hb.z, (D) => { const P = proj(hb.x, hb.y, hb.z); if (P) drawHummingbird(D, { ...hb, x: P[0], y: P[1], s: P[2] * hb.s }, t); }, { bias: -6, tag: 'bird' });
  // ---------------- la niña y la comunidad
  const people = [];
  const g = girlState(t);
  if (g) people.push(g);
  for (const plan of crewPlans) { const p = personState(plan, t); if (p) people.push(p); }
  // la sombra de la niña cubre a la gota: alguien llegó
  if (t > T.shadow - 0.1 && t < T.place[1]) {
    const k = clamp((t - T.shadow + 0.1) / 0.35) * (1 - prog(t, T.wake + 0.6, T.place[1]));
    const x = X.stuck, z = zAt(X.stuck, 0) - 2;
    stage.addAt(x, z, (D) => {
      const P = proj(x + 20, bed(x) + 3, z);
      if (P) D.shape(ellipsePts(P[0], P[1], 150 * P[2], 34 * P[2], 18, 0, 0.15, 3), '#2a2418', { alpha: 0.35 * k, edge: 8, base: false, rim: false, seed: 77 });
    }, { bias: -3.5, tag: 'fx' });
  }
  const mom = momState(t);
  if (mom && Math.abs(mom.off) < HALF + 10 && t > 29 && t < T.meet) {
    const z = zAt(mom.x, mom.off);
    stage.addAt(mom.x, z, (D) => { const P = proj(mom.x + 40, bed(mom.x) + 5, z); if (P) splash(D, P[0], P[1], P[2] * 1.4, (t * 3) % 1, 91 + Math.floor(t * 3)); }, { bias: -1, tag: 'fx' });
  }
  // halo de contraluz detrás de la niña (el sol le dibuja el contorno)
  if (shot.name === 'nina' && t > 17.1 && g) {
    const z = zAt(g.x, g.off) + 2;
    stage.addAt(g.x, z, (D) => {
      const P = proj(g.x, ground(g.x, z) + 70, z);
      if (P) glow(D.ctx, P[0] + 30 * P[2], P[1] - 20 * P[2], 150 * P[2], '#ffe7b0', 0.55 * prog(t, 17.1, 17.6));
    }, { tag: 'fx', bias: 2 });
  }
  for (const p of people) {
    const z = zAt(p.x, p.off);
    stage.addAt(p.x, z, (D) => {
      const P = proj(p.x, ground(p.x, z), z);
      if (P) drawPerson(D, { ...p, x: P[0], y: P[1], s: P[2] }, t);
    }, { tag: 'person' });
  }
  // la plántula de la niña, en el suelo junto a la gota, antes de sembrarse
  // ---------------- siembra: tierra y destello en cada golpe
  for (const pl of plantings) {
    if (!pl.hero) continue;
    const k1 = prog(t, pl.t - 0.35, pl.t + 0.3), k2 = prog(t, pl.t, pl.t + 0.6);
    if (k1 <= 0 || k2 >= 1) continue;
    const z = zAt(pl.x, pl.off);
    stage.addAt(pl.x, z, (D) => {
      const P = proj(pl.x, ground(pl.x, z), z);
      if (!P) return;
      dirtPuff(D, P[0], P[1], P[2] * 1.4, k1, pl.seed);
      sparkle(D, P[0], P[1] - 50 * P[2], k2, 34 * Math.max(0.6, P[2]), pl.i);
    }, { bias: -7, tag: 'fx' });
  }
  // ---------------- huerto escolar, niño y brote
  {
    const G = seedSpot();
    const gx = X.garden, go = -250;
    const gz = zAt(gx, go);
    stage.addAt(gx, gz + 30, (D) => { const P = proj(gx, ground(gx, gz + 30), gz + 30); if (P) drawGardenBed(D, P, 950, t, t > T.leap[1] ? 1 : 0); }, { tag: 'garden' });
    const k = gardenKidState(t);
    const kz = zAt(k.x, k.off);
    stage.addAt(k.x, kz, (D) => { const P = proj(k.x, ground(k.x, kz), kz); if (P) drawPerson(D, { ...k, x: P[0], y: P[1], s: P[2] }, t); }, { tag: 'person' });
    // la gotita vacía de la regadera
    const u = prog(t, T.canTilt[0] + 0.2, T.canTilt[0] + 0.55);
    if (u > 0 && u < 1) stage.addAt(k.x + 40, kz - 5, (D) => { const P = proj(k.x + 44, ground(k.x, kz) + 90 - 60 * u, kz - 5); if (P) D.shape(ellipsePts(P[0], P[1], 2.2 * P[2], 3.2 * P[2], 7), '#9fd0f0', { seed: 77, edge: 1 }); }, { bias: -3, tag: 'fx' });
    if (t > T.sprout - 0.05) {
      stage.addAt(G.x, G.z, (D) => {
        const P = proj(G.x, G.y - 40, G.z);
        if (!P) return;
        const gg = ease.outBack(prog(t, T.sprout, T.sprout + 0.5), 2);
        D.save(); D.translate(P[0], P[1]); D.scale(P[2] * 2.2 * Math.max(0.05, gg));
        drawSapling(D, 0.4 + 0.4 * clamp(gg), 991, t, { noSoil: true });
        D.restore();
        sparkle(D, P[0], P[1] - 60 * P[2], prog(t, T.sprout, T.sprout + 0.7), 50 * P[2], 11);
      }, { bias: -4, tag: 'fx' });
    }
    if (t > T.leap[1] - 0.05 && t < T.sprout + 0.6) {
      stage.addAt(G.x, G.z, (D) => { const P = proj(G.x, G.y - 40, G.z); if (P) splash(D, P[0], P[1], P[2] * 1.2, prog(t, T.leap[1], T.leap[1] + 0.45), 90); }, { bias: -5, tag: 'fx' });
    }
  }
  // ---------------- el reencuentro: corazón, mariposas y pájaros
  if (t > T.meet + 0.1 && t < T.meet + 1.7) {
    const k = prog(t, T.meet + 0.1, T.meet + 1.7);
    const z = zAt(X.meet, X.meetOff);
    stage.addAt(X.meet, z - 20, (D) => { const P = proj(X.meet, ground(X.meet, z) + 150 + k * 60, z); if (P) drawHeart(D, P[0], P[1], P[2] * 3.2 * ease.outBack(clamp(k * 3)), 1 - k * k, 7); }, { bias: -8, tag: 'fx' });
  }
  if (t > 29.2 && t < 35) {
    for (let i = 0; i < 6; i++) {
      const x = X.meet - 500 + i * 190 + Math.sin(t * 1.3 + i) * 60, off = 120 + (i % 3) * 110;
      const z = zAt(x, off);
      stage.addAt(x, z, (D) => { const P = proj(x, ground(x, z) + 120 + Math.cos(t * 1.7 + i * 2) * 30, z); if (P) drawButterfly(D, P[0], P[1], P[2] * 1.5, t, 400 + i, ['#f0b43c', '#f2f2ea', '#e36a3a'][i % 3]); }, { bias: -2, tag: 'fx' });
    }
  }
  // ---------------- haces de luz y manchas de sol (bosque)
  if (shot.name === 'bosque' && t < 11.9) {
    stage.add(900, (D) => drawShafts(D, cam, 900, t, { angle: 0.32, n: 6, alpha: 0.42, width: 85, col: '#fff0c0', seed: 3 }), { noHaze: true, noBlur: true, tag: 'shaft' });
    const x0 = Math.floor(cam.x / 170) * 170;
    for (let k = -4; k <= 5; k++) {
      const x = x0 + k * 170, off = (hrand(k + x0) - 0.5) * 300;
      const z = zAt(x, off);
      stage.addAt(x, z, (D) => drawFleck(D, cam, x, ground(x, z) + 1, z, 50 + hrand(x) * 40, t, x), { bias: -0.5, tag: 'fleck' });
    }
  }
  if (shot.name === 'paramo') {
    stage.add(1600, (D) => drawShafts(D, cam, 1600, t, { angle: -0.9, n: 5, alpha: 0.28, width: 160, col: '#ffd7a0', seed: 8 }), { noHaze: true, noBlur: true, tag: 'shaft' });
  }
  // ---------------- grietas del potrero seco
  const gk = 1 - clamp(((env.green || 0) - 0.1) / 0.4);
  if (gk > 0.02) {
    for (const c of CRACKS) {
      const z = zAt(c.x, c.off);
      const dd = z - cam.z;
      if (dd < cam.near + 20 || dd > 1800) continue;
      const P0 = proj(c.x, ground(c.x, z), z);
      if (!P0 || P0[0] < -200 || P0[0] > W + 200 || P0[1] > H + 50) continue;
      stage.addAt(c.x, z, (D) => {
        const pts = c.pts.map(([x, off]) => { const zz = zAt(x, off); const p = proj(x, ground(x, zz) + 0.5, zz); return p ? [p[0], p[1]] : null; }).filter(Boolean);
        if (pts.length > 1) D.stroke(pts, '#6e5238', Math.max(1, Math.min(3, P0[2] * 3)), { seed: c.seed, alpha: 0.7 * gk, abs: true });
      }, { bias: -0.2, tag: 'crack' });
    }
  }
  // ---------------- nubes (time-lapse, tormenta, subida)
  const ck = env.clouds || 0;
  if (ck > 0.01) {
    for (let i = 0; i < 16; i++) {
      const x = 3500 + i * 230 + Math.sin(i * 7) * 160, zz = 3600 + (i % 4) * 800;
      const y = bed(x, false) + 2300 + (i % 5) * 260 + (1 - ck) * 1400;
      stage.add(zz - cam.z, (D) => { const P = proj(x, y, zz); if (P) drawCloud(D, P, 1100 + (i % 3) * 350, 900 + i, t, mix('#ffffff', '#65717c', clamp(ck * 1.2 - 0.2)), mix('#c9d3e0', '#434e5a', clamp(ck * 1.2 - 0.2)), clamp(ck * 1.5)); }, { tag: 'cloud', haze: 0.25 });
    }
  }
  if (shot.name === 'subida') {
    const u = prog(t, T.rise[0], T.rise[1]);
    const G = seedSpot();
    for (let i = 0; i < 16; i++) {
      const x = G.x - 1200 + (i % 4) * 800 + hrand(i) * 300, zz = G.z + 800 + Math.floor(i / 4) * 900;
      const y = G.y + 5200 + hrand(i, 2) * 1800;
      stage.add(zz - cam.z, (D) => { const P = proj(x, y, zz); if (P) drawCloud(D, P, 900 + hrand(i, 3) * 500, 950 + i, t, '#ffffff', '#e0e6ee', 1); }, { tag: 'cloud', haze: 0.2 });
    }
  }
}

function overlays(D, ctx, sun, t, cam, env, shot) {
  if (shot.name === 'bosque' && t < 11.9) drawMotes(D, cam, t, { n: 70, k: 1 });
  if (shot.name === 'paramo') drawMotes(D, cam, t, { n: 50, k: 0.8, col: '#ffe6c0' });
  if (shot.name === 'siembra' || shot.name === 'nina') drawMotes(D, cam, t, { n: 40, k: 0.7, col: '#fff0c8' });
  // calor del potrero: ondas que suben sobre el horizonte
  if (shot.name === 'evapora' || shot.name === 'separados' || (shot.name === 'bosque' && t > 12.2)) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'screen';
    ctx.lineWidth = 3;
    for (let i = 0; i < 14; i++) {
      const y0 = cam.lensY + 160 - ((t * 40 + i * 37) % 320);
      ctx.strokeStyle = `rgba(255,248,230,${0.1 * Math.sin(((t * 40 + i * 37) % 320) / 320 * Math.PI)})`;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 24) { const y = y0 + Math.sin(x / 60 + t * 6 + i) * 4; if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
    }
    ctx.restore();
  }
  const rk = env.rain || 0;
  if (rk > 0.01) {
    rain(D, t, rk, cam);
    rainSplashes(D, t, rk, cam.lensY + 200, H);
  }
  // relámpagos
  let flash = lightning(D, t, T.thunder, W * 0.72) + lightning(D, t, T.thunder + 0.55, W * 0.3) * 0.7;
  if (flash > 0) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = clamp(flash * 0.55);
    ctx.fillStyle = '#e8eeff'; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  // subida: blanco de las nubes al final
  if (shot.name === 'subida') {
    const k = ease.inCubic(prog(t, T.rise[1] - 0.45, T.rise[1] - 0.05));
    if (k > 0) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = k; ctx.fillStyle = '#fbf8f0'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  }
}

export function drawFrame(D, canvas, t, frame) {
  const shot = shotAt(t);
  if (shot.name === 'mapa') return drawMap(D, canvas, t, frame);
  const cam = shot.cam(t);
  const env = tuneEnv(envAt(t), t, shot);
  const S = { planted: PLANTED, dew: 1 - prog(t, T.condense[0], T.condense[1] * 0.85) };
  renderView(D, canvas, cam, env, t, frame, S, (stage) => addActors(stage, cam, env, t, shot), (D2, ctx, sun) => overlays(D2, ctx, sun, t, cam, env, shot));
}
