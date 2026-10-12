import { describe, it, expect } from 'vitest';
import {
  FERIADOS_2026,
  FERIADO_LABELS,
  FERIADOS_FUNCIONARIAS,
  FERIADO_LABELS_FUNCIONARIAS,
} from '@/data/plantao2026';

describe('feriados das funcionárias', () => {
  it('24/12 e 31/12 são dia normal para as funcionárias, mas seguem feriado na residência', () => {
    for (const key of ['2026-12-24', '2026-12-31']) {
      expect(FERIADOS_FUNCIONARIAS.has(key)).toBe(false);
      expect(key in FERIADO_LABELS_FUNCIONARIAS).toBe(false);
      expect(FERIADOS_2026.has(key)).toBe(true);
      expect(key in FERIADO_LABELS).toBe(true);
    }
  });

  it('os demais feriados continuam iguais', () => {
    expect(FERIADOS_FUNCIONARIAS.size).toBe(FERIADOS_2026.size - 2);
    expect(FERIADO_LABELS_FUNCIONARIAS['2026-12-25']).toBe('Natal');
    expect(FERIADOS_FUNCIONARIAS.has('2026-11-02')).toBe(true);
  });
});
