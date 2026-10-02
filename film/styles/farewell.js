// Despedida: al terminar los créditos la gota se asoma junto al título, da un saltito y guiña.
import { H } from '../timeline.js';
import { ease, prog } from '../core/math.js';
import { T } from '../story.js';
import { drawDrop } from '../world/drop.js';

export function farewell(D, t, o = {}) {
  const t0 = o.t0 ?? T.credits + 1.05;
  if (t < t0) return null;
  const k = prog(t, t0, t0 + 0.35);
  const u = t - t0;
  const hop = Math.abs(Math.sin(u * 7)) * 22 * Math.exp(-u * 1.6);
  const s = (o.s ?? 1.9) * ease.outBack(k, 2.5);
  const x = o.x ?? 985, y = (o.y ?? H - 196) - hop;
  const wink = u > 0.55 && u < 0.85;
  const sq = 0.08 * Math.sin(u * 14) * Math.exp(-u * 2);
  drawDrop(D, { x, y, s, sx: 1 + sq, sy: 1 - sq, eyes: wink ? 0.1 : 1, look: [-0.6, -0.25], mood: wink ? 'joy' : 'happy', shadow: true, light: -1, rim: 0, blush: 0.8 }, t);
  return [x, y - 23 * s, s];
}
