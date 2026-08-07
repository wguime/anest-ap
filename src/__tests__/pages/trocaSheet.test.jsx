/**
 * TrocaSheet — o FLUXO ÚNICO de troca (dono 07/08: "num só local, fáceis de
 * executar e intuitivas"). Estes testes travam o contrato:
 *   1. o TIPO é INFERIDO pela geografia dos slots (taxonomia do dono) e
 *      pré-selecionado — hospitais diferentes / mesmo hospital / só um com slot;
 *   2. "Trocar agora" executa DIRETO (assumidaPor com tipo+motivo), sem passar
 *      por trocaCom — declarar+executar no mesmo ato só geraria ruído no log;
 *   3. "Declarar para depois" grava trocaCom com tipo+motivo;
 *   4. pendências do plano aparecem ANTES de executar (nunca meio swap calado);
 *   5. a própria pessoa não aparece no seletor de colega.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import TrocaSheet, { inferirTipoTroca, TIPO_LABEL } from '@/pages/escala-cirurgica/TrocaSheet'

const ROSTER = [
  { uid: 'uid-gio', nome: 'GIOVANA GOMES NOLL', apelidos: ['GIOVANA'] },
  { uid: 'uid-mau', nome: 'MAURICIO MAHALEM BASTOS', apelidos: ['MAURICIO'] },
  { uid: 'uid-fora', nome: 'COLEGA DE FORA', apelidos: ['FORA'] },
]
const APELIDO_UID = Object.fromEntries(ROSTER.flatMap((r) => r.apelidos.map((a) => [a, r.uid])))

const { marcarTroca, executarSubstituicao } = vi.hoisted(() => ({
  marcarTroca: vi.fn(async () => {}),
  executarSubstituicao: vi.fn(async () => {}),
}))

// as 3 escalas que o context forneceria — Giovana no HRO, Maurício na Unimed
const escalaUnimed = {
  id: 'esc-uni', hospital: 'unimed',
  ordemLiberacao: { matutino: ['ANDRE', 'MAURICIO'] },
  linhaOverrides: {},
  casos: [{ id: 'u1', sala: 'S2', ordem: 0, anestesista: 'MAURICIO', anestesistaUserId: 'uid-mau', bloco: 'normal' }],
}
const escalaHro = {
  id: 'esc-hro', hospital: 'hro',
  ordemLiberacao: { matutino: ['GIOVANA', 'KARINE'] },
  linhaOverrides: {},
  casos: [{ id: 'h1', sala: 'S1', ordem: 0, anestesista: 'GIOVANA', anestesistaUserId: 'uid-gio', bloco: 'normal' }],
}

vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgica: () => ({ escalas: { unimed: escalaUnimed, hro: escalaHro, materno: null } }),
  useEscalaCirurgicaActions: () => ({ marcarTroca, executarSubstituicao }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u-eu', displayName: 'Eu' } }),
}))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: ROSTER,
    rosterByUid: new Map(ROSTER.map((r) => [r.uid, r])),
    options: ROSTER.map((r) => ({ value: r.uid, label: r.nome })),
    resolver: (nome) => APELIDO_UID[String(nome || '').trim().toUpperCase()] || null,
    loading: false,
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const LINHA_GIOVANA = { chave: 'uid-gio', uid: 'uid-gio', anestesista: 'Giovana Noll', nomeOriginal: 'GIOVANA' }

const montar = (props = {}) => render(
  <TrocaSheet linha={LINHA_GIOVANA} escala={escalaHro} turno="matutino" onClose={vi.fn()} {...props} />,
  { wrapper: wrap },
)

const escolherColega = async (nome) => {
  fireEvent.click(screen.getByRole('combobox'))
  fireEvent.click(await screen.findByRole('option', { name: nome }))
}

beforeEach(() => vi.clearAllMocks())

describe('inferirTipoTroca — taxonomia pela geografia dos slots', () => {
  const lado = (hospital, turno) => ({ hospital, turno })
  it('hospitais diferentes → entre_hospitais', () => {
    expect(inferirTipoTroca({ lados: [lado('unimed', 'matutino'), lado('hro', 'matutino')] })).toBe('entre_hospitais')
  })
  it('mesmo hospital → posicoes; turnos diferentes → entre_turnos', () => {
    expect(inferirTipoTroca({ lados: [lado('hro', 'matutino'), lado('hro', 'matutino')] })).toBe('posicoes')
    expect(inferirTipoTroca({ lados: [lado('hro', 'matutino'), lado('hro', 'vespertino')] })).toBe('entre_turnos')
  })
  it('um lado só → assuncao; nenhum → null', () => {
    expect(inferirTipoTroca({ lados: [lado('hro', 'matutino')] })).toBe('assuncao')
    expect(inferirTipoTroca({ lados: [] })).toBeNull()
  })
})

describe('TrocaSheet', () => {
  it('a própria pessoa fica fora do seletor de colega', async () => {
    montar()
    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.queryByRole('option', { name: 'GIOVANA GOMES NOLL' })).toBeNull()
    expect(await screen.findByRole('option', { name: 'MAURICIO MAHALEM BASTOS' })).toBeTruthy()
  })

  it('par completo entre hospitais: infere o tipo, mostra o preview dos 2 lados', async () => {
    montar()
    await escolherColega('MAURICIO MAHALEM BASTOS')
    // chip do tipo inferido selecionado
    await waitFor(() => expect(screen.getByText(TIPO_LABEL.entre_hospitais)).toBeTruthy())
    // preview derivado do plano: cada lado com hospital e herança de casos
    expect(screen.getByText(/assume a posição de Giovana/i)).toBeTruthy()
    expect(screen.getByText(/assume a posição de Mauricio/i)).toBeTruthy()
  })

  it('"Trocar agora" executa com tipo e motivo DENTRO dos lados — sem declarar antes', async () => {
    montar()
    await escolherColega('MAURICIO MAHALEM BASTOS')
    fireEvent.change(screen.getByPlaceholderText(/plantão trocado/), { target: { value: 'plantão' } })
    fireEvent.click(screen.getByRole('button', { name: /Trocar agora/ }))
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    const [plan] = executarSubstituicao.mock.calls[0]
    expect(plan.lados).toHaveLength(2)
    for (const l of plan.lados) {
      expect(l.tipo).toBe('entre_hospitais')
      expect(l.motivo).toBe('plantão')
    }
    expect(marcarTroca).not.toHaveBeenCalled()
  })

  it('"Declarar para depois" grava trocaCom com tipo e motivo', async () => {
    montar()
    await escolherColega('MAURICIO MAHALEM BASTOS')
    fireEvent.change(screen.getByPlaceholderText(/plantão trocado/), { target: { value: 'congresso' } })
    fireEvent.click(screen.getByRole('button', { name: /Declarar para depois/ }))
    await waitFor(() => expect(marcarTroca).toHaveBeenCalledTimes(1))
    const [escala, linha, colega, , turno] = marcarTroca.mock.calls[0]
    expect(escala.id).toBe('esc-hro')
    expect(linha.chave).toBe('uid-gio')
    expect(colega).toMatchObject({ uid: 'uid-mau', nome: 'MAURICIO MAHALEM BASTOS', tipo: 'entre_hospitais', motivo: 'congresso' })
    expect(turno).toBe('matutino')
    expect(executarSubstituicao).not.toHaveBeenCalled()
  })

  it('colega SEM posição publicada: infere assunção e mostra a pendência antes de executar', async () => {
    montar()
    await escolherColega('COLEGA DE FORA')
    await waitFor(() => expect(screen.getByText(TIPO_LABEL.assuncao)).toBeTruthy())
    // pendência visível — nunca meio swap calado (defeito D4)
    expect(screen.getByText(/não tem posição publicada/)).toBeTruthy()
    // e ainda dá para executar: o lado existente (Giovana) é assumido pelo colega
    fireEvent.click(screen.getByRole('button', { name: /Trocar agora/ }))
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    const [plan] = executarSubstituicao.mock.calls[0]
    expect(plan.lados).toHaveLength(1)
    expect(plan.lados[0].para.uid).toBe('uid-fora')
    expect(plan.lados[0].tipo).toBe('assuncao')
  })
})
