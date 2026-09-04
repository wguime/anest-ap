/**
 * Atualização do PWA (Onda 2; audit A7-ii).
 *
 * O que estas travas protegem: com TRABALHO EM ANDAMENTO (a conferência da escala aberta)
 * o app NÃO recarrega — nem ao voltar do 2º plano com deploy novo, nem pelo claim do SW,
 * nem pelo backstop; e o reload que ficou devendo acontece assim que o trabalho libera.
 * Sem trabalho, o comportamento de 13/08 continua o mesmo (um reload, sem aviso).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { instalarAtualizacaoPwa, BACKSTOP_MS, RETORNO_MINIMO_MS, CHAVE_RELOAD } from '@/lib/pwaAtualizacao'
import { segurarAtualizacao, liberarAtualizacao, atualizacaoSegura, _reiniciarAtualizacaoAdiada } from '@/lib/atualizacaoAdiada'

function ambiente({ buildPublicado = 'v2', controller = true } = {}) {
  const docListeners = {}
  const swListeners = {}
  const storage = new Map()
  const deps = {
    buildId: 'v1',
    fetchFn: vi.fn(async () => ({ ok: true, json: async () => ({ buildId: buildPublicado }) })),
    doc: { hidden: false, addEventListener: (t, fn) => { docListeners[t] = fn }, removeEventListener: vi.fn() },
    win: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
    sw: { controller: controller ? {} : null, addEventListener: (t, fn) => { swListeners[t] = fn } },
    storage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
    reload: vi.fn(),
  }
  const registration = { update: vi.fn(async () => {}) }
  const api = instalarAtualizacaoPwa(registration, deps)
  return {
    deps, registration, api, storage,
    voltarDoSegundoPlano: () => docListeners.visibilitychange?.(),
    claim: () => swListeners.controllerchange?.(),
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-04T13:00:00-03:00'))
  _reiniciarAtualizacaoAdiada()
})
afterEach(() => vi.useRealTimers())

describe('sem trabalho em andamento — o comportamento de 13/08', () => {
  it('voltar do 2º plano com deploy novo: busca o SW e recarrega quando ele assume', async () => {
    const amb = ambiente()
    await vi.advanceTimersByTimeAsync(RETORNO_MINIMO_MS + 1000)
    amb.voltarDoSegundoPlano()
    await vi.advanceTimersByTimeAsync(10)
    expect(amb.deps.fetchFn).toHaveBeenCalled()
    expect(amb.registration.update).toHaveBeenCalled()
    amb.claim()
    expect(amb.deps.reload).toHaveBeenCalledTimes(1)
    expect(amb.storage.get(CHAVE_RELOAD)).toBeTruthy()
  })

  it('sem claim em 12 s, o backstop recarrega às cegas (uma vez, com cooldown)', async () => {
    const amb = ambiente()
    await vi.advanceTimersByTimeAsync(RETORNO_MINIMO_MS + 1000)
    amb.voltarDoSegundoPlano()
    await vi.advanceTimersByTimeAsync(BACKSTOP_MS + 10)
    expect(amb.deps.reload).toHaveBeenCalledTimes(1)
  })

  it('versão igual não recarrega; 1º acesso da vida (sem controller) ignora o claim inicial', async () => {
    const igual = ambiente({ buildPublicado: 'v1' })
    await vi.advanceTimersByTimeAsync(RETORNO_MINIMO_MS + 1000)
    igual.voltarDoSegundoPlano()
    await vi.advanceTimersByTimeAsync(BACKSTOP_MS + 10)
    expect(igual.deps.reload).not.toHaveBeenCalled()

    const primeiro = ambiente({ controller: false })
    primeiro.claim()
    expect(primeiro.deps.reload).not.toHaveBeenCalled()
  })
})

describe('com trabalho em andamento — a conferência aberta segura a atualização', () => {
  it('voltar do 2º plano com deploy novo NÃO recarrega, nem busca o SW; libera e recarrega', async () => {
    const amb = ambiente()
    await vi.advanceTimersByTimeAsync(RETORNO_MINIMO_MS + 1000)
    amb.registration.update.mockClear()
    segurarAtualizacao('escala-lote')
    expect(atualizacaoSegura()).toBe(true)

    amb.voltarDoSegundoPlano()
    await vi.advanceTimersByTimeAsync(BACKSTOP_MS + 10)
    expect(amb.deps.reload).not.toHaveBeenCalled()
    // não puxa o gatilho do SW: instalar o SW novo faria o claim, e o claim é o reload
    expect(amb.registration.update).not.toHaveBeenCalled()

    // a conferência fechou: a verificação que ficou devendo roda agora, e recarrega
    liberarAtualizacao('escala-lote')
    await vi.advanceTimersByTimeAsync(10)
    expect(amb.deps.fetchFn).toHaveBeenCalled()
    amb.claim()
    expect(amb.deps.reload).toHaveBeenCalledTimes(1)
  })

  it('o SW assumiu no meio da conferência: o reload fica devendo e acontece ao liberar', async () => {
    const amb = ambiente()
    segurarAtualizacao('escala-lote')
    amb.claim()
    expect(amb.deps.reload).not.toHaveBeenCalled()
    liberarAtualizacao('escala-lote')
    expect(amb.deps.reload).not.toHaveBeenCalled()   // fora da pilha de quem liberou
    await vi.advanceTimersByTimeAsync(1)
    expect(amb.deps.reload).toHaveBeenCalledTimes(1)
  })

  it('a conferência abriu ENQUANTO a versão era consultada: também não recarrega', async () => {
    const amb = ambiente()
    let resolver
    amb.deps.fetchFn.mockImplementationOnce(() => new Promise((r) => { resolver = r }))
    await vi.advanceTimersByTimeAsync(RETORNO_MINIMO_MS + 1000)
    amb.voltarDoSegundoPlano()
    segurarAtualizacao('escala-lote')
    resolver({ ok: true, json: async () => ({ buildId: 'v2' }) })
    await vi.advanceTimersByTimeAsync(BACKSTOP_MS + 10)
    expect(amb.deps.reload).not.toHaveBeenCalled()
  })

  it('dois motivos: só o último a liberar destrava', () => {
    const cb = vi.fn()
    segurarAtualizacao('a'); segurarAtualizacao('b')
    liberarAtualizacao('a')
    expect(atualizacaoSegura()).toBe(true)
    liberarAtualizacao('b')
    expect(atualizacaoSegura()).toBe(false)
    expect(cb).not.toHaveBeenCalled()
  })
})
