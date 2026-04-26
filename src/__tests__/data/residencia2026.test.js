/**
 * residencia2026 helpers — testes.
 */
import { describe, it, expect } from 'vitest';
import {
  getSlotEfetivo,
  getEscalaCardDate,
  isDiaNaoUtil,
  getProximoDiaUtil,
  toDateKey,
} from '../../data/residencia2026';
import { FERIADOS_2026 } from '../../data/plantao2026';

describe('getSlotEfetivo — rollover 11h e 18h', () => {
  it('00:00-10:59 retorna hoje · manhã', () => {
    const s = getSlotEfetivo(new Date('2026-04-20T09:00:00'));
    expect(s.turno).toBe('manha');
    expect(s.date.getDate()).toBe(20);
  });

  it('10:59 ainda é hoje · manhã (borda)', () => {
    const s = getSlotEfetivo(new Date('2026-04-20T10:59:00'));
    expect(s.turno).toBe('manha');
    expect(s.date.getDate()).toBe(20);
  });

  it('11:00 vira hoje · tarde (transição manhã→tarde)', () => {
    const s = getSlotEfetivo(new Date('2026-04-20T11:00:00'));
    expect(s.turno).toBe('tarde');
    expect(s.date.getDate()).toBe(20);
  });

  it('11:00-17:59 retorna hoje · tarde', () => {
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

describe('getSlotEfetivo — salto FDS/feriados (próximo dia útil)', () => {
  it('domingo (19/04/2026) qualquer hora aponta para segunda 20/04 · manhã', () => {
    const horarios = ['08:00:00', '11:30:00', '15:00:00', '19:00:00'];
    for (const hora of horarios) {
      const s = getSlotEfetivo(new Date(`2026-04-19T${hora}`), FERIADOS_2026);
      expect(s.turno).toBe('manha');
      expect(toDateKey(s.date)).toBe('2026-04-20');
    }
  });

  it('sábado (18/04/2026) aponta para segunda 20/04 · manhã', () => {
    const s = getSlotEfetivo(new Date('2026-04-18T10:00:00'), FERIADOS_2026);
    expect(s.turno).toBe('manha');
    expect(toDateKey(s.date)).toBe('2026-04-20');
  });

  it('feriado encadeado: domingo 5/4 antes da Sexta-Santa só aplica salto se feriado precede dia útil', () => {
    // Sexta-Santa é 03/04/2026. Sábado 04/04 e domingo 05/04 são FDS.
    // Próximo dia útil após domingo 05/04 é segunda 06/04 (terça 07 também é útil).
    const s = getSlotEfetivo(new Date('2026-04-05T12:00:00'), FERIADOS_2026);
    expect(toDateKey(s.date)).toBe('2026-04-06');
    expect(s.turno).toBe('manha');
  });

  it('Tiradentes (terça 21/04) aponta para quarta 22/04', () => {
    const s = getSlotEfetivo(new Date('2026-04-21T09:00:00'), FERIADOS_2026);
    expect(toDateKey(s.date)).toBe('2026-04-22');
    expect(s.turno).toBe('manha');
  });

  it('dia útil sem feriado: comportamento normal mesmo com feriadosSet', () => {
    const s = getSlotEfetivo(new Date('2026-04-20T14:00:00'), FERIADOS_2026);
    expect(s.turno).toBe('tarde');
    expect(toDateKey(s.date)).toBe('2026-04-20');
  });

  it('sexta às 18h rola para sábado, então salta para segunda', () => {
    // Sexta 17/04 às 18h: rollover normal vai para sábado 18/04 (FDS).
    // Com feriadosSet: sábado é não-útil, salta para segunda 20/04.
    const s = getSlotEfetivo(new Date('2026-04-17T18:00:00'), FERIADOS_2026);
    expect(toDateKey(s.date)).toBe('2026-04-20');
    expect(s.turno).toBe('manha');
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

  it('com feriadosSet: domingo aponta para segunda', () => {
    const d = getEscalaCardDate(new Date('2026-04-19T10:00:00'), FERIADOS_2026);
    expect(toDateKey(d)).toBe('2026-04-20');
  });

  it('com feriadosSet: feriado aponta para próximo dia útil', () => {
    const d = getEscalaCardDate(new Date('2026-04-21T09:00:00'), FERIADOS_2026);
    expect(toDateKey(d)).toBe('2026-04-22');
  });
});

describe('getProximoDiaUtil', () => {
  it('dia útil retorna ele mesmo', () => {
    const d = getProximoDiaUtil('2026-04-20', FERIADOS_2026);
    expect(toDateKey(d)).toBe('2026-04-20');
  });

  it('sábado retorna segunda', () => {
    const d = getProximoDiaUtil('2026-04-18', FERIADOS_2026);
    expect(toDateKey(d)).toBe('2026-04-20');
  });

  it('domingo retorna segunda', () => {
    const d = getProximoDiaUtil('2026-04-19', FERIADOS_2026);
    expect(toDateKey(d)).toBe('2026-04-20');
  });

  it('Tiradentes (terça 21/04) retorna quarta 22/04', () => {
    const d = getProximoDiaUtil('2026-04-21', FERIADOS_2026);
    expect(toDateKey(d)).toBe('2026-04-22');
  });

  it('aceita Date object', () => {
    const d = getProximoDiaUtil(new Date('2026-04-19T12:00:00'), FERIADOS_2026);
    expect(toDateKey(d)).toBe('2026-04-20');
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
