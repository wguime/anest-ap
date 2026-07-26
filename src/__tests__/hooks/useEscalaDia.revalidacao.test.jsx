/**
 * useEscalaDia — revalidação do plantão (pedido do dono 2026-07-25).
 *
 * Este hook alimenta o card "Plantões" da Home E os badges P1–P4 da escala
 * cirúrgica (mesma fonte). Buscava UMA vez no mount, então trocar um nome no
 * plantão durante o dia não aparecia: quem estava com o app aberto ficava com
 * o nome de quando a tela abriu, e a virada da meia-noite nem era percebida.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor, cleanup } from '@testing-library/react'

const { getPlantoesHojePorSetor } = vi.hoisted(() => ({
  getPlantoesHojePorSetor: vi.fn(),
}))

vi.mock('@/services/pegaPlantaoApi', () => ({
  getPlantoesHojePorSetor,
  getPlantoesHoje: vi.fn(async () => []),
  getAfastamentosAtivos: vi.fn(async () => []),
  transformPlantoes: (x) => x,
  transformAfastamentos: (x) => x,
  isConfigured: () => true,          // sem isto o hook cai no mock interno
  clearCache: vi.fn(),
  isWeekend: () => false,
  isWeekendMode: () => false,
  getPeriodoAtual: () => 'tarde',
  estaNaMadrugada: () => false,
  HORA_CORTE_PLANTAO: 19,
}))

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

describe('useEscalaDia — revalidação dos nomes do plantão', () => {
  beforeEach(() => {
    getPlantoesHojePorSetor.mockReset()
    getPlantoesHojePorSetor.mockResolvedValue(escalaCom('Eduardo Savoldi'))
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => { cleanup(); vi.useRealTimers() })

  it('busca no mount', async () => {
    const { result } = await montar()
    await waitFor(() => expect(result.current.plantoes).toHaveLength(1))
    expect(result.current.plantoes[0].nome).toBe('Eduardo Savoldi')
    expect(getPlantoesHojePorSetor).toHaveBeenCalledTimes(1)
  })

  it('nome trocado no plantão aparece ao VOLTAR para o app (visibilitychange)', async () => {
    const { result } = await montar()
    await waitFor(() => expect(result.current.plantoes).toHaveLength(1))

    getPlantoesHojePorSetor.mockResolvedValue(escalaCom('Cristina Marcon'))
    await act(async () => {
      vi.advanceTimersByTime(31_000) // passa o debounce de 30s
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(0)
    })
    await waitFor(() => expect(result.current.plantoes[0].nome).toBe('Cristina Marcon'))
  })

  it('revalida sozinho a cada 10min com a tela aberta', async () => {
    const { result } = await montar()
    await waitFor(() => expect(result.current.plantoes).toHaveLength(1))

    getPlantoesHojePorSetor.mockResolvedValue(escalaCom('Klisman Drescher'))
    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 1000) })
    await waitFor(() => expect(result.current.plantoes[0].nome).toBe('Klisman Drescher'))
  })

  it('rajada de foco não vira rajada de request (debounce de 30s)', async () => {
    await montar()
    await waitFor(() => expect(getPlantoesHojePorSetor).toHaveBeenCalledTimes(1))
    await act(async () => {
      for (let i = 0; i < 5; i++) window.dispatchEvent(new Event('focus'))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(getPlantoesHojePorSetor).toHaveBeenCalledTimes(1) // nenhuma extra
  })
})
