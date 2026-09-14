/**
 * Escala EFETIVA da residência = tabela estática + overrides de troca/ajuste.
 *
 * Caso real (julho/2026): Augusto pediu duas trocas com Roosewelt — TR240201
 * (21/07 ⇄ 20/07) e TR475677 (19/07 ⇄ 26/07), ambas aceitas em 26/06. O Firestore
 * ficou com 19 e 21 = Roosewelt, 20 e 26 = Augusto. A tela "Consultar Plantões"
 * continuou marcando o Roosewelt no 20 e no 26, porque as bolinhas liam só a
 * tabela. Estes testes travam a conta que a tela passou a usar.
 */
import { describe, it, expect } from 'vitest';
import { PLANTOES_2026, getResidenteEfetivo, getDatasDoResidente } from '../../data/plantao2026';

const OVERRIDES_JULHO = {
  '2026-07-19': 'r1-roosewelt', // TR475677
  '2026-07-26': 'r1-augusto',   // TR475677
  '2026-07-20': 'r1-augusto',   // TR240201
  '2026-07-21': 'r1-roosewelt', // TR240201
  '2026-07-25': 'r1-roosewelt', // TR338863 (Guilherme 25/07 ⇄ 21/11)
  '2026-11-21': 'r1-guilherme', // TR338863
};

const julho = (datas) => datas.filter((d) => d.startsWith('2026-07'));

describe('a tabela impressa (edição vigente) — o que as trocas mudam', () => {
  it('19 e 21/07 são do Augusto; 20 e 26/07 do Roosewelt', () => {
    expect(PLANTOES_2026['2026-07-19']).toBe('r1-augusto');
    expect(PLANTOES_2026['2026-07-21']).toBe('r1-augusto');
    expect(PLANTOES_2026['2026-07-20']).toBe('r1-roosewelt');
    expect(PLANTOES_2026['2026-07-26']).toBe('r1-roosewelt');
  });
});

describe('getResidenteEfetivo — o override vence a tabela', () => {
  it('19/07 é do Roosewelt e 20/07 do Augusto depois das trocas', () => {
    expect(getResidenteEfetivo('2026-07-19', OVERRIDES_JULHO)).toBe('r1-roosewelt');
    expect(getResidenteEfetivo('2026-07-20', OVERRIDES_JULHO)).toBe('r1-augusto');
  });

  it('dia sem override continua na tabela; sem overrides é a tabela pura', () => {
    expect(getResidenteEfetivo('2026-07-11', OVERRIDES_JULHO)).toBe(PLANTOES_2026['2026-07-11']);
    expect(getResidenteEfetivo('2026-07-20')).toBe('r1-roosewelt');
    expect(getResidenteEfetivo('2026-07-20', null)).toBe('r1-roosewelt');
  });

  it('data fora da tabela sem override é null', () => {
    expect(getResidenteEfetivo('2027-06-01', OVERRIDES_JULHO)).toBeNull();
  });
});

describe('getDatasDoResidente — as bolinhas do calendário', () => {
  it('Roosewelt em julho: 11, 13, 19, 21 e 25 — NÃO o 20 nem o 26', () => {
    expect(julho(getDatasDoResidente('r1-roosewelt', OVERRIDES_JULHO))).toEqual([
      '2026-07-11', '2026-07-13', '2026-07-19', '2026-07-21', '2026-07-25',
    ]);
  });

  /**
   * A fixture separa as hipóteses: sem overrides a lista volta a ser a da tabela
   * (20 e 26 marcados). Se este caso falhar, o de cima passou por acaso.
   */
  it('sem overrides é a tabela pura: 11, 13, 20 e 26', () => {
    expect(julho(getDatasDoResidente('r1-roosewelt'))).toEqual([
      '2026-07-11', '2026-07-13', '2026-07-20', '2026-07-26',
    ]);
  });

  it('Augusto ganha o 20 e o 26 e perde o 19, o 21 e o 25', () => {
    const augusto = julho(getDatasDoResidente('r1-augusto', OVERRIDES_JULHO));
    expect(augusto).toEqual(expect.arrayContaining(['2026-07-20', '2026-07-26']));
    expect(augusto).not.toEqual(expect.arrayContaining(['2026-07-19']));
    expect(augusto).not.toContain('2026-07-21');
    expect(augusto).not.toContain('2026-07-25');
  });

  it('override em data fora da tabela também entra, e a lista sai ordenada', () => {
    expect(PLANTOES_2026['2027-06-15']).toBeUndefined();
    const datas = getDatasDoResidente('r1-roosewelt', { ...OVERRIDES_JULHO, '2027-06-15': 'r1-roosewelt' });
    expect(datas[datas.length - 1]).toBe('2027-06-15');
    expect([...datas].sort()).toEqual(datas);
  });

  it('aPartirDe corta o passado; residente vazio devolve []', () => {
    expect(julho(getDatasDoResidente('r1-roosewelt', OVERRIDES_JULHO, { aPartirDe: '2026-07-20' })))
      .toEqual(['2026-07-21', '2026-07-25']);
    expect(getDatasDoResidente(null, OVERRIDES_JULHO)).toEqual([]);
  });
});
