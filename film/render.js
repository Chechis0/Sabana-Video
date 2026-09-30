// Render del video: varios procesos dibujan segmentos de 2 s y ffmpeg los codifica en H.264.
//   node --expose-gc film/render.js            (todo el video)
//   node --expose-gc film/render.js 10 14      (del segundo 10 al 14)
//   STRIDE=3 node --expose-gc film/render.js   (vista previa: 1 de cada 3 cuadros)
import { fork, spawn, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { FPS, DURATION, W, H } from './timeline.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const SEG_DIR = path.join(root, 'frames', process.env.SEG_NAME || 'film');
const SEG = 2;

export function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try {
    return execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
  } catch {
    return 'ffmpeg';
  }
}

async function worker() {
  const { makeRenderer } = await import('./render-view.js');
  const { drawFrame } = await import('./film.js');
  const { canvas, D } = makeRenderer();
  const ff = ffmpegPath();
  const stride = Number(process.env.STRIDE || 1);
  const seconds = JSON.parse(process.env.SECONDS_LIST);
  for (const sec of seconds) {
    const out = path.join(SEG_DIR, `seg_${String(sec).padStart(3, '0')}.mp4`);
    const enc = spawn(ff, [
      '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
      '-c:v', 'libx264', '-preset', stride > 1 ? 'veryfast' : 'slow', '-crf', String(process.env.CRF || (stride > 1 ? 24 : 16)), '-pix_fmt', 'yuv420p',
      '-x264-params', 'keyint=48:min-keyint=24', out,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    let buf = null;
    const f0 = sec * FPS, f1 = Math.min(DURATION, sec + SEG) * FPS;
    for (let f = f0; f < f1; f++) {
      if ((f - f0) % stride === 0 || !buf) {
        const t = f / FPS;
        drawFrame(D, canvas, t, f);
        if (D.pending.length) { await D.flush(); drawFrame(D, canvas, t, f); }
        buf = canvas.data();
      }
      if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once('drain', r));
      // la memoria nativa (búferes, trazados) sólo se libera cuando el bucle de eventos respira
      if (global.gc) global.gc();
      await new Promise((r) => setImmediate(r));
    }
    enc.stdin.end();
    await new Promise((r) => enc.on('close', r));
    process.send({ sec, ms: Date.now() - t0 });
  }
  process.exit(0);
}

async function main() {
  const a = Number(process.argv[2] ?? 0), b = Number(process.argv[3] ?? DURATION);
  const nw = Number(process.env.WORKERS || Math.max(1, Math.min(4, os.cpus().length)));
  fs.mkdirSync(SEG_DIR, { recursive: true });
  const secs = [];
  for (let s = Math.floor(a / SEG) * SEG; s < Math.ceil(b); s += SEG) secs.push(s);
  // reparto: los segmentos más caros primero, en rueda
  const lists = Array.from({ length: nw }, () => []);
  secs.forEach((s, i) => lists[i % nw].push(s));
  const t0 = Date.now();
  let done = 0;
  await Promise.all(lists.filter((l) => l.length).map((list) => new Promise((res, rej) => {
    const w = fork(fileURLToPath(import.meta.url), [], {
      env: { ...process.env, ROLE: 'worker', SECONDS_LIST: JSON.stringify(list) },
      execArgv: ['--expose-gc', '--max-old-space-size=3000'],
    });
    w.on('message', (m) => { done++; console.log(`segmento ${m.sec}s listo (${(m.ms / 1000).toFixed(1)} s) — ${done}/${secs.length}`); });
    w.on('exit', (code) => (code === 0 ? res() : rej(new Error('worker ' + code))));
  })));
  console.log(`render total ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

if (process.env.ROLE === 'worker') worker();
else if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
