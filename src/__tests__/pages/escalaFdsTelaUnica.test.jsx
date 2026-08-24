/**
 * FIM DE SEMANA — tela única (dono 24/08).
 *
 * A escala de sáb/dom passa a ter UMA tela: a fila de liberação. Sem abas, sem
 * seletor de hospital, com o card trazendo hospital · sala · cirurgiões e o
 * botão "Terminei", e com o painel da linha ganhando Hospital, Responsável e
 * Posição na fila.
 *
 * ⚠️ O DIA ÚTIL não pode mudar — as três abas e o seletor de hospital seguem lá.
 * Só o recado do plantonista e o botão "Importar" atravessam para os dois.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'
import BarraControles from '@/pages/escala-cirurgica/BarraControles'

vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({
  default: { fetchLocaisHospital: vi.fn(async () => []), fetchAvisos: vi.fn(async () => []) },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u1', displayName: 'Guilherme' } }),
}))
vi.mock('@/pages/escala-cirurgica/useAvisoPlantonista', () => ({
  default: () => ({ avisos: [], enviarAviso: vi.fn(), confirmarAviso: vi.fn(), excluirAviso: vi.fn(), historico: [], podeAvisar: true }),
}))
const ROSTER = [
  { uid: 'uid-karine', nome: 'KARINE BEDIN', apelidos: ['KARINE'] },
  { uid: 'uid-marilia', nome: 'MARILIA BASTOS', apelidos: ['MARILIA'] },
]
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: ROSTER, loading: false,
    rosterByUid: new Map(ROSTER.map((r) => [r.uid, r])),
    options: ROSTER.map((r) => ({ value: r.uid, label: r.nome })),
    resolver: (n) => ROSTER.find((r) => r.apelidos.includes(String(n).toUpperCase()))?.uid || null,
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

// escala da FILA ÚNICA: a linha 'fds' não tem casos — eles vêm por hospital
const ESCALA_FDS = {
  id: 'fds-1', hospital: 'fds',
  ordemLiberacao: { matutino: ['KARINE', 'GABRIEL'] },
  liberacoes: {}, linhaOverrides: {},
  casos: [],
}
const CASOS_FDS = [
  { id: 'c1', sala: 'CC - Sala 3', ordem: 0, hora: '07:30', turno: 'matutino', anestesista: 'KARINE', cirurgiao: 'Lucas Martins', procedimento: 'TROCA VALVAR', hospitalOrigem: 'unimed' },
  { id: 'c2', sala: 'Sala 4', ordem: 0, hora: '07:00', turno: 'matutino', anestesista: 'GABRIEL', cirurgiao: 'Plantao Orto', procedimento: 'CLAVICULA', hospitalOrigem: 'hro' },
]
const props = (extra = {}) => ({
  escala: ESCALA_FDS, hospital: 'fds', hospitalLabel: 'Fim de semana',
  canEdit: true, turno: 'matutino', modoFds: true, casosFds: CASOS_FDS,
  fdsMeta: { grade: {}, posicoes: {} },
  onToggle: vi.fn(), ...extra,
})

beforeEach(() => vi.clearAllMocks())

describe('barra de controles — o fim de semana perde os eixos que não tem', () => {
  const base = {
    opcoesData: [{ value: 'hoje', label: 'Hoje' }], modoData: 'hoje', onEscolherData: vi.fn(),
    turnoOpcoes: [{ value: 'matutino', label: 'Manhã' }, { value: 'vespertino', label: 'Tarde' }],
    turno: 'matutino', onEscolherTurno: vi.fn(),
    hospital: 'unimed', onEscolherHospital: vi.fn(), aba: 'liberacoes', onEscolherAba: vi.fn(),
  }
  const HOSP = [{ value: 'unimed', label: 'Unimed' }, { value: 'hro', label: 'HRO' }]
  const ABAS = [{ value: 'minhas', label: 'Minhas' }, { value: 'board', label: 'Completa' }]

  it('no DIA ÚTIL hospital e abas continuam na tela', () => {
    render(<BarraControles {...base} hospitalOpcoes={HOSP} abaOpcoes={ABAS} />, { wrapper: wrap })
    expect(screen.getByRole('tab', { name: 'Unimed' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Completa' })).toBeTruthy()
  })

  it('no FIM DE SEMANA os dois somem — a fila é única e a tela é uma só', () => {
    render(<BarraControles {...base} hospitalOpcoes={null} abaOpcoes={null} />, { wrapper: wrap })
    expect(screen.queryByRole('tab', { name: 'Unimed' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Completa' })).toBeNull()
    // o turno continua: ele é o eixo que sobra
    expect(screen.getByRole('tab', { name: 'Manhã' })).toBeTruthy()
  })
})

describe('card da fila — hospital isolado, sala abaixo, cirurgiões depois', () => {
  it('mostra o hospital da pessoa em linha própria', async () => {
    render(<LiberacoesView {...props()} />, { wrapper: wrap })
    expect(await screen.findByText(/Karine/)).toBeTruthy()
    // hospital derivado dos casos: Karine na Unimed, Gabriel no HRO
    expect(screen.getByText('Unimed')).toBeTruthy()
    expect(screen.getByText('HRO')).toBeTruthy()
  })

  it('o cirurgião continua abaixo, e a sala entre os dois', async () => {
    render(<LiberacoesView {...props()} />, { wrapper: wrap })
    expect(await screen.findByText('Lucas Martins')).toBeTruthy()
    expect(screen.getByText('CC - Sala 3')).toBeTruthy()
  })
})

describe('Terminei — encerra as cirurgias abertas da pessoa', () => {
  it('aparece em quem tem cirurgia e manda os ids dela', async () => {
    const onTerminarCasos = vi.fn(async () => {})
    render(<LiberacoesView {...props({ onTerminarCasos })} />, { wrapper: wrap })
    const botoes = await screen.findAllByText('Terminei')
    expect(botoes.length).toBe(2) // as duas pessoas têm cirurgia aberta
    fireEvent.click(botoes[0].closest('button'))
    await waitFor(() => expect(onTerminarCasos).toHaveBeenCalled())
    // manda SÓ os casos daquela pessoa
    expect(onTerminarCasos.mock.calls[0][0]).toEqual(['c1'])
  })

  it('NÃO aparece em quem está sem cirurgia — não há o que encerrar', async () => {
    const semCasos = { ...ESCALA_FDS, ordemLiberacao: { matutino: ['KARINE', 'GABRIEL', 'OSCAR'] } }
    render(<LiberacoesView {...props({ escala: semCasos, onTerminarCasos: vi.fn() })} />, { wrapper: wrap })
    await screen.findByText('Oscar')
    // 3 na fila, 2 com cirurgia
    expect(screen.getAllByText('Terminei').length).toBe(2)
  })

  it('é OUTRO controle que o círculo de liberar (lição de 20/08)', async () => {
    const onToggle = vi.fn()
    const onTerminarCasos = vi.fn(async () => {})
    render(<LiberacoesView {...props({ onToggle, onTerminarCasos })} />, { wrapper: wrap })
    fireEvent.click((await screen.findAllByText('Terminei'))[0].closest('button'))
    await waitFor(() => expect(onTerminarCasos).toHaveBeenCalled())
    expect(onToggle).not.toHaveBeenCalled()
  })
})

describe('painel da linha — Hospital, Responsável e Posição só na fila única', () => {
  const abrirPainel = async (extra = {}) => {
    render(<LiberacoesView {...props(extra)} />, { wrapper: wrap })
    const editar = (await screen.findAllByRole('button', { name: /Editar local\/cirurgião/ }))[0]
    fireEvent.click(editar)
    return screen.findByText('Observação')
  }

  it('traz os três assuntos novos', async () => {
    await abrirPainel({ onTrocarResponsavel: vi.fn(), onTrocarPosicao: vi.fn() })
    expect(screen.getByText('Hospital')).toBeTruthy()
    expect(screen.getByText('Responsável')).toBeTruthy()
    expect(screen.getByText('Posição na fila')).toBeTruthy()
  })

  it('trocar o responsável mantém a CHAVE do slot — a posição não se move', async () => {
    const onTrocarResponsavel = vi.fn(async () => {})
    await abrirPainel({ onTrocarResponsavel })
    fireEvent.click(screen.getByText('Responsável'))
    const combo = screen.getAllByRole('combobox').pop()
    fireEvent.click(combo)
    fireEvent.click(await screen.findByText('MARILIA BASTOS'))
    fireEvent.click(screen.getByRole('button', { name: /Trocar responsável/ }))
    await waitFor(() => expect(onTrocarResponsavel).toHaveBeenCalled())
    const arg = onTrocarResponsavel.mock.calls[0][0]
    expect(arg.para.uid).toBe('uid-marilia')
    // a chave é a do slot ORIGINAL: marcações e ordem publicada seguem valendo
    expect(arg.chaveSlot).toBe('uid-karine')
    expect(arg.casoIds).toEqual(['c1'])
  })

  it('o seletor de Local NÃO abre vazio no fim de semana (defeito de 24/08)', async () => {
    await abrirPainel()
    fireEvent.click(screen.getByText('Local'))
    const combo = screen.getAllByRole('combobox').pop()
    fireEvent.click(combo)
    // a lista traz salas dos TRÊS hospitais quando nenhum foi escolhido
    // CC - Sala 1 é da Unimed e não está em nenhum caso do dia: só pode ter vindo
    // da base dos três hospitais, que é justamente o que faltava
    expect(await screen.findByText('CC - Sala 1')).toBeTruthy()
    // Sala 4 é do HRO e aparece DUAS vezes: no card do Gabriel e na lista
    expect(screen.getAllByText('Sala 4').length).toBeGreaterThan(1)
  })
})
