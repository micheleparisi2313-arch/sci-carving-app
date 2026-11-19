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
