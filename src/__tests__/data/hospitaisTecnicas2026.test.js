/**
 * hospitaisTecnicas2026 — testes da tabela estática + helpers.
 */
import { describe, it, expect } from 'vitest';
import { HOSPITAIS_2026, FUNCIONARIAS_HOSPITAIS, getHospitaisParaData, getHospitaisEfetivo, isDiaAutomaticoHospitais, TURNO_MANHA, TURNO_TARDE } from '../../data/hospitaisTecnicas2026';
import { FERIADOS_2026 } from '../../data/plantao2026';

describe('hospitaisTecnicas2026 — escala', () => {
  it('contém 49 dias (FDS + feriados de abr/mai/jun/jul/ago)', () => {
    expect(Object.keys(HOSPITAIS_2026)).toHaveLength(49);
  });

  it('todas as entries têm shape válido', () => {
    const nomes = new Set(FUNCIONARIAS_HOSPITAIS.map((f) => f.nome));
    for (const [key, entry] of Object.entries(HOSPITAIS_2026)) {
      expect(key).toMatch(/^2026-(04|05|06|07|08)-\d{2}$/);
      if (entry.unimed) expect(nomes.has(entry.unimed)).toBe(true);
      if (entry.hro) expect(nomes.has(entry.hro)).toBe(true);
      if (entry.plantaoPago) expect(nomes.has(entry.plantaoPago)).toBe(true);
    }
  });

  it('domingos não têm UNIMED', () => {
    const domingos = ['2026-04-05', '2026-04-12', '2026-04-19', '2026-04-26', '2026-05-03', '2026-05-10', '2026-05-17', '2026-05-24', '2026-05-31', '2026-06-07', '2026-06-14', '2026-06-21', '2026-06-28'];
    for (const k of domingos) {
      expect(HOSPITAIS_2026[k]?.unimed).toBeNull();
    }
  });

  it('sábados e feriados têm UNIMED', () => {
    const comUnimed = ['2026-04-03', '2026-04-04', '2026-04-11', '2026-04-18', '2026-04-21', '2026-04-25', '2026-05-01', '2026-05-02', '2026-05-09', '2026-05-16', '2026-05-23', '2026-05-30', '2026-06-04', '2026-06-06', '2026-06-13', '2026-06-20', '2026-06-27'];
    for (const k of comUnimed) {
      expect(HOSPITAIS_2026[k]?.unimed).toBeTruthy();
    }
  });

  it('todos os dias têm HRO e Plantão Pago', () => {
    for (const entry of Object.values(HOSPITAIS_2026)) {
      expect(entry.hro).toBeTruthy();
      expect(entry.plantaoPago).toBeTruthy();
    }
  });

  it('horários fixos', () => {
    expect(TURNO_MANHA).toBe('07:00 - 15:00');
    expect(TURNO_TARDE).toBe('15:00 - 23:00');
  });
});

describe('getHospitaisEfetivo — rollover 18h', () => {
  it('17:59 retorna dia corrente', () => {
    const now = new Date('2026-04-04T17:59:00');
    const ef = getHospitaisEfetivo(now);
    expect(ef.getDate()).toBe(4);
  });

  it('18:00 retorna dia seguinte', () => {
    const now = new Date('2026-04-04T18:00:00');
    const ef = getHospitaisEfetivo(now);
    expect(ef.getDate()).toBe(5);
  });

  it('00:00 retorna dia corrente (não mais ontem)', () => {
    const now = new Date('2026-04-04T00:00:00');
    const ef = getHospitaisEfetivo(now);
    expect(ef.getDate()).toBe(4);
  });
});

describe('getHospitaisEfetivo — salto FDS/feriados', () => {
  it('domingo (19/04) com feriadosSet aponta para segunda 20/04', () => {
    const now = new Date('2026-04-19T10:00:00');
    const ef = getHospitaisEfetivo(now, FERIADOS_2026);
    expect(ef.getDate()).toBe(20);
  });

  it('sábado (18/04) com feriadosSet aponta para segunda 20/04', () => {
    const now = new Date('2026-04-18T15:00:00');
    const ef = getHospitaisEfetivo(now, FERIADOS_2026);
    expect(ef.getDate()).toBe(20);
  });

  it('Tiradentes (terça 21/04) com feriadosSet aponta para quarta 22/04', () => {
    const now = new Date('2026-04-21T09:00:00');
    const ef = getHospitaisEfetivo(now, FERIADOS_2026);
    expect(ef.getDate()).toBe(22);
  });

  it('dia útil com feriadosSet mantém dia corrente', () => {
    const now = new Date('2026-04-20T10:00:00');
    const ef = getHospitaisEfetivo(now, FERIADOS_2026);
    expect(ef.getDate()).toBe(20);
  });
});

describe('getHospitaisParaData + isDiaAutomaticoHospitais', () => {
  it('sábado retorna entry completo', () => {
    const d = new Date('2026-04-04T12:00:00');
    expect(isDiaAutomaticoHospitais(d)).toBe(true);
    const entry = getHospitaisParaData(d);
    expect(entry.unimed).toBe('Mari');
    expect(entry.hro).toBe('Renata');
    expect(entry.plantaoPago).toBe('Luciana');
    expect(entry.data).toBe('2026-04-04');
  });

  it('domingo retorna entry sem UNIMED', () => {
    const d = new Date('2026-04-05T12:00:00');
    expect(isDiaAutomaticoHospitais(d)).toBe(true);
    const entry = getHospitaisParaData(d);
    expect(entry.unimed).toBeNull();
    expect(entry.hro).toBe('Renata');
    expect(entry.plantaoPago).toBe('Mari');
  });

  it('feriado Tiradentes (21/04 terça) é automático', () => {
    const d = new Date('2026-04-21T12:00:00');
    expect(isDiaAutomaticoHospitais(d)).toBe(true);
    expect(getHospitaisParaData(d).label).toBe('Tiradentes');
  });

  it('dia útil não-feriado retorna null', () => {
    // 06/04 é segunda-feira comum
    const d = new Date('2026-04-06T12:00:00');
    expect(isDiaAutomaticoHospitais(d)).toBe(false);
    expect(getHospitaisParaData(d)).toBeNull();
  });

  it('data fora do range retorna null', () => {
    const d = new Date('2026-07-15T12:00:00');
    expect(isDiaAutomaticoHospitais(d)).toBe(false);
    expect(getHospitaisParaData(d)).toBeNull();
  });
});
