import { describe, it, expect } from 'vitest';
import { roxIndex } from '../../lib/roxIndex';

describe('roxIndex', () => {
  it('returns null for missing values', () => {
    expect(roxIndex({})).toBeNull();
    expect(roxIndex({ spo2: 95 })).toBeNull();
    expect(roxIndex({ spo2: 95, fio2: 50 })).toBeNull();
  });

  it('returns null for zero divisors', () => {
    expect(roxIndex({ spo2: 95, fio2: 0, fr: 20 })).toBeNull();
    expect(roxIndex({ spo2: 95, fio2: 50, fr: 0 })).toBeNull();
  });

  it('calculates ROX correctly with FiO2 as percentage', () => {
    const result = roxIndex({ spo2: 95, fio2: 50, fr: 20 });
    expect(result.rox).toBeCloseTo(9.5, 1);
    expect(result.risk).toBe('baixo');
  });

  it('calculates ROX correctly with FiO2 as decimal', () => {
    const result = roxIndex({ spo2: 95, fio2: 0.5, fr: 20 });
    expect(result.rox).toBeCloseTo(9.5, 1);
  });

  it('low risk at ROX >= 4.88', () => {
    const result = roxIndex({ spo2: 98, fio2: 40, fr: 20 });
    expect(result.rox).toBeGreaterThanOrEqual(4.88);
    expect(result.risk).toBe('baixo');
    expect(result.interpretation).toContain('Baixo risco');
  });

  it('intermediate risk at ROX 3.85-4.87', () => {
    // ROX = (90/0.7)/28 = 128.57/28 = 4.59 → intermediate
    const result = roxIndex({ spo2: 90, fio2: 70, fr: 28 });
    expect(result.risk).toBe('medio');
    expect(result.interpretation).toContain('intermediário');
  });

  it('high risk at ROX < 3.85', () => {
    const result = roxIndex({ spo2: 88, fio2: 80, fr: 35 });
    expect(result.rox).toBeLessThan(3.85);
    expect(result.risk).toBe('alto');
    expect(result.interpretation).toContain('intubação');
  });

  it('handles typical clinical scenario: stable HFNC', () => {
    const result = roxIndex({ spo2: 96, fio2: 40, fr: 18 });
    expect(result.rox).toBeGreaterThan(10);
    expect(result.risk).toBe('baixo');
  });

  it('handles typical clinical scenario: failing HFNC', () => {
    const result = roxIndex({ spo2: 85, fio2: 100, fr: 38 });
    expect(result.rox).toBeLessThan(3);
    expect(result.risk).toBe('alto');
  });

  it('rounds to 2 decimal places', () => {
    const result = roxIndex({ spo2: 93, fio2: 55, fr: 22 });
    const decimalParts = result.rox.toString().split('.');
    if (decimalParts.length > 1) {
      expect(decimalParts[1].length).toBeLessThanOrEqual(2);
    }
  });
});
