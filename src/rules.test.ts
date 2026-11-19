import { describe, expect, it } from 'vitest';
import { angleAt, lineTilt } from './metrics';
import { punteggioSeduto } from './rules';

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
