// I 5 criteri di correzione di Michele, tradotti in regole.
// Le soglie sono una prima taratura sui video di prova del 19/11/2026: si cambiano qui.

import type { FrameMetrics } from './metrics';

export type Livello = 'avanzato' | 'intermedio';
export type Esito = 'ok' | 'attenzione' | 'da correggere' | 'non valutabile';

export type Curva = {
  inizio: number;            // secondi
  fine: number;
  apice: number;             // secondi, momento di massima inclinazione
  lato: 'destra' | 'sinistra';
  frames: FrameMetrics[];
  apiceFrame: FrameMetrics;
  costruzioneSpigolo: number; // 0..1: quando l'inclinazione arriva al 70% del massimo (presto = basso)
};

export type Giudizio = { voce: string; esito: Esito; misura: string; consiglio?: string };

export const SOGLIE = {
  bustoSci: { ok: 50, attenzione: 65 },          // gradi (stima sperimentale, Michele: 49° era buono)
  ginocchioMax: { attenzione: 155, errore: 165 }, // gradi
  anca: { min: 95, max: 160 },                   // gradi
  spalle: { ok: 12, attenzione: 22 },            // gradi dall'orizzontale
  seduto: { ok: 15, attenzione: 40 },            // punteggio: anche dietro i piedi + busto-coscia chiuso
  spigolo: { ok: 0.5, attenzione: 0.65 },        // frazione della curva
  ritmo: { ok: 0.25, attenzione: 0.4 },          // variazione della durata delle curve
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
    intermedio: 'Piega un po\' di più le gambe e porta il busto leggermente in avanti, come se fossi pronto a saltare.',
  },
  spalle: {
    avanzato: "Spalle in bolla, orizzontali come una livella: non buttare la spalla interna dentro la curva, l'inclinazione la fanno le gambe.",
    intermedio: "Tieni le spalle dritte, orizzontali: non abbassare la spalla verso l'interno della curva.",
  },
  seduto: {
    avanzato: 'Porta il bacino sopra i piedi: sei un po\' seduto. Spingi le anche avanti in entrata di curva per caricare la punta dello sci.',
    intermedio: 'Non sederti dietro: tieni il bacino sopra i piedi, come quando stai in piedi.',
  },
  tempismo: {
    avanzato: "Metti lo sci sullo spigolo prima: l'inclinazione va costruita nella prima metà della curva, non solo dopo la linea di massima pendenza.",
    intermedio: 'Inizia a inclinarti prima nella curva, appena cambi direzione.',
  },
};

function grade(x: number, ok: number, att: number): Esito {
  return x <= ok ? 'ok' : x <= att ? 'attenzione' : 'da correggere';
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
  const add = (voce: string, key: string, esito: Esito, misura: string) =>
    out.push({ voce, esito, misura, consiglio: esito === 'ok' || esito === 'non valutabile' ? undefined : TESTI[key][livello] });

  // 1. Busto verso gli sci
  const bs = median(f.map((x) => x.spalleVsSci));
  add('Busto verso gli sci', 'bustoSci', grade(bs, SOGLIE.bustoSci.ok, SOGLIE.bustoSci.attenzione),
    `rotazione stimata ${bs.toFixed(0)}°`);

  // 2. Posizione pronta
  const gMax = Math.max(...f.map((x) => x.ginocchio));
  const an = median(f.map((x) => x.anca));
  let e2: Esito = 'ok';
  if (gMax > SOGLIE.ginocchioMax.errore) e2 = 'da correggere';
  else if (gMax > SOGLIE.ginocchioMax.attenzione || an > SOGLIE.anca.max || an < SOGLIE.anca.min) e2 = 'attenzione';
  add('Posizione pronta', 'posizione', e2, `ginocchio fino a ${gMax.toFixed(0)}°, busto-coscia ${an.toFixed(0)}°`);

  // 3. Spalle in bolla (orizzontali come una livella): non valutabile se ripreso di lato
  const sp = Math.abs(c.apiceFrame.spalleIncl);
  if (lato) add('Spalle in bolla', 'spalle', 'non valutabile', 'ripresa di lato');
  else add('Spalle in bolla', 'spalle', grade(sp, SOGLIE.spalle.ok, SOGLIE.spalle.attenzione), `spalle inclinate di ${sp.toFixed(0)}°`);

  // 4. Tempismo di curva
  add('Tempismo di curva', 'tempismo', grade(c.costruzioneSpigolo, SOGLIE.spigolo.ok, SOGLIE.spigolo.attenzione),
    `spigolo pieno al ${(c.costruzioneSpigolo * 100).toFixed(0)}% della curva`);

  // 5. Bacino sopra i piedi: meno affidabile se ripreso esattamente da davanti
  const sed = punteggioSeduto(median(f.map((x) => x.ancheAvanti)), an);
  if (fronte) add('Bacino sopra i piedi', 'seduto', 'non valutabile', 'ripresa da davanti o da dietro');
  else add('Bacino sopra i piedi', 'seduto', grade(sed, SOGLIE.seduto.ok, SOGLIE.seduto.attenzione),
    sed > SOGLIE.seduto.ok ? 'bacino dietro i piedi' : 'bacino sopra i piedi');

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
    voce: 'Ritmo tra le curve', esito, misura: `durata media ${m.toFixed(1)} s, variazione ${(cv * 100).toFixed(0)}%`,
    consiglio: esito === 'ok' ? undefined : 'Cerca curve tutte della stessa durata: conta il ritmo ad alta voce, uno-due, uno-due.',
  };
}

const PESO: Record<Esito, number> = { ok: 100, attenzione: 60, 'da correggere': 20, 'non valutabile': NaN };

/** Punteggio 0-100 per voce, media su tutte le curve valutabili. */
export function punteggi(curve: Giudizio[][]): { voce: string; punti: number }[] {
  const voci = curve[0]?.map((g) => g.voce) ?? [];
  return voci.map((voce) => {
    const v = curve.map((gs) => PESO[gs.find((g) => g.voce === voce)!.esito]).filter((x) => !Number.isNaN(x));
    return { voce, punti: v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : NaN };
  });
}

/** Le 2-3 correzioni più importanti: le voci peggiori, con il consiglio. */
export function priorita(curve: Giudizio[][], max = 3): Giudizio[] {
  const tutte = curve.flat().filter((g) => g.consiglio);
  const conta = new Map<string, { g: Giudizio; peso: number }>();
  for (const g of tutte) {
    const p = g.esito === 'da correggere' ? 2 : 1;
    const c = conta.get(g.voce);
    conta.set(g.voce, { g: c && c.g.esito === 'da correggere' ? c.g : g, peso: (c?.peso ?? 0) + p });
  }
  return [...conta.values()].sort((a, b) => b.peso - a.peso).slice(0, max).map((x) => x.g);
}
