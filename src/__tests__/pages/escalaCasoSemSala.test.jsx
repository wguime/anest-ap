/**
 * CASO SEM SALA (dono 11/2026): "não seja obrigatório colocar a sala, já que nem sempre
 * ela está definida".
 *
 * O formulário deixou de exigir a sala (`addCasoSheet.test.jsx`). Aqui fica o que vem
 * DEPOIS de gravar: o caso tem de aparecer num grupo legível, e "sem sala" não pode se
 * comportar como UMA sala — é o que aconteceria sozinho, porque o quadro, a conta do
 * contrato de urgências e o "Falta início" agrupam pelo TEXTO da sala, e texto vazio é
 * igual a texto vazio.
 *
 *  1. Quadro: o grupo se chama "Sala a definir" (era um traço) e o ⚙ entrega os casos do
 *     grupo à folha — `c.sala === '—'` não casa com ninguém.
 *  2. Urgências do HRO: duas urgências sem sala são DUAS vagas do contrato, não uma.
 *  3. Horário pendente: uma cirurgia sem sala não é "a anterior" de outra sem sala.
 *  4. O botão que abre o formulário tem um nome só: "Adicionar caso".
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import BoardView from '@/pages/escala-cirurgica/BoardView'
import { estadoUrgencias } from '@/lib/escalaCirurgicaUrgencias'
import { pendenciasDoDia } from '@/lib/escalaHorarioPendente'

vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({
    atualizarCaso: vi.fn(async () => {}), setStatusCirurgia: vi.fn(async () => {}),
    setAnestesistaCasos: vi.fn(async () => {}), adicionarAjuda: vi.fn(async () => {}), removerAjuda: vi.fn(async () => {}),
  }),
  useEscalaCirurgica: () => ({ hoje: '2026-11-10', escalas: {}, data: '2026-11-10', loading: false }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'uid-melo', role: 'anestesiologista', displayName: 'Melo' } }),
}))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({ options: [], rosterByUid: new Map(), resolver: () => null, loading: false, roster: [] }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>
const HOJE = '2026-11-10'
const caso = (over = {}) => ({
  id: 'c1', sala: '', ordem: 0, hora: '14:00', turno: 'vespertino', pacienteIniciais: 'A.B.',
  procedimento: 'LAPAROTOMIA EXPLORADORA', cirurgiao: 'RENATO SA', anestesista: 'GABRIEL', convenio: 'SUS',
  tipo: 'urgencia', gravidade: 'urgente', statusCirurgia: 'agendada', origem: 'manual', ...over,
})
const board = (casos) => render(
  <BoardView escala={{ id: 'e1', hospital: 'unimed', data: HOJE, ajudaExterna: {}, casos }} meuAlias="MELO" meuUid="uid-melo" turno="vespertino" />,
  { wrapper: wrap },
)

describe('quadro — o caso sem sala aparece em "Sala a definir"', () => {
  it('o grupo tem nome, e a cirurgia está dentro dele', () => {
    board([caso(), caso({ id: 'c2', sala: 'CC - Sala 1', anestesista: 'ANA', procedimento: 'COLECISTECTOMIA' })])
    expect(screen.getByText('Sala a definir')).toBeTruthy()
    expect(screen.queryByText('—')).toBeNull()
    expect(screen.getByRole('button', { name: /^Detalhes do caso.*Laparotomia/i })).toBeTruthy()
  })

  it('o ⚙ do grupo abre a folha COM as cirurgias do grupo (não fica vazia)', () => {
    board([caso()])
    fireEvent.click(screen.getByRole('button', { name: 'Definir anestesista da sala a definir' }))
    const folha = screen.getByRole('dialog')
    expect(folha.textContent).toMatch(/Laparotomia exploradora/i)
  })

  it('o botão do quadro diz só "Adicionar caso" — o mesmo nome da outra aba e da folha', () => {
    board([caso()])
    expect(screen.getByRole('button', { name: 'Adicionar caso' })).toBeTruthy()
    expect(screen.queryByText(/urgência\/encaixe/)).toBeNull()
  })
})

describe('urgências do HRO — sem sala, cada cirurgia é uma vaga', () => {
  // anestesistas DIFERENTES: a mesma pessoa em duas cirurgias é uma vaga só, com ou sem sala
  const urg = (id, sala = '') => caso({ id, sala, anestesista: `ANEST ${id}`, turno: 'matutino', hora: null, statusCirurgia: 'iniciada', statusAtualizadoEm: `${HOJE}T09:00:00`, created_at: `${HOJE}T08:5${id.slice(-1)}:00` })
  const em = (casos) => estadoUrgencias(casos, { hospital: 'hro', agoraMin: 11 * 60, dataEscala: HOJE, hojeIso: HOJE, turno: 'matutino' })

  it('duas urgências sem sala ocupam plantão E sobreaviso', () => {
    const { postos } = em([urg('u1'), urg('u2')])
    expect(postos.filter((p) => p.item).length).toBe(2)
  })

  it('a mesma pessoa em duas urgências sem sala é UMA vaga (ninguém opera dois ao mesmo tempo)', () => {
    const { postos } = em([urg('u1'), { ...urg('u2'), anestesista: 'ANEST u1' }])
    expect(postos.filter((p) => p.item).length).toBe(1)
  })

  it('com sala, duas cirurgias na MESMA sala seguem sendo uma vaga só (regra de 21/08)', () => {
    const { postos } = em([urg('u1', 'Sala 5'), urg('u2', 'Sala 5')])
    expect(postos.filter((p) => p.item).length).toBe(1)
  })
})

describe('horário pendente — sem sala não encadeia', () => {
  const escala = (casos) => ({ hospital: 'unimed', data: HOJE, status: 'publicada', casos })
  const opts = { hoje: HOJE, agoraMin: 15 * 60, liberado: () => false }

  it('a cirurgia aberta de um colega, também sem sala, não segura o "Falta início" da minha', () => {
    const aberta = caso({ id: 'a', ordem: 0, hora: '13:00', anestesista: 'ANA', anestesistaUserId: 'uid-ana', statusCirurgia: 'iniciada', inicioReal: '13:05' })
    const minha = caso({ id: 'b', ordem: 1, hora: '14:00', anestesista: 'BRUNO', anestesistaUserId: 'uid-bruno' })
    // 15:00 = 14:00 + 30 min de tolerância, vencido
    expect(pendenciasDoDia([escala([aberta, minha])], opts).map((p) => p.caso.id)).toContain('b')
  })

  it('na MESMA sala de verdade, a anterior aberta continua segurando (regra de 27/10)', () => {
    const aberta = caso({ id: 'a', sala: 'CC - Sala 1', ordem: 0, hora: '13:00', anestesista: 'ANA', anestesistaUserId: 'uid-ana', statusCirurgia: 'iniciada', inicioReal: '13:05' })
    const minha = caso({ id: 'b', sala: 'CC - Sala 1', ordem: 1, hora: '14:00', anestesista: 'BRUNO', anestesistaUserId: 'uid-bruno' })
    expect(pendenciasDoDia([escala([aberta, minha])], opts).map((p) => p.caso.id)).not.toContain('b')
  })
})
