/**
 * Tests for Holliday-Segar (calculator-definitions.js)
 *
 * Valida o compute de `ped_holliday_segar` (ativa) e da duplicata
 * `hemo_holliday` (inactive) — ambas devem usar:
 *   - Taxa horária (4-2-1):    ≤10kg: 4×kg | 10-20kg: 40+2×(kg-10) | >20kg: 60+1×(kg-20)
 *   - Volume diário (100-50-20): ≤10kg: 100×kg | 10-20kg: 1000+50×(kg-10) | >20kg: 1500+20×(kg-20)
 *
 * IMPORTANTE (correção clínica 2026-06): o volume de 24h NÃO é mlHora × 24.
 * A 4-2-1 é aproximação horária da regra diária (20 kg → 60 mL/h e 1500 mL/dia;
 * 60 × 24 = 1440 ≠ 1500).
 */
import { describe, it, expect } from 'vitest';
import { getCalculatorById } from '../../design-system/data/calculator-definitions.js';

const ped = getCalculatorById('ped_holliday_segar');
const hemo = getCalculatorById('hemo_holliday');

// peso → [mlHora (4-2-1), ml24h (100-50-20)]
const TABLE = [
  [4, 16, 400],        // neonato/lactente, 1º tier
  [8, 32, 800],
  [10, 40, 1000],      // limite exato do 1º tier
  [10.0, 40, 1000],    // boundary explícito
  [12.5, 45, 1125],    // fracionário no 2º tier
  [15, 50, 1250],      // 40+2×5 | 1000+50×5
  [20, 60, 1500],      // limite exato do 2º tier — caso do e2e
  [20.0, 60, 1500],    // boundary explícito
  [30, 70, 1700],      // 60+10 | 1500+20×10
  [70, 110, 2500],     // 60+50 | 1500+20×50
];

describe('ped_holliday_segar', () => {
  it('existe, está ativa e usa o display custom', () => {
    expect(ped).toBeTruthy();
    expect(ped.status).toBe('active');
    expect(ped.customRender).toBe('hollidaySegar');
  });

  it.each(TABLE)('peso %s kg → %s mL/h (4-2-1) e %s mL/24h (100-50-20)', (peso, mlHora, ml24h) => {
    const r = ped.compute({ peso });
    expect(r).toBeTruthy();
    expect(r.details.mlHora).toBeCloseTo(mlHora, 5);
    expect(r.details.ml24h).toBeCloseTo(ml24h, 5);
  });

  it('volume 24h NÃO é mlHora × 24 acima de 10 kg (regras distintas)', () => {
    const r = ped.compute({ peso: 20 });
    expect(r.details.mlHora * 24).toBe(1440); // aproximação horária
    expect(r.details.ml24h).toBe(1500);       // regra diária clássica
  });

  it('mesmo no 1º tier a diária difere da horária ×24 (10 kg: 40×24=960 vs 1000)', () => {
    const r = ped.compute({ peso: 10 });
    expect(r.details.mlHora * 24).toBe(960);
    expect(r.details.ml24h).toBe(1000);
  });

  it('inputs inválidos retornam null (0, negativo, vazio, não-numérico)', () => {
    expect(ped.compute({ peso: 0 })).toBeNull();
    expect(ped.compute({ peso: -5 })).toBeNull();
    expect(ped.compute({ peso: '' })).toBeNull();
    expect(ped.compute({ peso: 'abc' })).toBeNull();
    expect(ped.compute({})).toBeNull();
  });

  it('aceita peso como string (input HTML)', () => {
    const r = ped.compute({ peso: '20' });
    expect(r.details.mlHora).toBe(60);
    expect(r.details.ml24h).toBe(1500);
  });

  it('resultMessage formata mL/h com 1 decimal e mL/24h inteiro', () => {
    const msg = ped.resultMessage(ped.compute({ peso: 20 }));
    expect(msg).toContain('60.0 mL/h');
    expect(msg).toContain('1500 mL/24h');
    expect(ped.resultMessage(null)).toBe('Informe o peso');
  });

  it('infoBox menciona ambas as regras (4-2-1 horária e 100-50-20 diária)', () => {
    const joined = ped.infoBox.keyPoints.join(' | ');
    expect(joined).toContain('4 mL/kg/h');
    expect(joined).toContain('100-50-20');
  });
});

describe('hemo_holliday (duplicata inactive) — coerência com ped_holliday_segar', () => {
  it('segue inactive (não aparece na UI)', () => {
    expect(hemo).toBeTruthy();
    expect(hemo.status).toBe('inactive');
  });

  it.each(TABLE)('peso %s kg → mesmos resultados da calculadora ativa', (peso) => {
    const a = ped.compute({ peso });
    const b = hemo.compute({ peso });
    expect(b.details.mlHora).toBeCloseTo(a.details.mlHora, 5);
    expect(b.details.ml24h).toBeCloseTo(a.details.ml24h, 5);
  });

  it('inválidos retornam null', () => {
    expect(hemo.compute({ peso: 0 })).toBeNull();
    expect(hemo.compute({ peso: -1 })).toBeNull();
  });
});
