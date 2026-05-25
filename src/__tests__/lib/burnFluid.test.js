/**
 * Tests for src/lib/burnFluid.js — Reposição volêmica em queimados
 *
 * Cobre:
 *   - Parkland ISBI (2 mL/kg) — fórmula atual
 *   - Parkland Baxter (4 mL/kg) — fórmula histórica
 *   - Manutenção pediátrica Holliday-Segar
 *   - Ajuste por tempo decorrido
 *   - Edge cases (zero, negativos, extremos fisiológicos)
 *   - Relação ISBI = metade de Baxter para adultos
 */
import { describe, it, expect } from 'vitest';
import {
  hollidaySegarDaily,
  parklandISBI,
  parklandBaxter,
  parklandBoth,
} from '../../lib/burnFluid.js';

// ---------- Holliday-Segar ----------

describe('hollidaySegarDaily', () => {
  it('returns 0 for weight <= 0', () => {
    expect(hollidaySegarDaily(0)).toBe(0);
    expect(hollidaySegarDaily(-5)).toBe(0);
  });

  it('calculates correctly for <= 10 kg', () => {
    expect(hollidaySegarDaily(8)).toBe(800);    // 8 × 100
    expect(hollidaySegarDaily(10)).toBe(1000);  // 10 × 100
  });

  it('calculates correctly for 10–20 kg', () => {
    expect(hollidaySegarDaily(15)).toBe(1250);  // 1000 + 50×5
    expect(hollidaySegarDaily(20)).toBe(1500);  // 1000 + 50×10
  });

  it('calculates correctly for > 20 kg', () => {
    expect(hollidaySegarDaily(25)).toBe(1600);  // 1500 + 20×5
    expect(hollidaySegarDaily(29)).toBe(1680);  // 1500 + 20×9
  });
});

// ---------- Parkland ISBI (2 mL/kg) ----------

describe('parklandISBI — adult 70kg, 30% TBSA', () => {
  it('0h elapsed → volume24h = 4200, volume8h = 2100', () => {
    const r = parklandISBI(70, 30, 0);
    expect(r).not.toBeNull();
    expect(r.volume24h).toBe(4200);   // 2 × 70 × 30
    expect(r.volume8h).toBe(2100);
    expect(r.volume16h).toBe(2100);
    expect(r.coef).toBe(2);
  });

  it('0h elapsed → rateFirst8h = 262.5 mL/h', () => {
    const r = parklandISBI(70, 30, 0);
    expect(r.rateFirst8h).toBe(262.5);  // 2100 / 8
  });

  it('0h elapsed → adjustedRate8h equals rateFirst8h (no time passed)', () => {
    const r = parklandISBI(70, 30, 0);
    expect(r.adjustedRate8h).toBe(r.rateFirst8h);
  });

  it('4h elapsed → adjustedRate8h recalculated for 4h remaining', () => {
    const r = parklandISBI(70, 30, 4);
    // Volume first 8h = 2100; ideally 262.5 × 4 = 1050 already given
    // Remaining = 2100 - 1050 = 1050 in 4h → 262.5 mL/h
    expect(r.hoursRemaining8h).toBe(4);
    expect(r.adjustedRate8h).toBe(262.5);
  });

  it('2h elapsed → adjustedRate8h recalculated for 6h remaining', () => {
    const r = parklandISBI(70, 30, 2);
    // Volume first 8h = 2100; ideally 262.5 × 2 = 525 already given
    // Remaining = 2100 - 525 = 1575 in 6h → 262.5 mL/h
    expect(r.hoursRemaining8h).toBe(6);
    expect(r.adjustedRate8h).toBe(262.5);
  });

  it('8h elapsed → first period complete, adjustedRate8h = 0', () => {
    const r = parklandISBI(70, 30, 8);
    expect(r.adjustedRate8h).toBe(0);
    expect(r.hoursRemaining8h).toBe(0);
    // rateNext16h should still be valid
    expect(r.rateNext16h).toBeCloseTo(131.25);  // 2100 / 16
  });

  it('adult (>= 30kg) has no pediatric maintenance', () => {
    const r = parklandISBI(70, 30, 0);
    expect(r.maintenancePed24h).toBe(0);
    expect(r.totalWithMaintenance).toBe(4200);
    expect(r.isPediatric).toBe(false);
  });

  it('urine goal is 0.5 mL/kg/h for adult', () => {
    const r = parklandISBI(70, 30, 0);
    expect(r.urineGoalMlKgH).toBe(0.5);
    expect(r.urineGoalMlH).toBe(35);  // 70 × 0.5
  });
});

// ---------- Parkland Baxter (4 mL/kg) ----------

describe('parklandBaxter — adult 70kg, 30% TBSA', () => {
  it('0h elapsed → volume24h = 8400', () => {
    const r = parklandBaxter(70, 30, 0);
    expect(r).not.toBeNull();
    expect(r.volume24h).toBe(8400);  // 4 × 70 × 30
    expect(r.coef).toBe(4);
  });

  it('0h elapsed → rateFirst8h = 525 mL/h', () => {
    const r = parklandBaxter(70, 30, 0);
    expect(r.rateFirst8h).toBe(525);  // 4200 / 8
  });
});

// ---------- Pediátrico ----------

describe('parklandISBI — pediatric', () => {
  it('child 15kg, 20% TBSA, 0h → 600 + maintenance 1250 = 1850 total', () => {
    const r = parklandISBI(15, 20, 0);
    expect(r).not.toBeNull();
    expect(r.volume24h).toBe(600);              // 2 × 15 × 20
    expect(r.maintenancePed24h).toBe(1250);     // 1000 + 50×5
    expect(r.totalWithMaintenance).toBe(1850);
    expect(r.isPediatric).toBe(true);
  });

  it('child 8kg, 15% TBSA, 0h → 240 + maintenance 800 = 1040 total', () => {
    const r = parklandISBI(8, 15, 0);
    expect(r).not.toBeNull();
    expect(r.volume24h).toBe(240);              // 2 × 8 × 15
    expect(r.maintenancePed24h).toBe(800);      // 8 × 100
    expect(r.totalWithMaintenance).toBe(1040);
    expect(r.isPediatric).toBe(true);
  });

  it('urine goal is 1 mL/kg/h for pediatric (<30kg)', () => {
    const r = parklandISBI(15, 20, 0);
    expect(r.urineGoalMlKgH).toBe(1);
    expect(r.urineGoalMlH).toBe(15);  // 15 × 1
  });

  it('borderline: 30kg is NOT pediatric (>= 30)', () => {
    const r = parklandISBI(30, 20, 0);
    expect(r.isPediatric).toBe(false);
    expect(r.maintenancePed24h).toBe(0);
  });

  it('borderline: 29.9kg IS pediatric', () => {
    const r = parklandISBI(29.9, 20, 0);
    expect(r.isPediatric).toBe(true);
    expect(r.maintenancePed24h).toBeGreaterThan(0);
  });
});

// ---------- Edge cases ----------

describe('edge cases', () => {
  it('weight 0 → null', () => {
    expect(parklandISBI(0, 30, 0)).toBeNull();
    expect(parklandBaxter(0, 30, 0)).toBeNull();
  });

  it('negative weight → null', () => {
    expect(parklandISBI(-10, 30, 0)).toBeNull();
  });

  it('SCQ 0% → null', () => {
    expect(parklandISBI(70, 0, 0)).toBeNull();
    expect(parklandBaxter(70, 0, 0)).toBeNull();
  });

  it('negative SCQ → null', () => {
    expect(parklandISBI(70, -5, 0)).toBeNull();
  });

  it('SCQ > 100% → null (impossible burn)', () => {
    expect(parklandISBI(70, 101, 0)).toBeNull();
  });

  it('SCQ 100% — massive burn, valid', () => {
    const r = parklandISBI(70, 100, 0);
    expect(r).not.toBeNull();
    expect(r.volume24h).toBe(14000);  // 2 × 70 × 100
  });

  it('hoursElapsed negative → clamped to 0', () => {
    const r = parklandISBI(70, 30, -2);
    const r0 = parklandISBI(70, 30, 0);
    expect(r.adjustedRate8h).toBe(r0.adjustedRate8h);
  });

  it('hoursElapsed > 24 → clamped to 24', () => {
    const r = parklandISBI(70, 30, 30);
    expect(r.adjustedRate8h).toBe(0);
    expect(r.hoursRemaining8h).toBe(0);
  });

  it('non-numeric inputs fallback gracefully', () => {
    expect(parklandISBI('abc', 30, 0)).toBeNull();
    expect(parklandISBI(70, 'xyz', 0)).toBeNull();
  });

  it('string numeric inputs are parsed', () => {
    const r = parklandISBI('70', '30', '0');
    expect(r).not.toBeNull();
    expect(r.volume24h).toBe(4200);
  });

  it('neonatal weight 3kg — formula still produces valid result', () => {
    const r = parklandISBI(3, 10, 0);
    expect(r).not.toBeNull();
    expect(r.volume24h).toBe(60);               // 2 × 3 × 10
    expect(r.maintenancePed24h).toBe(300);       // 3 × 100
    expect(r.totalWithMaintenance).toBe(360);
    expect(r.isPediatric).toBe(true);
  });

  it('morbid obesity 250kg — formula produces valid result', () => {
    const r = parklandISBI(250, 50, 0);
    expect(r).not.toBeNull();
    expect(r.volume24h).toBe(25000);  // 2 × 250 × 50
    expect(r.isPediatric).toBe(false);
  });
});

// ---------- ISBI vs Baxter relação ----------

describe('ISBI volume is exactly half of Baxter for same adult inputs', () => {
  const cases = [
    { w: 70, scq: 30 },
    { w: 80, scq: 40 },
    { w: 60, scq: 50 },
    { w: 100, scq: 20 },
  ];

  cases.forEach(({ w, scq }) => {
    it(`w=${w}kg, SCQ=${scq}%: ISBI = Baxter / 2`, () => {
      const isbi = parklandISBI(w, scq, 0);
      const baxter = parklandBaxter(w, scq, 0);
      expect(isbi.volume24h).toBe(baxter.volume24h / 2);
      expect(isbi.volume8h).toBe(baxter.volume8h / 2);
      expect(isbi.rateFirst8h).toBe(baxter.rateFirst8h / 2);
    });
  });
});

// ---------- parklandBoth ----------

describe('parklandBoth', () => {
  it('returns both ISBI and Baxter results', () => {
    const r = parklandBoth(70, 30, 0);
    expect(r.isbi).not.toBeNull();
    expect(r.baxter).not.toBeNull();
    expect(r.isbi.coef).toBe(2);
    expect(r.baxter.coef).toBe(4);
    expect(r.isbi.volume24h).toBe(4200);
    expect(r.baxter.volume24h).toBe(8400);
  });

  it('returns null for both when inputs are invalid', () => {
    const r = parklandBoth(0, 30, 0);
    expect(r.isbi).toBeNull();
    expect(r.baxter).toBeNull();
  });

  it('default hoursElapsed is 0', () => {
    const r1 = parklandBoth(70, 30);
    const r2 = parklandBoth(70, 30, 0);
    expect(r1.isbi.adjustedRate8h).toBe(r2.isbi.adjustedRate8h);
  });
});

// ---------- Tempo decorrido — cenários clínicos ----------

describe('time-adjusted scenarios', () => {
  it('late arrival: 6h elapsed, adult 80kg, 40% → catch-up rate', () => {
    const r = parklandISBI(80, 40, 6);
    // volume24h = 2 × 80 × 40 = 6400
    // volume8h = 3200, rateFirst8h = 400 mL/h
    // Already due: 400 × 6 = 2400
    // Remaining: 3200 - 2400 = 800 in 2h → 400 mL/h
    expect(r.volume24h).toBe(6400);
    expect(r.hoursRemaining8h).toBe(2);
    expect(r.adjustedRate8h).toBe(400);
  });

  it('1h elapsed adjusts correctly', () => {
    const r = parklandISBI(70, 30, 1);
    // volume8h = 2100, rateFirst8h = 262.5
    // Already due: 262.5 × 1 = 262.5
    // Remaining: 2100 - 262.5 = 1837.5 in 7h → 262.5
    expect(r.hoursRemaining8h).toBe(7);
    expect(r.adjustedRate8h).toBe(262.5);
  });

  it('12h elapsed — well into second period', () => {
    const r = parklandISBI(70, 30, 12);
    expect(r.adjustedRate8h).toBe(0);
    expect(r.hoursRemaining8h).toBe(0);
    // rateNext16h still valid for reference
    expect(r.rateNext16h).toBeCloseTo(131.25);
  });
});
