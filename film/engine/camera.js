// Cámara estenopeica (pinhole) con desplazamiento de lente: mira siempre hacia +Z,
// así las verticales se mantienen verticales, como en un dibujo. El "tilt" se hace
// desplazando el horizonte (lensY) en vez de inclinar la cámara.
//
// Mundo: X a la derecha (río abajo), Y hacia arriba, Z hacia el fondo.
import { W, H } from '../timeline.js';

export class Cam {
  // x,y,z: posición; f: focal en px; lensY: altura en pantalla del eje óptico (horizonte)
  // roll: giro de cuadro (rad); focus: distancia de enfoque; aperture: fuerza del desenfoque
  constructor(o = {}) {
    Object.assign(this, { x: 0, y: 0, z: -1000, f: 1000, lensY: H * 0.5, roll: 0, focus: 1000, aperture: 0, near: 12 }, o);
    this._cr = Math.cos(this.roll);
    this._sr = Math.sin(this.roll);
  }
  // proyecta un punto del mundo → [sx, sy, escala, distancia]
  project(X, Y, Z) {
    const d = Z - this.z;
    if (d < this.near) return null;
    const s = this.f / d;
    let x = (X - this.x) * s, y = -(Y - this.y) * s + (this.lensY - H / 2);
    if (this.roll) { const rx = x * this._cr - y * this._sr, ry = x * this._sr + y * this._cr; x = rx; y = ry; }
    return [x + W / 2, y + H / 2, s, d];
  }
  // punto en pantalla de una dirección en el infinito (sol, luna): az y el en radianes
  dir(az, el) {
    let x = Math.tan(az) * this.f, y = -Math.tan(el) * this.f + (this.lensY - H / 2);
    if (this.roll) { const rx = x * this._cr - y * this._sr, ry = x * this._sr + y * this._cr; x = rx; y = ry; }
    return [x + W / 2, y + H / 2];
  }
  // desenfoque (px) de algo a distancia d
  blurAt(d) {
    if (!this.aperture) return 0;
    return this.aperture * this.f * Math.abs(1 / this.focus - 1 / d);
  }
  // rango visible de X a una distancia d (con margen en px)
  xRange(d, margin = 200) {
    const s = this.f / d;
    const half = (W / 2 + margin) / s;
    return [this.x - half * 1.2, this.x + half * 1.2];
  }
  // altura del mundo que aparece en el borde inferior/superior de pantalla a distancia d
  yAtScreen(sy, d) {
    return this.y - (sy - this.lensY) * (d / this.f);
  }
}
