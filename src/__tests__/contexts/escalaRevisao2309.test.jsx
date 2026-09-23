/**
 * REVISÃO DA ESCALA 23/09 — cinco defeitos silenciosos, uma trava cada.
 *
 *  1. Erro de rede ≠ "não publicada": a leitura que FALHA não vira `null` (que a
 *     tela lia como "Sem escala publicada"), a revalidação não apaga a escala boa,
 *     e `garantirEscala` só cria escala vazia se o SERVIDOR confirmar que não há —
 *     senão um toque em "Adicionar caso" publicava um turno vazio por cima do real.
 *  2. O "Desfazer" do toast de liberação lia a escala de ANTES e liberava de novo.
 *  3. Desliberar / salvar a linha apagava declarações da pessoa (`naEquipe`,
 *     `turnoProprio`, `origem`, `semAjuda`); o `hospital` do painel nunca gravava.
 *  5. Término que atravessa a meia-noite ("01:30" pedido às 21:30) era lido como
 *     estourado — pílula âmbar e push falso no plantão da noite.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { ThemeProvider, ToastProvider } from '@/design-system'

const { svcMock, subCallbacks } = vi.hoisted(() => ({
  svcMock: {
    fetchEscala: vi.fn(),
    fetchP4Hospital: vi.fn(async () => null),
    patchLiberacao: vi.fn(async () => {}),
    patchLinhaOverride: vi.fn(async () => {}),
    salvarEscalaTurno: vi.fn(async (p) => ({ id: 'esc-nova', ...p, liberacoes: {}, linhaOverrides: {} })),
  },
  subCallbacks: [],
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseSubscriptionHelper', () => ({
  createReliableSubscription: (opts) => {
    subCallbacks.push(opts.callback)
    return { cleanup: () => {} }
  },
}))

import { EscalaCirurgicaProvider, useEscalaCirurgica, useEscalaCirurgicaActions, REALTIME_COALESCE_MS } from '@/contexts/EscalaCirurgicaContext'
import { diffRelogioMin, formatRestante } from '@/pages/escala-cirurgica/utils'
import { formatFaltante } from '@/pages/escala-cirurgica/PainelTempo'

const escalaBase = (extra = {}) => ({
  id: 'esc-uni', hospital: 'unimed', status: 'publicada',
  ordemLiberacao: { matutino: ['STAUB', 'GIOVANA'] },
  liberacoes: {}, linhaOverrides: {}, ajudaExterna: {},
  casos: [{ id: 'c1', sala: 'S1', ordem: 0, anestesista: 'STAUB', turno: 'matutino', statusCirurgia: 'agendada' }],
  ...extra,
})

let actions
let estado
function Grab() {
  actions = useEscalaCirurgicaActions()
  estado = useEscalaCirurgica()
  return null
}
const montar = () => render(
  <ThemeProvider><ToastProvider>
    <EscalaCirurgicaProvider><Grab /></EscalaCirurgicaProvider>
  </ToastProvider></ThemeProvider>
)
const unimed = () => estado.escalas.unimed
const falhaRede = () => Promise.reject(Object.assign(new Error('Failed to fetch'), { code: '' }))

beforeEach(() => {
  vi.clearAllMocks()
  subCallbacks.length = 0
  // produção: a falha NÃO cai na fixture demo (que é só de DEV/e2e)
  vi.stubEnv('DEV', false)
})
afterEach(() => { vi.unstubAllEnvs() })

describe('1 · erro de rede não vira "sem escala" nem publica turno vazio', () => {
  it('leitura inicial que falha marca erroCarga (não "não publicada") e "Tentar de novo" recupera', async () => {
    svcMock.fetchEscala.mockImplementation((_d, h) => (h === 'unimed' ? falhaRede() : Promise.resolve(null)))
    montar()
    await waitFor(() => expect(estado.loading).toBe(false))
    expect(unimed()).toBeNull()
    expect(estado.erroCarga).toEqual({ unimed: true })

    svcMock.fetchEscala.mockImplementation(async (_d, h) => (h === 'unimed' ? escalaBase() : null))
    await act(async () => { await actions.recarregar() })
    expect(unimed()?.id).toBe('esc-uni')
    expect(estado.erroCarga).toBeNull()
  })

  it('hospital sem escala publicada (resposta null) NÃO é erro', async () => {
    svcMock.fetchEscala.mockImplementation(async () => null)
    montar()
    await waitFor(() => expect(estado.loading).toBe(false))
    expect(estado.erroCarga).toBeNull()
  })

  it('revalidação do realtime que falha MANTÉM a escala que estava na tela', async () => {
    svcMock.fetchEscala.mockImplementation(async (_d, h) => (h === 'unimed' ? escalaBase() : null))
    montar()
    await waitFor(() => expect(unimed()?.id).toBe('esc-uni'))
    svcMock.fetchEscala.mockImplementation(() => falhaRede())
    await act(async () => {
      subCallbacks.forEach((cb) => cb())
      await new Promise((r) => setTimeout(r, REALTIME_COALESCE_MS + 50))
    })
    expect(unimed()?.id).toBe('esc-uni')
    expect(estado.erroCarga).toBeNull()
  })

  it('garantirEscala com a tela vazia por FALHA: acha a escala no servidor e não publica nada', async () => {
    svcMock.fetchEscala.mockImplementation((_d, h) => (h === 'unimed' ? falhaRede() : Promise.resolve(null)))
    montar()
    await waitFor(() => expect(estado.erroCarga).toEqual({ unimed: true }))
    svcMock.fetchEscala.mockImplementation(async (_d, h) => (h === 'unimed' ? escalaBase() : null))
    let r
    await act(async () => { r = await actions.garantirEscala({ data: estado.data, hospital: 'unimed', turno: 'matutino' }, { userId: 'u1' }) })
    expect(r.id).toBe('esc-uni')
    expect(svcMock.salvarEscalaTurno).not.toHaveBeenCalled()
    expect(unimed()?.id).toBe('esc-uni')
  })

  it('garantirEscala sem conseguir confirmar no servidor RECUSA — nunca publica vazio às cegas', async () => {
    svcMock.fetchEscala.mockImplementation(() => falhaRede())
    montar()
    await waitFor(() => expect(estado.loading).toBe(false))
    await act(async () => {
      await expect(actions.garantirEscala({ data: estado.data, hospital: 'unimed', turno: 'matutino' }, { userId: 'u1' })).rejects.toThrow()
    })
    expect(svcMock.salvarEscalaTurno).not.toHaveBeenCalled()
  })

  it('garantirEscala quando o servidor confirma que NÃO existe: cria (Materno sem escala, dono 16/08)', async () => {
    svcMock.fetchEscala.mockImplementation(async () => null)
    montar()
    await waitFor(() => expect(estado.loading).toBe(false))
    await act(async () => { await actions.garantirEscala({ data: estado.data, hospital: 'materno', turno: 'matutino' }, { userId: 'u1' }) })
    expect(svcMock.salvarEscalaTurno).toHaveBeenCalledTimes(1)
    expect(svcMock.salvarEscalaTurno.mock.calls[0][0]).toMatchObject({ hospital: 'materno', casos: [], ordemLiberacao: [] })
  })
})

describe('2 · "Desfazer" do toast desfaz — não libera de novo', () => {
  it('com a escala de ANTES da liberação (closure do toast), desfazer tira a liberação', async () => {
    svcMock.fetchEscala.mockImplementation(async (_d, h) => (h === 'unimed' ? escalaBase() : null))
    montar()
    await waitFor(() => expect(unimed()?.id).toBe('esc-uni'))
    const antes = unimed() // o que o toast guardou
    const linha = { chave: 'staub', anestesista: 'STAUB' }
    await act(async () => { await actions.toggleLiberacao(antes, linha, { userId: 'u1' }, 'matutino') })
    expect(unimed().liberacoes['matutino:staub']?.liberadoEm).toBeTruthy()
    await act(async () => { await actions.toggleLiberacao(antes, linha, { userId: 'u1' }, 'matutino', { apenasDesfazer: true }) })
    expect(unimed().liberacoes['matutino:staub']).toBeUndefined()
    expect(svcMock.patchLiberacao).toHaveBeenLastCalledWith('esc-uni', 'matutino:staub', null)
  })

  it('desfazer quando alguém já desliberou não cria liberação nova', async () => {
    svcMock.fetchEscala.mockImplementation(async (_d, h) => (h === 'unimed' ? escalaBase() : null))
    montar()
    await waitFor(() => expect(unimed()?.id).toBe('esc-uni'))
    await act(async () => { await actions.toggleLiberacao(unimed(), { chave: 'staub', anestesista: 'STAUB' }, { userId: 'u1' }, 'matutino', { apenasDesfazer: true }) })
    expect(unimed().liberacoes['matutino:staub']).toBeUndefined()
    expect(svcMock.patchLiberacao).not.toHaveBeenCalled()
  })
})

describe('3 · declarações sobre a pessoa sobrevivem', () => {
  const declaracoes = {
    origem: 'hro', semAjuda: true, naEquipe: { ate: '19:00' }, turnoProprio: { ate: '15:00' },
    trocaCom: { uid: 'uid-x' }, conferido: true,
  }
  const comDeclaracoes = () => escalaBase({
    liberacoes: { 'matutino:staub': { liberadoEm: '2026-09-23T10:00:00Z', por: 'u0' } },
    linhaOverrides: { 'matutino:staub': { ...declaracoes, local: 'Sala 3', termino: '11:00', observacao: 'x' } },
  })

  it('desliberar renova a EXIBIÇÃO (local/tempo/observação) e mantém as declarações', async () => {
    svcMock.fetchEscala.mockImplementation(async (_d, h) => (h === 'unimed' ? comDeclaracoes() : null))
    montar()
    await waitFor(() => expect(unimed()?.id).toBe('esc-uni'))
    await act(async () => { await actions.toggleLiberacao(unimed(), { chave: 'staub', anestesista: 'STAUB' }, { userId: 'u1' }, 'matutino') })
    const ov = unimed().linhaOverrides['matutino:staub']
    expect(ov).toMatchObject({ renovado: true, ...declaracoes })
    expect(ov.local).toBeUndefined()
    expect(ov.termino).toBeUndefined()
    expect(ov.observacao).toBeUndefined()
  })

  it('salvar o editor mantém as declarações e grava o hospital da linha', async () => {
    svcMock.fetchEscala.mockImplementation(async (_d, h) => (h === 'unimed' ? comDeclaracoes() : null))
    montar()
    await waitFor(() => expect(unimed()?.id).toBe('esc-uni'))
    await act(async () => {
      await actions.setLinhaOverride(unimed(), { chave: 'staub', anestesista: 'STAUB' },
        { local: 'Sala 5', hospital: 'hro', cirurgioes: '', termino: '12:00', observacao: '' }, { userId: 'u1' }, 'matutino')
    })
    expect(unimed().linhaOverrides['matutino:staub']).toMatchObject({ ...declaracoes, local: 'Sala 5', hospital: 'hro', termino: '12:00' })
  })

  it('"Restaurar automático" limpa a exibição e mantém as declarações', async () => {
    svcMock.fetchEscala.mockImplementation(async (_d, h) => (h === 'unimed' ? comDeclaracoes() : null))
    montar()
    await waitFor(() => expect(unimed()?.id).toBe('esc-uni'))
    await act(async () => { await actions.setLinhaOverride(unimed(), { chave: 'staub', anestesista: 'STAUB' }, null, { userId: 'u1' }, 'matutino') })
    const ov = unimed().linhaOverrides['matutino:staub']
    expect(ov).toMatchObject(declaracoes)
    expect(ov.local).toBeUndefined()
  })
})

describe('5 · término que atravessa a meia-noite', () => {
  const m = (hhmm) => { const [h, mi] = hhmm.split(':').map(Number); return h * 60 + mi }

  it('"01:30" pedido às 21:30 ainda FALTA 4h', () => {
    expect(diffRelogioMin(m('01:30'), m('21:30'))).toBe(240)
    expect(formatFaltante(m('01:30'), m('21:30'))).toEqual({ texto: '~4h00', atrasada: false })
  })

  it('"23:30" visto à 00:15 estourou há 45min (não "faltam 23h")', () => {
    expect(formatFaltante(m('23:30'), m('00:15'))).toEqual({ texto: '+45min', atrasada: true })
    expect(formatRestante(m('23:30'), m('00:15'))).toBe('há 45min além do previsto')
  })

  it('de DIA nada muda: término das 08:00 esquecido às 21:00 segue "13h além"', () => {
    expect(formatFaltante(m('08:00'), m('21:00'))).toEqual({ texto: '+13h00', atrasada: true })
    expect(diffRelogioMin(m('14:00'), m('13:00'))).toBe(60)
  })
})

describe('madrugada: o relógio da escala conta 24h+ no plantão em andamento (dono 23/09)', () => {
  it('01:00 vendo o dia operacional vale 25:00; outra data segue 01:00', async () => {
    const { minutoOperacional } = await import('@/pages/escala-cirurgica/useAgoraMinutoEscala')
    expect(minutoOperacional(60, { data: '2026-09-22', hoje: '2026-09-22' })).toBe(1500)
    expect(minutoOperacional(60, { data: '2026-09-23', hoje: '2026-09-22' })).toBe(60)
    expect(minutoOperacional(8 * 60, { data: '2026-09-23', hoje: '2026-09-23' })).toBe(480)
  })

  it('com o relógio em 25:00 a fase continua ZERADA (a lista não volta inteira)', async () => {
    const { faseLiberacoes } = await import('@/lib/plantaoNoturno')
    // quarta 23/09 é dia útil
    expect(faseLiberacoes({ agoraMin: 1500, dataEscala: '2026-09-23', hojeIso: '2026-09-23' })).toBe('zerada')
  })

  it('urgência que chegou 00:40 do dia seguinte entra na régua do plantão (24:40), outra data não', async () => {
    const { chegadaDaUrgencia } = await import('@/lib/escalaCirurgicaUrgencias')
    const madrugada = new Date(2026, 8, 24, 0, 40).toISOString()
    const tarde = new Date(2026, 8, 24, 14, 0).toISOString()
    expect(chegadaDaUrgencia({ createdAt: madrugada }, { dataEscala: '2026-09-23' })).toBe(24 * 60 + 40)
    expect(chegadaDaUrgencia({ createdAt: tarde }, { dataEscala: '2026-09-23' })).toBeNull()
  })

  it('diaOperacionalISO: antes das 7h é a véspera; às 7h vira', async () => {
    const { diaOperacionalISO } = await import('@/contexts/EscalaCirurgicaContext')
    expect(diaOperacionalISO(new Date(2026, 8, 24, 6, 59))).toBe('2026-09-23')
    expect(diaOperacionalISO(new Date(2026, 8, 24, 7, 0))).toBe('2026-09-24')
  })

  it('turno do dia operacional: de madrugada é a TARDE (a noite lê as cirurgias da tarde)', async () => {
    const { turnoAtualOperacional } = await import('@/pages/escala-cirurgica/utils')
    expect(turnoAtualOperacional(new Date(2026, 8, 24, 3, 0))).toBe('vespertino')
    expect(turnoAtualOperacional(new Date(2026, 8, 24, 8, 0))).toBe('matutino')
    expect(turnoAtualOperacional(new Date(2026, 8, 24, 14, 0))).toBe('vespertino')
  })
})
