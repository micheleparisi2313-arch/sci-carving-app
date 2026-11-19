// Criteri di valutazione e Carving Score.
// Gruppo "maestro": i 5 criteri di correzione di Michele.
// Gruppo "sci": le metriche che Carv misura con i sensori, ricavate qui dal video.
// Le soglie sono una prima taratura sui video di prova del 19/11/2026: si cambiano qui.

import type { FrameMetrics } from './metrics';

export type Livello = 'avanzato' | 'intermedio';
export type Esito = 'ok' | 'attenzione' | 'da correggere' | 'non valutabile';
export type Gruppo = 'maestro' | 'sci';

export type Curva = {
  inizio: number;            // secondi
  fine: number;
  apice: number;             // secondi, momento di massima inclinazione
  lato: 'destra' | 'sinistra';
  frames: FrameMetrics[];
  apiceFrame: FrameMetrics;
  costruzioneSpigolo: number; // 0..1: quando l'inclinazione arriva al 70% del massimo (presto = basso)
};

export type Giudizio = { voce: string; gruppo: Gruppo; esito: Esito; misura: string; consiglio?: string };

export const SOGLIE = {
  bustoSci: { ok: 50, attenzione: 65 },          // gradi (stima sperimentale, Michele: 49° era buono)
  ginocchioMax: { attenzione: 155, errore: 165 }, // gradi
  anca: { min: 95, max: 160 },                   // gradi
  spalle: { ok: 12, attenzione: 22 },            // gradi dall'orizzontale
  seduto: { ok: 15, attenzione: 40 },            // punteggio: anche dietro i piedi + busto-coscia chiuso
  spigolo: { ok: 0.5, attenzione: 0.65 },        // frazione della curva
  ritmo: { ok: 0.25, attenzione: 0.4 },          // variazione della durata delle curve
  inclinazione: { avanzato: [45, 30], intermedio: [35, 22] } as Record<Livello, [number, number]>, // gradi all'apice
  tibie: { ok: 8, attenzione: 15 },              // gradi di differenza tra le tibie
  flessione: { ok: 25, attenzione: 15 },         // gradi di escursione del ginocchio nella curva
  angolazione: { ok: 15, attenzione: 5 },        // gambe più inclinate del busto, in gradi
  simmetria: { ok: 10, attenzione: 20 },         // punti di differenza tra curve a destra e a sinistra
};

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};

const TESTI: Record<string, Record<Livello, string>> = {
  bustoSci: {
    avanzato: 'Tieni lo sterno verso le punte degli sci, al massimo leggermente verso la punta dello sci esterno: evita di ruotare il busto con la curva.',
    intermedio: 'Guarda con le spalle verso le punte degli sci, non verso dove gira la curva.',
  },
  posizione: {
    avanzato: "Resta in posizione pronta per tutto l'arco: busto leggermente in avanti, gambe sempre flesse, senza distenderti in uscita.",
    intermedio: "Piega un po' di più le gambe e porta il busto leggermente in avanti, come se fossi pronto a saltare.",
  },
  spalle: {
    avanzato: "Spalle in bolla, orizzontali come una livella: non buttare la spalla interna dentro la curva, l'inclinazione la fanno le gambe.",
    intermedio: "Tieni le spalle dritte, orizzontali: non abbassare la spalla verso l'interno della curva.",
  },
  seduto: {
    avanzato: "Porta il bacino sopra i piedi: sei un po' seduto. Spingi le anche avanti in entrata di curva per caricare la punta dello sci.",
    intermedio: 'Non sederti dietro: tieni il bacino sopra i piedi, come quando stai in piedi.',
  },
  tempismo: {
    avanzato: "Metti lo sci sullo spigolo prima: l'inclinazione va costruita nella prima metà della curva, non solo dopo la linea di massima pendenza.",
    intermedio: 'Inizia a inclinarti prima nella curva, appena cambi direzione.',
  },
  inclinazione: {
    avanzato: "Cerca più angolo di spigolo: lascia andare le gambe verso l'interno della curva mantenendo le spalle in bolla.",
    intermedio: "Inclina di più le gambe verso l'interno della curva, così lo sci taglia invece di derapare.",
  },
  tibie: {
    avanzato: 'Tibie parallele: accompagna il ginocchio interno, così i due sci lavorano sullo stesso angolo di spigolo.',
    intermedio: 'Tieni le ginocchia parallele: il ginocchio interno segue quello esterno.',
  },
  flessione: {
    avanzato: 'Usa di più la flesso-estensione: estendi in uscita per cambiare spigolo e assorbi flettendo in conduzione.',
    intermedio: 'Muovi di più le gambe: alzati un po\' tra una curva e l\'altra e piegati durante la curva.',
  },
  angolazione: {
    avanzato: 'Più angolazione: le gambe si inclinano, il busto resta più verticale. Separa la parte alta da quella bassa.',
    intermedio: 'Non inclinare tutto il corpo come un palo: piega di lato le anche e tieni il busto più dritto.',
  },
};

function grade(x: number, ok: number, att: number): Esito {
  return x <= ok ? 'ok' : x <= att ? 'attenzione' : 'da correggere';
}
function gradeAlto(x: number, ok: number, att: number): Esito {
  return x >= ok ? 'ok' : x >= att ? 'attenzione' : 'da correggere';
}

/** Punteggio "seduto": più alto = più seduto. Combina anche dietro i piedi e busto-coscia chiuso. */
export function punteggioSeduto(ancheAvanti: number, anca: number): number {
  return -ancheAvanti + Math.max(0, 110 - anca) * 0.5;
}

export function giudicaCurva(c: Curva, livello: Livello): Giudizio[] {
  const f = c.frames;
  const viste = f.map((x) => x.vista);
  const lato = viste.filter((v) => v === 'lato').length > f.length / 2;
  const fronte = viste.filter((v) => v === 'fronte').length > f.length / 2;
  const out: Giudizio[] = [];
  const add = (voce: string, gruppo: Gruppo, key: string, esito: Esito, misura: string) =>
    out.push({ voce, gruppo, esito, misura, consiglio: esito === 'ok' || esito === 'non valutabile' ? undefined : TESTI[key][livello] });

  // --- I 5 criteri del maestro ---
  const bs = median(f.map((x) => x.spalleVsSci));
  add('Busto verso gli sci', 'maestro', 'bustoSci', grade(bs, SOGLIE.bustoSci.ok, SOGLIE.bustoSci.attenzione),
    `rotazione stimata ${bs.toFixed(0)}°`);

  const ginocchi = f.map((x) => x.ginocchio);
  const gMax = Math.max(...ginocchi);
  const an = median(f.map((x) => x.anca));
  let e2: Esito = 'ok';
  if (gMax > SOGLIE.ginocchioMax.errore) e2 = 'da correggere';
  else if (gMax > SOGLIE.ginocchioMax.attenzione || an > SOGLIE.anca.max || an < SOGLIE.anca.min) e2 = 'attenzione';
  add('Posizione pronta', 'maestro', 'posizione', e2, `ginocchio fino a ${gMax.toFixed(0)}°, busto-coscia ${an.toFixed(0)}°`);

  const sp = Math.abs(c.apiceFrame.spalleIncl);
  if (lato) add('Spalle in bolla', 'maestro', 'spalle', 'non valutabile', 'ripresa di lato');
  else add('Spalle in bolla', 'maestro', 'spalle', grade(sp, SOGLIE.spalle.ok, SOGLIE.spalle.attenzione), `spalle inclinate di ${sp.toFixed(0)}°`);

  add('Tempismo di curva', 'maestro', 'tempismo', grade(c.costruzioneSpigolo, SOGLIE.spigolo.ok, SOGLIE.spigolo.attenzione),
    `spigolo pieno al ${(c.costruzioneSpigolo * 100).toFixed(0)}% della curva`);

  const sed = punteggioSeduto(median(f.map((x) => x.ancheAvanti)), an);
  if (fronte) add('Bacino sopra i piedi', 'maestro', 'seduto', 'non valutabile', 'ripresa da davanti o da dietro');
  else add('Bacino sopra i piedi', 'maestro', 'seduto', grade(sed, SOGLIE.seduto.ok, SOGLIE.seduto.attenzione),
    sed > SOGLIE.seduto.ok ? 'bacino dietro i piedi' : 'bacino sopra i piedi');

  // --- Le metriche degli sci (quelle di Carv), stimate dal corpo ---
  const incl = Math.abs(c.apiceFrame.gambeIncl);
  const [iOk, iAtt] = SOGLIE.inclinazione[livello];
  add('Angolo di spigolo', 'sci', 'inclinazione', gradeAlto(incl, iOk, iAtt), `gambe inclinate di ${incl.toFixed(0)}° all'apice`);

  const tib = median(f.map((x) => x.tibieDiff));
  if (lato) add('Sci paralleli', 'sci', 'tibie', 'non valutabile', 'ripresa di lato');
  else add('Sci paralleli', 'sci', 'tibie', grade(tib, SOGLIE.tibie.ok, SOGLIE.tibie.attenzione), `tibie diverse di ${tib.toFixed(0)}°`);

  const escursione = gMax - Math.min(...ginocchi);
  add('Flesso-estensione', 'sci', 'flessione', gradeAlto(escursione, SOGLIE.flessione.ok, SOGLIE.flessione.attenzione),
    `ginocchio da ${Math.min(...ginocchi).toFixed(0)}° a ${gMax.toFixed(0)}°`);

  const ango = incl - Math.abs(c.apiceFrame.bustoIncl);
  add('Angolazione', 'sci', 'angolazione', gradeAlto(ango, SOGLIE.angolazione.ok, SOGLIE.angolazione.attenzione),
    `gambe ${ango >= 0 ? 'più' : 'meno'} inclinate del busto di ${Math.abs(ango).toFixed(0)}°`);

  return out;
}

/** Regolarità del ritmo tra le curve: coefficiente di variazione delle durate. */
export function giudicaRitmo(curve: Curva[]): Giudizio | null {
  if (curve.length < 3) return null;
  const d = curve.map((c) => c.fine - c.inizio);
  const m = d.reduce((a, b) => a + b, 0) / d.length;
  const cv = Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / d.length) / m;
  const esito = grade(cv, SOGLIE.ritmo.ok, SOGLIE.ritmo.attenzione);
  return {
    voce: 'Ritmo tra le curve', gruppo: 'sci', esito, misura: `durata media ${m.toFixed(1)} s, variazione ${(cv * 100).toFixed(0)}%`,
    consiglio: esito === 'ok' ? undefined : 'Cerca curve tutte della stessa durata: conta il ritmo ad alta voce, uno-due, uno-due.',
  };
}

const PESO: Record<Esito, number> = { ok: 100, attenzione: 60, 'da correggere': 20, 'non valutabile': NaN };
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

/** Punteggio 0-100 per voce, media su tutte le curve valutabili. */
export function punteggi(curve: Giudizio[][]): { voce: string; gruppo: Gruppo; punti: number }[] {
  const voci = curve[0] ?? [];
  return voci.map(({ voce, gruppo }) => {
    const v = curve.map((gs) => PESO[gs.find((g) => g.voce === voce)!.esito]).filter((x) => !Number.isNaN(x));
    return { voce, gruppo, punti: v.length ? Math.round(avg(v)) : NaN };
  });
}

/** Simmetria: confronta il punteggio medio delle curve a destra con quelle a sinistra. */
export function simmetria(curve: Curva[], giudizi: Giudizio[][]): { destra: number; sinistra: number; esito: Esito } | null {
  const media = (lato: Curva['lato']) =>
    avg(curve.flatMap((c, i) => (c.lato === lato ? giudizi[i].map((g) => PESO[g.esito]).filter((x) => !Number.isNaN(x)) : [])));
  const destra = media('destra'), sinistra = media('sinistra');
  if (Number.isNaN(destra) || Number.isNaN(sinistra)) return null;
  return { destra: Math.round(destra), sinistra: Math.round(sinistra),
    esito: grade(Math.abs(destra - sinistra), SOGLIE.simmetria.ok, SOGLIE.simmetria.attenzione) };
}

export const FASCE = [
  { min: 85, nome: 'Maestro' },
  { min: 72, nome: 'Esperto' },
  { min: 58, nome: 'Avanzato' },
  { min: 42, nome: 'Intermedio' },
  { min: 0, nome: 'In crescita' },
];
export const CURVE_MINIME = 4;

/**
 * Carving Score 0-100: 70% i criteri del maestro, 30% le metriche degli sci.
 * È "valido" solo con almeno 4 curve analizzate: il video è la prova, niente punteggi gonfiati.
 */
export function carvingScore(p: { gruppo: Gruppo; punti: number }[], nCurve: number) {
  const m = avg(p.filter((x) => x.gruppo === 'maestro' && !Number.isNaN(x.punti)).map((x) => x.punti));
  const s = avg(p.filter((x) => x.gruppo === 'sci' && !Number.isNaN(x.punti)).map((x) => x.punti));
  const score = Number.isNaN(s) ? m : Number.isNaN(m) ? s : 0.7 * m + 0.3 * s;
  const punti = Math.round(score);
  return { punti, fascia: FASCE.find((f) => punti >= f.min)!.nome, valido: nCurve >= CURVE_MINIME };
}

/** Le 2-3 correzioni più importanti: prima i criteri del maestro, poi le voci peggiori. */
export function priorita(curve: Giudizio[][], max = 3): Giudizio[] {
  const conta = new Map<string, { g: Giudizio; peso: number }>();
  for (const g of curve.flat().filter((x) => x.consiglio)) {
    const p = (g.esito === 'da correggere' ? 2 : 1) * (g.gruppo === 'maestro' ? 1.5 : 1);
    const c = conta.get(g.voce);
    conta.set(g.voce, { g: c && c.g.esito === 'da correggere' ? c.g : g, peso: (c?.peso ?? 0) + p });
  }
  return [...conta.values()].sort((a, b) => b.peso - a.peso).slice(0, max).map((x) => x.g);
}
