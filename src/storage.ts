// Storico delle analisi. Per il prototipo resta nel browser; poi passerà al database (Supabase).

export type VoceStorico = { data: string; nome: string; curve: number; punti: { voce: string; punti: number }[] };
const KEY = 'storico-v1';

export function caricaStorico(): VoceStorico[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function salvaNelloStorico(v: VoceStorico): VoceStorico[] {
  const s = [v, ...caricaStorico()].slice(0, 50);
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* spazio esaurito o navigazione privata */ }
  return s;
}
