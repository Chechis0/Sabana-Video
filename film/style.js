// Estilo visual de la película. El guion, las cámaras y el mundo son los mismos; cambia
// el "pincel" (cómo se pinta cada forma), la postproducción y la música.
//   STYLE=pencil  (v4: lápiz de color, por defecto)
//   STYLE=pixel   (pixel art: 216×384 ampliado ×5, paleta limitada y tramado)
//   STYLE=cartoon (caricatura: tinta, colores planos y sombras duras)
//   STYLE=paper   (papel recortado en stop-motion: piezas con fibra, cortes y sombras)
import { createCanvas } from '@napi-rs/canvas';
import { W, H } from './timeline.js';

export const STYLE = (process.env.STYLE || 'pencil').toLowerCase();
export const PENCIL = STYLE === 'pencil';
export const PIXEL = STYLE === 'pixel';
export const CARTOON = STYLE === 'cartoon';
export const PAPER = STYLE === 'paper';
if (![PENCIL, PIXEL, CARTOON, PAPER].some(Boolean)) throw new Error('STYLE desconocido: ' + STYLE);

// resolución interna de dibujo (el pixel art se dibuja pequeño y se amplía sin suavizar)
export const PX = PIXEL ? 5 : 1;
export const RW = W / PX, RH = H / PX;

export const OUT_DIR = { pencil: 'out/v4', pixel: 'out/pixel', cartoon: 'out/caricatura', paper: 'out/papel' }[STYLE];
export const FILM_NAME = { pencil: 'sembrar_agua_41s', pixel: 'sembrar_agua_pixel_41s', cartoon: 'sembrar_agua_caricatura_41s', paper: 'sembrar_agua_papel_41s' }[STYLE];
export const SEG_NAME = process.env.SEG_NAME || (PENCIL ? 'film' : 'film_' + STYLE);
export const TITLE = {
  pencil: 'Sembrar agua — Árboles para mi País',
  pixel: 'Sembrar agua (pixel art) — Árboles para mi País',
  cartoon: 'Sembrar agua (caricatura) — Árboles para mi País',
  paper: 'Sembrar agua (papel recortado) — Árboles para mi País',
}[STYLE];

// Lienzo cuyo contexto acepta coordenadas de 1080×1920 aunque mida menos: todas las
// transformaciones, desenfoques y sombras se escalan por 1/PX. Así el mismo código de
// dibujo pinta directamente a la resolución del pixel art.
export function scaledCanvas(w = RW, h = RH, s = 1 / PX) {
  const c = createCanvas(Math.round(w), Math.round(h));
  const g = c.getContext('2d');
  if (s !== 1) {
    const proto = Object.getPrototypeOf(g);
    const st = proto.setTransform;
    g.setTransform = function (a, b, cc, d, e, f) {
      if (typeof a === 'object') return st.call(this, a.a * s, a.b * s, a.c * s, a.d * s, a.e * s, a.f * s);
      return st.call(this, a * s, b * s, cc * s, d * s, e * s, f * s);
    };
    g.resetTransform = function () { return st.call(this, s, 0, 0, s, 0, 0); };
    const fd = Object.getOwnPropertyDescriptor(proto, 'filter');
    Object.defineProperty(g, 'filter', {
      configurable: true,
      get() { return fd.get.call(this); },
      set(v) { fd.set.call(this, String(v).replace(/blur\(([\d.]+)px\)/g, (m, n) => `blur(${(Number(n) * s).toFixed(2)}px)`)); },
    });
    for (const k of ['shadowBlur', 'shadowOffsetX', 'shadowOffsetY']) {
      const d = Object.getOwnPropertyDescriptor(proto, k);
      Object.defineProperty(g, k, { configurable: true, get() { return d.get.call(this) / s; }, set(v) { d.set.call(this, v * s); } });
    }
    st.call(g, s, 0, 0, s, 0, 0);
  }
  c.g = g;
  c.scaled = s;
  return c;
}
