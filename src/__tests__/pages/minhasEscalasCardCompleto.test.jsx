/**
 * O card do caso na aba "Minhas" é o MESMO da "Completa" (dono 29/07).
 *
 * Bug: `MinhasEscalasView` abria o `CasoDetalheSheet` sem a prop `podeEditar`, e
 * dentro do sheet TUDO que edita é gated em `podeEditarCaso`. Resultado: pela
 * Minhas o detalhe vinha pela metade — sem residente, sem tempo da cirurgia, sem
 * ajuda e sem "mudar de sala/local" — enquanto pela Completa vinha completo. Como a
 * Minhas não deixava editar, "mudar numa aba e ver na outra" também não fechava.
 *
 * As três abas usam o MESMO componente de detalhe: a diferença entre elas tem de
 * ser só QUAIS casos a lista mostra.
 *
 * REDESENHO 17/08 ("Andamento no topo"): residente, cirurgião e tempo passaram a
 * abrir o editor a partir da linha que mostra o valor atual — o painel deixou de
 * empilhar três seletores abertos. O que estes testes travam continua sendo o
 * mesmo: pela Minhas o detalhe chega COMPLETO e grava pelo mesmo caminho.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import MinhasEscalasView from '@/pages/escala-cirurgica/MinhasEscalasView'

const { atualizarCaso } = vi.hoisted(() => ({ atualizarCaso: vi.fn(async () => {}) }))

vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({
    atualizarCaso,
    // o formulário do caso (aberto pela porta "Editar dados da cirurgia") usa
    // estas três; sem elas o destructuring quebra na montagem
    adicionarCaso: vi.fn(async () => ({})),
    excluirCaso: vi.fn(async () => {}),
    definirSalasUrgencia: vi.fn(async () => {}),
    adicionarAjuda: vi.fn(async () => {}),
    removerAjuda: vi.fn(async () => {}),
    setStatusCirurgia: vi.fn(async () => {}),
    setAnestesistaCasos: vi.fn(async () => {}),
  }),
  // o hook das urgências lê `hoje` do context (fonte única desde 21/08)
  useEscalaCirurgica: () => ({ hoje: '2026-08-18', escalas: {}, data: '2026-08-18', loading: false }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
// anestesiologista está em PAPEIS_COM_ACESSO do gate → canEdit verdadeiro
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'uid-melo', role: 'anestesiologista', displayName: 'Melo' } }),
}))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    options: [{ value: 'uid-melo', label: 'Guilherme Melo' }],
    rosterByUid: new Map([['uid-melo', { uid: 'uid-melo', nome: 'GUILHERME MELO', apelidos: ['MELO'] }]]),
    resolver: () => null,
    loading: false,
  }),
}))
vi.mock('@/hooks/useRosterResidentes', () => ({
  default: () => ({
    residentes: [{ uid: 'uid-augusto', nome: 'Augusto' }],
    residenteByUid: new Map([['uid-augusto', { uid: 'uid-augusto', nome: 'Augusto' }]]),
    options: [{ value: 'uid-augusto', label: 'Augusto' }],
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const caso = {
  id: 'c1', sala: 'Bloco M - Sala 3', ordem: 0, hora: '16:00', turno: 'vespertino',
  pacienteIniciais: 'E.G.', idade: '23', procedimento: 'FRATURA DA TÍBIA',
  cirurgiao: 'VITOR BRIESE', anestesista: 'MELO', anestesistaUserId: 'uid-melo',
  convenio: 'FAS', statusCirurgia: 'agendada',
}
const escala = { id: 'e1', hospital: 'hro', data: '2026-07-29', ajudaExterna: {}, casos: [caso] }

const abrirDetalhe = (c = caso) => {
  render(
    <MinhasEscalasView escala={{ ...escala, casos: [c] }} meuAlias="MELO" meuUid="uid-melo"
      turno="vespertino" onVerBoard={vi.fn()} />,
    { wrapper: wrap },
  )
  fireEvent.click(screen.getByRole('button', { name: /^Detalhes do caso/ }))
}

beforeEach(() => atualizarCaso.mockClear())

describe('Minhas — detalhe do caso vem COMPLETO', () => {
  it('traz o residente na leitura do painel', () => {
    // desde 01/09 a linha é LEITURA (o seletor foi para o formulário do caso) e,
    // como toda linha do cartão, some quando não há valor — antes ela mostrava
    // "Sem residente" porque carregava o botão de trocar
    abrirDetalhe({ ...caso, residente: 'Augusto', residenteUserId: 'uid-augusto' })
    expect(screen.getByText('Residente')).toBeTruthy()
    expect(screen.getByText('Augusto')).toBeTruthy()
  })

  it('traz o tempo da cirurgia', () => {
    abrirDetalhe()
    // sem término informado a linha é um convite explícito, não um campo vazio
    fireEvent.click(screen.getByRole('button', { name: /Definir término/ }))
    expect(screen.getByRole('button', { name: '1h30' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Horário de término' }))
    expect(document.querySelector('[data-slot="termino-hora"]')).toBeTruthy()
  })

  it('traz a sala/local, o cirurgião e a marcação de ajuda', () => {
    abrirDetalhe()
    expect(screen.getByText('Sala/local')).toBeTruthy()
    expect(screen.getByText('Cirurgião')).toBeTruthy()
    expect(screen.getByRole('button', { name: /como ajuda/i })).toBeTruthy()
  })

  // A razão de existir deste arquivo (dono 29/07): a Minhas não pode ser a aba
  // "pela metade". Quando os dados do caso saíram do painel para o formulário
  // (01/09), a porta tinha de vir junto — um botão que só funciona na Completa
  // recria exatamente o beco sem saída que este describe trava.
  it('a porta para EDITAR o caso existe também aqui, e abre o formulário', async () => {
    abrirDetalhe()
    fireEvent.click(screen.getByRole('button', { name: /Editar dados da cirurgia/i }))
    expect(await screen.findByText('Editar caso')).toBeTruthy()
    // preenchido com o caso, não em branco
    expect(screen.getByDisplayValue('FRATURA DA TÍBIA')).toBeTruthy()
  })

  it('editar pela Minhas grava no MESMO caminho da Completa', async () => {
    abrirDetalhe()
    fireEvent.click(screen.getByRole('button', { name: /Definir término/ }))
    fireEvent.click(screen.getByRole('tab', { name: 'Horário de término' }))
    // horário é campo mascarado: digitar 1800 → "18:00" e grava
    fireEvent.change(document.querySelector('[data-slot="termino-hora"]'), { target: { value: '1800' } })
    // mesma action de context que a Completa usa — é o que mantém as abas juntas
    expect(atualizarCaso).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'e1' }), 'c1', { terminoPrevisto: '18:00' },
    )
  })
})
