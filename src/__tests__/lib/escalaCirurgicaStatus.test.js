/**
 * "Acabou?" é UMA pergunta com DUAS respostas (dono 21/08, ao pedir que as
 * informações da escala parem de ser desencontradas).
 *
 * A frase estava escrita em QUATRO lugares — a canônica em `escala-cirurgica/
 * utils.js`, duas cópias verbatim (`colunaLiberacao.js` e `LiberacoesView.jsx`) e
 * uma variante DIFERENTE nos caminhos de troca. Este arquivo é a tabela-verdade
 * da fonte única, incluindo a divergência que é DELIBERADA e precisa continuar.
 */
import { describe, expect, it } from 'vitest'
import { STATUS_CONCLUIDO, carimboDeStatus, casoConcluido, casoTerminado } from '@/lib/escalaCirurgicaStatus'
import { casoConcluido as casoConcluidoUtils } from '@/pages/escala-cirurgica/utils'

const caso = (statusCirurgia, statusExtra = null) => ({ statusCirurgia, statusExtra })

describe('casoConcluido — "ainda ocupa alguém?"', () => {
  it('terminada e suspensa encerram; agendada e iniciada não', () => {
    expect(casoConcluido(caso('terminada'))).toBe(true)
    expect(casoConcluido(caso('agendada', 'suspensa'))).toBe(true)
    expect(casoConcluido(caso('iniciada', 'suspensa'))).toBe(true)
    expect(casoConcluido(caso('agendada'))).toBe(false)
    expect(casoConcluido(caso('iniciada'))).toBe(false)
  })

  it('aviso que NÃO é suspensa não encerra', () => {
    expect(casoConcluido(caso('iniciada', 'atrasada'))).toBe(false)
    expect(casoConcluido(caso('agendada', 'passa_tarde'))).toBe(false)
  })

  // dado legado/demo grava "suspensa" no eixo principal
  it('aceita o valor legado no campo principal', () => {
    expect(casoConcluido(caso('suspensa'))).toBe(true)
    expect(STATUS_CONCLUIDO).toEqual(['terminada', 'suspensa'])
  })

  it('caso vazio ou sem status conta como agendada', () => {
    expect(casoConcluido({})).toBe(false)
    expect(casoConcluido(null)).toBe(false)
  })
})

describe('casoTerminado — "quem responde pelo registro?"', () => {
  it('SÓ terminada', () => {
    expect(casoTerminado(caso('terminada'))).toBe(true)
    expect(casoTerminado(caso('iniciada'))).toBe(false)
    expect(casoTerminado(caso('agendada'))).toBe(false)
    expect(casoTerminado(null)).toBe(false)
  })
})

// ⚠️ Esta divergência é o motivo de existirem DUAS funções, e não uma. Se algum
// dia alguém "simplificar" para um booleano só, este teste cai — e o efeito real
// seria a cirurgia suspensa deixar de acompanhar quem assume a sala, sem que
// ninguém tenha pedido.
describe('as duas respostas divergem de propósito na SUSPENSA', () => {
  it('suspensa encerra a sala mas não encerra o registro', () => {
    const suspensa = caso('iniciada', 'suspensa')
    expect(casoConcluido(suspensa)).toBe(true) // some da fila, libera a vaga
    expect(casoTerminado(suspensa)).toBe(false) // acompanha a troca de responsável
  })
})

describe('utils re-exporta a mesma função (sem cópia)', () => {
  it('é literalmente a mesma referência', () => {
    expect(casoConcluidoUtils).toBe(casoConcluido)
  })
})


// ════════════════════════════════════════════════════════════════════════════
// PROCEDÊNCIA DO ESTADO (dono 21/08) — "Iniciada às 14:33 por Guilherme Melo".
// A pesquisa sobre quadros cirúrgicos eletrônicos converge: o quadro em que a
// equipe não confia AUMENTA a carga de comunicação, porque as pessoas ligam para
// confirmar. Dizer quando e por quem custa uma linha.
// ════════════════════════════════════════════════════════════════════════════
describe('carimboDeStatus', () => {
  const DIA = '2026-08-21'
  const comCarimbo = (extra = {}) => ({
    statusCirurgia: 'iniciada',
    statusAtualizadoEm: `${DIA}T14:33:07`,
    statusAtualizadoPor: 'u-melo',
    ...extra,
  })

  it('devolve estado, hora e autor', () => {
    expect(carimboDeStatus(comCarimbo(), { dataEscala: DIA }))
      .toEqual({ status: 'iniciada', hora: '14:33', porUid: 'u-melo' })
  })

  // Nada aconteceu ainda: afirmar "Agendada às 14:33" seria dar procedência a
  // um não-evento.
  it('caso AGENDADO não tem o que dizer', () => {
    expect(carimboDeStatus(comCarimbo({ statusCirurgia: 'agendada' }), { dataEscala: DIA })).toBeNull()
  })

  it('sem carimbo, null', () => {
    expect(carimboDeStatus({ statusCirurgia: 'iniciada' })).toBeNull()
    expect(carimboDeStatus(null)).toBeNull()
    expect(carimboDeStatus(comCarimbo({ statusAtualizadoEm: 'xx' }), { dataEscala: DIA })).toBeNull()
  })

  // Mesma regra de `inicioDaUrgencia`: horário sem data engana mais do que informa.
  it('carimbo de OUTRO dia não vira horário solto', () => {
    expect(carimboDeStatus(comCarimbo({ statusAtualizadoEm: '2026-08-20T14:33:07' }), { dataEscala: DIA })).toBeNull()
  })

  it('sem autor no carimbo, devolve porUid null (a UI mostra só a hora)', () => {
    expect(carimboDeStatus(comCarimbo({ statusAtualizadoPor: null }), { dataEscala: DIA }))
      .toMatchObject({ porUid: null })
  })

  it('aceita a linha crua do banco (snake_case)', () => {
    expect(carimboDeStatus(
      { statusCirurgia: 'terminada', status_atualizado_em: `${DIA}T09:05:00`, status_atualizado_por: 'u-x' },
      { dataEscala: DIA },
    )).toEqual({ status: 'terminada', hora: '09:05', porUid: 'u-x' })
  })
})
