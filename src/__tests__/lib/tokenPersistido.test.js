/**
 * tokenPersistidoValido (abertura instantânea, 15/10/2026): as leituras do
 * Supabase usam o ID token que o Firebase já guardou, sem esperar a confirmação
 * de rede — SÓ quando é seguro. Qualquer dúvida = null (espera como sempre).
 */
import { describe, it, expect } from 'vitest'
import { tokenPersistidoValido, chavePersistenciaFirebase, MARGEM_MINIMA_MS, usuarioFirebaseNoAparelho } from '@/lib/tokenPersistido'

const API_KEY = 'AIza-teste'
const AGORA = Date.UTC(2026, 9, 15, 12, 0, 0)

// JWT real: payload em UTF-8 antes do base64url (o nome com acento é de propósito)
const b64url = (obj) => {
  const bytes = new TextEncoder().encode(JSON.stringify(obj))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const jwt = (payload) => `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(payload)}.assinatura`

function storageCom(valor) {
  const mapa = new Map()
  if (valor !== undefined) mapa.set(chavePersistenciaFirebase(API_KEY), typeof valor === 'string' ? valor : JSON.stringify(valor))
  return { getItem: (k) => (mapa.has(k) ? mapa.get(k) : null) }
}

const salvo = (payload, uid = 'u1') => ({ uid, stsTokenManager: { accessToken: jwt(payload), expirationTime: payload.exp * 1000 } })
const PAYLOAD_OK = { user_id: 'u1', sub: 'u1', role: 'authenticated', exp: AGORA / 1000 + 30 * 60, nome: 'Ana Júlia' }

const ler = (storage, uidEsperado = 'u1') => tokenPersistidoValido({ storage, apiKey: API_KEY, uidEsperado, agora: AGORA })

describe('tokenPersistidoValido', () => {
  it('token do mesmo usuário, com o claim e válido por 30 min → serve', () => {
    const s = storageCom(salvo(PAYLOAD_OK))
    expect(ler(s)).toBe(jwt(PAYLOAD_OK))
  })

  it('vence em menos de 2 min → espera o Firebase renovar', () => {
    const quase = { ...PAYLOAD_OK, exp: (AGORA + MARGEM_MINIMA_MS - 1000) / 1000 }
    expect(ler(storageCom(salvo(quase)))).toBeNull()
    const vencido = { ...PAYLOAD_OK, exp: AGORA / 1000 - 60 }
    expect(ler(storageCom(salvo(vencido)))).toBeNull()
  })

  it('sem o claim role=authenticated (usuário do caminho legado) → espera', () => {
    const { role, ...semRole } = PAYLOAD_OK
    expect(role).toBe('authenticated')
    expect(ler(storageCom(salvo(semRole)))).toBeNull()
  })

  it('token de OUTRO usuário que não o da sessão salva → espera', () => {
    expect(ler(storageCom(salvo(PAYLOAD_OK)), 'u2')).toBeNull()
    // registro e token discordando entre si também
    expect(ler(storageCom(salvo(PAYLOAD_OK, 'u9')))).toBeNull()
    expect(ler(storageCom(salvo({ ...PAYLOAD_OK, user_id: 'u9', sub: 'u9' }, 'u1')))).toBeNull()
  })

  it('sem sessão salva, sem chave, formato desconhecido ou storage bloqueado → null', () => {
    expect(tokenPersistidoValido({ storage: storageCom(salvo(PAYLOAD_OK)), apiKey: API_KEY, uidEsperado: null, agora: AGORA })).toBeNull()
    expect(ler(storageCom(undefined))).toBeNull()
    expect(ler(storageCom('não é json'))).toBeNull()
    expect(ler(storageCom({ uid: 'u1', outroFormato: { token: 'x' } }))).toBeNull()
    expect(ler(storageCom({ uid: 'u1', stsTokenManager: { accessToken: 'sem.pontos' } }))).toBeNull()
    const bloqueado = { getItem: () => { throw new Error('SecurityError') } }
    expect(ler(bloqueado)).toBeNull()
  })
})

describe('usuarioFirebaseNoAparelho ("Manter conectado")', () => {
  const ver = (storage, uid = 'u1') => usuarioFirebaseNoAparelho({ storage, apiKey: API_KEY, uid })

  it('login do mesmo uid guardado no aparelho → true', () => {
    expect(ver(storageCom({ uid: 'u1', stsTokenManager: {} }))).toBe(true)
  })

  it('sem registro (sessão só na aba), outro uid, formato estranho ou storage bloqueado → false', () => {
    expect(ver(storageCom(undefined))).toBe(false)
    expect(ver(storageCom({ uid: 'u2' }))).toBe(false)
    expect(ver(storageCom('não é json'))).toBe(false)
    expect(ver({ getItem: () => { throw new Error('SecurityError') } })).toBe(false)
    expect(usuarioFirebaseNoAparelho({ storage: storageCom({ uid: 'u1' }), apiKey: API_KEY, uid: null })).toBe(false)
  })
})
