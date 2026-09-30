// Une los segmentos de video con la banda sonora: out/arboles_para_mi_pais.mp4
//   node --expose-gc src/build.js          (render de audio + video + mezcla)
//   node src/build.js --mux-only           (solo une lo que ya está renderizado)
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ffmpegPath } from './render.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const segDir = path.join(root, 'frames', 'segments');
const outDir = path.join(root, 'out');
const ff = ffmpegPath();

if (!process.argv.includes('--mux-only')) {
  execFileSync('node', [path.join(here, 'audio', 'render-audio.js')], { stdio: 'inherit' });
  execFileSync('node', ['--expose-gc', path.join(here, 'render.js')], { stdio: 'inherit' });
}

const segs = fs.readdirSync(segDir).filter((f) => f.startsWith('seg_') && f.endsWith('.mp4')).sort();
const list = path.join(segDir, 'list.txt');
fs.writeFileSync(list, segs.map((s) => `file '${path.join(segDir, s)}'`).join('\n'));
const out = path.join(outDir, 'arboles_para_mi_pais.mp4');
const joined = path.join(segDir, 'joined.mp4');
execFileSync(ff, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined], { stdio: 'inherit' });
// codificación final en dos pasadas (~9.5 Mbps): conserva el grano del lápiz y pesa < 50 MB
const vopts = ['-c:v', 'libx264', '-preset', 'slow', '-b:v', '9500k', '-maxrate', '14M', '-bufsize', '20M', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2'];
const passlog = path.join(segDir, 'x264pass');
execFileSync(ff, ['-y', '-loglevel', 'error', '-i', joined, ...vopts, '-pass', '1', '-passlogfile', passlog, '-an', '-f', 'mp4', '/dev/null'], { stdio: 'inherit' });
execFileSync(ff, [
  '-y', '-loglevel', 'error', '-i', joined, '-i', path.join(outDir, 'banda_sonora.wav'),
  '-map', '0:v', '-map', '1:a', ...vopts, '-pass', '2', '-passlogfile', passlog,
  '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart',
  '-metadata', 'title=Árboles para mi País — Sembrar agua',
  '-metadata', 'comment=Animación 100% dibujada en JavaScript con textura de lápiz de color. Música original sintetizada.',
  out,
], { stdio: 'inherit' });
console.log('video listo:', out, (fs.statSync(out).size / 1e6).toFixed(1), 'MB');
