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
    adicionarAjuda: vi.fn(async () => {}),
    removerAjuda: vi.fn(async () => {}),
    setStatusCirurgia: vi.fn(async () => {}),
    setAnestesistaCasos: vi.fn(async () => {}),
  }),
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

const abrirDetalhe = () => {
  render(
    <MinhasEscalasView escala={escala} meuAlias="MELO" meuUid="uid-melo" turno="vespertino" onVerBoard={vi.fn()} />,
    { wrapper: wrap },
  )
  fireEvent.click(screen.getByRole('button', { name: /^Detalhes do caso/ }))
}

beforeEach(() => atualizarCaso.mockClear())

describe('Minhas — detalhe do caso vem COMPLETO', () => {
  it('traz o residente — a linha mostra o valor e o botão abre o seletor', () => {
    abrirDetalhe()
    expect(screen.getByText('Residente')).toBeTruthy()
    // sem residente escolhido, a linha diz "Sem residente" (é o valor, não um vazio)
    expect(screen.getByText('Sem residente')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Trocar residente' }))
    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.getByRole('option', { name: 'Augusto' })).toBeTruthy()
  })

  it('traz o tempo da cirurgia', () => {
    abrirDetalhe()
    // sem término informado a linha é um convite explícito, não um campo vazio
    fireEvent.click(screen.getByRole('button', { name: /Definir término/ }))
    expect(document.querySelector('[data-slot="termino-hora"]')).toBeTruthy()
  })

  it('traz "mudar de sala/local", o cirurgião e a marcação de ajuda', () => {
    abrirDetalhe()
    expect(screen.getByRole('button', { name: /Mudar de sala\/local/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Trocar cirurgião' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /como ajuda/i })).toBeTruthy()
  })

  it('editar pela Minhas grava no MESMO caminho da Completa', async () => {
    abrirDetalhe()
    fireEvent.click(screen.getByRole('button', { name: /Definir término/ }))
    // horário é campo mascarado: digitar 1800 → "18:00" e grava
    fireEvent.change(document.querySelector('[data-slot="termino-hora"]'), { target: { value: '1800' } })
    // mesma action de context que a Completa usa — é o que mantém as abas juntas
    expect(atualizarCaso).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'e1' }), 'c1', { terminoPrevisto: '18:00' },
    )
  })
})
