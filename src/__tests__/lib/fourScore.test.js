import { describe, it, expect } from 'vitest';
import { fourScore } from '../../lib/fourScore';

describe('fourScore', () => {
  it('returns 0 for all components at 0', () => {
    const result = fourScore({ eye: 0, motor: 0, brainstem: 0, respiration: 0 });
    expect(result.total).toBe(0);
    expect(result.prognosis).toBe('morte_encefalica_possivel');
    expect(result.risk).toBe('critico');
  });

  it('returns 16 for all components at 4', () => {
    const result = fourScore({ eye: 4, motor: 4, brainstem: 4, respiration: 4 });
    expect(result.total).toBe(16);
    expect(result.prognosis).toBe('bom_prognostico');
    expect(result.risk).toBe('baixo');
  });

  it('clamps values to 0-4 range', () => {
    const result = fourScore({ eye: 5, motor: -1, brainstem: 10, respiration: 4 });
    expect(result.total).toBe(4 + 0 + 4 + 4);
  });

  it('classifies intermediate scores', () => {
    const result = fourScore({ eye: 2, motor: 2, brainstem: 2, respiration: 2 });
    expect(result.total).toBe(8);
    expect(result.prognosis).toBe('disfuncao_grave');
    expect(result.risk).toBe('alto');
  });

  it('returns component descriptions', () => {
    const result = fourScore({ eye: 0, motor: 1, brainstem: 4, respiration: 3 });
    expect(result.components.eye.description).toContain('E0');
    expect(result.components.motor.description).toContain('M1');
    expect(result.components.brainstem.description).toContain('B4');
    expect(result.components.respiration.description).toContain('R3');
  });

  it('handles intubated patient (respiration 0-1)', () => {
    const intubated = fourScore({ eye: 3, motor: 4, brainstem: 4, respiration: 0 });
    expect(intubated.total).toBe(11);
    expect(intubated.components.respiration.description).toContain('Apneia');

    const overVent = fourScore({ eye: 3, motor: 4, brainstem: 4, respiration: 1 });
    expect(overVent.total).toBe(12);
    expect(overVent.components.respiration.description).toContain('ventilador');
  });

  it('identifies possible brain death at score 0', () => {
    const result = fourScore({ eye: 0, motor: 0, brainstem: 0, respiration: 0 });
    expect(result.prognosis).toBe('morte_encefalica_possivel');
  });

  it('handles string inputs', () => {
    const result = fourScore({ eye: '3', motor: '2', brainstem: '4', respiration: '1' });
    expect(result.total).toBe(10);
  });

  it('handles missing/undefined inputs as 0', () => {
    const result = fourScore({});
    expect(result.total).toBe(0);
  });

  it('prognosis boundaries', () => {
    expect(fourScore({ eye: 1, motor: 0, brainstem: 0, respiration: 0 }).prognosis).toBe('prognostico_reservado');
    expect(fourScore({ eye: 1, motor: 1, brainstem: 1, respiration: 1 }).prognosis).toBe('prognostico_reservado');
    expect(fourScore({ eye: 2, motor: 1, brainstem: 1, respiration: 1 }).prognosis).toBe('disfuncao_grave');
    expect(fourScore({ eye: 2, motor: 2, brainstem: 2, respiration: 2 }).prognosis).toBe('disfuncao_grave');
    expect(fourScore({ eye: 3, motor: 3, brainstem: 2, respiration: 1 }).prognosis).toBe('disfuncao_moderada');
    expect(fourScore({ eye: 4, motor: 3, brainstem: 3, respiration: 3 }).prognosis).toBe('bom_prognostico');
  });
});
