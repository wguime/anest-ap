/**
 * O formulário de troca da residência julga "de quem é o plantão" pela escala
 * EFETIVA (tabela + trocas aceitas), não pela tabela impressa.
 *
 * Caso real (agosto/2026): TR974269 — Rodrigo (18/08) ⇄ Guilherme (19/08), aceita
 * em 15/07. Depois, em 18/08, Guilherme ofereceu o 18/08 de volta ao Rodrigo
 * (TR984249). Pela tabela, o 18/08 é do Rodrigo, então a validação por tabela
 * recusaria o pedido do Guilherme — e aceitaria um pedido do Rodrigo por um dia
 * que ele já tinha cedido.
 */
import { describe, it, expect } from 'vitest';
import { PLANTOES_2026 } from '../../data/plantao2026';
import { validarPedidoTrocaResidencia } from '../../lib/trocaResidenciaValidacao';

const OVERRIDES = {
  '2026-08-18': 'r1-guilherme', // TR974269
  '2026-08-19': 'r2-rodrigo',   // TR974269
};

const pedido = (extra = {}) => ({
  dataPlantaoKey: '2026-08-18',
  dataDesejadaKey: null,
  descricao: 'Pessoal',
  destinatarioId: null,
  userResidenteId: 'r1-guilherme',
  overrides: OVERRIDES,
  ...extra,
});

describe('quem pode oferecer o quê', () => {
  it('a tabela diz Rodrigo no 18/08 (edição vigente)', () => {
    expect(PLANTOES_2026['2026-08-18']).toBe('r2-rodrigo');
  });

  it('Guilherme, que recebeu o 18/08 na troca, pode oferecê-lo', () => {
    expect(validarPedidoTrocaResidencia(pedido())).toEqual({});
  });

  it('Rodrigo, que cedeu o 18/08, não pode oferecê-lo de novo', () => {
    const erros = validarPedidoTrocaResidencia(pedido({ userResidenteId: 'r2-rodrigo' }));
    expect(erros.dataPlantao).toMatch(/não é seu plantão/);
  });

  it('sem overrides a tabela manda — o mesmo pedido do Rodrigo passa', () => {
    expect(validarPedidoTrocaResidencia(pedido({ userResidenteId: 'r2-rodrigo', overrides: {} }))).toEqual({});
  });

  it('sem residente identificado a posse não é julgada (chat inline)', () => {
    expect(validarPedidoTrocaResidencia(pedido({ userResidenteId: null }))).toEqual({});
  });

  it('data sem plantão cadastrado é recusada', () => {
    expect(validarPedidoTrocaResidencia(pedido({ dataPlantaoKey: '2027-06-01' })).dataPlantao)
      .toMatch(/Sem plantão cadastrado/);
    expect(validarPedidoTrocaResidencia(pedido({ dataPlantaoKey: null })).dataPlantao)
      .toMatch(/Informe a data/);
  });
});

describe('swap — o destinatário é quem está no dia desejado DEPOIS das trocas', () => {
  it('19/08 é do Rodrigo pela troca, embora a tabela diga Guilherme', () => {
    expect(PLANTOES_2026['2026-08-19']).toBe('r1-guilherme');
    const ok = validarPedidoTrocaResidencia(pedido({ dataDesejadaKey: '2026-08-19', destinatarioId: 'r2-rodrigo' }));
    expect(ok).toEqual({});
    const errado = validarPedidoTrocaResidencia(pedido({ dataDesejadaKey: '2026-08-19', destinatarioId: 'r2-daniel' }));
    expect(errado.destinatarioId).toMatch(/não está de plantão na data desejada/);
  });

  it('swap exige destinatário e datas diferentes', () => {
    expect(validarPedidoTrocaResidencia(pedido({ dataDesejadaKey: '2026-08-19' })).destinatarioId)
      .toMatch(/Selecione o residente/);
    expect(validarPedidoTrocaResidencia(pedido({ dataDesejadaKey: '2026-08-18', destinatarioId: 'r2-rodrigo' })).dataDesejada)
      .toMatch(/diferentes/);
  });

  it('motivo é obrigatório', () => {
    expect(validarPedidoTrocaResidencia(pedido({ descricao: '  ' })).descricao).toMatch(/motivo/);
  });
});
