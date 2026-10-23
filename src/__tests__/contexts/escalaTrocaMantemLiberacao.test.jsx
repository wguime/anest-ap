/**
 * A LIBERAÇÃO É DA PESSOA, NÃO DA POSIÇÃO (dono 23/10/2026).
 *
 * HRO da manhã de 23/10: o Klisman assumiu a posição do Rodnei às 09:02 e foi liberado
 * nela às 10:46 — a marca mora na chave da POSIÇÃO (`matutino:<uid do Rodnei>`). Às 10:53
 * a troca Cristina ⇄ Rodnei gravou "Cristina assume" por cima: a liberação passou para a
 * Cristina e o Klisman voltou ao fim da fila como "próximo", abaixo de 5 liberados.
 *
 * Contrato: a troca executa como sempre (uma transação), e quem SAIU de uma posição já
 * liberada continua liberado na própria chave. Roda o provider de verdade, com o service
 * mockado (mesmo arranjo de escalaCirurgicaTrocaRollback.test.jsx).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { ThemeProvider, ToastProvider } from '@/design-system'

const { svcMock } = vi.hoisted(() => ({
  svcMock: {
    fetchEscala: vi.fn(),
    fetchP4Hospital: vi.fn(async () => null),
    patchLinhaOverride: vi.fn(async () => {}),
    patchLiberacao: vi.fn(async () => {}),
    updateAnestesistaCasos: vi.fn(async () => {}),
    executarTrocaAtomica: vi.fn(async ({ lados = [] }) => ({ escalas: {}, casos: [], pulados: 0, lados: lados.length })),
  },
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseSubscriptionHelper', () => ({ createReliableSubscription: () => ({ cleanup: () => {} }) }))

import { EscalaCirurgicaProvider, useEscalaCirurgica, useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'

const LIBERADO_EM = '2026-10-23T13:46:40.734Z'
const escalaHro = (extra = {}) => ({
  id: 'esc-hro', hospital: 'hro', status: 'publicada',
  ordemLiberacao: { matutino: ['THAYNA', 'RAQUEL', 'RODNEI', 'GARIM'] },
  ajudaExterna: {}, casos: [],
  linhaOverrides: {
    'matutino:u-rodnei': { assumidaPor: { uid: 'u-klisman', nome: 'KLISMAN DRESCHER HILLESHEIN', de: { uid: 'u-rodnei' }, em: '2026-10-23T12:02:07Z' } },
  },
  liberacoes: { 'matutino:u-rodnei': { liberadoEm: LIBERADO_EM, por: 'u-thayna' } },
  ...extra,
})
const LADO_HRO = {
  hospital: 'hro', escalaId: 'esc-hro', turno: 'matutino', chaveSlot: 'u-rodnei', nomeSlot: 'RODNEI',
  de: { uid: 'u-rodnei', nome: 'RODNEI CABRAL LIMA', apelido: 'RODNEI' },
  para: { uid: 'u-cristina', nome: 'CRISTINA BERTOL BARBOSA MARCON', apelido: 'CRISTINA' },
  casoIds: [], tipo: 'entre_hospitais',
}

let actions
let estado
function Grab() {
  actions = useEscalaCirurgicaActions()
  estado = useEscalaCirurgica()
  return null
}
const montar = async (hro) => {
  svcMock.fetchEscala.mockImplementation(async (_data, hosp) => (hosp === 'hro' ? hro : null))
  render(<ThemeProvider><ToastProvider><EscalaCirurgicaProvider><Grab /></EscalaCirurgicaProvider></ToastProvider></ThemeProvider>)
  await waitFor(() => expect(estado?.escalas?.hro?.id).toBe('esc-hro'))
}

beforeEach(() => vi.clearAllMocks())

describe('quem sai de uma posição já liberada continua liberado', () => {
  it('recorte de 23/10: Cristina assume a posição do Rodnei, e o Klisman continua liberado', async () => {
    await montar(escalaHro())
    await act(async () => { await actions.executarSubstituicao({ lados: [LADO_HRO], limparTroca: [] }, { userId: 'u-gabriela' }) })

    expect(svcMock.executarTrocaAtomica).toHaveBeenCalledTimes(1)
    expect(svcMock.patchLiberacao).toHaveBeenCalledWith('esc-hro', 'matutino:u-klisman', { liberadoEm: LIBERADO_EM, por: 'u-gabriela' })
    expect(estado.escalas.hro.liberacoes['matutino:u-klisman']).toMatchObject({ liberadoEm: LIBERADO_EM })
    // a posição segue liberada para quem chega
    expect(estado.escalas.hro.liberacoes['matutino:u-rodnei']).toMatchObject({ liberadoEm: LIBERADO_EM })
    expect(await screen.findByText(/liberação de Klisman .* mantida/)).toBeTruthy()
  })

  it('posição ocupada mas NÃO liberada: nada a manter', async () => {
    await montar(escalaHro({ liberacoes: {} }))
    await act(async () => { await actions.executarSubstituicao({ lados: [LADO_HRO], limparTroca: [] }, { userId: 'u-gabriela' }) })
    expect(svcMock.patchLiberacao).not.toHaveBeenCalled()
  })

  it('posição liberada com o próprio dono nela: a liberação já é da chave dele', async () => {
    await montar(escalaHro({ linhaOverrides: {} }))
    await act(async () => { await actions.executarSubstituicao({ lados: [LADO_HRO], limparTroca: [] }, { userId: 'u-gabriela' }) })
    expect(svcMock.patchLiberacao).not.toHaveBeenCalled()
  })

  it('o banco recusa (cirurgia sem horário): a troca fica feita e o aviso diz o caminho', async () => {
    await montar(escalaHro())
    svcMock.patchLiberacao.mockRejectedValueOnce(new Error('horario_pendente: 1 cirurgia(s) sem horário'))
    await act(async () => { await actions.executarSubstituicao({ lados: [LADO_HRO], limparTroca: [] }, { userId: 'u-gabriela' }) })
    expect(svcMock.executarTrocaAtomica).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/Klisman .* voltou à fila/)).toBeTruthy()
    expect(screen.getByText(/Há cirurgia sem horário de início\/término/)).toBeTruthy()
  })
})
