import { useEffect, useMemo, useRef, useState } from 'react';
import { analizza, type Analisi } from './analyze';
import { EDGES } from './pose';
import { trovaCurve } from './turns';
import { giudicaCurva, giudicaRitmo, priorita, punteggi, type Esito, type Livello } from './rules';
import { caricaStorico, salvaNelloStorico, type VoceStorico } from './storage';

type Fase = 'scelta' | 'tocco' | 'analisi' | 'referto';

const COLORE: Record<Esito, string> = {
  ok: 'var(--ok)', attenzione: 'var(--warn)', 'da correggere': 'var(--bad)', 'non valutabile': 'var(--muted)',
};

export default function App() {
  const [livello, setLivello] = useState<Livello>(() => (localStorage.getItem('livello') as Livello) || 'avanzato');
  const [fase, setFase] = useState<Fase>('scelta');
  const [url, setUrl] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [tap, setTap] = useState<{ x: number; y: number; t: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [errore, setErrore] = useState<string | null>(null);
  const [analisi, setAnalisi] = useState<Analisi | null>(null);
  const [durata, setDurata] = useState(1);
  const [storico, setStorico] = useState<VoceStorico[]>(caricaStorico);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { try { localStorage.setItem('livello', livello); } catch { /* ignore */ } }, [livello]);

  const referto = useMemo(() => {
    if (!analisi) return null;
    const curve = trovaCurve(analisi.campioni);
    const giudizi = curve.map((c) => giudicaCurva(c, livello));
    return { curve, giudizi, ritmo: giudicaRitmo(curve), punti: punteggi(giudizi), top: priorita(giudizi) };
  }, [analisi, livello]);

  // disegna lo scheletro sopra il video, sincronizzato con il tempo
  useEffect(() => {
    const v = videoRef.current, c = overlayRef.current;
    if (!v || !c) return;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const r = v.getBoundingClientRect();
      if (c.width !== Math.round(r.width) || c.height !== Math.round(r.height)) { c.width = Math.round(r.width); c.height = Math.round(r.height); }
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, c.width, c.height);
      const { s, ox, oy } = fit(v, c);
      if (fase === 'tocco' && tap && Math.abs(v.currentTime - tap.t) < 0.05) {
        ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(ox + tap.x * s, oy + tap.y * s, 22, 0, Math.PI * 2); ctx.stroke();
      }
      if (fase === 'referto' && analisi) {
        const cs = analisi.campioni;
        let best = null as (typeof cs)[number] | null;
        for (const x of cs) if (!best || Math.abs(x.t - v.currentTime) < Math.abs(best.t - v.currentTime)) best = x;
        if (best?.pose && Math.abs(best.t - v.currentTime) < 0.15) {
          const p = best.pose.pts;
          ctx.strokeStyle = '#ffd60a'; ctx.lineWidth = 3;
          for (const [a, b] of EDGES) {
            ctx.beginPath(); ctx.moveTo(ox + p[a].x * s, oy + p[a].y * s); ctx.lineTo(ox + p[b].x * s, oy + p[b].y * s); ctx.stroke();
          }
          ctx.fillStyle = '#ff3b30';
          for (let i = 11; i < 33; i++) { ctx.beginPath(); ctx.arc(ox + p[i].x * s, oy + p[i].y * s, 3.5, 0, Math.PI * 2); ctx.fill(); }
        }
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [fase, tap, analisi, url]);

  function scegliFile(f: File | undefined) {
    if (!f) return;
    if (url) URL.revokeObjectURL(url);
    setUrl(URL.createObjectURL(f)); setNome(f.name);
    setTap(null); setAnalisi(null); setErrore(null); setFase('tocco');
  }

  function tocca(e: React.PointerEvent<HTMLCanvasElement>) {
    if (fase !== 'tocco') return;
    const v = videoRef.current!, c = overlayRef.current!;
    v.pause();
    const r = c.getBoundingClientRect();
    const { s, ox, oy } = fit(v, c);
    const x = (e.clientX - r.left - ox) / s, y = (e.clientY - r.top - oy) / s;
    if (x < 0 || y < 0 || x > v.videoWidth || y > v.videoHeight) return;
    setTap({ x, y, t: v.currentTime });
  }

  async function avvia() {
    if (!tap || !videoRef.current) return;
    setFase('analisi'); setProgress(0); setErrore(null);
    try {
      const a = await analizza(videoRef.current, tap, setProgress);
      setAnalisi(a); setFase('referto');
      videoRef.current.currentTime = tap.t;
      const curve = trovaCurve(a.campioni);
      const p = punteggi(curve.map((c) => giudicaCurva(c, livello)));
      setStorico(salvaNelloStorico({ data: new Date().toISOString(), nome, curve: curve.length, punti: p }));
    } catch (err) {
      setErrore(err instanceof Error ? err.message : String(err)); setFase('tocco');
    }
  }

  const vaiA = (t: number) => { const v = videoRef.current; if (v) { v.pause(); v.currentTime = t; } };

  return (
    <main>
      <header>
        <h1>Sci Carving</h1>
        <p className="sub">Carica una tua sciata e ricevi le correzioni sulla tecnica di carving.</p>
      </header>

      <section className="card">
        <label className="row">
          <span>Il tuo livello</span>
          <select value={livello} onChange={(e) => setLivello(e.target.value as Livello)}>
            <option value="avanzato">Avanzato</option>
            <option value="intermedio">Intermedio</option>
          </select>
        </label>
        <label className="file">
          <input type="file" accept="video/*" onChange={(e) => scegliFile(e.target.files?.[0])} />
          <span>{url ? 'Cambia video' : 'Scegli o registra un video'}</span>
        </label>
        {fase === 'scelta' && (
          <details>
            <summary>Come filmare per un'analisi migliore</summary>
            <ul>
              <li>Telefono fermo, in verticale, senza zoom che cambia.</li>
              <li>Lo sciatore deve occupare almeno un terzo dell'altezza dell'immagine.</li>
              <li>Ripresa da davanti-sotto o da dietro per le spalle; di lato per il bacino.</li>
              <li>4-8 curve, 10-20 secondi.</li>
            </ul>
          </details>
        )}
      </section>

      {url && (
        <section className="card">
          <div className="stage">
            <video ref={videoRef} src={url} onLoadedMetadata={(e) => setDurata(e.currentTarget.duration || 1)} playsInline controls={fase !== 'tocco'} muted preload="auto" />
            <canvas ref={overlayRef} className={fase === 'tocco' ? 'tap' : 'over'} onPointerDown={tocca} />
          </div>
          {fase === 'tocco' && (
            <>
              <input className="scrub" type="range" min={0} max={durata} step={0.033}
                defaultValue={0} onChange={(e) => vaiA(Number(e.target.value))} aria-label="Scorri il video" />
              <p className="hint">Scorri fino a quando lo sciatore si vede bene, poi <b>tocca lo sciatore</b>. L'analisi parte da quel momento.</p>
              {errore && <p className="err">{errore}</p>}
              <button disabled={!tap} onClick={avvia}>Analizza la sciata</button>
            </>
          )}
          {fase === 'analisi' && (
            <div className="progress"><div style={{ width: `${Math.round(progress * 100)}%` }} /><span>Analisi in corso, {Math.round(progress * 100)}%</span></div>
          )}
        </section>
      )}

      {fase === 'referto' && referto && (
        <section className="card">
          <h2>Il tuo referto</h2>
          {referto.curve.length === 0 ? (
            <p>Non sono riuscito a riconoscere curve complete. Prova con una ripresa più vicina e più stabile.</p>
          ) : (
            <>
              <p className="sub">{referto.curve.length} curve analizzate. Tocca una curva per rivederla.</p>
              <div className="scores">
                {referto.punti.map((p) => (
                  <div key={p.voce} className="score">
                    <span>{p.voce}</span>
                    <div className="bar"><div style={{ width: `${Number.isNaN(p.punti) ? 0 : p.punti}%` }} /></div>
                    <b>{Number.isNaN(p.punti) ? '–' : p.punti}</b>
                  </div>
                ))}
              </div>
              {referto.top.length > 0 && (
                <>
                  <h3>Su cosa lavorare</h3>
                  <ol className="tips">{referto.top.map((g) => <li key={g.voce}><b>{g.voce}.</b> {g.consiglio}</li>)}</ol>
                </>
              )}
              {referto.ritmo && <p className="sub">Ritmo tra le curve: <b style={{ color: COLORE[referto.ritmo.esito] }}>{referto.ritmo.esito}</b> ({referto.ritmo.misura}).</p>}
              <h3>Curva per curva</h3>
              <div className="turns">
                {referto.curve.map((c, i) => (
                  <button key={i} className="turn" onClick={() => vaiA(c.apice)}>
                    <span className="tname">Curva {i + 1} a {c.lato} <small>{c.apice.toFixed(1)} s</small></span>
                    {referto.giudizi[i].map((g) => (
                      <span key={g.voce} className="chip" title={g.misura}>
                        <i style={{ background: COLORE[g.esito] }} />{g.voce}: {g.esito}
                      </span>
                    ))}
                  </button>
                ))}
              </div>
              <p className="note">Prototipo: le misure sono stime dal video e dipendono dall'angolo di ripresa. Le soglie sono in taratura con il maestro.</p>
            </>
          )}
        </section>
      )}

      {storico.length > 0 && (
        <section className="card">
          <h2>I tuoi progressi</h2>
          <table>
            <thead><tr><th>Data</th>{storico[0].punti.map((p) => <th key={p.voce}>{p.voce}</th>)}</tr></thead>
            <tbody>
              {storico.map((s) => (
                <tr key={s.data}><td>{new Date(s.data).toLocaleDateString('it-IT')}</td>
                  {s.punti.map((p) => <td key={p.voce}>{Number.isNaN(p.punti) || p.punti === null ? '–' : p.punti}</td>)}</tr>
              ))}
            </tbody>
          </table>
          <p className="note">Per ora lo storico resta solo su questo telefono.</p>
        </section>
      )}
    </main>
  );
}

/** Scala e margini del video dentro il suo riquadro (object-fit: contain). */
function fit(v: HTMLVideoElement, c: HTMLCanvasElement) {
  const vw = v.videoWidth || 1, vh = v.videoHeight || 1;
  const s = Math.min(c.width / vw, c.height / vh);
  return { s, ox: (c.width - vw * s) / 2, oy: (c.height - vh * s) / 2 };
}
