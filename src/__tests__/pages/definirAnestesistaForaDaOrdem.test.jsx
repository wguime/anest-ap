/**
 * Trocar o anestesista de uma URGÊNCIA para alguém fora da ordem (dono 15/10/2026,
 * modelo A). Mesmo diálogo do "Adicionar caso"; na cirurgia eletiva (repasse de
 * sala no fim do turno, rotina) nada muda.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import DefinirAnestesistaSheet from '@/pages/escala-cirurgica/DefinirAnestesistaSheet'

const { setAnestesistaCasos, executarSubstituicao, ROSTER, escalas } = vi.hoisted(() => {
  const ROSTER = new Map([
    ['u-dani', { uid: 'u-dani', nome: 'DANIELA REIS', apelidos: ['DANIELA'] }],
    ['u-kar', { uid: 'u-kar', nome: 'KARINE BEDIN', apelidos: ['KARINE'] }],
    ['u-raf', { uid: 'u-raf', nome: 'RAFAEL PELISSARO', apelidos: ['RAFAEL'] }],
  ])
  const urg = { id: 'c-urg', sala: 'Sala 5', ordem: 0, hora: '', turno: 'matutino', statusCirurgia: 'agendada', tipo: 'urgencia', anestesista: 'DANIELA', anestesistaUserId: 'u-dani', cirurgiao: 'Rubin' }
  const hro = {
    id: 'hro', hospital: 'hro', data: '2026-10-15', linhaOverrides: {},
    ordemLiberacao: { matutino: ['DANIELA', 'KARINE'] }, ajudaExterna: { matutino: [] }, liberacoes: {},
    casos: [urg, { id: 'c-kar', sala: 'Sala 2', turno: 'matutino', anestesista: 'KARINE', anestesistaUserId: 'u-kar', statusCirurgia: 'terminada', terminoReal: '11:19' }],
  }
  const unimed = { id: 'uni', hospital: 'unimed', data: '2026-10-15', ordemLiberacao: { matutino: ['OSCAR', 'RAFAEL'] }, ajudaExterna: { matutino: [] }, liberacoes: {}, casos: [] }
  return {
    setAnestesistaCasos: vi.fn(async () => {}), executarSubstituicao: vi.fn(async () => {}),
    ROSTER, escalas: { hro, unimed },
  }
})
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ setAnestesistaCasos, executarSubstituicao }),
  useEscalaCirurgica: () => ({ hoje: '2026-10-15', escalas, data: '2026-10-15', loading: false }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ user: { uid: 'uid-eu' } }) }))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    options: [...ROSTER.values()].map((r) => ({ value: r.uid, label: r.nome })),
    rosterByUid: ROSTER,
    resolver: (nome) => [...ROSTER.values()].find((r) => r.apelidos.includes(String(nome || '').trim().toUpperCase()))?.uid || null,
    loading: false,
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>
const abrir = (caso = escalas.hro.casos[0]) => render(
  <DefinirAnestesistaSheet escala={escalas.hro} sala="Sala 5" casosAlvo={[caso]} turno="matutino" onClose={vi.fn()} />,
  { wrapper: wrap },
)
const escolherEConfirmar = (nome) => {
  fireEvent.click(screen.getByRole('button', { name: 'Escolher quem assume' }))
  fireEvent.click(screen.getByRole('option', { name: new RegExp(nome) }))
  fireEvent.click(screen.getByRole('button', { name: /Confirmar responsável/i }))
}

beforeEach(() => vi.clearAllMocks())

describe('Trocar o anestesista da urgência — fora da ordem (dono 15/10)', () => {
  it('passar a urgência ao Rafael (Unimed) com a Karine livre pede confirmação', () => {
    abrir()
    escolherEConfirmar('RAFAEL PELISSARO')
    expect(setAnestesistaCasos).not.toHaveBeenCalled()
    expect(screen.getByText('Confirmar Rafael fora da ordem?')).toBeTruthy()
    expect(screen.getByText(/O próximo a ser chamado é Karine/)).toBeTruthy()
  })

  it('"Usar Karine" passa a urgência para ela', async () => {
    abrir()
    escolherEConfirmar('RAFAEL PELISSARO')
    fireEvent.click(screen.getByRole('button', { name: /Usar Karine/ }))
    await waitFor(() => expect(setAnestesistaCasos).toHaveBeenCalled())
    expect(setAnestesistaCasos.mock.calls[0][2]).toEqual(expect.objectContaining({ uid: 'u-kar' }))
  })

  it('"Confirmar" passa para o Rafael', async () => {
    abrir()
    escolherEConfirmar('RAFAEL PELISSARO')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Rafael' }))
    await waitFor(() => expect(setAnestesistaCasos).toHaveBeenCalled())
    expect(setAnestesistaCasos.mock.calls[0][2]).toEqual(expect.objectContaining({ uid: 'u-raf' }))
  })

  it('cirurgia ELETIVA: repasse sem pergunta', async () => {
    abrir({ ...escalas.hro.casos[0], tipo: 'eletiva' })
    escolherEConfirmar('RAFAEL PELISSARO')
    await waitFor(() => expect(setAnestesistaCasos).toHaveBeenCalled())
    expect(screen.queryByText(/fora da ordem/)).toBeNull()
  })
})
