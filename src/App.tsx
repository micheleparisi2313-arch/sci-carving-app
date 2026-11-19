import { useEffect, useMemo, useRef, useState } from 'react';
import { analizza, DURATA_MAX_S, type Analisi } from './analyze';
import { EDGES, loadPose } from './pose';
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
    const on = () => { setGuida(location.hash === '#guida'); scrollTo(0, 0); };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  const [livello, setLivello] = useState<Livello>(() => leggi('livello', ['avanzato', 'intermedio'], 'avanzato'));
  const [sceltaArco, setSceltaArco] = useState<'auto' | Arco>(() => leggi('arco', ['auto', 'medio', 'corto'], 'auto'));
  const [fase, setFase] = useState<Fase>('scelta');
  const [url, setUrl] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [esempio, setEsempio] = useState(false);
  const [tap, setTap] = useState<{ x: number; y: number; t: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [inizioAnalisi, setInizioAnalisi] = useState(0);
  const [errore, setErrore] = useState<string | null>(null);
  const [analisi, setAnalisi] = useState<Analisi | null>(null);
  const [durata, setDurata] = useState(1);
  const [storico, setStorico] = useState<VoceStorico[]>(caricaStorico);
  const [clip, setClip] = useState<{ stato: 'idle' | 'rec' | 'fatto'; p: number; msg?: string }>({ stato: 'idle', p: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const refertoRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLElement>(null);

  useEffect(() => { scrivi('livello', livello); }, [livello]);
  useEffect(() => { scrivi('arco', sceltaArco); }, [sceltaArco]);

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
        const pulse = 22 + 4 * Math.sin(performance.now() / 180);
        ctx.strokeStyle = '#e0913a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(ox + tap.x * s, oy + tap.y * s, pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#e0913a';
        ctx.beginPath(); ctx.arc(ox + tap.x * s, oy + tap.y * s, 4, 0, Math.PI * 2); ctx.fill();
      }
      if (fase === 'referto' && analisi) {
        const cs = analisi.campioni;
        let best = null as (typeof cs)[number] | null;
        for (const x of cs) if (!best || Math.abs(x.t - v.currentTime) < Math.abs(best.t - v.currentTime)) best = x;
        let skierY = NaN;
        if (best?.pose && Math.abs(best.t - v.currentTime) < 0.15) {
          const p = best.pose.pts;
          skierY = oy + ((p[23].y + p[24].y) / 2) * s;
          // spessori in proporzione allo sciatore: uno sciatore piccolo non viene coperto dai pallini
          const body = p.slice(11, 29).map((q) => q.y);
          const alto = (Math.max(...body) - Math.min(...body)) * s;
          const lw = Math.max(1.5, Math.min(3, alto / 60)), rad = Math.max(1.5, Math.min(3.5, alto / 50));
          ctx.strokeStyle = '#ffd60a'; ctx.lineWidth = lw; ctx.lineCap = 'round';
          for (const [a, b] of EDGES) {
            ctx.beginPath(); ctx.moveTo(ox + p[a].x * s, oy + p[a].y * s); ctx.lineTo(ox + p[b].x * s, oy + p[b].y * s); ctx.stroke();
          }
          ctx.fillStyle = '#ff3b30';
          for (let i = 11; i < 33; i++) { ctx.beginPath(); ctx.arc(ox + p[i].x * s, oy + p[i].y * s, rad, 0, Math.PI * 2); ctx.fill(); }
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

  // iPhone (Safari) non disegna il video finché non parte o non viene spostato: resta nero.
  // Lo avvio un attimo senza audio e lo fermo su un fotogramma, così lo sciatore si vede subito.
  function mostraPrimoFotogramma(v: HTMLVideoElement) {
    setDurata(Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 1);
    const t = esempio && analisi ? analisi.campioni[0]?.t ?? 0 : Math.min(0.05, v.duration / 2 || 0);
    const ferma = () => { v.pause(); try { v.currentTime = t; } catch { /* ignore */ } };
    const p = v.play();
    if (p && typeof p.then === 'function') p.then(ferma, ferma); else ferma();
  }

  function scegliFile(f: File | undefined) {
    if (!f) return;
    if (url && !esempio) URL.revokeObjectURL(url);
    setUrl(URL.createObjectURL(f)); setNome(f.name); setEsempio(false);
    setTap(null); setAnalisi(null); setErrore(null); setClip({ stato: 'idle', p: 0 }); setFase('tocco');
    loadPose().catch(() => { /* riprovo quando parte l'analisi */ }); // il modello si scarica mentre si sceglie il momento
    setTimeout(() => stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
  }

  async function apriEsempio() {
    setErrore(null);
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}esempio/esempio.json`);
      if (!r.ok) throw new Error(`esempio non trovato (${r.status})`);
      const a = (await r.json()) as Analisi;
      if (url && !esempio) URL.revokeObjectURL(url);
      setAnalisi(a); setEsempio(true); setNome('Referto di esempio');
      setTap({ x: 0, y: 0, t: a.campioni[0]?.t ?? 0 });
      setUrl(`${import.meta.env.BASE_URL}esempio/esempio.mp4`); setClip({ stato: 'idle', p: 0 }); setFase('referto');
      setTimeout(() => refertoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    } catch (err) {
      setErrore(`Non riesco ad aprire l'esempio: ${err instanceof Error ? err.message : String(err)}. Controlla la connessione.`);
    }
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
    setFase('analisi'); setProgress(0); setErrore(null); setInizioAnalisi(performance.now());
    const lock = await schermoAcceso();
    try {
      const a = await analizza(videoRef.current, tap, setProgress);
      setAnalisi(a); setFase('referto');
      videoRef.current.currentTime = tap.t;
      const curve = trovaCurve(a.campioni);
      const arco = sceltaArco === 'auto' ? riconosciArco(curve) : sceltaArco;
      const gs = curve.map((c) => giudicaCurva(c, livello, arco));
      const p = punteggi(gs);
      const sc = carvingScore(p, curve.length);
      const cl = punteggioClassifica(gs.map(punteggioCurva));
      if (curve.length) setStorico(salvaNelloStorico({ data: new Date().toISOString(), nome, curve: curve.length, score: sc.punti, valido: sc.valido, classifica: cl ?? undefined, punti: p }));
      setTimeout(() => refertoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : String(err)); setFase('tocco');
    } finally {
      lock?.release().catch(() => { /* già rilasciato */ });
    }
  }

  async function faiClip() {
    if (!videoRef.current || !analisi || !referto) return;
    setClip({ stato: 'rec', p: 0 });
    try {
      const f = await creaClip(videoRef.current, analisi, `Carving Score ${referto.score.punti}`,
        `${referto.score.fascia} · ${giudizio7(referto.score.punti)} · ${referto.curve.length} curve`, (p) => setClip({ stato: 'rec', p }));
      const esito = await condividi(f);
      setClip({ stato: 'fatto', p: 1, msg: esito === 'condivisa' ? 'Clip condivisa.' : 'Clip salvata nei download.' });
    } catch (err) {
      setClip({ stato: 'idle', p: 0, msg: err instanceof Error ? err.message : String(err) });
    }
  }

  const vaiA = (t: number) => { const v = videoRef.current; if (v) { v.pause(); v.currentTime = t; v.scrollIntoView({ behavior: 'smooth', block: 'center' }); } };

  if (guida) return <Guida />;

  const pct = Math.round(progress * 100);
  const trascorsi = (performance.now() - inizioAnalisi) / 1000;
  const restano = progress > 0.04 ? Math.max(0, Math.round((trascorsi * (1 - progress)) / progress)) : null;
  const passo = fase === 'scelta' ? 1 : fase === 'tocco' ? 2 : 3;

  return (
    <main>
      <header className="mast">
        <svg className="mast-traccia" viewBox="0 0 160 300" aria-hidden="true" preserveAspectRatio="xMidYMin meet">
          <path d="M120 0 C40 40 40 80 100 110 C160 140 150 190 80 215 C20 238 40 280 90 300" />
          <path d="M128 0 C48 40 48 80 108 110 C168 140 158 190 88 215 C28 238 48 280 98 300" />
        </svg>
        <p className="eyebrow">Metodo, cura, costanza.</p>
        <h1>Sci <span>Carving</span></h1>
        <p className="lede">Carica una tua sciata. Ricevi le correzioni del maestro, curva per curva.</p>
        <ol className="passi" aria-label="Come funziona">
          {['Scegli il video', 'Tocca lo sciatore', 'Leggi il referto'].map((t, i) => (
            <li key={t} className={i + 1 === passo ? 'ora' : i + 1 < passo ? 'fatto' : ''}><b>{i + 1}</b>{t}</li>
          ))}
        </ol>
      </header>

      <section className="card inizio">
        <div className="campo">
          <span className="campo-nome">Il tuo livello</span>
          <Scelta valore={livello} onChange={setLivello} opzioni={[['avanzato', 'Avanzato'], ['intermedio', 'Intermedio']]} />
        </div>
        <div className="campo">
          <span className="campo-nome">Arco di curva</span>
          <Scelta valore={sceltaArco} onChange={setSceltaArco} opzioni={[['auto', 'Auto'], ['medio', 'Medio'], ['corto', 'Corto']]} />
        </div>
        <label className="file">
          <input type="file" accept="video/*" onChange={(e) => { scegliFile(e.target.files?.[0]); e.target.value = ''; }} />
          <span>{url && !esempio ? 'Cambia video' : 'Scegli o registra un video'}</span>
        </label>
        <div className="link-riga">
          <button className="ghost" onClick={apriEsempio}>Guarda un referto di esempio</button>
          <a className="guide-link" href="#guida">Come filmare</a>
        </div>
        {errore && fase === 'scelta' && <p className="err">{errore}</p>}
      </section>

      {url && (
        <section className="card video-card" ref={stageRef}>
          {esempio && <p className="badge">Esempio · una sciata già analizzata</p>}
          <div className="stage">
            <video ref={videoRef} src={url} onLoadedMetadata={(e) => mostraPrimoFotogramma(e.currentTarget)} playsInline controls={fase !== 'tocco'} muted preload="auto" />
            <canvas ref={overlayRef} className={fase === 'tocco' ? 'tap' : 'over'} onPointerDown={tocca} />
            {fase === 'tocco' && <span className="stage-hint">{tap ? 'Sciatore scelto' : 'Tocca lo sciatore'}</span>}
          </div>
          {fase === 'tocco' && (
            <>
              <input className="scrub" type="range" min={0} max={durata} step={0.033}
                defaultValue={0} onChange={(e) => vaiA(Number(e.target.value))} aria-label="Scorri il video" />
              <p className="hint">Scorri fino a quando lo sciatore si vede bene e intero, poi <b>toccalo</b>. L'analisi parte da quel momento e dura al massimo {DURATA_MAX_S} secondi di video.</p>
              {errore && <p className="err">{errore}</p>}
              <div className="azione">
                <button disabled={!tap} onClick={avvia}>{tap ? 'Analizza la sciata' : 'Prima tocca lo sciatore'}</button>
              </div>
            </>
          )}
          {fase === 'analisi' && (
            <div className="attesa" aria-live="polite">
              <div className="progress"><div style={{ width: `${pct}%` }} /></div>
              <p className="attesa-riga"><b>{pct}%</b>{restano !== null ? ` · circa ${restano < 60 ? `${restano} s` : `${Math.ceil(restano / 60)} min`}` : ' · preparo il modello'}</p>
              <p className="note">Tieni lo schermo acceso e l'app aperta: l'analisi gira tutta sul telefono, il video non viene caricato da nessuna parte.</p>
            </div>
          )}
        </section>
      )}

      {fase === 'referto' && referto && (
        <section className="card referto" ref={refertoRef}>
          {referto.curve.length === 0 ? (
            <>
              <h2>Nessuna curva riconosciuta</h2>
              <p>Lo sciatore è troppo piccolo, esce dall'inquadratura o fa meno di una curva completa. Riprova con una ripresa più vicina e più stabile, seguendo la guida.</p>
              <a className="guide-link" href="#guida">Come filmare</a>
            </>
          ) : (
            <>
              <div className="hero">
                <div className="hero-num">
                  <span className="label">Carving Score</span>
                  <span className="big">{referto.score.punti}</span>
                </div>
                <div className="hero-txt">
                  <span className={`voto v-${slug(giudizio7(referto.score.punti))}`}>{giudizio7(referto.score.punti)}</span>
                  <div className="fascia">{referto.score.fascia}</div>
                  <div className="sub">
                    {referto.curve.length} curve, arco {referto.arco}{sceltaArco === 'auto' ? ' (dal ritmo)' : ''}.{' '}
                    {referto.score.valido ? 'Punteggio valido.' : `Provvisorio: servono ${CURVE_MINIME} curve.`}
                  </div>
                </div>
              </div>
              <div className="rank">
                {referto.classifica !== null
                  ? <>Classifica con gli amici <b>{referto.classifica}</b><small>migliori {CURVE_CLASSIFICA} curve di fila</small></>
                  : <>Classifica con gli amici <small>servono {CURVE_CLASSIFICA} curve di fila</small></>}
              </div>

              <Traccia curve={referto.curve} punti={referto.perCurva} onSelect={vaiA} />

              {referto.top.length > 0 && (
                <>
                  <h3>Su cosa lavorare</h3>
                  <ol className="tips">{referto.top.map((g) => <li key={g.voce}><b>{g.voce}</b>{g.consiglio}</li>)}</ol>
                </>
              )}

              <h3>I criteri del maestro</h3>
              <Barre punti={referto.punti.filter((p) => p.gruppo === 'maestro')} />
              <h3>Gli sci, stimati dal corpo</h3>
              <Barre punti={referto.punti.filter((p) => p.gruppo === 'sci')} />
              <div className="extra">
                {referto.ritmo && <p>Ritmo <b style={{ color: COLORE[referto.ritmo.esito] }}>{referto.ritmo.esito}</b><small>{referto.ritmo.misura}</small></p>}
                {referto.simm && <p>Simmetria <b style={{ color: COLORE[referto.simm.esito] }}>{referto.simm.esito}</b><small>destra {referto.simm.destra}, sinistra {referto.simm.sinistra}</small></p>}
              </div>

              <button className="share" disabled={clip.stato === 'rec'} onClick={faiClip}>
                {clip.stato === 'rec' ? `Preparo la clip, ${Math.round(clip.p * 100)}%` : 'Crea la clip da condividere'}
              </button>
              {clip.msg && <p className="sub">{clip.msg}</p>}

              <h3>Curva per curva</h3>
              <p className="sub">Scorri le curve e tocca per rivederla nel punto di massimo spigolo.</p>
              <div className="turns">
                {referto.curve.map((c, i) => (
                  <button key={i} className="turn" onClick={() => vaiA(c.apice)}>
                    <span className="t-top"><span>Curva {i + 1}<small>a {c.lato} · {c.apice.toFixed(1)} s</small></span><b>{referto.perCurva[i]}</b></span>
                    <span className={`voto v-${slug(giudizio7(referto.perCurva[i]))}`}>{giudizio7(referto.perCurva[i])}</span>
                    <span className="t-voci">
                      {referto.giudizi[i].map((g) => (
                        <span key={g.voce} className="t-voce" title={g.misura}>
                          <i style={{ background: COLORE[g.esito] }} /><span>{g.voce}</span><em>{Number.isNaN(g.punti) ? '–' : g.punti}</em>
                        </span>
                      ))}
                    </span>
                  </button>
                ))}
              </div>
              <p className="note">Prototipo: le misure sono stime dal video e dipendono dall'angolo di ripresa. Le soglie sono tarate dal maestro sul livello 7.</p>
            </>
          )}
        </section>
      )}

      {storico.length > 0 && (
        <section className="card">
          <h2>I tuoi progressi</h2>
          <Progressi storico={storico} />
          <table>
            <thead><tr><th>Data</th><th>Score</th><th>Curve</th><th>Classifica</th><th>Ski:IQ Carv</th></tr></thead>
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
      <footer className="piede">Prototipo · l'analisi avviene sul telefono</footer>
    </main>
  );
}

/** Interruttore a pillole, più comodo di un menu sul telefono. */
function Scelta<T extends string>({ valore, onChange, opzioni }: { valore: T; onChange: (v: T) => void; opzioni: [T, string][] }) {
  return (
    <div className="scelta" role="radiogroup">
      {opzioni.map(([v, t]) => (
        <button key={v} type="button" role="radio" aria-checked={valore === v} className={valore === v ? 'on' : ''} onClick={() => onChange(v)}>{t}</button>
      ))}
    </div>
  );
}

const slug = (s: string) => s.replace(/\s+/g, '-');

function leggi<T extends string>(k: string, ammessi: T[], def: T): T {
  try { const v = localStorage.getItem(k) as T | null; return v && ammessi.includes(v) ? v : def; } catch { return def; }
}
function scrivi(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* navigazione privata */ } }

/** Tiene lo schermo acceso durante l'analisi: se il telefono si spegne, il browser la mette in pausa. */
async function schermoAcceso(): Promise<{ release: () => Promise<void> } | null> {
  const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
  try { return (await nav.wakeLock?.request('screen')) ?? null; } catch { return null; }
}

function Barre({ punti }: { punti: { voce: string; punti: number }[] }) {
  return (
    <div className="scores">
      {punti.map((p) => (
        <div key={p.voce} className="score">
          <span>{p.voce}<small className="g7">{giudizio7(p.punti)}</small></span>
          <div className="bar"><div className={`v-${slug(giudizio7(p.punti))}`} style={{ width: `${Number.isNaN(p.punti) ? 0 : p.punti}%` }} /></div>
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
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, 10); else ctx.rect(x, y, w, h); ctx.fill(); // roundRect manca su Safari < 16.4
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
