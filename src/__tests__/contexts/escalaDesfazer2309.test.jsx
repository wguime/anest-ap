/**
 * "DESFAZER" NAS AÇÕES QUE NÃO TINHAM VOLTA (dono 23/09, revisão do módulo):
 * marcar Terminada, remover ajuda, "Restaurar automático" e excluir o recado.
 *
 *  - Terminada: o Desfazer devolve o retrato de ANTES do toque (status, extra,
 *    carimbo e término) — só se o caso ainda estiver terminado.
 *  - Remover ajuda: a pessoa volta na MESMA posição do bloco de ajuda.
 *  - Restaurar automático: o Desfazer regrava a exibição apagada, com a marca
 *    `renovado` junto.
 *  - Recado: some na hora, mas só é apagado no banco depois da janela; Desfazer
 *    cancela a exclusão.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, act, renderHook } from '@testing-library/react'

const { svcMock, toastMock } = vi.hoisted(() => ({
  svcMock: {
    fetchEscala: vi.fn(),
    fetchP4Hospital: vi.fn(async () => null),
    patchLinhaOverride: vi.fn(async () => {}),
    updateAjudaExterna: vi.fn(async () => {}),
    updateStatusCirurgia: vi.fn(async () => {}),
    updateCaso: vi.fn(async () => {}),
    desfazerTerminada: vi.fn(async () => true),
    fetchAvisos: vi.fn(async () => [{ id: 'av1', texto: 'sala 3 atrasada', confirmadoPor: [] }]),
    excluirAviso: vi.fn(async () => {}),
  },
  toastMock: vi.fn(),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseSubscriptionHelper', () => ({ createReliableSubscription: () => ({ cleanup: () => {} }) }))
vi.mock('@/design-system/components/ui/toast', () => ({ useToast: () => ({ toast: toastMock }) }))

import { EscalaCirurgicaProvider, useEscalaCirurgica, useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'
import useAvisoPlantonista, { JANELA_DESFAZER_MS } from '@/pages/escala-cirurgica/useAvisoPlantonista'

const escalaBase = () => ({
  id: 'esc-uni', hospital: 'unimed', status: 'publicada',
  ordemLiberacao: { matutino: ['STAUB'] },
  ajudaExterna: { matutino: ['ANA', 'BETO', 'CARLA'] },
  liberacoes: {},
  linhaOverrides: { 'matutino:staub': { local: 'Sala 3', observacao: 'recado', termino: '11:00', renovado: true, origem: 'hro' } },
  casos: [{
    id: 'c1', sala: 'S1', ordem: 0, anestesista: 'STAUB', turno: 'matutino',
    statusCirurgia: 'iniciada', statusExtra: 'atrasada', terminoPrevisto: '11:30',
    statusAtualizadoEm: '2026-09-23T10:00:00.000Z', statusAtualizadoPor: 'u-inicio',
  }],
})

let actions
let estado
function Grab() { actions = useEscalaCirurgicaActions(); estado = useEscalaCirurgica(); return null }
const montar = async () => {
  render(<EscalaCirurgicaProvider><Grab /></EscalaCirurgicaProvider>)
  await waitFor(() => expect(estado?.escalas?.unimed?.id).toBe('esc-uni'))
}
const unimed = () => estado.escalas.unimed
const acaoDoUltimoToast = () => toastMock.mock.calls.at(-1)?.[0]?.action

beforeEach(() => {
  vi.clearAllMocks()
  svcMock.fetchEscala.mockImplementation(async (_d, h) => (h === 'unimed' ? escalaBase() : null))
})

describe('Terminada → Desfazer', () => {
  it('oferece Desfazer e ele devolve status, extra, carimbo e o término zerado', async () => {
    await montar()
    await act(async () => { await actions.setStatusCirurgia(unimed(), unimed().casos[0], 'terminada', { userId: 'u-fim' }) })
    expect(unimed().casos[0].statusCirurgia).toBe('terminada')
    expect(unimed().casos[0].terminoPrevisto).toBeNull()
    const acao = acaoDoUltimoToast()
    expect(acao?.label).toBe('Desfazer')
    await act(async () => { await acao.onClick() })
    // o retrato de ANTES do toque vai ao servidor — carimbo e término originais
    await waitFor(() => expect(svcMock.desfazerTerminada).toHaveBeenCalledWith('c1', expect.objectContaining({
      statusCirurgia: 'iniciada', statusExtra: 'atrasada', terminoPrevisto: '11:30',
      statusAtualizadoEm: '2026-09-23T10:00:00.000Z', statusAtualizadoPor: 'u-inicio',
    })))
    expect(unimed().casos[0]).toMatchObject({ statusCirurgia: 'iniciada', statusExtra: 'atrasada', terminoPrevisto: '11:30', statusAtualizadoEm: '2026-09-23T10:00:00.000Z' })
  })

  it('se a cirurgia mudou no meio-tempo, o Desfazer não grava e avisa', async () => {
    svcMock.desfazerTerminada.mockResolvedValueOnce(false)
    await montar()
    await act(async () => { await actions.setStatusCirurgia(unimed(), unimed().casos[0], 'terminada', { userId: 'u-fim' }) })
    await act(async () => { await acaoDoUltimoToast().onClick() })
    await waitFor(() => expect(toastMock).toHaveBeenLastCalledWith(expect.objectContaining({ variant: 'error', title: 'Não foi possível desfazer' })))
    expect(unimed().casos[0].statusCirurgia).toBe('terminada')
  })

  it('marcar Iniciada não oferece Desfazer (só o Terminada tem volta cara)', async () => {
    await montar()
    await act(async () => { await actions.setStatusCirurgia(unimed(), unimed().casos[0], 'agendada', { userId: 'u' }) })
    expect(toastMock.mock.calls.some(([t]) => t?.action?.label === 'Desfazer')).toBe(false)
  })
})

describe('Remover ajuda → Desfazer', () => {
  it('a pessoa volta na MESMA posição do bloco de ajuda', async () => {
    await montar()
    await act(async () => { await actions.removerAjuda(unimed(), 'matutino', 'BETO') })
    expect(unimed().ajudaExterna.matutino).toEqual(['ANA', 'CARLA'])
    await act(async () => { await acaoDoUltimoToast().onClick() })
    await waitFor(() => expect(unimed().ajudaExterna.matutino).toEqual(['ANA', 'BETO', 'CARLA']))
    expect(svcMock.updateAjudaExterna).toHaveBeenLastCalledWith('esc-uni', expect.objectContaining({ matutino: ['ANA', 'BETO', 'CARLA'] }))
  })
})

describe('Restaurar automático → Desfazer', () => {
  it('o override de exibição volta, com a marca renovado, e a origem nunca saiu', async () => {
    await montar()
    const linha = { chave: 'staub', anestesista: 'STAUB' }
    await act(async () => { await actions.setLinhaOverride(unimed(), linha, null, { userId: 'u' }, 'matutino') })
    expect(unimed().linhaOverrides['matutino:staub']).toMatchObject({ origem: 'hro' })
    expect(unimed().linhaOverrides['matutino:staub'].local).toBeUndefined()
    // o que a view manda no Desfazer (restaurarEditor em LiberacoesView)
    await act(async () => {
      await actions.setLinhaOverride(unimed(), linha,
        { local: 'Sala 3', hospital: '', cirurgioes: '', termino: '11:00', observacao: 'recado', renovado: true }, { userId: 'u' }, 'matutino')
    })
    expect(unimed().linhaOverrides['matutino:staub']).toMatchObject({ local: 'Sala 3', termino: '11:00', observacao: 'recado', renovado: true, origem: 'hro' })
  })
})

describe('Excluir recado → Desfazer', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }) })
  afterEach(() => { vi.useRealTimers() })
  const hook = async () => {
    const r = renderHook(() => useAvisoPlantonista({ escalaId: 'esc-uni', turno: 'matutino', userId: 'u', userName: 'U', hospitalLabel: 'Unimed' }))
    await waitFor(() => expect(r.result.current.avisos).toHaveLength(1))
    return r
  }

  it('some na hora, mas só é apagado no banco depois da janela', async () => {
    const { result } = await hook()
    act(() => { result.current.excluir('av1') })
    expect(result.current.avisos).toHaveLength(0)
    expect(svcMock.excluirAviso).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(JANELA_DESFAZER_MS + 10) })
    expect(svcMock.excluirAviso).toHaveBeenCalledWith('av1')
  })

  it('Desfazer dentro da janela: nada é apagado e o recado volta', async () => {
    const { result } = await hook()
    let desfazer
    act(() => { desfazer = result.current.excluir('av1') })
    await act(async () => { desfazer() })
    await act(async () => { vi.advanceTimersByTime(JANELA_DESFAZER_MS + 10) })
    expect(svcMock.excluirAviso).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.avisos).toHaveLength(1))
  })
})
