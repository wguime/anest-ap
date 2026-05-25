import { describe, it, expect } from 'vitest';
import { curb65, crb65 } from '../../lib/curb65';

describe('curb65', () => {
  it('returns 0 for no criteria met', () => {
    const result = curb65({ confusion: false, urea: 5, rr: 20, sbp: 120, dbp: 80, age: 50 });
    expect(result.score).toBe(0);
    expect(result.risk).toBe('baixo');
    expect(result.disposition).toBe('ambulatorial');
    expect(result.mortality).toBe('0.6%');
  });

  it('scores each criterion individually', () => {
    expect(curb65({ confusion: true, urea: 5, rr: 20, sbp: 120, dbp: 80, age: 50 }).score).toBe(1);
    expect(curb65({ confusion: false, urea: 8, rr: 20, sbp: 120, dbp: 80, age: 50 }).score).toBe(1);
    expect(curb65({ confusion: false, urea: 5, rr: 30, sbp: 120, dbp: 80, age: 50 }).score).toBe(1);
    expect(curb65({ confusion: false, urea: 5, rr: 20, sbp: 89, dbp: 80, age: 50 }).score).toBe(1);
    expect(curb65({ confusion: false, urea: 5, rr: 20, sbp: 120, dbp: 60, age: 50 }).score).toBe(1);
    expect(curb65({ confusion: false, urea: 5, rr: 20, sbp: 120, dbp: 80, age: 65 }).score).toBe(1);
  });

  it('scores all criteria met as 5', () => {
    const result = curb65({ confusion: true, urea: 10, rr: 35, sbp: 80, dbp: 50, age: 70 });
    expect(result.score).toBe(5);
    expect(result.risk).toBe('critico');
    expect(result.disposition).toBe('internacao_uti');
    expect(result.mortality).toBe('57.6%');
  });

  it('urea boundary at 7', () => {
    expect(curb65({ urea: 7 }).breakdown.ureaElevada).toBe(false);
    expect(curb65({ urea: 7.1 }).breakdown.ureaElevada).toBe(true);
  });

  it('RR boundary at 30', () => {
    expect(curb65({ rr: 29 }).breakdown.frElevada).toBe(false);
    expect(curb65({ rr: 30 }).breakdown.frElevada).toBe(true);
  });

  it('SBP boundary at 90', () => {
    expect(curb65({ sbp: 90 }).breakdown.hipotensao).toBe(false);
    expect(curb65({ sbp: 89 }).breakdown.hipotensao).toBe(true);
  });

  it('DBP boundary at 60', () => {
    expect(curb65({ dbp: 61 }).breakdown.hipotensao).toBe(false);
    expect(curb65({ dbp: 60 }).breakdown.hipotensao).toBe(true);
  });

  it('age boundary at 65', () => {
    expect(curb65({ age: 64 }).breakdown.idade65).toBe(false);
    expect(curb65({ age: 65 }).breakdown.idade65).toBe(true);
  });

  it('disposition follows score', () => {
    expect(curb65({ confusion: false }).disposition).toBe('ambulatorial');
    expect(curb65({ confusion: true }).disposition).toBe('ambulatorial');
    expect(curb65({ confusion: true, urea: 8 }).disposition).toBe('internacao_curta');
    expect(curb65({ confusion: true, urea: 8, rr: 30 }).disposition).toBe('internacao_uti');
  });

  it('mortality matches expected values', () => {
    expect(curb65({ score: 0 }).mortality).toBe('0.6%');
  });
});

describe('crb65', () => {
  it('is CURB-65 without urea (always 0 for that component)', () => {
    const result = crb65({ confusion: true, rr: 30, sbp: 80, dbp: 50, age: 70 });
    expect(result.score).toBe(4);
    expect(result.breakdown.ureaElevada).toBe(false);
  });
});
