/**
 * Duas peças do contexto da escala para o pop-up de horários e os turnos do dia abertos
 * (dono 28/10/2026, `.tmp/popup-horarios/`):
 *
 *  1. ABERTURA OTIMIZADA ("a abertura deve ser otimizada para não haver delays"; proposta
 *     aceita: buscar a lista de dias anteriores na abertura do app). O provider — montado com o
 *     app, junto com a escala do dia que o card da Home já busca — pede a lista da pessoa; conta
 *     de hospital não tem pendência pessoal e não paga a ida.
 *  2. TROCAR QUEM FEZ NUM TURNO ENCERRADO (modelo A+): `semEfeitosNaFila` troca só o nome na
 *     cirurgia — sem ajuda preservada, sem marcador de escalado e sem limpar a anotação da linha,
 *     que existem para a fila que ainda corre. Sem a opção, o repasse segue como sempre.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { ThemeProvider, ToastProvider } from '@/design-system'

const { svcMock, estado } = vi.hoisted(() => ({
  estado: { usuario: null },
  svcMock: {
    fetchEscala: vi.fn(),
    fetchP4Hospital: vi.fn(async () => null),
    fetchCasosDaPessoa: vi.fn(async () => []),
    updateAnestesistaCasos: vi.fn(async () => {}),
    updateAjudaExterna: vi.fn(async () => {}),
    patchLiberacao: vi.fn(async () => {}),
    patchLinhaOverride: vi.fn(async () => {}),
  },
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseSubscriptionHelper', () => ({
  createReliableSubscription: () => ({ cleanup: () => {} }),
}))
vi.mock('@/contexts/userContextObject', async (orig) => ({
  ...(await orig()),
  useUserOpcional: () => (estado.usuario ? { user: estado.usuario } : null),
}))

import { EscalaCirurgicaProvider, useEscalaCirurgica, useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'
import { _zerarAnteriores } from '@/pages/escala-cirurgica/pendenciasAnteriores'

const HOJE = '2026-10-29'
const escalaBase = () => ({
  id: 'esc-uni', hospital: 'unimed', status: 'publicada', data: HOJE,
  ordemLiberacao: { matutino: ['PAULO', 'ADRIANO'] },
  liberacoes: {}, ajudaExterna: {},
  // ADRIANO tem anotação manual na linha: receber caso a limparia (regra de 16/09)
  linhaOverrides: { 'matutino:uid-adr': { local: 'CO - Cesárea', cirurgioes: 'Cesária > Junior', por: 'u-louise', em: '2026-10-29T10:00:00Z' } },
  casos: [
    { id: 'c1', sala: 'CO - Sala 3', ordem: 0, anestesista: 'PAULO', anestesistaUserId: 'uid-pau', turno: 'matutino', tipo: 'eletiva', statusCirurgia: 'terminada' },
    { id: 'c2', sala: 'CC - Sala 10', ordem: 0, anestesista: 'ADRIANO', anestesistaUserId: 'uid-adr', turno: 'matutino', tipo: 'eletiva', statusCirurgia: 'terminada' },
  ],
})

let actions
let ctx
function Grab() {
  actions = useEscalaCirurgicaActions()
  ctx = useEscalaCirurgica()
  return null
}
const montar = async () => {
  render(
    <ThemeProvider><ToastProvider>
      <EscalaCirurgicaProvider><Grab /></EscalaCirurgicaProvider>
    </ToastProvider></ThemeProvider>,
  )
  await waitFor(() => expect(ctx?.escalas?.unimed?.id).toBe('esc-uni'))
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(`${HOJE}T15:00:00-03:00`))
  vi.clearAllMocks()
  localStorage.clear()
  _zerarAnteriores()
  estado.usuario = null
  svcMock.fetchEscala.mockImplementation(async (_d, h) => (h === 'unimed' ? escalaBase() : null))
})
afterEach(() => vi.useRealTimers())

describe('a lista de dias anteriores sai na ABERTURA do app', () => {
  it('anestesista: o provider pede a lista dele assim que o app monta', async () => {
    estado.usuario = { uid: 'u-ana', role: 'anestesiologista', displayName: 'Ana' }
    await montar()
    await waitFor(() => expect(svcMock.fetchCasosDaPessoa).toHaveBeenCalledWith({ uid: 'u-ana', desde: '2026-10-27', ate: HOJE }))
    expect(svcMock.fetchCasosDaPessoa).toHaveBeenCalledTimes(1)
  })

  it('conta de hospital não tem pendência pessoal: não busca', async () => {
    estado.usuario = { uid: 'u-hro', role: 'func-hro', displayName: 'HRO' }
    await montar()
    await act(async () => { vi.advanceTimersByTime(500) })
    expect(svcMock.fetchCasosDaPessoa).not.toHaveBeenCalled()
  })

  it('sem usuário (antes do login) não busca', async () => {
    await montar()
    await act(async () => { vi.advanceTimersByTime(500) })
    expect(svcMock.fetchCasosDaPessoa).not.toHaveBeenCalled()
  })
})

describe('trocar quem fez num turno encerrado não mexe na fila', () => {
  it('com `semEfeitosNaFila`: só o nome na cirurgia — sem anotação, ajuda ou marcador', async () => {
    await montar()
    await act(async () => {
      await actions.setAnestesistaCasos(ctx.escalas.unimed, ['c1'], { uid: 'uid-adr', apelido: 'ADRIANO' }, { userId: 'u-dono', semEfeitosNaFila: true })
    })
    expect(svcMock.updateAnestesistaCasos).toHaveBeenCalledWith(['c1'], { uid: 'uid-adr', apelido: 'ADRIANO', dupla: false }, { extraPorId: null })
    expect(svcMock.patchLinhaOverride).not.toHaveBeenCalled()
    expect(svcMock.updateAjudaExterna).not.toHaveBeenCalled()
    expect(svcMock.patchLiberacao).not.toHaveBeenCalled()
    expect(ctx.escalas.unimed.casos.find((c) => c.id === 'c1')).toMatchObject({ anestesista: 'ADRIANO', anestesistaUserId: 'uid-adr' })
  })

  it('sem a opção (turno em curso) o repasse segue limpando a anotação de quem recebe (controle)', async () => {
    await montar()
    await act(async () => {
      await actions.setAnestesistaCasos(ctx.escalas.unimed, ['c1'], { uid: 'uid-adr', apelido: 'ADRIANO' }, { userId: 'u-dono' })
    })
    expect(svcMock.patchLinhaOverride).toHaveBeenCalledWith('esc-uni', 'matutino:uid-adr', null)
  })
})
