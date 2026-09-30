// Render del video: varios procesos dibujan segmentos de 1 s y ffmpeg los codifica en H.264.
//   node --expose-gc src/render.js            (todo el video, 4 procesos)
//   node --expose-gc src/render.js 10 14      (solo del segundo 10 al 14, para revisar)
import { fork, spawn, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { FPS, DURATION, W, H } from './timeline.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const SEG_DIR = path.join(root, 'frames', 'segments');
const SEG = 2; // segundos por segmento

export function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try {
    return execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
  } catch {
    return 'ffmpeg';
  }
}

async function worker() {
  const { makeRenderer, drawFrame } = await import('./scene.js');
  const { canvas, D } = makeRenderer();
  const ff = ffmpegPath();
  const seconds = JSON.parse(process.env.SECONDS_LIST);
  for (const sec of seconds) {
    const out = path.join(SEG_DIR, `seg_${String(sec).padStart(3, '0')}.mp4`);
    const enc = spawn(ff, [
      '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(process.env.CRF || 18), '-pix_fmt', 'yuv420p',
      '-x264-params', 'keyint=48:min-keyint=24', out,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let f = sec * FPS; f < Math.min(DURATION, sec + SEG) * FPS; f++) {
      const t = f / FPS;
      drawFrame(D, t, f);
      if (D.pending.length) { await D.flush(); drawFrame(D, t, f); }
      const buf = canvas.data();
      if (!enc.stdin.write(Buffer.from(buf))) await new Promise((r) => enc.stdin.once('drain', r));
      if (global.gc) global.gc();
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
  // reparto intercalado: cada proceso reutiliza sus texturas entre segmentos
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
