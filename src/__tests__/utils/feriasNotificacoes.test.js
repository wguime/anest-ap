/**
 * Notificação agregada de férias — diff de violações, destinatários
 * (allowlist do gate: Guilherme 2 contas, Fernanda, Leandro) e payload SÓ
 * COM CONTAGENS (postura do projeto: sem nomes em notificação).
 */
import { describe, it, expect } from 'vitest'
import {
  getDestinatariosFerias,
  diffViolacoesNovas,
  buildFeriasNotificationPayload,
} from '../../utils/feriasNotificacoes'

describe('getDestinatariosFerias — allowlist por e-mail', () => {
  const users = [
    { id: 'u-melo1', active: true, email: 'wguime@yahoo.com.br' },
    { id: 'u-melo2', active: true, email: 'Anestesista.Guilherme@gmail.com' }, // case-insensitive
    { id: 'u-fer', active: true, email: 'guollofernanda@gmail.com' },
    { id: 'u-lea', active: false, email: 'leandrobernardes03@hotmail.com' }, // inativo fica fora
    { id: 'u-adm', active: true, isAdmin: true, email: 'outro@gmail.com' }, // admin NÃO entra
    { id: 'u-coord', active: true, isCoordenador: true, email: 'coord@gmail.com' }, // coordenador NÃO entra
  ]

  it('só quem está no allowlist e ativo (admin/coordenador de fora)', () => {
    expect(getDestinatariosFerias(users).sort()).toEqual(['u-fer', 'u-melo1', 'u-melo2'])
  })

  it('entrada inválida → lista vazia', () => {
    expect(getDestinatariosFerias(null)).toEqual([])
    expect(getDestinatariosFerias([{ id: 'x', email: null }])).toEqual([])
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
    { id: 'a', regra: 'COTA_ESTOURADA', severidade: 'critical', pessoa: 'JOÃO RICARDO MOREIRA', detalhe: 'João Ricardo Moreira: 36 dias...' },
    { id: 'b', regra: 'MAX_POR_DIA', severidade: 'warning', pessoa: null, detalhe: '13/10: 7 pessoas' },
    { id: 'c', regra: 'MAX_POR_DIA', severidade: 'warning', pessoa: null, detalhe: '17/12: 7 pessoas' },
  ]

  it('agrega por regra, sem nomes, com dedup diário no relatedEntityId', () => {
    const p = buildFeriasNotificationPayload({ novas, ano: 2026, hojeISO: '2026-08-03', recipientIds: ['u1', null, 'u2'] })
    expect(p.subject).toBe('Férias 2026: 3 alertas de regra novos')
    expect(p.content).toContain('1× acima da cota anual')
    expect(p.content).toContain('2× mais de 6 no mesmo dia')
    expect(p.content).toContain('(1 crítico)')
    expect(p.content).not.toContain('João') // contagens, nunca nomes
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
