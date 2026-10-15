/**
 * Sessão salva (abertura instantânea, 15/10/2026): o perfil do último login
 * confirmado vai para o localStorage para o app abrir na Home sem esperar o
 * Firebase ir à rede. O que importa travar:
 *  - o que vai ao disco volta IGUAL para quem desenha a tela (datas do
 *    Firestore com a mesma API de leitura);
 *  - token de push nunca vai ao disco;
 *  - conteúdo estranho/storage bloqueado nunca vira sessão (cai no login normal).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { CHAVE_SESSAO, lerSessaoSalva, gravarSessao, limparSessao, TimestampSalvo } from '@/lib/sessaoSalva'

/** Imita o Timestamp do Firestore (toDate + seconds/nanoseconds). */
const timestampFirestore = (seconds, nanoseconds = 0) => ({
  seconds,
  nanoseconds,
  toDate: () => new Date(seconds * 1000 + nanoseconds / 1e6),
})

const PERFIL = {
  id: 'u1',
  uid: 'u1',
  email: 'ana@anest.com.br',
  firstName: 'Ana',
  role: 'anestesiologista',
  isAdmin: false,
  permissions: { 'doc-protocolos': true, 'escala-cirurgica': true },
  customPermissions: true,
  incidentSettings: { isResponsible: true, receberIncidentes: true, receberDenuncias: false },
  createdAt: timestampFirestore(1760000000, 500000000),
  lgpdConsentAt: '2026-08-01T10:00:00.000Z',
  fcmToken: 'token-do-aparelho',
  fcmTokenUpdatedAt: timestampFirestore(1760500000),
}

describe('sessaoSalva', () => {
  beforeEach(() => localStorage.clear())

  it('devolve o perfil gravado, com papel, permissões e settings de incidente', () => {
    gravarSessao('u1', PERFIL)
    const s = lerSessaoSalva()
    expect(s.uid).toBe('u1')
    expect(s.perfil.role).toBe('anestesiologista')
    expect(s.perfil.permissions).toEqual(PERFIL.permissions)
    expect(s.perfil.incidentSettings).toEqual(PERFIL.incidentSettings)
    expect(s.perfil.lgpdConsentAt).toBe(PERFIL.lgpdConsentAt)
    expect(typeof s.salvaEm).toBe('number')
  })

  it('data do Firestore volta com a mesma API (toDate/toMillis/seconds)', () => {
    gravarSessao('u1', PERFIL)
    const { createdAt } = lerSessaoSalva().perfil
    expect(createdAt).toBeInstanceOf(TimestampSalvo)
    expect(createdAt.seconds).toBe(1760000000)
    expect(createdAt.nanoseconds).toBe(500000000)
    expect(createdAt.toDate().getTime()).toBe(PERFIL.createdAt.toDate().getTime())
    expect(createdAt.toMillis()).toBe(1760000000500)
  })

  it('Date volta como Date', () => {
    gravarSessao('u1', { ...PERFIL, updatedAt: new Date('2026-10-14T12:00:00Z') })
    const { updatedAt } = lerSessaoSalva().perfil
    expect(updatedAt).toBeInstanceOf(Date)
    expect(updatedAt.toISOString()).toBe('2026-10-14T12:00:00.000Z')
  })

  it('token de push nunca vai ao disco', () => {
    gravarSessao('u1', PERFIL)
    const bruto = localStorage.getItem(CHAVE_SESSAO)
    expect(bruto).not.toContain('token-do-aparelho')
    const { perfil } = lerSessaoSalva()
    expect(perfil).not.toHaveProperty('fcmToken')
    expect(perfil).not.toHaveProperty('fcmTokenUpdatedAt')
  })

  it('regravar uma sessão já restaurada não perde as datas', () => {
    gravarSessao('u1', PERFIL)
    const restaurada = lerSessaoSalva()
    gravarSessao('u1', restaurada.perfil)
    expect(lerSessaoSalva().perfil.createdAt.toMillis()).toBe(1760000000500)
  })

  it('limpar apaga a sessão', () => {
    gravarSessao('u1', PERFIL)
    limparSessao()
    expect(localStorage.getItem(CHAVE_SESSAO)).toBeNull()
    expect(lerSessaoSalva()).toBeNull()
  })

  it('conteúdo que não confere não vira sessão', () => {
    const casos = [
      'não é json',
      JSON.stringify(null),
      JSON.stringify({ uid: '', perfil: PERFIL }),
      JSON.stringify({ uid: 'u1' }),
      JSON.stringify({ uid: 'u1', perfil: [] }),
      // perfil de outra pessoa sob o uid salvo
      JSON.stringify({ uid: 'u1', perfil: { ...PERFIL, id: 'u2', uid: 'u2' } }),
    ]
    for (const bruto of casos) {
      localStorage.setItem(CHAVE_SESSAO, bruto)
      expect(lerSessaoSalva()).toBeNull()
    }
  })

  it('storage bloqueado (aba privada) não quebra nada', () => {
    const bloqueado = {
      getItem: () => { throw new Error('SecurityError') },
      setItem: () => { throw new Error('QuotaExceededError') },
      removeItem: () => { throw new Error('SecurityError') },
    }
    expect(lerSessaoSalva(bloqueado)).toBeNull()
    expect(() => gravarSessao('u1', PERFIL, bloqueado)).not.toThrow()
    expect(() => limparSessao(bloqueado)).not.toThrow()
  })

  it('sem uid ou perfil não grava', () => {
    gravarSessao('', PERFIL)
    gravarSessao('u1', null)
    expect(localStorage.getItem(CHAVE_SESSAO)).toBeNull()
  })
})
