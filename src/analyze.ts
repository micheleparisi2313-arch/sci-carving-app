// Analisi del video: segue lo sciatore toccato dall'utente e misura ogni fotogramma.

import { bodyBox, detectIn, loadPose, type Pose } from './pose';
import { frameMetrics } from './metrics';
import type { Campione } from './turns';

export type Analisi = { campioni: (Campione & { pose: Pose | null })[]; fps: number };

const KEY = [11, 12, 23, 24, 25, 26, 27, 28];
const visib = (p: Pose) => KEY.reduce((s, i) => s + p.pts[i].v, 0) / KEY.length;

function seek(video: HTMLVideoElement, t: number): Promise<void> {
  // Safari a volte non manda "seeked" (stesso istante, video non ancora caricato): non restare bloccati.
  return new Promise((res) => {
    let fatto = false;
    const done = () => { if (fatto) return; fatto = true; video.removeEventListener('seeked', done); clearTimeout(timer); res(); };
    const timer = setTimeout(done, 2000);
    video.addEventListener('seeked', done);
    video.currentTime = t;
  });
}

export async function analizza(
  video: HTMLVideoElement,
  tap: { x: number; y: number; t: number },
  onProgress: (p: number) => void,
  fps = 15,
): Promise<Analisi> {
  await loadPose();
  const w = video.videoWidth, h = video.videoHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: false })!;
  const grab = async (t: number) => { await seek(video, t); ctx.drawImage(video, 0, 0, w, h); };
  const box = (cx: number, cy: number, half: number) => ({ x0: cx - half, y0: cy - half, x1: cx + half, y1: cy + half });
  const minDim = Math.min(w, h);

  // 1. aggancio: provo riquadri di grandezza crescente attorno al punto toccato
  await grab(tap.t);
  let prev: { cx: number; cy: number; size: number } | null = null;
  let best = Infinity;
  for (const f of [0.12, 0.2, 0.32, 0.5]) {
    const p = detectIn(canvas, w, h, box(tap.x, tap.y, (minDim * f) / 2 + 20));
    if (!p || visib(p) < 0.4) continue;
    const b = bodyBox(p.pts);
    const d = Math.hypot(b.cx - tap.x, b.cy - tap.y);
    if (d < b.size * 0.8 && d < best) { best = d; prev = b; }
  }
  if (!prev) throw new Error('Non trovo lo sciatore nel punto toccato. Prova a toccare il centro del corpo, in un momento in cui si vede bene.');

  // 2. inseguimento in avanti dal momento toccato
  const campioni: Analisi['campioni'] = [];
  const end = video.duration;
  let lost = 0;
  for (let t = tap.t; t < end; t += 1 / fps) {
    await grab(t);
    let found: Pose | null = null;
    const mults = lost >= 6 ? [0.9, 1.6, 2.5, 4] : [0.9, 1.6, 2.5];
    for (const m of mults) {
      const p = detectIn(canvas, w, h, box(prev.cx, prev.cy, prev.size * m + 20));
      if (!p || visib(p) < 0.4) continue;
      const b = bodyBox(p.pts);
      const jump = Math.hypot(b.cx - prev.cx, b.cy - prev.cy);
      const maxJump = (0.8 + lost * 0.3) * prev.size + 15;
      if (jump > maxJump || b.size < 0.4 * prev.size || b.size > 2.5 * prev.size) continue;
      found = p; prev = b; break;
    }
    if (found) lost = 0; else lost++;
    const usable = found && bodyBox(found.pts).size >= Math.max(50, 0.07 * h) && visib(found) >= 0.5;
    campioni.push({ t, pose: found, m: usable ? frameMetrics(found!.pts, found!.world) : null });
    onProgress((t - tap.t) / Math.max(0.001, end - tap.t));
    if (lost > fps * 2) break; // sciatore uscito dall'inquadratura per più di 2 secondi
  }
  onProgress(1);
  return { campioni, fps };
}
