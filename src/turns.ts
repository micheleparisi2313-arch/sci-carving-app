// Divide la sciata in curve usando l'inclinazione delle gambe (il segno cambia a ogni cambio di spigolo).

import type { FrameMetrics } from './metrics';
import type { Curva } from './rules';

export type Campione = { t: number; m: FrameMetrics | null };

function smoothSeries(v: (number | null)[], k = 5): (number | null)[] {
  return v.map((x, i) => {
    if (x === null) return null;
    const win = v.slice(Math.max(0, i - (k >> 1)), i + (k >> 1) + 1).filter((y): y is number => y !== null);
    if (win.length < 3) return null;
    const s = [...win].sort((a, b) => a - b);
    return s[s.length >> 1];
  });
}

export function trovaCurve(campioni: Campione[], minDurata = 0.3): Curva[] {
  const g = smoothSeries(campioni.map((c) => c.m?.gambeIncl ?? null));
  const curve: Curva[] = [];
  let i = 0;
  while (i < campioni.length) {
    const gi = g[i];
    if (gi === null || Math.abs(gi) < 12) { i++; continue; }
    const sgn = Math.sign(gi);
    let j = i;
    while (j < campioni.length) {
      const gj = g[j];
      if (gj === null || Math.sign(gj) !== sgn || Math.abs(gj) < 8) break;
      j++;
    }
    const seg = campioni.slice(i, j);
    if (seg.length >= 3 && seg[seg.length - 1].t - seg[0].t >= minDurata) {
      const abs = g.slice(i, j).map((x) => Math.abs(x as number));
      const max = Math.max(...abs);
      const iApice = abs.indexOf(max);
      const i70 = abs.findIndex((x) => x >= 0.7 * max);
      const t0 = seg[0].t, t1 = seg[seg.length - 1].t;
      curve.push({
        inizio: t0,
        fine: t1,
        apice: seg[iApice].t,
        lato: sgn > 0 ? 'destra' : 'sinistra',
        frames: seg.map((s) => s.m!).filter(Boolean),
        apiceFrame: seg[iApice].m!,
        costruzioneSpigolo: (seg[i70].t - t0) / Math.max(1e-6, t1 - t0),
      });
    }
    i = j;
  }
  return curve;
}
