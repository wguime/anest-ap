/**
 * Helpers de plantões — testam as funções que alimentam os dropdowns dos
 * formulários de troca: getDatasDaSobreavisista, getDatasDaFuncionariaHospitais
 * e getSlotsFuncionariaNaData (com overrides aplicados).
 */
import { describe, it, expect } from 'vitest';
import { getDatasDaSobreavisista } from '../../data/sobreavisoMaterno2026';
import { getDatasDaFuncionariaHospitais, getSlotsFuncionariaNaData, getHospitaisEfetivos } from '../../data/hospitaisTecnicas2026';

const PAST_KEY = '2026-01-01';

describe('getDatasDaSobreavisista', () => {
  it('lista datas de Marta a partir do início do range', () => {
    const datas = getDatasDaSobreavisista('marta', PAST_KEY);
    // Datas reais de Marta: 01/04, 06/04, 08/04, 14/04, 17/04, 24/04, 08/05, 12/05, 14/05, 16/05, 18/05, 25/05
    expect(datas).toContain('2026-04-01');
    expect(datas).toContain('2026-04-06');
    expect(datas).toContain('2026-05-25');
    expect(datas.length).toBeGreaterThan(5);
  });

  it('respeita fromKey (filtra datas anteriores)', () => {
    const datas = getDatasDaSobreavisista('marta', '2026-05-01');
    expect(datas.every((k) => k >= '2026-05-01')).toBe(true);
    expect(datas).not.toContain('2026-04-01');
  });

  it('aplica overrides — funcionária ganha sobreaviso de outra', () => {
    // Override: 03/04 originalmente é Luciana, mas trocado para Marta
    const overrides = { '2026-04-03': 'marta' };
    const datas = getDatasDaSobreavisista('marta', PAST_KEY, overrides);
    expect(datas).toContain('2026-04-03');
  });

  it('aplica overrides — funcionária perde sobreaviso quando trocado', () => {
    const overrides = { '2026-04-01': 'renata' };
    const datas = getDatasDaSobreavisista('marta', PAST_KEY, overrides);
    expect(datas).not.toContain('2026-04-01');
  });

  it('retorna [] para funcionária sem id', () => {
    expect(getDatasDaSobreavisista(null, PAST_KEY)).toEqual([]);
    expect(getDatasDaSobreavisista('', PAST_KEY)).toEqual([]);
  });

  it('retorna lista ordenada', () => {
    const datas = getDatasDaSobreavisista('marta', PAST_KEY);
    const sorted = [...datas].sort();
    expect(datas).toEqual(sorted);
  });
});

describe('getSlotsFuncionariaNaData', () => {
  it('Renata em 04/04 = HRO manhã', () => {
    expect(getSlotsFuncionariaNaData('renata', '2026-04-04')).toEqual([{ hospital: 'hro', turno: 'manha' }]);
  });

  it('Mari em 04/04 = UNIMED manhã', () => {
    expect(getSlotsFuncionariaNaData('mari', '2026-04-04')).toEqual([{ hospital: 'unimed', turno: 'manha' }]);
  });

  it('Luciana em 04/04 = Plantão Pago tarde', () => {
    expect(getSlotsFuncionariaNaData('luciana', '2026-04-04')).toEqual([{ hospital: 'plantao_pago', turno: 'tarde' }]);
  });

  it('Marta em 04/04 = nenhum (não escalada)', () => {
    expect(getSlotsFuncionariaNaData('marta', '2026-04-04')).toEqual([]);
  });

  it('respeita override — funcionária ganha slot por troca', () => {
    // Override: HRO 04/04 transferido para Marta
    const overrides = { '2026-04-04_hro_manha': 'marta' };
    expect(getSlotsFuncionariaNaData('marta', '2026-04-04', overrides)).toEqual([{ hospital: 'hro', turno: 'manha' }]);
  });

  it('respeita override — funcionária perde slot quando trocado', () => {
    const overrides = { '2026-04-04_hro_manha': 'marta' };
    // Renata era a original do HRO, mas com override agora não está mais
    expect(getSlotsFuncionariaNaData('renata', '2026-04-04', overrides)).toEqual([]);
  });

  it('retorna [] em data sem escala', () => {
    expect(getSlotsFuncionariaNaData('renata', '2026-04-06')).toEqual([]); // segunda
  });
});

describe('getDatasDaFuncionariaHospitais', () => {
  it('Renata: lista datas com pelo menos 1 slot dela', () => {
    const datas = getDatasDaFuncionariaHospitais('renata', PAST_KEY);
    expect(datas).toContain('2026-04-04');
    expect(datas).toContain('2026-04-05');
    expect(datas).toContain('2026-04-11');
    expect(datas.length).toBeGreaterThan(2);
  });

  it('Mari: lista todas as datas em que aparece', () => {
    const datas = getDatasDaFuncionariaHospitais('mari', PAST_KEY);
    expect(datas).toContain('2026-04-04');
    expect(datas).toContain('2026-04-05');
    expect(datas).toContain('2026-04-18');
    expect(datas).toContain('2026-04-19');
  });

  it('respeita fromKey', () => {
    const datas = getDatasDaFuncionariaHospitais('renata', '2026-05-01');
    expect(datas.every((k) => k >= '2026-05-01')).toBe(true);
  });

  it('aplica overrides — adiciona data via troca recebida', () => {
    // Marta originalmente NÃO está em 04/04. Com override, recebe HRO 04/04.
    const overrides = { '2026-04-04_hro_manha': 'marta' };
    const datas = getDatasDaFuncionariaHospitais('marta', PAST_KEY, overrides);
    expect(datas).toContain('2026-04-04');
  });

  it('retorna [] para id inválido', () => {
    expect(getDatasDaFuncionariaHospitais(null, PAST_KEY)).toEqual([]);
  });

  it('retorna lista ordenada', () => {
    const datas = getDatasDaFuncionariaHospitais('renata', PAST_KEY);
    expect(datas).toEqual([...datas].sort());
  });
});

describe('getHospitaisEfetivos — overrides refletem na escala consolidada', () => {
  it('sem overrides — retorna escala base', () => {
    const data = new Date('2026-04-04T12:00:00');
    const r = getHospitaisEfetivos(data);
    expect(r.hro).toBe('Renata');
    expect(r.unimed).toBe('Mari');
    expect(r.plantaoPago).toBe('Luciana');
  });

  it('com override — substitui o nome no slot', () => {
    const data = new Date('2026-04-04T12:00:00');
    const overrides = { '2026-04-04_hro_manha': 'marta' };
    const r = getHospitaisEfetivos(data, overrides);
    expect(r.hro).toBe('Marta');
    expect(r.unimed).toBe('Mari'); // não afetado
  });

  it('retorna null em data sem escala', () => {
    const data = new Date('2026-04-06T12:00:00'); // segunda
    expect(getHospitaisEfetivos(data)).toBeNull();
  });
});
