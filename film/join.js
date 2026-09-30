// Une segmentos (+ audio si existe): node film/join.js salida.mp4 [audio.wav]
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ffmpegPath } from './render.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const segDir = path.join(here, '..', 'frames', process.env.SEG_NAME || 'film');
const [out, audio] = process.argv.slice(2);
const ff = ffmpegPath();
const segs = fs.readdirSync(segDir).filter((f) => f.startsWith('seg_') && f.endsWith('.mp4')).sort();
const list = path.join(segDir, 'list.txt');
fs.writeFileSync(list, segs.map((s) => `file '${path.join(segDir, s)}'`).join('\n'));
const args = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
if (audio) args.push('-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest');
args.push('-c:v', 'copy', '-movflags', '+faststart', out);
execFileSync(ff, args, { stdio: 'inherit' });
console.log('listo', out, (fs.statSync(out).size / 1e6).toFixed(1), 'MB');
