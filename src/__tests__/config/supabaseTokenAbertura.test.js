/**
 * config/supabase.js na abertura (15/10/2026):
 *  - antes de o Firebase anunciar o usuário, getSupabaseToken usa o ID token que
 *    o SDK já guardou (mesmo uid da sessão salva, claim role, ≥2 min) — as
 *    leituras saem na abertura; sem isso, espera como sempre;
 *  - o realtime acompanha o login: o supabase-js entrega o 1º token com
 *    setAuth(token), que o realtime-js trata como "manual" e nunca renova; a cada
 *    mudança do ID token (login, logout, renovação) chamamos setAuth() SEM
 *    argumento, que volta ao modo callback.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.unmock('@/config/supabase')

// o mock do @/config/firebase guarda ESTE objeto: os casos mudam as propriedades,
// nunca a referência
const { estado } = vi.hoisted(() => ({
  estado: {
    authState: [], idToken: [], realtime: null,
    auth: { app: { name: '[DEFAULT]', options: { apiKey: 'chave-teste' } }, currentUser: null },
  },
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => { estado.authState.push(cb); return () => {} },
  onIdTokenChanged: (_auth, cb) => { estado.idToken.push(cb); return () => {} },
}))

vi.mock('@/config/firebase', () => ({ auth: estado.auth }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ realtime: estado.realtime }),
}))

const API_KEY = 'chave-teste'
const b64url = (obj) => {
  const bytes = new TextEncoder().encode(JSON.stringify(obj))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const jwt = (payload) => `${b64url({ alg: 'RS256' })}.${b64url(payload)}.sig`

const TOKEN_GUARDADO = jwt({ user_id: 'u1', sub: 'u1', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 1800 })
const TOKEN_CONFIRMADO = jwt({ user_id: 'u1', sub: 'u1', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, novo: true })

async function carregar({ sessaoSalva = true, loginGuardado = true } = {}) {
  vi.resetModules()
  estado.authState = []
  estado.idToken = []
  estado.realtime = { setAuth: vi.fn(() => Promise.resolve()) }
  estado.auth.currentUser = null
  localStorage.clear()
  if (sessaoSalva) {
    const { gravarSessao } = await import('@/lib/sessaoSalva')
    gravarSessao('u1', { uid: 'u1', id: 'u1', role: 'anestesiologista' })
  }
  if (loginGuardado) {
    localStorage.setItem(`firebase:authUser:${API_KEY}:[DEFAULT]`, JSON.stringify({
      uid: 'u1', stsTokenManager: { accessToken: TOKEN_GUARDADO },
    }))
  }
  return import('@/config/supabase')
}

/** O Firebase termina de restaurar a sessão. */
function firebaseConfirma(uid) {
  estado.auth.currentUser = uid ? { uid, getIdToken: vi.fn(async () => TOKEN_CONFIRMADO) } : null
  estado.authState.forEach((cb) => cb(estado.auth.currentUser))
}

beforeEach(() => localStorage.clear())

describe('getSupabaseToken na abertura', () => {
  it('antes da confirmação, usa o token já guardado pelo Firebase (sem esperar a rede)', async () => {
    const { getSupabaseToken } = await carregar()
    await expect(getSupabaseToken()).resolves.toBe(TOKEN_GUARDADO)
  })

  it('sem sessão salva do mesmo usuário, espera a confirmação como sempre', async () => {
    const { getSupabaseToken } = await carregar({ sessaoSalva: false })
    let pronto = false
    const p = getSupabaseToken().then((t) => { pronto = true; return t })
    await Promise.resolve()
    expect(pronto).toBe(false)
    firebaseConfirma('u1')
    await expect(p).resolves.toBe(TOKEN_CONFIRMADO)
  })

  it('depois da confirmação, o token vem do Firebase (o guardado não é mais lido)', async () => {
    const { getSupabaseToken } = await carregar()
    firebaseConfirma('u1')
    await expect(getSupabaseToken()).resolves.toBe(TOKEN_CONFIRMADO)
  })

  it('Firebase sem usuário: devolve null', async () => {
    const { getSupabaseToken } = await carregar({ sessaoSalva: false, loginGuardado: false })
    firebaseConfirma(null)
    await expect(getSupabaseToken()).resolves.toBeNull()
  })
})

describe('realtime acompanha o login do Firebase', () => {
  it('cada mudança do ID token chama realtime.setAuth() SEM argumento (modo callback)', async () => {
    await carregar()
    expect(estado.idToken).toHaveLength(1)

    estado.idToken[0]({ uid: 'u1' }) // confirmação / renovação
    estado.idToken[0](null) // logout ou sessão recusada

    expect(estado.realtime.setAuth).toHaveBeenCalledTimes(2)
    for (const chamada of estado.realtime.setAuth.mock.calls) expect(chamada).toEqual([])
  })
})
