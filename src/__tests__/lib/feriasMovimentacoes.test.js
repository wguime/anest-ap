/**
 * Replay das movimentações sobre os registros do Pega Plantão — os
 * casos-limite levantados no plano (a: transcrição, b: código novo/removido,
 * c: no-op, d: corrida, e: virada de ano).
 */
import { describe, it, expect } from 'vitest'
import {
  aplicarMovimentacoes, indexarPorPessoaDia, vistasDasMovimentacoes,
  filtrarNoOps, chaveDia,
} from '../../lib/feriasMovimentacoes'

const NOME = 'G. MELO'
const pp = (codigo, data, nome = NOME) => ({ codigo, nome, data, ehFimDeSemana: false })
const mov = (id, data, acao, extra = {}) => ({
  id, nome: NOME, data, acao,
  origemDia: acao === 'marcar' ? 'app' : extra.codigoPp ? 'pegaplantao' : 'app',
  codigoPp: extra.codigoPp || null,
  criadoEm: extra.criadoEm || `2026-08-04T10:0${id.slice(-1)}:00Z`,
})

describe('aplicarMovimentacoes — identidade e marcação simples', () => {
  it('sem movimentações devolve os registros do PP intactos (+origem)', () => {
    const regs = [pp('c1', '2026-09-10'), pp('c2', '2026-09-11')]
    const out = aplicarMovimentacoes(regs, [])
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ codigo: 'c1', data: '2026-09-10', origem: 'pp' })
  })

  it('marcação do app vira registro sintético contável', () => {
    const out = aplicarMovimentacoes([], [mov('m1', '2026-09-10', 'marcar')])
    expect(out).toEqual([
      { codigo: 'app:m1', nome: NOME, data: '2026-09-10', ehFimDeSemana: false, origem: 'app' },
    ])
  })
})

describe('caso (a) — marquei no app e depois transcrevi no PP', () => {
  it('dedup por (nome,data): conta 1, PP canônico', () => {
    const out = aplicarMovimentacoes([pp('cPP', '2026-09-10')], [mov('m1', '2026-09-10', 'marcar')])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ codigo: 'cPP', origem: 'pp' })
  })
})

describe('caso (b) — desmarcação de dia do PP', () => {
  it('anula SÓ o código desmarcado', () => {
    const regs = [pp('cA', '2026-09-10'), pp('cB', '2026-09-11')]
    const out = aplicarMovimentacoes(regs, [mov('m1', '2026-09-10', 'desmarcar', { codigoPp: 'cA' })])
    expect(out.map((r) => r.codigo)).toEqual(['cB'])
  })

  it('código NOVO no mesmo dia depois da desmarcação reativa o dia', () => {
    const out = aplicarMovimentacoes(
      [pp('cNovo', '2026-09-10')],
      [mov('m1', '2026-09-10', 'desmarcar', { codigoPp: 'cAntigo' })]
    )
    expect(out.map((r) => r.codigo)).toEqual(['cNovo'])
  })

  it('desmarcação já transcrita no PP (código sumiu) é no-op inofensivo', () => {
    const out = aplicarMovimentacoes([], [mov('m1', '2026-09-10', 'desmarcar', { codigoPp: 'cAntigo' })])
    expect(out).toEqual([])
  })

  it('desmarcar marcação do app e re-marcar reativa (last-wins)', () => {
    const movs = [
      mov('m1', '2026-09-10', 'marcar', { criadoEm: '2026-08-04T10:00:00Z' }),
      mov('m2', '2026-09-10', 'desmarcar', { criadoEm: '2026-08-04T11:00:00Z' }),
      mov('m3', '2026-09-10', 'marcar', { criadoEm: '2026-08-04T12:00:00Z' }),
    ]
    const out = aplicarMovimentacoes([], movs)
    expect(out).toHaveLength(1)
    expect(out[0].codigo).toBe('app:m3')

    // ordem embaralhada na entrada não muda o resultado
    expect(aplicarMovimentacoes([], [movs[2], movs[0], movs[1]])[0].codigo).toBe('app:m3')
  })
})

describe('caso (d) — corrida entre devices', () => {
  it('dois "marcar" do mesmo dia colapsam num único dia', () => {
    const out = aplicarMovimentacoes([], [
      mov('m1', '2026-09-10', 'marcar', { criadoEm: '2026-08-04T10:00:00Z' }),
      mov('m2', '2026-09-10', 'marcar', { criadoEm: '2026-08-04T10:00:30Z' }),
    ])
    expect(out).toHaveLength(1)
  })

  it('empate de criadoEm usa o id como tie-break determinístico', () => {
    const mesmo = '2026-08-04T10:00:00Z'
    const a = { ...mov('m1', '2026-09-10', 'marcar', { criadoEm: mesmo }) }
    const b = { ...mov('m2', '2026-09-10', 'desmarcar', { criadoEm: mesmo }) }
    expect(aplicarMovimentacoes([], [a, b])).toEqual([])
    expect(aplicarMovimentacoes([], [b, a])).toEqual([]) // m2 (desmarcar) vence sempre
  })
})

describe('caso (e) — dias de outra pessoa e FDS', () => {
  it('movimentação de um sócio não afeta o outro', () => {
    const regs = [pp('c1', '2026-09-10'), { ...pp('c2', '2026-09-10'), nome: 'FERNANDA GUOLLO' }]
    const out = aplicarMovimentacoes(regs, [mov('m1', '2026-09-10', 'desmarcar', { codigoPp: 'c1' })])
    expect(out).toHaveLength(1)
    expect(out[0].nome).toBe('FERNANDA GUOLLO')
  })

  it('marca ehFimDeSemana corretamente no sintético', () => {
    const out = aplicarMovimentacoes([], [mov('m1', '2026-09-12', 'marcar')]) // sábado
    expect(out[0].ehFimDeSemana).toBe(true)
  })
})

describe('indexarPorPessoaDia + vistasDasMovimentacoes + filtrarNoOps', () => {
  it('indexa dias ativos com código e origem', () => {
    const efetivos = aplicarMovimentacoes([pp('cPP', '2026-09-10')], [mov('m1', '2026-09-11', 'marcar')])
    const idx = indexarPorPessoaDia(efetivos)
    expect(idx.get(chaveDia(NOME, '2026-09-10'))).toEqual({ codigo: 'cPP', origem: 'pp' })
    expect(idx.get(chaveDia(NOME, '2026-09-11'))).toEqual({ codigo: 'app:m1', origem: 'app' })
  })

  it('vistas só das marcações, com o timestamp real', () => {
    const vistas = vistasDasMovimentacoes([
      mov('m1', '2026-09-10', 'marcar', { criadoEm: '2026-08-04T10:00:00Z' }),
      mov('m2', '2026-09-11', 'desmarcar'),
    ])
    expect([...vistas.keys()]).toEqual(['app:m1'])
    expect(vistas.get('app:m1').firstSeenAt).toBe('2026-08-04T10:00:00Z')
  })

  it('caso (c) — preflight descarta marcar dia já ativo e desmarcar dia ausente', () => {
    const registrosPP = [pp('cPP', '2026-09-10')]
    const frescas = [mov('m9', '2026-09-15', 'marcar')]
    const propostas = [
      { nome: NOME, data: '2026-09-10', acao: 'marcar' },   // já ativo no PP → no-op
      { nome: NOME, data: '2026-09-15', acao: 'marcar' },   // outro device já marcou → no-op
      { nome: NOME, data: '2026-09-20', acao: 'desmarcar' }, // não está marcado → no-op
      { nome: NOME, data: '2026-09-16', acao: 'marcar' },   // válido
    ]
    expect(filtrarNoOps(propostas, frescas, registrosPP)).toEqual([
      { nome: NOME, data: '2026-09-16', acao: 'marcar' },
    ])
  })
})
