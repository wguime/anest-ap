/**
 * useEscalaDia — snapshot do dia em localStorage (SWR).
 *
 * A API Pega Plantão só tinha cache em MEMÓRIA: toda abertura fria do app
 * segurava os cards Plantões/Férias da Home em skeleton até o round-trip
 * OAuth + API externa (queixa do dono 12/08: "a Home demora a abrir os
 * conteúdos"). O último resultado real do dia hidrata o estado no primeiro
 * render e o fetch atualiza em silêncio.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, cleanup } from '@testing-library/react'

const { getPlantoesHojePorSetor } = vi.hoisted(() => ({
  getPlantoesHojePorSetor: vi.fn(),
}))

vi.mock('@/services/pegaPlantaoApi', () => ({
  getPlantoesHojePorSetor,
  getPlantoesHoje: vi.fn(async () => []),
  getAfastamentosAtivos: vi.fn(async () => []),
  transformPlantoes: (x) => x,
  transformAfastamentos: (x) => x,
  isConfigured: () => true,
  clearCache: vi.fn(),
  isWeekend: () => false,
  isWeekendMode: () => false,
  getPeriodoAtual: () => 'tarde',
  estaNaMadrugada: () => false,
  HORA_CORTE_PLANTAO: 19,
}))

const SNAPSHOT_KEY = 'anest-escala-dia-snapshot-v1'

const chaveHoje = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const escalaCom = (nomeP1) => ({
  manha: [],
  tarde: [{ setor: 'P1', nome: nomeP1, hora: '19:00' }],
  ferias: [],
  isWeekend: false,
})

const montar = async () => {
  const { useEscalaDia } = await import('@/hooks/usePegaPlantao')
  return renderHook(() => useEscalaDia())
}

describe('useEscalaDia — snapshot do dia (Home abre sem skeleton)', () => {
  beforeEach(() => {
    localStorage.clear()
    getPlantoesHojePorSetor.mockReset()
    getPlantoesHojePorSetor.mockResolvedValue(escalaCom('Eduardo Savoldi'))
  })
  afterEach(() => cleanup())

  it('snapshot de HOJE hidrata o primeiro render (sem skeleton) e o fetch atualiza em silêncio', async () => {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({
      chave: chaveHoje(),
      dados: escalaCom('Nome Do Snapshot'),
    }))
    const { result } = await montar()

    // primeiro render, síncrono: conteúdo do snapshot, sem loading
    expect(result.current.loading).toBe(false)
    expect(result.current.plantoes[0].nome).toBe('Nome Do Snapshot')

    // o fetch ainda roda e substitui (SWR)
    await waitFor(() => expect(result.current.plantoes[0].nome).toBe('Eduardo Savoldi'))
    expect(getPlantoesHojePorSetor).toHaveBeenCalledTimes(1)
  })

  it('snapshot de OUTRO dia é ignorado (skeleton normal até o fetch)', async () => {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({
      chave: '2020-01-01',
      dados: escalaCom('Plantonista De Ontem'),
    }))
    const { result } = await montar()
    expect(result.current.plantoes).toHaveLength(0)
    await waitFor(() => expect(result.current.plantoes[0].nome).toBe('Eduardo Savoldi'))
  })

  it('sucesso do fetch grava o snapshot do dia', async () => {
    const { result } = await montar()
    await waitFor(() => expect(result.current.plantoes).toHaveLength(1))
    const salvo = JSON.parse(localStorage.getItem(SNAPSHOT_KEY))
    expect(salvo.chave).toBe(chaveHoje())
    expect(salvo.dados.tarde[0].nome).toBe('Eduardo Savoldi')
  })

  it('erro do fetch com snapshot do dia na tela MANTÉM o dado real (não vira mock)', async () => {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({
      chave: chaveHoje(),
      dados: escalaCom('Nome Do Snapshot'),
    }))
    getPlantoesHojePorSetor.mockRejectedValue(new Error('API fora'))
    const { result } = await montar()

    await waitFor(() => expect(result.current.error).toBe('API fora'))
    expect(result.current.plantoes[0].nome).toBe('Nome Do Snapshot')
    expect(result.current.usandoMock).toBe(false)
  })

  it('erro do fetch SEM snapshot cai no mock (comportamento antigo intacto)', async () => {
    getPlantoesHojePorSetor.mockRejectedValue(new Error('API fora'))
    const { result } = await montar()
    await waitFor(() => expect(result.current.usandoMock).toBe(true))
    expect(result.current.plantoes.length).toBeGreaterThan(0)
  })
})
