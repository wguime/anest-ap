/**
 * Aviso ao Comitê de Ética quando alguém marca férias além da cota
 * (dono 04/08: Leandro, Fernanda e João Ricardo). Diferente do alerta
 * agregado de regras, ESTE leva o nome — o propósito é atribuir a
 * marcação irregular para o Comitê decidir a perda de dias.
 */
import { describe, it, expect } from 'vitest'
import { getComiteEtica, buildExcedenteNotificationPayload } from '../../utils/feriasNotificacoes'

describe('getComiteEtica', () => {
  const users = [
    { id: 'u-lea', active: true, email: 'leandrobernardes03@hotmail.com' },
    { id: 'u-fer', active: true, email: 'GuolloFernanda@gmail.com' }, // case-insensitive
    { id: 'u-joao', active: true, email: 'joaormoreiraster@gmail.com' },
    { id: 'u-melo', active: true, email: 'wguime@yahoo.com.br' },   // tem extrato, não é comitê
    { id: 'u-off', active: false, email: 'leandrobernardes03@hotmail.com' },
    { id: 'u-adm', active: true, isAdmin: true, email: 'outro@x.com' },
  ]

  it('só os três membros ativos do comitê', () => {
    expect(getComiteEtica(users).sort()).toEqual(['u-fer', 'u-joao', 'u-lea'])
  })

  it('entrada inválida → vazio', () => {
    expect(getComiteEtica(null)).toEqual([])
    expect(getComiteEtica([{ id: 'x' }])).toEqual([])
  })
})

describe('buildExcedenteNotificationPayload', () => {
  const base = {
    nomeCompleto: 'Raquel Schneider Feliciani',
    diasExcedidos: 2,
    cota: 30,
    diasMarcados: 32,
    ano: 2026,
    hojeISO: '2026-08-04',
    recipientIds: ['u-lea', null, 'u-fer'],
  }

  it('nomeia quem excedeu e dá os números; prioridade alta', () => {
    const p = buildExcedenteNotificationPayload(base)
    expect(p.subject).toBe('Férias acima da cota: Raquel Schneider Feliciani')
    expect(p.content).toContain('32 dias')
    expect(p.content).toContain('cota de 30')
    expect(p.content).toContain('2 dias além')
    expect(p.priority).toBe('alta')
    expect(p.actionUrl).toBe('extratoFerias')
    expect(p.recipientIds).toEqual(['u-lea', 'u-fer'])
  })

  it('relatedEntityId por pessoa+dia evita repetir o mesmo caso', () => {
    const p = buildExcedenteNotificationPayload(base)
    expect(p.relatedEntityId).toBe('ferias-excedente-2026-raquel-schneider-feliciani-20260804')
    // outra pessoa no mesmo dia → id diferente
    const outro = buildExcedenteNotificationPayload({ ...base, nomeCompleto: 'João Ricardo Moreira' })
    expect(outro.relatedEntityId).toBe('ferias-excedente-2026-joao-ricardo-moreira-20260804')
  })

  it('singular correto com 1 dia', () => {
    const p = buildExcedenteNotificationPayload({ ...base, diasExcedidos: 1, diasMarcados: 31 })
    expect(p.content).toContain('1 dia além')
    expect(p.content).not.toContain('1 dias além')
  })
})
