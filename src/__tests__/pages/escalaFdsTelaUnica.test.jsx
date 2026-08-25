/**
 * FIM DE SEMANA — tela única (dono 24/08).
 *
 * A escala de sáb/dom passa a ter UMA tela: a fila de liberação. Sem abas, sem
 * seletor de hospital, com o card trazendo hospital · sala · cirurgiões e o
 * botão "Terminei", e com o painel da linha ganhando Hospital, Responsável e
 * Posição na fila.
 *
 * ⚠️ O DIA ÚTIL NÃO MUDA — NADA daqui atravessa (dono 24/08, 2ª mensagem:
 * "faça apenas o solicitado sem alterar a escala de dias úteis"). Na primeira
 * versão o recado do plantonista, o botão "Importar", o "Terminei", a pastilha
 * "Assumir" e a nova ordem do card foram adotados também no dia útil; o dono
 * recusou. O describe do fim do arquivo é a trava da FRONTEIRA — ela já foi
 * cruzada uma vez.
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

/**
 * ⚠️ O "Terminei" FOI RETIRADO (dono 24/08, 3ª decisão sobre ele). O caminho foi:
 * criado como botão da linha para encerrar de uma vez as cirurgias em aberto →
 * restrito à fila única ("não altere a escala de dias úteis") → removido, com a
 * coluna de ações voltando a ser tempo + Editar, como no dia útil.
 *
 * Esta trava fica no lugar dos três testes que exercitavam o botão, para que a
 * remoção não pareça um esquecimento e para que ele não volte sem decisão: o
 * encerramento de cirurgia é no detalhe do caso, uma a uma.
 */
describe('sem "Terminei" na fila — a cirurgia se encerra no detalhe', () => {
  it('a coluna de ações tem só tempo e Editar', async () => {
    render(<LiberacoesView {...props()} />, { wrapper: wrap })
    await screen.findByText(/Karine/)
    expect(screen.queryByText('Terminei')).toBeNull()
    expect(screen.queryByText('Encerrando…')).toBeNull()
    // o que fica é a mesma dupla do dia útil
    expect(screen.getAllByText('Editar').length).toBeGreaterThan(0)
    expect(screen.getAllByText('+ Tempo total').length).toBeGreaterThan(0)
  })
})

describe('alinhamento do card — número e círculo na linha do nome', () => {
  it('o card alinha pelo TOPO, não pelo centro', async () => {
    const { container } = render(<LiberacoesView {...props()} />, { wrapper: wrap })
    await screen.findByText(/Karine/)
    const card = container.querySelector('[data-linha]')
    expect(card.className).toContain('items-start')
    expect(card.className).not.toContain('items-center')
  })

  it('o bloco de texto também alinha pelo topo — senão o hospital descola do nome', async () => {
    const { container } = render(<LiberacoesView {...props()} />, { wrapper: wrap })
    await screen.findByText(/Karine/)
    const card = container.querySelector('[data-linha]')
    const interno = card.querySelector('[class*="justify-between"]')
    expect(interno.className).toContain('items-start')
  })
})

describe('alerta de sem anestesista — compacto', () => {
  const COM_ORFA = [...CASOS_FDS, {
    id: 'c9', sala: 'CO - Sala 3', ordem: 0, hora: '11:00', turno: 'matutino',
    anestesista: '?', semAnestesista: true, procedimento: 'CESARIANA',
    cirurgiao: 'Carlos Yora', hospitalOrigem: 'unimed',
  }]

  it('NÃO repete "Sem anestesista" dentro do card: o título logo acima já diz', async () => {
    render(<LiberacoesView {...props({ casosFds: COM_ORFA })} />, { wrapper: wrap })
    // o título da seção existe...
    expect(await screen.findByText(/Procedimentos sem anestesista/)).toBeTruthy()
    // ...e o badge dentro do card não: era a mesma frase duas vezes, e ele
    // empurrava a sala para a esquerda além de somar altura
    expect(screen.queryByText('Sem anestesista')).toBeNull()
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

// ════════════════════════════════════════════════════════════════════════════
// A FRONTEIRA: o que é do fim de semana FICA no fim de semana (dono 24/08)
// ════════════════════════════════════════════════════════════════════════════
describe('o desenho da fila única não atravessa para o dia útil', () => {
  // mesma escala e mesmos casos, só que como um dia útil: um hospital, sem modoFds
  const ESCALA_UTIL = {
    id: 'e-util', hospital: 'unimed',
    ordemLiberacao: { matutino: ['KARINE', 'GABRIEL'] },
    liberacoes: {}, linhaOverrides: {},
    casos: [
      { id: 'c1', sala: 'CC - Sala 3', ordem: 0, hora: '07:30', turno: 'matutino', anestesista: 'KARINE', cirurgiao: 'Lucas Martins', procedimento: 'TROCA VALVAR' },
      { id: 'c2', sala: 'CC - Sala 4', ordem: 0, hora: '07:00', turno: 'matutino', anestesista: 'GABRIEL', cirurgiao: 'Plantao Orto', procedimento: 'CLAVICULA' },
    ],
  }
  const utilProps = (extra = {}) => ({
    escala: ESCALA_UTIL, hospital: 'unimed', hospitalLabel: 'Unimed',
    canEdit: true, turno: 'matutino', onToggle: vi.fn(), ...extra,
  })

  it('sem "Terminei" — no dia útil a cirurgia se encerra no detalhe, uma a uma', async () => {
    render(<LiberacoesView {...utilProps({ onTerminarCasos: vi.fn() })} />, { wrapper: wrap })
    await screen.findByText(/Karine/i)
    expect(screen.queryByText('Terminei')).toBeNull()
  })



  it('sem anestesista: volta a frase de sempre, não a pastilha "Assumir"', async () => {
    const escala = {
      ...ESCALA_UTIL,
      casos: [
        ...ESCALA_UTIL.casos,
        { id: 'c9', sala: 'CC - Sala 9', ordem: 0, hora: '08:00', turno: 'matutino', anestesista: '?', semAnestesista: true, procedimento: 'HERNIA', cirurgiao: 'Dr. X' },
      ],
    }
    render(<LiberacoesView {...utilProps({ escala, onDefinirCasos: vi.fn() })} />, { wrapper: wrap })
    expect(await screen.findByText(/Toque para definir o anestesista/)).toBeTruthy()
    expect(screen.queryByText('Assumir')).toBeNull()
  })

  it('a sala fica ABAIXO do cirurgião, e o hospital não aparece no card', async () => {
    const { container } = render(<LiberacoesView {...utilProps()} />, { wrapper: wrap })
    // a chave da linha é o uid do vínculo quando o dicionário resolve
    await screen.findByText(/Lucas Martins/)
    const card = container.querySelector('[data-linha="uid-karine"]')
    expect(card).toBeTruthy()
    // compara as FOLHAS (elemento sem filho elemento): comparar textContent de
    // qualquer nó acharia primeiro um ancestral, que contém as duas coisas e
    // deixaria o teste passar com qualquer ordem
    const folhas = [...card.querySelectorAll('p, span, div')].filter((e) => !e.querySelector('*'))
    const cir = folhas.find((e) => e.textContent.includes('Lucas Martins'))
    const sala = folhas.find((e) => e.textContent.trim() === 'CC - Sala 3')
    expect(cir).toBeTruthy()
    expect(sala).toBeTruthy()
    // DOCUMENT_POSITION_PRECEDING = o cirurgião vem ANTES da sala
    expect(sala.compareDocumentPosition(cir) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    // hospital em linha própria é do fim de semana: aqui a tela toda é de um só
    expect(card.textContent).not.toMatch(/UNIMED/)
  })
})
