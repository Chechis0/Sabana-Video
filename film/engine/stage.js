// Escenario: reúne todo lo que se dibuja en un cuadro con su distancia a la cámara,
// lo ordena de lejos a cerca (pintor) y lo pinta por tramos de desenfoque (profundidad
// de campo). Cada objeto lejano se funde con la bruma del cielo.
import { W, H } from '../timeline.js';
import { clamp } from '../core/math.js';
import { createCanvas } from '@napi-rs/canvas';
import { scaledCanvas, PX } from '../style.js';

const LEVELS = [0, 1.6, 3, 5, 8, 12, 17, 24, 32];
function quantBlur(b) {
  if (b < 1.1) return 0;
  let best = LEVELS[1];
  for (const l of LEVELS) if (Math.abs(l - b) < Math.abs(best - b)) best = l;
  return best;
}

// búferes reducidos para desenfocar barato (un desenfoque grande a media o cuarta resolución
// se ve igual y cuesta mucho menos)
const smalls = new Map();
function getSmall(ds) {
  let c = smalls.get(ds);
  if (!c) { c = createCanvas(Math.round(W / ds), Math.round(H / ds)); c.g = c.getContext('2d'); smalls.set(ds, c); }
  return c;
}
export const BLURT = { n: 0, ms: 0 };

let layer = null;
function getLayer() {
  // capa del mismo tamaño que el lienzo principal (pequeña en pixel art)
  if (!layer) layer = scaledCanvas();
  return layer;
}

export let PROF = null;
const SKIP = new Set((process.env.SKIP || '').split(',').filter(Boolean));
export function profOn() { PROF = {}; return PROF; }

export class Stage {
  constructor(cam, env, refZ = () => 0) {
    this.cam = cam;
    this.env = env;
    this.items = [];
    this.seq = 0;
    // el orden de pintado se mide respecto al cauce (que serpentea): así un objeto
    // en la orilla siempre queda entre los mismos cortes de terreno
    this.refZ = refZ;
    this.zc = refZ(cam.x);
  }
  // d: distancia real (desenfoque y bruma); o.sortD: distancia para ordenar
  // o: { blur (px extra), noBlur, noHaze, haze (multiplicador), sortD, bias }
  add(d, fn, o = {}) {
    if (d < this.cam.near) return;
    this.items.push({ d, s: (o.sortD ?? d) + (o.bias || 0), fn, o, i: this.seq++ });
  }
  // objeto del mundo en (x, z)
  addAt(x, z, fn, o = {}) {
    const d = z - this.cam.z;
    this.add(d, fn, { ...o, sortD: z - this.refZ(x) + this.zc - this.cam.z });
  }

  hazeK(d, o) {
    const e = this.env;
    if (!e.hazeDist) return 0;
    const k = 1 - Math.exp(-Math.max(0, d - (e.hazeStart ?? 300)) / e.hazeDist);
    return clamp(k * (e.hazeMax ?? 0.85) * (o.haze ?? 1));
  }

  // lo más cercano a la cámara queda en sombra (encuadre oscuro que da profundidad)
  nearK(d, o) {
    const e = this.env;
    if (!e.nearDark || o.noNear) return 0;
    const d1 = e.nearD1 ?? this.cam.focus * 0.8, d0 = e.nearD0 ?? this.cam.near;
    return clamp((d1 - d) / (d1 - d0)) * e.nearDark;
  }

  render(D) {
    const main = D.ctx;
    const cam = this.cam;
    const items = this.items.sort((a, b) => b.s - a.s || a.i - b.i);
    // tramos consecutivos con el mismo desenfoque
    const runs = [];
    for (const it of items) {
      if (SKIP.size && SKIP.has(it.o.tag || 'x')) continue;
      const b = it.o.noBlur ? 0 : quantBlur(cam.blurAt(it.d) + (it.o.blur || 0));
      const last = runs[runs.length - 1];
      if (last && last.b === b) last.items.push(it);
      else runs.push({ b, items: [it] });
    }
    const L = getLayer();
    for (const run of runs) {
      const target = run.b > 0 ? L.g : main;
      if (run.b > 0) { L.g.setTransform(1, 0, 0, 1, 0, 0); L.g.clearRect(0, 0, W, H); }
      D.ctx = target;
      D.runBlur = run.b * (D.blurScale || 1); // lo que se va a desenfocar no necesita detalle fino
      for (const it of run.items) {
        D.haze = it.o.noHaze ? null : { col: this.env.hazeCol, k: this.hazeK(it.d, it.o), dcol: this.env.nearCol || '#1d2a1c', dk: this.nearK(it.d, it.o) };
        D.depth = it.d;
        if (process.env.DBG && it.o.tag === "slice") console.log("slice d", it.d.toFixed(0), "haze", JSON.stringify(D.haze));
        target.globalAlpha = 1;
        target.globalCompositeOperation = 'source-over';
        const draw = () => it.fn(D, it.d);
        if (PROF) { const t0 = performance.now(); D.wrapItem ? D.wrapItem(it, draw) : draw(); if (PROF.flush) target.getImageData(0, 0, 1, 1); const k = it.o.tag || 'x'; PROF[k] = (PROF[k] || 0) + performance.now() - t0; PROF[k + '#'] = (PROF[k + '#'] || 0) + 1; }
        else if (D.wrapItem) D.wrapItem(it, draw);
        else draw();
      }
      D.haze = null;
      if (run.b > 0) {
        const tb = performance.now();
        const b = D.blurScale ? run.b * D.blurScale : run.b;
        main.save();
        main.setTransform(1, 0, 0, 1, 0, 0);
        main.globalAlpha = 1;
        main.globalCompositeOperation = 'source-over';
        if (PX === 1 && b >= 5 && !process.env.FULL_BLUR) {
          const ds = b >= 14 ? 4 : 2;
          const S = getSmall(ds);
          S.g.setTransform(1, 0, 0, 1, 0, 0);
          S.g.globalCompositeOperation = 'copy';
          S.g.filter = `blur(${(b / ds).toFixed(2)}px)`;
          S.g.drawImage(L, 0, 0, W / ds, H / ds);
          S.g.filter = 'none';
          main.imageSmoothingEnabled = true;
          main.drawImage(S, 0, 0, W, H);
        } else {
          main.filter = `blur(${b}px)`;
          main.drawImage(L, 0, 0, W, H);
          main.filter = 'none';
        }
        main.restore();
        BLURT.n++; BLURT.ms += performance.now() - tb;
      }
    }
    D.ctx = main;
    D.runBlur = 0;
  }
}
