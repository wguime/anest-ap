/**
 * fetch do cliente Supabase (09/11/2026): usuário logado nunca sai como anônimo
 * e um 401 da Data API renova o token e repete uma vez.
 */
import { describe, it, expect, vi } from 'vitest'
import { criarFetchAutenticado, SessaoIndisponivelError } from '@/lib/fetchSupabaseAutenticado'

const ANON = 'chave-anon'
const REST = 'https://x.supabase.co/rest/v1/escala_cirurgica?select=*'
const ok = () => new Response('[]', { status: 200 })
const naoAutorizado = () => new Response('{}', { status: 401 })

function montar({ sessao = true, renovar = async () => 'token-novo', respostas = [ok()] } = {}) {
  const fila = [...respostas]
  const fetchBase = vi.fn(async () => fila.shift())
  const renovarToken = vi.fn(renovar)
  const f = criarFetchAutenticado({ anonKey: ANON, temSessao: () => sessao, renovarToken, fetchBase })
  return { f, fetchBase, renovarToken }
}

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } })

describe('usuário logado nunca sai como anônimo', () => {
  it('leitura com a chave anon e sessão ativa falha ANTES de ir à rede', async () => {
    const { f, fetchBase } = montar()
    await expect(f(REST, auth(ANON))).rejects.toBeInstanceOf(SessaoIndisponivelError)
    expect(fetchBase).not.toHaveBeenCalled()
  })

  it('escrita (PATCH) com a chave anon e sessão ativa também não sai', async () => {
    const { f, fetchBase } = montar()
    await expect(f(REST, { method: 'PATCH', body: '{}', ...auth(ANON) })).rejects.toBeInstanceOf(SessaoIndisponivelError)
    expect(fetchBase).not.toHaveBeenCalled()
  })

  it('sem sessão (página pública, deslogado) a chave anon passa', async () => {
    const { f, fetchBase } = montar({ sessao: false })
    const r = await f(REST, auth(ANON))
    expect(r.status).toBe(200)
    expect(fetchBase).toHaveBeenCalledTimes(1)
  })

  it('token do usuário passa sem mexer no cabeçalho', async () => {
    const { f, fetchBase } = montar()
    await f(REST, auth('token-do-usuario'))
    expect(fetchBase.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer token-do-usuario')
  })
})

describe('401 da Data API renova e repete uma vez', () => {
  it('repete com o token novo e devolve a segunda resposta', async () => {
    const { f, fetchBase, renovarToken } = montar({ respostas: [naoAutorizado(), ok()] })
    const r = await f(REST, { method: 'PATCH', body: '{"a":1}', ...auth('token-vencido') })
    expect(r.status).toBe(200)
    expect(renovarToken).toHaveBeenCalledTimes(1)
    expect(fetchBase).toHaveBeenCalledTimes(2)
    expect(fetchBase.mock.calls[1][1].headers.get('Authorization')).toBe('Bearer token-novo')
    expect(fetchBase.mock.calls[1][1].body).toBe('{"a":1}')
  })

  it('não entra em laço: segundo 401 volta como está', async () => {
    const { f, fetchBase } = montar({ respostas: [naoAutorizado(), naoAutorizado()] })
    const r = await f(REST, auth('token-vencido'))
    expect(r.status).toBe(401)
    expect(fetchBase).toHaveBeenCalledTimes(2)
  })

  it('renovação falhou ou devolveu o mesmo token: não repete', async () => {
    const a = montar({ respostas: [naoAutorizado()], renovar: async () => { throw new Error('rede') } })
    expect((await a.f(REST, auth('t'))).status).toBe(401)
    expect(a.fetchBase).toHaveBeenCalledTimes(1)

    const b = montar({ respostas: [naoAutorizado()], renovar: async () => 't' })
    expect((await b.f(REST, auth('t'))).status).toBe(401)
    expect(b.fetchBase).toHaveBeenCalledTimes(1)
  })

  it('edge function e storage não são repetidos', async () => {
    const { f, fetchBase, renovarToken } = montar({ respostas: [naoAutorizado()] })
    const r = await f('https://x.supabase.co/functions/v1/sign-cert', { method: 'POST', ...auth('t') })
    expect(r.status).toBe(401)
    expect(renovarToken).not.toHaveBeenCalled()
    expect(fetchBase).toHaveBeenCalledTimes(1)
  })

  it('sem sessão, 401 volta como está', async () => {
    const { f, renovarToken } = montar({ sessao: false, respostas: [naoAutorizado()] })
    expect((await f(REST, auth('t'))).status).toBe(401)
    expect(renovarToken).not.toHaveBeenCalled()
  })
})
