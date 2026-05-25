import { describe, it, expect } from 'vitest';
import {
  sodiumCorrectedHillier,
  sodiumCorrectedKatz,
  sodiumCorrectedBoth,
  interpretSodium,
  calciumCorrectedPayne,
  interpretCalcium,
} from '@/lib/electrolyteCorrection';

// ---------------------------------------------------------------------------
// Sódio corrigido — Hillier (2.4)
// ---------------------------------------------------------------------------

describe('sodiumCorrectedHillier (Hillier 1999, fator 2.4)', () => {
  it('glicose 100 mg/dL → correção zero (baseline)', () => {
    const r = sodiumCorrectedHillier(130, 100);
    expect(r.corrected).toBe(130);
    expect(r.correction).toBe(0);
    expect(r.formula).toBe('Hillier');
    expect(r.factor).toBe(2.4);
  });

  it('Na=130, Glicose=500 → corrigido 139.6', () => {
    // 2.4 × ((500 - 100) / 100) = 2.4 × 4 = 9.6
    const r = sodiumCorrectedHillier(130, 500);
    expect(r.corrected).toBe(139.6);
    expect(r.correction).toBe(9.6);
  });

  it('Na=125, Glicose=800 → corrigido 141.8 (CAD grave)', () => {
    // 2.4 × ((800 - 100) / 100) = 2.4 × 7 = 16.8
    const r = sodiumCorrectedHillier(125, 800);
    expect(r.corrected).toBe(141.8);
    expect(r.correction).toBe(16.8);
  });

  it('Na=140, Glicose=200 → corrigido 142.4', () => {
    // 2.4 × ((200 - 100) / 100) = 2.4 × 1 = 2.4
    const r = sodiumCorrectedHillier(140, 200);
    expect(r.corrected).toBe(142.4);
    expect(r.correction).toBe(2.4);
  });

  it('glicose < 100 → correção negativa (fisiologicamente válido)', () => {
    // 2.4 × ((70 - 100) / 100) = 2.4 × (-0.3) = -0.72
    const r = sodiumCorrectedHillier(140, 70);
    expect(r.corrected).toBe(139.3); // 140 + (-0.72) arredondado
    expect(r.correction).toBe(-0.7);
  });
});

// ---------------------------------------------------------------------------
// Sódio corrigido — Katz (1.6)
// ---------------------------------------------------------------------------

describe('sodiumCorrectedKatz (Katz 1973, fator 1.6)', () => {
  it('glicose 100 mg/dL → correção zero', () => {
    const r = sodiumCorrectedKatz(130, 100);
    expect(r.corrected).toBe(130);
    expect(r.correction).toBe(0);
    expect(r.formula).toBe('Katz');
    expect(r.factor).toBe(1.6);
  });

  it('Na=130, Glicose=500 → corrigido 136.4', () => {
    // 1.6 × 4 = 6.4
    const r = sodiumCorrectedKatz(130, 500);
    expect(r.corrected).toBe(136.4);
    expect(r.correction).toBe(6.4);
  });

  it('Na=125, Glicose=800 → corrigido 136.2', () => {
    // 1.6 × 7 = 11.2
    const r = sodiumCorrectedKatz(125, 800);
    expect(r.corrected).toBe(136.2);
    expect(r.correction).toBe(11.2);
  });
});

// ---------------------------------------------------------------------------
// sodiumCorrectedBoth
// ---------------------------------------------------------------------------

describe('sodiumCorrectedBoth', () => {
  it('retorna ambas as correções simultaneamente', () => {
    const r = sodiumCorrectedBoth(130, 500);
    expect(r.hillier.corrected).toBe(139.6);
    expect(r.katz.corrected).toBe(136.4);
  });

  it('input inválido → ambos retornam null', () => {
    const r = sodiumCorrectedBoth(null, 500);
    expect(r.hillier).toBeNull();
    expect(r.katz).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Edge cases — sódio
// ---------------------------------------------------------------------------

describe('sódio — edge cases', () => {
  it('Na=0 (input zero) → retorna resultado (Na=0 + correção)', () => {
    const r = sodiumCorrectedHillier(0, 500);
    expect(r.corrected).toBe(9.6); // 0 + 9.6
  });

  it('input NaN/null/undefined → retorna null', () => {
    expect(sodiumCorrectedHillier(null, 100)).toBeNull();
    expect(sodiumCorrectedHillier(undefined, 100)).toBeNull();
    expect(sodiumCorrectedHillier('abc', 100)).toBeNull();
    expect(sodiumCorrectedHillier(130, null)).toBeNull();
  });

  it('input negativo → retorna null', () => {
    expect(sodiumCorrectedHillier(-10, 100)).toBeNull();
    expect(sodiumCorrectedHillier(130, -50)).toBeNull();
  });

  it('strings numéricas são aceitas', () => {
    const r = sodiumCorrectedHillier('130', '500');
    expect(r.corrected).toBe(139.6);
  });

  it('glicose muito alta (1500 mg/dL) → correção significativa', () => {
    // 2.4 × ((1500 - 100) / 100) = 2.4 × 14 = 33.6
    const r = sodiumCorrectedHillier(120, 1500);
    expect(r.corrected).toBe(153.6);
    expect(r.correction).toBe(33.6);
  });

  it('arredondamento clínico: nunca mais que 1 casa decimal', () => {
    // 2.4 × ((350 - 100) / 100) = 2.4 × 2.5 = 6.0
    const r = sodiumCorrectedHillier(133, 350);
    const decimalPlaces = r.corrected.toString().split('.')[1]?.length ?? 0;
    expect(decimalPlaces).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// interpretSodium
// ---------------------------------------------------------------------------

describe('interpretSodium', () => {
  it('Na=118 → critico (hiponatremia grave)', () => {
    const r = interpretSodium(118);
    expect(r.risk).toBe('critico');
    expect(r.label).toBe('Hiponatremia grave');
    expect(r.description).toContain('edema cerebral');
  });

  it('Na=125 → alto (hiponatremia moderada)', () => {
    expect(interpretSodium(125).risk).toBe('alto');
  });

  it('Na=132 → medio (hiponatremia leve)', () => {
    expect(interpretSodium(132).risk).toBe('medio');
  });

  it('Na=140 → baixo (normal)', () => {
    const r = interpretSodium(140);
    expect(r.risk).toBe('baixo');
    expect(r.label).toBe('Normal');
  });

  it('Na=148 → medio (hipernatremia leve)', () => {
    expect(interpretSodium(148).risk).toBe('medio');
  });

  it('Na=155 → alto (hipernatremia significativa)', () => {
    expect(interpretSodium(155).risk).toBe('alto');
  });

  it('limites exatos: 120, 130, 135, 145, 150', () => {
    expect(interpretSodium(120).risk).toBe('alto');   // 120 = moderada, não grave
    expect(interpretSodium(129).risk).toBe('alto');
    expect(interpretSodium(130).risk).toBe('medio');
    expect(interpretSodium(134).risk).toBe('medio');
    expect(interpretSodium(135).risk).toBe('baixo');
    expect(interpretSodium(145).risk).toBe('baixo');
    expect(interpretSodium(146).risk).toBe('medio');
    expect(interpretSodium(150).risk).toBe('medio');
    expect(interpretSodium(151).risk).toBe('alto');
  });

  it('input inválido → null', () => {
    expect(interpretSodium(null)).toBeNull();
    expect(interpretSodium('abc')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Cálcio corrigido — Payne
// ---------------------------------------------------------------------------

describe('calciumCorrectedPayne (Payne 1973)', () => {
  it('Ca=8.0, Alb=2.0 → corrigido 9.6', () => {
    // 0.8 × (4.0 - 2.0) = 0.8 × 2 = 1.6
    const r = calciumCorrectedPayne(8.0, 2.0);
    expect(r.corrected).toBe(9.6);
    expect(r.correction).toBe(1.6);
    expect(r.formula).toBe('Payne');
  });

  it('Ca=10.0, Alb=4.0 → sem correção', () => {
    // 0.8 × (4.0 - 4.0) = 0
    const r = calciumCorrectedPayne(10.0, 4.0);
    expect(r.corrected).toBe(10.0);
    expect(r.correction).toBe(0);
  });

  it('Ca=7.5, Alb=3.0 → corrigido 8.3', () => {
    // 0.8 × (4.0 - 3.0) = 0.8
    const r = calciumCorrectedPayne(7.5, 3.0);
    expect(r.corrected).toBe(8.3);
    expect(r.correction).toBe(0.8);
  });

  it('albumina alta (5.0) → correção negativa', () => {
    // 0.8 × (4.0 - 5.0) = -0.8
    const r = calciumCorrectedPayne(10.0, 5.0);
    expect(r.corrected).toBe(9.2);
    expect(r.correction).toBe(-0.8);
  });

  it('input inválido → null', () => {
    expect(calciumCorrectedPayne(null, 4.0)).toBeNull();
    expect(calciumCorrectedPayne(8.0, 'abc')).toBeNull();
  });

  it('input negativo → null', () => {
    expect(calciumCorrectedPayne(-1, 4.0)).toBeNull();
    expect(calciumCorrectedPayne(8.0, -1)).toBeNull();
  });

  it('strings numéricas são aceitas', () => {
    const r = calciumCorrectedPayne('8.0', '2.0');
    expect(r.corrected).toBe(9.6);
  });
});

// ---------------------------------------------------------------------------
// interpretCalcium
// ---------------------------------------------------------------------------

describe('interpretCalcium', () => {
  it('Ca=6.5 → critico (hipocalcemia grave)', () => {
    const r = interpretCalcium(6.5);
    expect(r.risk).toBe('critico');
    expect(r.label).toBe('Hipocalcemia grave');
    expect(r.description).toContain('tetania');
  });

  it('Ca=7.5 → alto (hipocalcemia)', () => {
    expect(interpretCalcium(7.5).risk).toBe('alto');
  });

  it('Ca=9.0 → baixo (normal)', () => {
    const r = interpretCalcium(9.0);
    expect(r.risk).toBe('baixo');
    expect(r.label).toBe('Normal');
  });

  it('Ca=11.0 → medio (hipercalcemia leve)', () => {
    expect(interpretCalcium(11.0).risk).toBe('medio');
  });

  it('Ca=13.0 → alto (hipercalcemia)', () => {
    const r = interpretCalcium(13.0);
    expect(r.risk).toBe('alto');
    expect(r.description).toContain('arritmia');
  });

  it('limites exatos: 7.0, 8.5, 10.5, 12.0', () => {
    expect(interpretCalcium(6.9).risk).toBe('critico');
    expect(interpretCalcium(7.0).risk).toBe('alto');
    expect(interpretCalcium(8.4).risk).toBe('alto');
    expect(interpretCalcium(8.5).risk).toBe('baixo');
    expect(interpretCalcium(10.5).risk).toBe('baixo');
    expect(interpretCalcium(10.6).risk).toBe('medio');
    expect(interpretCalcium(12.0).risk).toBe('medio');
    expect(interpretCalcium(12.1).risk).toBe('alto');
  });

  it('input inválido → null', () => {
    expect(interpretCalcium(null)).toBeNull();
    expect(interpretCalcium('abc')).toBeNull();
  });
});
