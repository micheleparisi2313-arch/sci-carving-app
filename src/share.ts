// Crea una clip verticale da condividere: video, scheletro, Carving Score e nome dell'app.

import type { Analisi } from './analyze';
import { EDGES } from './pose';

function pickMime(): string {
  const options = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  return options.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? '';
}

export async function creaClip(
  video: HTMLVideoElement,
  analisi: Analisi,
  titolo: string,
  sottotitolo: string,
  onProgress: (p: number) => void,
): Promise<File> {
  const mime = pickMime();
  if (!mime) throw new Error('Questo browser non può registrare la clip. Prova con Chrome o Safari aggiornati.');
  const vw = video.videoWidth, vh = video.videoHeight;
  const scale = Math.min(1, 720 / vw);
  const W = Math.round(vw * scale), H = Math.round(vh * scale);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const cs = analisi.campioni.filter((c) => c.pose);
  const t0 = analisi.campioni[0]?.t ?? 0;
  const t1 = analisi.campioni[analisi.campioni.length - 1]?.t ?? video.duration;

  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));

  const fs = Math.round(W / 16);
  const draw = () => {
    ctx.drawImage(video, 0, 0, W, H);
    const t = video.currentTime;
    let best: (typeof cs)[number] | null = null;
    for (const c of cs) if (!best || Math.abs(c.t - t) < Math.abs(best.t - t)) best = c;
    if (best?.pose && Math.abs(best.t - t) < 0.15) {
      const p = best.pose.pts;
      ctx.strokeStyle = '#ffd60a'; ctx.lineWidth = Math.max(2, W / 200);
      for (const [a, b] of EDGES) { ctx.beginPath(); ctx.moveTo(p[a].x * scale, p[a].y * scale); ctx.lineTo(p[b].x * scale, p[b].y * scale); ctx.stroke(); }
    }
    const g = ctx.createLinearGradient(0, 0, 0, fs * 3.4);
    g.addColorStop(0, 'rgba(0,0,0,.65)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, fs * 3.4);
    ctx.fillStyle = '#fff'; ctx.font = `700 ${fs}px system-ui, sans-serif`; ctx.fillText(titolo, fs * 0.6, fs * 1.4);
    ctx.font = `500 ${Math.round(fs * 0.6)}px system-ui, sans-serif`; ctx.fillText(sottotitolo, fs * 0.6, fs * 2.3);
    ctx.font = `600 ${Math.round(fs * 0.55)}px system-ui, sans-serif`; ctx.textAlign = 'right';
    ctx.fillText('Sci Carving', W - fs * 0.6, H - fs * 0.6); ctx.textAlign = 'left';
  };

  video.pause();
  await new Promise<void>((r) => { video.addEventListener('seeked', () => r(), { once: true }); video.currentTime = t0; });
  draw();
  rec.start(250);
  await video.play();
  await new Promise<void>((resolve) => {
    const tick = () => {
      draw();
      onProgress((video.currentTime - t0) / Math.max(0.01, t1 - t0));
      if (video.currentTime >= t1 || video.ended) { video.pause(); resolve(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  rec.stop();
  await stopped;
  onProgress(1);
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  return new File(chunks, `sci-carving.${ext}`, { type: mime.split(';')[0] });
}

/** Condivide la clip (WhatsApp, Instagram...) o, se non si può, la scarica. */
export async function condividi(file: File): Promise<'condivisa' | 'scaricata'> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: 'La mia sciata', text: 'Il mio Carving Score' }); return 'condivisa'; } catch { /* annullata */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return 'scaricata';
}
