// Storico delle analisi. Per il prototipo resta nel browser; poi passerà al database (Supabase).

export type VoceStorico = {
  data: string;
  nome: string;
  curve: number;
  score?: number;          // Carving Score
  valido?: boolean;
  skiIq?: number;          // Ski:IQ di Carv della giornata, inserito a mano (facoltativo)
  punti: { voce: string; punti: number }[];
};
const KEY = 'storico-v1';

export function caricaStorico(): VoceStorico[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

function scrivi(s: VoceStorico[]): VoceStorico[] {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* spazio esaurito o navigazione privata */ }
  return s;
}

export function salvaNelloStorico(v: VoceStorico): VoceStorico[] {
  return scrivi([v, ...caricaStorico()].slice(0, 50));
}

export function aggiornaSkiIq(data: string, skiIq: number | undefined): VoceStorico[] {
  return scrivi(caricaStorico().map((v) => (v.data === data ? { ...v, skiIq } : v)));
}
