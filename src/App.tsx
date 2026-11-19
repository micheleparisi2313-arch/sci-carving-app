import { useEffect, useMemo, useRef, useState } from 'react';
import { analizza, type Analisi } from './analyze';
import { EDGES } from './pose';
import { trovaCurve } from './turns';
import { CURVE_CLASSIFICA, CURVE_MINIME, carvingScore, giudizio7, punteggioClassifica, punteggioCurva, giudicaCurva, giudicaRitmo, priorita, punteggi, riconosciArco, simmetria, type Arco, type Esito, type Giudizio, type Livello } from './rules';
import { aggiornaSkiIq, caricaStorico, salvaNelloStorico, type VoceStorico } from './storage';
import { condividi, creaClip } from './share';
import { Progressi } from './Progressi';
import { Traccia } from './Traccia';
import { Guida } from './Guida';

type Fase = 'scelta' | 'tocco' | 'analisi' | 'referto';

const COLORE: Record<Esito, string> = {
  ok: 'var(--ok)', attenzione: 'var(--warn)', 'da correggere': 'var(--bad)', 'non valutabile': 'var(--muted)',
};

export default function App() {
  const [guida, setGuida] = useState(() => location.hash === '#guida');
  useEffect(() => {
    const on = () => setGuida(location.hash === '#guida');
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  const [livello, setLivello] = useState<Livello>(() => (localStorage.getItem('livello') as Livello) || 'avanzato');
  const [sceltaArco, setSceltaArco] = useState<'auto' | Arco>('auto');
  const [fase, setFase] = useState<Fase>('scelta');
  const [url, setUrl] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [tap, setTap] = useState<{ x: number; y: number; t: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [errore, setErrore] = useState<string | null>(null);
  const [analisi, setAnalisi] = useState<Analisi | null>(null);
  const [durata, setDurata] = useState(1);
  const [storico, setStorico] = useState<VoceStorico[]>(caricaStorico);
  const [clip, setClip] = useState<{ stato: 'idle' | 'rec' | 'fatto'; p: number; msg?: string }>({ stato: 'idle', p: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { try { localStorage.setItem('livello', livello); } catch { /* ignore */ } }, [livello]);

  const referto = useMemo(() => {
    if (!analisi) return null;
    const curve = trovaCurve(analisi.campioni);
    const arco = sceltaArco === 'auto' ? riconosciArco(curve) : sceltaArco;
    const giudizi = curve.map((c) => giudicaCurva(c, livello, arco));
    const punti = punteggi(giudizi);
    const perCurva = giudizi.map(punteggioCurva);
    return {
      perCurva, classifica: punteggioClassifica(perCurva),
      curve, giudizi, punti, ritmo: giudicaRitmo(curve), top: priorita(giudizi),
      simm: simmetria(curve, giudizi), score: carvingScore(punti, curve.length), arco,
    };
  }, [analisi, livello, sceltaArco]);

  // disegna lo scheletro sopra il video, sincronizzato con il tempo
  useEffect(() => {
    const v = videoRef.current, c = overlayRef.current;
    if (!v || !c) return;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const r = v.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const cw = Math.round(r.width), ch = Math.round(r.height);
      if (c.width !== Math.round(cw * dpr) || c.height !== Math.round(ch * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
      const ctx = c.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      const { s, ox, oy } = fit(v, cw, ch);
      if (fase === 'tocco' && tap && Math.abs(v.currentTime - tap.t) < 0.05) {
        ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(ox + tap.x * s, oy + tap.y * s, 22, 0, Math.PI * 2); ctx.stroke();
      }
      if (fase === 'referto' && analisi) {
        const cs = analisi.campioni;
        let best = null as (typeof cs)[number] | null;
        for (const x of cs) if (!best || Math.abs(x.t - v.currentTime) < Math.abs(best.t - v.currentTime)) best = x;
        let skierY = NaN;
        if (best?.pose && Math.abs(best.t - v.currentTime) < 0.15) {
          const p = best.pose.pts;
          skierY = oy + ((p[23].y + p[24].y) / 2) * s;
          ctx.strokeStyle = '#ffd60a'; ctx.lineWidth = 3;
          for (const [a, b] of EDGES) {
            ctx.beginPath(); ctx.moveTo(ox + p[a].x * s, oy + p[a].y * s); ctx.lineTo(ox + p[b].x * s, oy + p[b].y * s); ctx.stroke();
          }
          ctx.fillStyle = '#ff3b30';
          for (let i = 11; i < 33; i++) { ctx.beginPath(); ctx.arc(ox + p[i].x * s, oy + p[i].y * s, 3.5, 0, Math.PI * 2); ctx.fill(); }
        }
        // giudizi in tempo reale sulla curva in corso
        if (referto) {
          const t = v.currentTime;
          const i = referto.curve.findIndex((c) => t >= c.inizio - 0.15 && t <= c.fine + 0.15);
          // il pannello va dal lato opposto allo sciatore, per non coprirlo
          if (i >= 0) pannello(ctx, cw, ch, oy, skierY < ch / 2, i, referto.curve[i].lato, referto.perCurva[i], referto.giudizi[i]);
        }
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [fase, tap, analisi, url, referto]);

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
    const { s, ox, oy } = fit(v, r.width, r.height);
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
      const arco = sceltaArco === 'auto' ? riconosciArco(curve) : sceltaArco;
      const p = punteggi(curve.map((c) => giudicaCurva(c, livello, arco)));
      const sc = carvingScore(p, curve.length);
      const cl = punteggioClassifica(curve.map((c) => punteggioCurva(giudicaCurva(c, livello, arco))));
      setStorico(salvaNelloStorico({ data: new Date().toISOString(), nome, curve: curve.length, score: sc.punti, valido: sc.valido, classifica: cl ?? undefined, punti: p }));
    } catch (err) {
      setErrore(err instanceof Error ? err.message : String(err)); setFase('tocco');
    }
  }

  async function faiClip() {
    if (!videoRef.current || !analisi || !referto) return;
    setClip({ stato: 'rec', p: 0 });
    try {
      const f = await creaClip(videoRef.current, analisi, `Carving Score ${referto.score.punti}`,
        `${referto.score.fascia} · ${referto.curve.length} curve`, (p) => setClip({ stato: 'rec', p }));
      const esito = await condividi(f);
      setClip({ stato: 'fatto', p: 1, msg: esito === 'condivisa' ? 'Clip condivisa.' : 'Clip salvata nei download.' });
    } catch (err) {
      setClip({ stato: 'idle', p: 0, msg: err instanceof Error ? err.message : String(err) });
    }
  }

  const vaiA = (t: number) => { const v = videoRef.current; if (v) { v.pause(); v.currentTime = t; } };

  if (guida) return <Guida />;

  return (
    <main>
      <header className="mast">
        <p className="eyebrow">Metodo, cura, costanza.</p>
        <h1>Sci <span>Carving</span></h1>
        <p className="lede">Carica una tua sciata. Ricevi le correzioni del maestro, curva per curva.</p>
      </header>

      <section className="card">
        <label className="row">
          <span>Il tuo livello</span>
          <select value={livello} onChange={(e) => setLivello(e.target.value as Livello)}>
            <option value="avanzato">Avanzato</option>
            <option value="intermedio">Intermedio</option>
          </select>
        </label>
        <label className="row">
          <span>Arco di curva</span>
          <select value={sceltaArco} onChange={(e) => setSceltaArco(e.target.value as 'auto' | Arco)}>
            <option value="auto">Riconosci dal video</option>
            <option value="medio">Arco medio</option>
            <option value="corto">Arco corto</option>
          </select>
        </label>
        <label className="file">
          <input type="file" accept="video/*" onChange={(e) => scegliFile(e.target.files?.[0])} />
          <span>{url ? 'Cambia video' : 'Scegli o registra un video'}</span>
        </label>
        <a className="guide-link" href="#guida">Come filmare per un punteggio valido</a>
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
          {referto.curve.length === 0 ? (
            <><h2>Il tuo referto</h2><p>Non sono riuscito a riconoscere curve complete. Prova con una ripresa più vicina e più stabile.</p></>
          ) : (
            <>
              <div className="hero">
                <div className="big">{referto.score.punti}</div>
                <div>
                  <div className="label">Carving Score</div>
                  <div className="fascia">{referto.score.fascia}</div>
                  <div className="g7big">{giudizio7(referto.score.punti)}</div>
                  <div className="sub">
                    {referto.curve.length} curve analizzate, arco {referto.arco}
                    {sceltaArco === 'auto' ? ' (riconosciuto dal ritmo)' : ''}.{' '}
                    {referto.score.valido ? 'Punteggio valido.' : `Provvisorio: servono almeno ${CURVE_MINIME} curve.`}
                  </div>
                  <div className="rank">
                    {referto.classifica !== null
                      ? <>Punteggio classifica: <b>{referto.classifica}</b> (migliori {CURVE_CLASSIFICA} curve di fila)</>
                      : `Per entrare in classifica con gli amici servono ${CURVE_CLASSIFICA} curve.`}
                  </div>
                </div>
              </div>

              <Traccia curve={referto.curve} punti={referto.perCurva} onSelect={vaiA} />

              {referto.top.length > 0 && (
                <>
                  <h3>Su cosa lavorare</h3>
                  <ol className="tips">{referto.top.map((g) => <li key={g.voce}><b>{g.voce}.</b> {g.consiglio}</li>)}</ol>
                </>
              )}

              <h3>I criteri del maestro</h3>
              <Barre punti={referto.punti.filter((p) => p.gruppo === 'maestro')} />
              <h3>Gli sci, stimati dal corpo</h3>
              <Barre punti={referto.punti.filter((p) => p.gruppo === 'sci')} />
              {referto.ritmo && <p className="sub">Ritmo tra le curve: <b style={{ color: COLORE[referto.ritmo.esito] }}>{referto.ritmo.esito}</b> ({referto.ritmo.misura}).</p>}
              {referto.simm && <p className="sub">Destra {referto.simm.destra}, sinistra {referto.simm.sinistra}: simmetria <b style={{ color: COLORE[referto.simm.esito] }}>{referto.simm.esito}</b>.</p>}

              <button className="share" disabled={clip.stato === 'rec'} onClick={faiClip}>
                {clip.stato === 'rec' ? `Preparo la clip, ${Math.round(clip.p * 100)}%` : 'Crea la clip da condividere'}
              </button>
              {clip.msg && <p className="sub">{clip.msg}</p>}

              <h3>Curva per curva</h3>
              <p className="sub">Tocca una curva per rivederla nel punto di massimo spigolo.</p>
              <div className="turns">
                {referto.curve.map((c, i) => (
                  <button key={i} className="turn" onClick={() => vaiA(c.apice)}>
                    <span className="tname">Curva {i + 1} a {c.lato} <small>{c.apice.toFixed(1)} s</small><em className="tscore">{giudizio7(referto.perCurva[i])} {referto.perCurva[i]}</em></span>
                    {referto.giudizi[i].map((g) => (
                      <span key={g.voce} className="chip" title={g.misura}>
                        <i style={{ background: COLORE[g.esito] }} />{g.voce}: {giudizio7(g.punti)}{Number.isNaN(g.punti) ? '' : ` ${g.punti}`}
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
          <Progressi storico={storico} />
          <table>
            <thead><tr><th>Data</th><th>Carving Score</th><th>Curve</th><th>Classifica</th><th>Ski:IQ Carv</th></tr></thead>
            <tbody>
              {storico.map((s) => (
                <tr key={s.data}>
                  <td>{new Date(s.data).toLocaleDateString('it-IT')}</td>
                  <td>{s.score ?? '–'}{s.valido === false ? ' (provv.)' : ''}</td>
                  <td>{s.curve}</td>
                  <td>{s.classifica ?? '–'}</td>
                  <td>
                    <input className="iq" inputMode="numeric" placeholder="facoltativo" defaultValue={s.skiIq ?? ''}
                      aria-label="Ski:IQ di Carv della giornata"
                      onBlur={(e) => { const n = parseInt(e.target.value, 10); setStorico(aggiornaSkiIq(s.data, Number.isNaN(n) ? undefined : n)); }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">Hai Carv? Inserisci lo Ski:IQ della giornata per vedere tutto in un posto. Per ora lo storico resta solo su questo telefono.</p>
        </section>
      )}
    </main>
  );
}

function Barre({ punti }: { punti: { voce: string; punti: number }[] }) {
  return (
    <div className="scores">
      {punti.map((p) => (
        <div key={p.voce} className="score">
          <span>{p.voce}<small className="g7">{giudizio7(p.punti)}</small></span>
          <div className="bar"><div style={{ width: `${Number.isNaN(p.punti) ? 0 : p.punti}%` }} /></div>
          <b>{Number.isNaN(p.punti) ? '–' : p.punti}</b>
        </div>
      ))}
    </div>
  );
}

/** Scala e margini del video dentro il suo riquadro (object-fit: contain). */
function fit(v: HTMLVideoElement, w: number, h: number) {
  const vw = v.videoWidth || 1, vh = v.videoHeight || 1;
  const s = Math.min(w / vw, h / vh);
  return { s, ox: (w - vw * s) / 2, oy: (h - vh * s) / 2 };
}

const TINTA: Record<string, string> = { ok: '#7fd39b', attenzione: '#f0a94e', 'da correggere': '#f08273', 'non valutabile': '#9aa3a0' };

/** Riquadro sopra il video: giudizio a 7 livelli e punti per ogni criterio della curva in corso. */
function pannello(ctx: CanvasRenderingContext2D, cw: number, ch: number, oy: number, sotto: boolean, i: number, lato: string, punti: number, gs: Giudizio[]) {
  const righe = gs.filter((g) => g.esito !== 'non valutabile');
  // video orizzontale: il pannello va nella banda nera sopra il video, più compatto, così non copre la sciata
  const banda = oy > 150;
  const rh = banda ? 17 : 19, h = 46 + righe.length * rh, w = Math.min(cw - 20, 300);
  // in basso lascia spazio ai comandi del video
  const x = 10, y = banda ? Math.max(6, oy - h - 6) : sotto ? Math.max(10, ch - h - 64) : 10;
  ctx.fillStyle = 'rgba(15, 23, 20, 0.78)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.font = '600 14px "Instrument Sans", system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`Curva ${i + 1} a ${lato}`, x + 12, y + 22);
  ctx.textAlign = 'right'; ctx.fillStyle = '#e0913a'; ctx.font = '600 14px "IBM Plex Mono", monospace';
  ctx.fillText(`${giudizio7(punti)} ${punti}`, x + w - 12, y + 22);
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.moveTo(x + 12, y + 32); ctx.lineTo(x + w - 12, y + 32); ctx.stroke();
  righe.forEach((g, k) => {
    const yy = y + 50 + k * rh;
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.font = '12px "Instrument Sans", system-ui, sans-serif';
    ctx.fillText(g.voce, x + 12, yy);
    ctx.textAlign = 'right'; ctx.fillStyle = TINTA[g.esito]; ctx.font = '500 12px "IBM Plex Mono", monospace';
    ctx.fillText(`${giudizio7(g.punti)} ${g.punti}`, x + w - 12, yy);
  });
  ctx.textAlign = 'left';
}
