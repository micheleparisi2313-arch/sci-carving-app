// Misure del corpo per un singolo fotogramma.
// pts: punti 2D in pixel dell'immagine (y verso il basso) con visibilità.
// world: punti 3D in metri centrati sulle anche (y verso il basso), dati da MediaPipe.

export type P2 = { x: number; y: number; v: number };
export type P3 = { x: number; y: number; z: number };

export const IDX = {
  ls: 11, rs: 12, lh: 23, rh: 24, lk: 25, rk: 26, la: 27, ra: 28, lheel: 29, rheel: 30, lt: 31, rt: 32,
} as const;

export type FrameMetrics = {
  ginocchio: number;      // angolo del ginocchio più disteso (180 = gamba tesa)
  anca: number;           // angolo busto-coscia (180 = busto dritto sulla gamba)
  spalleIncl: number;     // linea spalle rispetto all'orizzontale dell'immagine (0 = in bolla)
  gambeIncl: number;      // inclinazione piedi->anche rispetto alla verticale (segno = lato della curva)
  bustoIncl: number;      // inclinazione anche->spalle rispetto alla verticale
  spalleVsSci: number;    // 0 = spalle frontali alle punte degli sci (stima 3D)
  ancheAvanti: number;    // anche davanti(+) o dietro(-) i piedi, in % della lunghezza della gamba
  tibieDiff: number;      // differenza di inclinazione tra le due tibie (0 = sci paralleli, spigoli simili)
  vista: 'fronte' | 'lato' | 'misto';
  visibilita: number;
};

const sub3 = (a: P3, b: P3): P3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mid3 = (a: P3, b: P3): P3 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
const len3 = (a: P3) => Math.hypot(a.x, a.y, a.z);
const deg = (r: number) => (r * 180) / Math.PI;

export function angleAt(a: P3, b: P3, c: P3): number {
  const v1 = sub3(a, b), v2 = sub3(c, b);
  const cos = (v1.x * v2.x + v1.y * v2.y + v1.z * v2.z) / (len3(v1) * len3(v2) + 1e-9);
  return deg(Math.acos(Math.max(-1, Math.min(1, cos))));
}

/** Inclinazione di una linea rispetto all'orizzontale, ricondotta a [-90, 90]. */
export function lineTilt(a: P2, b: P2): number {
  let t = deg(Math.atan2(-(b.y - a.y), b.x - a.x));
  if (t > 90) t -= 180;
  if (t < -90) t += 180;
  return t;
}

/** Inclinazione del segmento da p0 a p1 rispetto alla verticale (positivo = verso destra). */
export function verticalLean(p0: { x: number; y: number }, p1: { x: number; y: number }): number {
  return deg(Math.atan2(p1.x - p0.x, -(p1.y - p0.y)));
}

export function frameMetrics(pts: P2[], w: P3[]): FrameMetrics {
  const kneeL = angleAt(w[IDX.lh], w[IDX.lk], w[IDX.la]);
  const kneeR = angleAt(w[IDX.rh], w[IDX.rk], w[IDX.ra]);
  const hip = mid3(w[IDX.lh], w[IDX.rh]);
  const sh = mid3(w[IDX.ls], w[IDX.rs]);
  const kn = mid3(w[IDX.lk], w[IDX.rk]);

  const m2 = (i: number, j: number) => ({ x: (pts[i].x + pts[j].x) / 2, y: (pts[i].y + pts[j].y) / 2 });
  const feet2 = m2(IDX.la, IDX.ra), hips2 = m2(IDX.lh, IDX.rh), sh2 = m2(IDX.ls, IDX.rs);

  // direzione degli sci ~ tallone -> punta del piede, sul piano orizzontale (x, z)
  const skiL = sub3(w[IDX.lt], w[IDX.lheel]), skiR = sub3(w[IDX.rt], w[IDX.rheel]);
  let sx = (skiL.x + skiR.x) / 2, sz = (skiL.z + skiR.z) / 2;
  const sn = Math.hypot(sx, sz) + 1e-9; sx /= sn; sz /= sn;
  const shl = sub3(w[IDX.rs], w[IDX.ls]);
  const ln = Math.hypot(shl.x, shl.z) + 1e-9;
  const cos = Math.abs(sx * shl.x + sz * shl.z) / ln;
  const spalleVsSci = 90 - deg(Math.acos(Math.max(0, Math.min(1, cos))));

  // bacino sopra i piedi: posizione delle anche rispetto alle caviglie lungo la direzione degli sci
  const ank = mid3(w[IDX.la], w[IDX.ra]);
  const legLen = (len3(sub3(w[IDX.lh], w[IDX.lk])) + len3(sub3(w[IDX.lk], w[IDX.la])) +
    len3(sub3(w[IDX.rh], w[IDX.rk])) + len3(sub3(w[IDX.rk], w[IDX.ra]))) / 2;
  const ancheAvanti = (((hip.x - ank.x) * sx + (hip.z - ank.z) * sz) / (legLen + 1e-9)) * 100;

  // da dove è ripreso: larghezza spalle rispetto alla lunghezza del busto, nell'immagine
  const shW = Math.hypot(pts[IDX.rs].x - pts[IDX.ls].x, pts[IDX.rs].y - pts[IDX.ls].y);
  const torso = Math.hypot(sh2.x - hips2.x, sh2.y - hips2.y) + 1e-9;
  const ratio = shW / torso;
  const vista = ratio < 0.35 ? 'lato' : ratio > 0.9 ? 'fronte' : 'misto';

  // sci paralleli: le due tibie inclinate allo stesso modo (dal video, come i "due spigoli simili" di Carv)
  const tibiaL = verticalLean(pts[IDX.la], pts[IDX.lk]);
  const tibiaR = verticalLean(pts[IDX.ra], pts[IDX.rk]);

  const key = [IDX.ls, IDX.rs, IDX.lh, IDX.rh, IDX.lk, IDX.rk, IDX.la, IDX.ra];
  return {
    ginocchio: Math.max(kneeL, kneeR),
    anca: angleAt(sh, hip, kn),
    spalleIncl: lineTilt(pts[IDX.ls], pts[IDX.rs]),
    gambeIncl: verticalLean(feet2, hips2),
    bustoIncl: verticalLean(hips2, sh2),
    spalleVsSci,
    ancheAvanti,
    tibieDiff: Math.abs(tibiaL - tibiaR),
    vista,
    visibilita: key.reduce((s, i) => s + pts[i].v, 0) / key.length,
  };
}
