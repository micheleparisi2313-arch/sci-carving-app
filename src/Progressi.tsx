import type { VoceStorico } from './storage';

/** Grafico del Carving Score nel tempo (e dello Ski:IQ di Carv, se inserito). */
export function Progressi({ storico }: { storico: VoceStorico[] }) {
  const pts = [...storico].reverse().filter((s) => typeof s.score === 'number');
  if (pts.length < 2) return <p className="sub">Il grafico dei progressi compare dalla seconda analisi.</p>;
  const W = 640, H = 180, L = 36, R = 12, T = 12, B = 24;
  const x = (i: number) => L + (i / (pts.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / 100) * (H - T - B);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.score!).toFixed(1)}`).join(' ');
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Carving Score nel tempo">
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{v}</text>
        </g>
      ))}
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
      {pts.map((p, i) => (
        <g key={p.data}>
          <circle cx={x(i)} cy={y(p.score!)} r="4" fill="var(--accent)" />
          <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">
            {new Date(p.data).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
          </text>
        </g>
      ))}
    </svg>
  );
}
