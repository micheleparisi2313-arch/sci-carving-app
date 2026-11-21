import { describe, expect, it } from 'vitest';
import { angleAt, lineTilt } from './metrics';
import { punteggioSeduto, puntiSpalle, giudizio7, puntiBasso, puntiAlto, riconosciArco, SOGLIE } from './rules';

describe('misure', () => {
  it('angolo retto', () => {
    expect(angleAt({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBeCloseTo(90);
  });
  it('spalle in bolla = 0 gradi', () => {
    expect(lineTilt({ x: 0, y: 10, v: 1 }, { x: 10, y: 10, v: 1 })).toBeCloseTo(0);
  });
  it('anche dietro i piedi e busto chiuso = più seduto', () => {
    expect(punteggioSeduto(-40, 93)).toBeGreaterThan(punteggioSeduto(10, 116));
  });
});

import { carvingScore } from './rules';
describe('Carving Score', () => {
  it('pesa 70% maestro e 30% sci', () => {
    const r = carvingScore([{ gruppo: 'maestro', punti: 100 }, { gruppo: 'sci', punti: 0 }], 6);
    expect(r.punti).toBe(70);
    expect(r.valido).toBe(true);
  });
  it('è provvisorio con meno di 4 curve', () => {
    expect(carvingScore([{ gruppo: 'maestro', punti: 80 }], 3).valido).toBe(false);
  });
});

import { punteggioClassifica } from './rules';
describe('classifica', () => {
  it('serve almeno 5 curve', () => {
    expect(punteggioClassifica([80, 80, 80, 80])).toBeNull();
  });
  it('prende le migliori 5 curve di fila', () => {
    expect(punteggioClassifica([20, 90, 90, 90, 90, 90, 20])).toBe(90);
  });
});

describe('spalle in bolla, tarate sugli istruttori nazionali', () => {
  it('a forte inclinazione le spalle a 23-36° sono "buono, quasi molto buono"', () => {
    const p = [puntiSpalle(36, 63), puntiSpalle(29, 67), puntiSpalle(23, 44), puntiSpalle(35, 39)];
    const media = p.reduce((a, b) => a + b, 0) / p.length;
    expect(media).toBeGreaterThanOrEqual(65);
    expect(media).toBeLessThan(75);
    expect(giudizio7(media)).toBe('buono');
  });
  it('con poca inclinazione resta severo', () => {
    expect(puntiSpalle(30, 10)).toBeLessThan(55);
  });
});

describe('taratura sul livello 7 (riferimento di Michele)', () => {
  it('fino a metà della soglia ok è perfetto', () => {
    expect(puntiBasso(20, 50, 65)).toBe(100);
    expect(puntiBasso(50, 50, 65)).toBe(80);
  });
  it('angolo di spigolo da livello 7 (45-50°) vale perfetto', () => {
    const [ok, att, top] = SOGLIE.inclinazione.avanzato;
    expect(puntiAlto(50, ok, att, top)).toBe(100);
    expect(giudizio7(puntiAlto(48, ok, att, top))).toBe('perfetto');
  });
});

describe('arco corto e arco medio', () => {
  const curve = (durate: number[]) => durate.map((d, i) => ({ inizio: i * 2, fine: i * 2 + d })) as unknown as Parameters<typeof riconosciArco>[0];
  it('riconosce l\'arco dalla durata delle curve (valori del livello 7)', () => {
    expect(riconosciArco(curve([0.73, 0.73, 0.6, 0.6, 0.47, 0.6]))).toBe('corto');
    expect(riconosciArco(curve([1.07, 0.93, 0.6, 1.53, 2.07]))).toBe('medio');
  });
  it('nell\'arco medio le spalle hanno più tolleranza', () => {
    expect(puntiSpalle(30, 65, 'medio')).toBeGreaterThan(puntiSpalle(30, 65, 'corto'));
  });
});

describe('robustezza (iPhone)', () => {
  it('giudizio7 non si blocca con valori non validi', () => {
    for (const x of [NaN, undefined, null, -5, Infinity]) expect(giudizio7(x as number)).toBeTypeOf('string');
    expect(giudizio7(-5)).toBe('insufficiente');
  });
  it('carvingScore senza curve non si blocca', () => {
    const sc = carvingScore([], 0);
    expect(sc.fascia).toBe('Non valutabile');
    expect(sc.valido).toBe(false);
  });
});
