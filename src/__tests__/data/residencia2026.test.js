/**
 * residencia2026 helpers — testes.
 */
import { describe, it, expect } from 'vitest';
import { getSlotEfetivo, getEscalaCardDate, isDiaNaoUtil } from '../../data/residencia2026';
import { FERIADOS_2026 } from '../../data/plantao2026';

describe('getSlotEfetivo — rollover 18h', () => {
  it('00:00-11:59 retorna hoje · manhã', () => {
    const s = getSlotEfetivo(new Date('2026-04-20T09:00:00'));
    expect(s.turno).toBe('manha');
    expect(s.date.getDate()).toBe(20);
  });

  it('12:00-17:59 retorna hoje · tarde', () => {
    const s = getSlotEfetivo(new Date('2026-04-20T14:00:00'));
    expect(s.turno).toBe('tarde');
    expect(s.date.getDate()).toBe(20);
  });

  it('17:59 ainda é hoje · tarde', () => {
    const s = getSlotEfetivo(new Date('2026-04-20T17:59:00'));
    expect(s.turno).toBe('tarde');
    expect(s.date.getDate()).toBe(20);
  });

  it('18:00 rola para amanhã · manhã', () => {
    const s = getSlotEfetivo(new Date('2026-04-20T18:00:00'));
    expect(s.turno).toBe('manha');
    expect(s.date.getDate()).toBe(21);
  });
});

describe('getEscalaCardDate — 18h rolls para dia seguinte', () => {
  it('antes das 18h retorna hoje', () => {
    const d = getEscalaCardDate(new Date('2026-04-20T17:59:00'));
    expect(d.getDate()).toBe(20);
  });

  it('18h+ retorna amanhã', () => {
    const d = getEscalaCardDate(new Date('2026-04-20T18:00:00'));
    expect(d.getDate()).toBe(21);
  });
});

describe('isDiaNaoUtil — FDS ou feriado', () => {
  it('segunda (20/04/2026) é dia útil', () => {
    expect(isDiaNaoUtil('2026-04-20', FERIADOS_2026)).toBe(false);
  });

  it('sábado (18/04/2026) é não-útil', () => {
    expect(isDiaNaoUtil('2026-04-18', FERIADOS_2026)).toBe(true);
  });

  it('domingo (19/04/2026) é não-útil', () => {
    expect(isDiaNaoUtil('2026-04-19', FERIADOS_2026)).toBe(true);
  });

  it('Tiradentes (21/04/2026, terça) é não-útil', () => {
    expect(isDiaNaoUtil('2026-04-21', FERIADOS_2026)).toBe(true);
  });

  it('Dia do Trabalho (01/05/2026, sexta) é não-útil', () => {
    expect(isDiaNaoUtil('2026-05-01', FERIADOS_2026)).toBe(true);
  });

  it('dateInput vazio retorna false', () => {
    expect(isDiaNaoUtil(null, FERIADOS_2026)).toBe(false);
    expect(isDiaNaoUtil('', FERIADOS_2026)).toBe(false);
  });

  it('aceita Date object', () => {
    expect(isDiaNaoUtil(new Date('2026-04-19T12:00:00'), FERIADOS_2026)).toBe(true);
    expect(isDiaNaoUtil(new Date('2026-04-20T12:00:00'), FERIADOS_2026)).toBe(false);
  });
});
