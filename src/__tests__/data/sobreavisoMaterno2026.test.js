/**
 * sobreavisoMaterno2026 — testes da tabela estática + helpers.
 */
import { describe, it, expect } from 'vitest';
import { SOBREAVISO_MATERNO_2026, FUNCIONARIAS_SOBREAVISO, getSobreavisoParaData, getSobreavisoEfetivo, getFuncionariaById, getHorarioSobreaviso } from '../../data/sobreavisoMaterno2026';

describe('sobreavisoMaterno2026 — escala', () => {
  it('contém 91 dias (abril + maio + junho 2026)', () => {
    expect(Object.keys(SOBREAVISO_MATERNO_2026)).toHaveLength(91);
  });

  it('todos os IDs referenciados existem em FUNCIONARIAS_SOBREAVISO', () => {
    const validIds = new Set(FUNCIONARIAS_SOBREAVISO.map((f) => f.id));
    for (const [, id] of Object.entries(SOBREAVISO_MATERNO_2026)) {
      expect(validIds.has(id)).toBe(true);
    }
  });

  it('dateKeys no formato YYYY-MM-DD', () => {
    for (const key of Object.keys(SOBREAVISO_MATERNO_2026)) {
      expect(key).toMatch(/^2026-(04|05|06)-\d{2}$/);
    }
  });
});

describe('getHorarioSobreaviso', () => {
  it('sempre retorna 19:00 → 07:00 (12h)', () => {
    const h = getHorarioSobreaviso();
    expect(h).toEqual({ inicio: '19:00', fim: '07:00', duracao: 12 });
  });
});

describe('getSobreavisoEfetivo — rollover 07h', () => {
  it('06:59 retorna o dia anterior', () => {
    const now = new Date('2026-04-15T06:59:00');
    const ef = getSobreavisoEfetivo(now);
    expect(ef.getDate()).toBe(14);
    expect(ef.getMonth()).toBe(3); // abril
  });

  it('07:00 retorna o dia corrente', () => {
    const now = new Date('2026-04-15T07:00:00');
    const ef = getSobreavisoEfetivo(now);
    expect(ef.getDate()).toBe(15);
  });

  it('23:59 retorna o dia corrente', () => {
    const now = new Date('2026-04-15T23:59:00');
    const ef = getSobreavisoEfetivo(now);
    expect(ef.getDate()).toBe(15);
  });
});

describe('getSobreavisoParaData', () => {
  it('retorna funcionária + data + horário para 2026-04-15', () => {
    const result = getSobreavisoParaData(new Date('2026-04-15T12:00:00'));
    expect(result).toBeTruthy();
    expect(result.id).toBe(SOBREAVISO_MATERNO_2026['2026-04-15']);
    expect(result.data).toBe('2026-04-15');
    expect(result.horario.inicio).toBe('19:00');
  });

  it('retorna null para data fora do range', () => {
    const result = getSobreavisoParaData(new Date('2026-07-01T12:00:00'));
    expect(result).toBeNull();
  });
});

describe('getFuncionariaById', () => {
  it('retorna funcionária válida', () => {
    const f = getFuncionariaById('marta');
    expect(f.nome).toBe('Marta');
    expect(f.cargo).toBe('Enfermeira');
  });

  it('retorna null para id inválido', () => {
    expect(getFuncionariaById('xxxxx')).toBeNull();
    expect(getFuncionariaById(null)).toBeNull();
    expect(getFuncionariaById('')).toBeNull();
  });
});
