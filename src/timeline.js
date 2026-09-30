// Guion temporal (segundos). Música a 120 BPM en 4/4 → 1 compás = 2 s, 1 pulso = 0.5 s.
export const FPS = 24;
export const DURATION = 40;
export const W = 1080, H = 1920;
export const BEAT = 0.5;

export const T = {
  // 1 · Páramo al amanecer: nace la gota
  fadeIn: [-1, -0.5], // sin fundido: el primer cuadro ya muestra a la protagonista
  condense: [0.0, 1.3],
  eyesOpen: 1.6,
  lookAround: [1.9, 2.7],
  fall: 3.35, land: 3.8,
  slideToPool: [4.05, 4.85],
  poolSplash: 4.85,
  // 2 · Descenso por el bosque
  ride: [5.1, 12.0],
  bird: [7.6, 10.2],
  bearDrink: [9.0, 11.6],
  // 3 · El potrero seco
  dry: [12.0, 13.9],
  stuck: 13.9,
  bearEdge: [12.4, 14.2],
  sadEyes: 15.0,
  // 4 · Llega una plántula
  seedling: 16.35,
  peek: 16.9,
  pullBack: [17.0, 18.2],
  // 5 · Siembra y crecimiento
  plantStart: 18.0,
  plantCount: 12,
  rain: [23.3, 26.1],
  revive: [24.7, 25.7],
  refill: [25.5, 27.7],
  cheer: 27.4,
  canTilt: [31.95, 32.5],
  // 6 · Conexión
  bearsWalk: [28.0, 30.0],
  bearsMeet: 30.0,
  whip: [30.6, 32.05],
  leap: [32.45, 33.05],
  sprout: 33.3,
  // 7 · Revelación
  zoomOut: [33.95, 35.9],
  leafOut: [35.2, 36.9],
    title1: 36.5,
  title2: 37.1,
  credits: 37.8,
  end: 40,
};

export const plantTimes = Array.from({ length: T.plantCount }, (_, i) => T.plantStart + 0.5 + i * BEAT);
