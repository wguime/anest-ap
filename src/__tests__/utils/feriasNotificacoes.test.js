/**
 * Notificação agregada de férias — diff de violações, destinatários e
 * payload SÓ COM CONTAGENS (postura do projeto: sem nomes em notificação).
 */
import { describe, it, expect } from 'vitest'
import {
  getCoordenadoresFerias,
  diffViolacoesNovas,
  buildFeriasNotificationPayload,
} from '../../utils/feriasNotificacoes'

describe('getCoordenadoresFerias', () => {
  const users = [
    { id: 'u1', active: true, isCoordenador: true },
    { id: 'u2', active: true, role: 'coordenador' },
    { id: 'u3', active: false, isCoordenador: true }, // inativo fica fora
    { id: 'u4', active: true, isAdmin: true },
    { id: 'u5', active: true, role: 'anestesiologista' },
  ]

  it('prefere coordenadores ativos (admin fica de fora quando há coordenador)', () => {
    expect(getCoordenadoresFerias(users).sort()).toEqual(['u1', 'u2'])
  })

  it('fallback para admins quando não há coordenador ativo', () => {
    const semCoordenador = users.filter((u) => u.id === 'u4' || u.id === 'u5')
    expect(getCoordenadoresFerias(semCoordenador)).toEqual(['u4'])
  })

  it('entrada inválida → lista vazia', () => {
    expect(getCoordenadoresFerias(null)).toEqual([])
  })
})

describe('diffViolacoesNovas', () => {
  const violacoes = [
    { id: 'cota:fulano:2026', regra: 'COTA_ESTOURADA' },
    { id: 'max-dia:2026-10-13', regra: 'MAX_POR_DIA' },
  ]

  it('filtra as já vistas (linhas do banco ou Set)', () => {
    expect(diffViolacoesNovas(violacoes, [{ violacao_id: 'cota:fulano:2026' }])).toEqual([violacoes[1]])
    expect(diffViolacoesNovas(violacoes, new Set(['max-dia:2026-10-13']))).toEqual([violacoes[0]])
  })

  it('conjuntos vazio / igual / superset', () => {
    expect(diffViolacoesNovas(violacoes, [])).toEqual(violacoes)
    expect(diffViolacoesNovas(violacoes, violacoes.map((v) => ({ violacao_id: v.id })))).toEqual([])
    expect(diffViolacoesNovas([], [{ violacao_id: 'x' }])).toEqual([])
  })
})

describe('buildFeriasNotificationPayload', () => {
  const novas = [
    { id: 'a', regra: 'COTA_ESTOURADA', severidade: 'critical', pessoa: 'JOÃO RICARDO MOREIRA', detalhe: 'JOÃO RICARDO MOREIRA: 36 dias...' },
    { id: 'b', regra: 'MAX_POR_DIA', severidade: 'warning', pessoa: null, detalhe: '13/10: 7 pessoas' },
    { id: 'c', regra: 'MAX_POR_DIA', severidade: 'warning', pessoa: null, detalhe: '17/12: 7 pessoas' },
  ]

  it('agrega por regra, sem nomes, com dedup diário no relatedEntityId', () => {
    const p = buildFeriasNotificationPayload({ novas, ano: 2026, hojeISO: '2026-08-03', recipientIds: ['u1', null, 'u2'] })
    expect(p.subject).toBe('Férias 2026: 3 alertas de regra novos')
    expect(p.content).toContain('1× cota de dias estourada')
    expect(p.content).toContain('2× mais de 6 pessoas no mesmo dia')
    expect(p.content).toContain('(1 crítico)')
    expect(p.content).not.toContain('JOÃO') // contagens, nunca nomes
    expect(p.relatedEntityId).toBe('ferias-regras-2026-20260803')
    expect(p.recipientIds).toEqual(['u1', 'u2'])
    expect(p.priority).toBe('alta')
    expect(p.actionUrl).toBe('extratoFerias')
  })

  it('sem críticas → prioridade normal e singular correto', () => {
    const p = buildFeriasNotificationPayload({ novas: [novas[1]], ano: 2026, hojeISO: '2026-08-04', recipientIds: ['u1'] })
    expect(p.subject).toBe('Férias 2026: 1 alerta de regra novo')
    expect(p.priority).toBe('normal')
    expect(p.content).not.toContain('crítico')
  })
})
