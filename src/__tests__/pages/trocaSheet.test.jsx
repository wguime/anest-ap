/**
 * TrocaSheet — o FLUXO ÚNICO de troca (dono 07/08: "num só local, fáceis de
 * executar e intuitivas"). Estes testes travam o contrato:
 *   1. a ORIGEM de cada um é CONFIRMADA, nunca assumida (dono 09/08): a escala
 *      pode ser publicada JÁ com os nomes trocados de posição — supor que o
 *      nome achado no rodapé marca a origem devolvia cada um ao hospital de
 *      onde saiu (caso Garim⇄Rafael, escalas de 10/08 pela manhã);
 *   2. o TIPO é INFERIDO pela geografia dos slots CONFIRMADOS e pré-selecionado;
 *   3. "Trocar agora" executa DIRETO (assumidaPor com tipo+motivo);
 *   4. só metade confirmada não executa (meio swap calado = defeito D4);
 *   5. não existe mais "Declarar para depois" (dono 09/08) — o sheet nunca
 *      grava trocaCom;
 *   6. a própria pessoa não aparece no seletor de colega.
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
  <TrocaSheet linha={LINHA_GIOVANA} turno="matutino" onClose={vi.fn()} {...props} />,
  { wrapper: wrap },
)

const escolherColega = async (nome) => {
  fireEvent.click(screen.getByRole('combobox'))
  fireEvent.click(await screen.findByRole('option', { name: nome }))
}
const marcarOrigem = (nomeChip) => fireEvent.click(screen.getByRole('button', { name: nomeChip }))
/** "Não sai daqui" existe por pessoa: 0 = quem abriu o sheet, 1 = o colega */
const naoSai = (indice) => fireEvent.click(screen.getAllByRole('button', { name: 'Não sai daqui' })[indice])
const botaoTrocar = () => screen.getByRole('button', { name: /Trocar agora/ })

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

  it('as posições NÃO vêm pré-marcadas: sem confirmar a origem não dá para trocar', async () => {
    montar()
    await escolherColega('MAURICIO MAHALEM BASTOS')
    await screen.findByText('De onde cada um sai?')
    expect(botaoTrocar()).toBeDisabled()
    // só um lado confirmado ainda não executa (meio swap calado — defeito D4)
    marcarOrigem('HRO · manhã')
    expect(botaoTrocar()).toBeDisabled()
  })

  it('par completo entre hospitais: confirmadas as origens, infere o tipo e mostra os 2 lados', async () => {
    montar()
    await escolherColega('MAURICIO MAHALEM BASTOS')
    marcarOrigem('HRO · manhã')
    marcarOrigem('Unimed · manhã')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: TIPO_LABEL.entre_hospitais })).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.getByText(/assume a posição de Giovana/i)).toBeTruthy()
    expect(screen.getByText(/assume a posição de Mauricio/i)).toBeTruthy()
  })

  it('"Trocar agora" executa com tipo e motivo DENTRO dos lados — e nunca declara', async () => {
    montar()
    await escolherColega('MAURICIO MAHALEM BASTOS')
    marcarOrigem('HRO · manhã')
    marcarOrigem('Unimed · manhã')
    fireEvent.change(screen.getByPlaceholderText(/plantão trocado/), { target: { value: 'plantão' } })
    fireEvent.click(botaoTrocar())
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    const [plan] = executarSubstituicao.mock.calls[0]
    expect(plan.lados).toHaveLength(2)
    for (const l of plan.lados) {
      expect(l.tipo).toBe('entre_hospitais')
      expect(l.motivo).toBe('plantão')
    }
    expect(marcarTroca).not.toHaveBeenCalled()
  })

  it('"Declarar para depois" não existe mais (dono 09/08)', async () => {
    montar()
    await escolherColega('MAURICIO MAHALEM BASTOS')
    expect(screen.queryByRole('button', { name: /Declarar para depois/ })).toBeNull()
  })

  it('escala publicada JÁ trocada: os dois "não saem daqui" e não há o que executar', async () => {
    // caso real 10/08 — a secretária publicou Garim no lugar do Rafael e vice-versa;
    // executar aqui devolveria cada um ao hospital de origem, desfazendo a troca
    montar()
    await escolherColega('MAURICIO MAHALEM BASTOS')
    naoSai(0)
    naoSai(1)
    await waitFor(() => expect(screen.getByText(/Nada a executar/i)).toBeTruthy())
    expect(botaoTrocar()).toBeDisabled()
    fireEvent.click(botaoTrocar())
    expect(executarSubstituicao).not.toHaveBeenCalled()
  })

  it('metade já publicada trocada: executa SÓ a posição confirmada', async () => {
    montar()
    await escolherColega('MAURICIO MAHALEM BASTOS')
    naoSai(0)                       // Giovana já está no lugar certo
    marcarOrigem('Unimed · manhã')  // a vaga do Maurício é que passa
    fireEvent.click(botaoTrocar())
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    const [plan] = executarSubstituicao.mock.calls[0]
    expect(plan.lados).toHaveLength(1)
    expect(plan.lados[0].hospital).toBe('unimed')
    expect(plan.lados[0].para.uid).toBe('uid-gio')
    expect(plan.lados[0].tipo).toBe('assuncao')
  })

  it('colega SEM posição publicada: avisa e executa o lado que existe', async () => {
    montar()
    await escolherColega('COLEGA DE FORA')
    expect(await screen.findByText(/não tem posição a deixar/i)).toBeTruthy()
    marcarOrigem('HRO · manhã')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: TIPO_LABEL.assuncao })).toHaveAttribute('aria-pressed', 'true'))
    fireEvent.click(botaoTrocar())
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    const [plan] = executarSubstituicao.mock.calls[0]
    expect(plan.lados).toHaveLength(1)
    expect(plan.lados[0].para.uid).toBe('uid-fora')
    expect(plan.lados[0].tipo).toBe('assuncao')
  })
})
