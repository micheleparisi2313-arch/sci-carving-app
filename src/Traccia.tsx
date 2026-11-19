import type { Curva } from './rules';

/**
 * La firma visiva dell'app: la traccia lasciata sulla neve da una sciata in carving.
 * Ogni arco è una curva analizzata; più è alto il punteggio, più il binario è netto e pieno.
 * Toccare un arco riporta il video al momento di massimo spigolo di quella curva.
 */
export function Traccia({ curve, punti, onSelect }: { curve: Curva[]; punti: number[]; onSelect: (t: number) => void }) {
  const n = curve.length;
  if (!n) return null;
  const W = 640, H = 168, padX = 28, mid = 92, amp = 46;
  const step = (W - padX * 2) / n;
  // un arco per curva: semionda da centro a centro, verso l'alto (destra) o il basso (sinistra)
  const arc = (i: number, off: number) => {
    const x0 = padX + i * step, x1 = x0 + step;
    const dir = curve[i].lato === 'destra' ? -1 : 1;
    const y = mid + dir * amp;
    return `M${x0} ${mid + off}C${x0 + step * 0.35} ${y + off} ${x1 - step * 0.35} ${y + off} ${x1} ${mid + off}`;
  };
  return (
    <figure className="traccia">
      <figcaption>La tua traccia · {n} curve</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Traccia di ${n} curve con il punteggio di ciascuna`}>
        {curve.map((c, i) => {
          const p = punti[i];
          const forza = Math.max(0.18, p / 100);
          const x = padX + (i + 0.5) * step;
          const yLab = c.lato === 'destra' ? mid - amp - 2 : mid + amp + 26;
          return (
            <g key={i} className="arco" tabIndex={0} role="button" aria-label={`Curva ${i + 1}, ${p} punti`}
              onClick={() => onSelect(c.apice)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(c.apice)}>
              <path d={arc(i, 0)} className="hit" />
              <path d={arc(i, -3.5)} className="binario" style={{ opacity: forza }} />
              <path d={arc(i, 3.5)} className="binario" style={{ opacity: forza }} />
              <text x={x} y={yLab} textAnchor="middle" className="pt">{p}</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
