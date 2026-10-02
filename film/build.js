// Construye el filminuto: banda sonora → render de cuadros → mezcla final normalizada.
//   node --expose-gc film/build.js            (todo)
//   node film/build.js --mux-only             (sólo une lo ya renderizado con la música)
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ffmpegPath } from './render.js';
import { OUT_DIR, FILM_NAME, SEG_NAME, TITLE, STYLE, PIXEL } from './style.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const segDir = path.join(root, 'frames', SEG_NAME);
const outDir = path.join(root, OUT_DIR);
fs.mkdirSync(outDir, { recursive: true });
const ff = ffmpegPath();
const wav = path.join(outDir, 'banda_sonora.wav');

if (!process.argv.includes('--mux-only')) {
  execFileSync('node', [path.join(here, 'audio', 'score.js')], { stdio: 'inherit' });
  execFileSync('node', ['--expose-gc', path.join(here, 'render.js')], { stdio: 'inherit' });
}
if (!fs.existsSync(wav)) execFileSync('node', [path.join(here, 'audio', 'score.js')], { stdio: 'inherit' });

// 1) unir segmentos
const segs = fs.readdirSync(segDir).filter((f) => f.startsWith('seg_') && f.endsWith('.mp4')).sort();
const list = path.join(segDir, 'list.txt');
fs.writeFileSync(list, segs.map((s) => `file '${path.join(segDir, s)}'`).join('\n'));
const joined = path.join(segDir, 'joined.mp4');
execFileSync(ff, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined], { stdio: 'inherit' });

// 2) sonoridad: -14 LUFS integrados, pico real -1 dBTP (dos pasadas de loudnorm)
let meas = null;
try {
  const err = execFileSync('sh', ['-c', `"${ff}" -hide_banner -nostats -i "${wav}" -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1`]).toString();
  meas = JSON.parse(err.slice(err.lastIndexOf('{'), err.lastIndexOf('}') + 1));
} catch { /* sin medición: una pasada */ }
const ln = meas
  ? `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${meas.input_i}:measured_TP=${meas.input_tp}:measured_LRA=${meas.input_lra}:measured_thresh=${meas.input_thresh}:offset=${meas.target_offset}:linear=true`
  : 'loudnorm=I=-14:TP=-1:LRA=11';

// 3) codificación final en dos pasadas (~10 Mbps): conserva el grano del lápiz
const out = path.join(outDir, FILM_NAME + '.mp4');
const BR = { pencil: '9200k', pixel: '7000k', cartoon: '8000k', paper: '9200k' }[STYLE];
const TUNE = { pencil: 'grain', pixel: 'animation', cartoon: 'animation', paper: 'film' }[STYLE];
const vopts = ['-c:v', 'libx264', '-preset', 'slow', '-b:v', BR, '-maxrate', '14M', '-bufsize', '20M', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2', '-tune', TUNE];
const passlog = path.join(segDir, 'x264pass');
const COMMENT = {
  pencil: 'Animación 100% dibujada con código JavaScript (lápiz de color, cámara 2.5D). Música original sintetizada en JavaScript.',
  pixel: 'Pixel art 100% dibujado con código JavaScript (216×384 ampliado ×5, paleta propia). Música chip original sintetizada en JavaScript.',
  cartoon: 'Caricatura 100% dibujada con código JavaScript (tinta, colores planos, luz de cine). Música original sintetizada en JavaScript.',
  paper: 'Papel recortado en stop-motion, 100% dibujado con código JavaScript. Música original sintetizada en JavaScript.',
}[STYLE];
execFileSync(ff, ['-y', '-loglevel', 'error', '-i', joined, ...vopts, '-pass', '1', '-passlogfile', passlog, '-an', '-f', 'mp4', '/dev/null'], { stdio: 'inherit' });
execFileSync(ff, [
  '-y', '-loglevel', 'error', '-i', joined, '-i', wav,
  '-map', '0:v', '-map', '1:a', ...vopts, '-pass', '2', '-passlogfile', passlog,
  '-af', ln + ',aresample=48000', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart',
  '-metadata', 'title=' + TITLE,
  '-metadata', 'artist=Sergio Pardo Osorio',
  '-metadata', 'comment=' + COMMENT,
  out,
], { stdio: 'inherit' });
console.log('video listo:', out, (fs.statSync(out).size / 1e6).toFixed(1), 'MB');
