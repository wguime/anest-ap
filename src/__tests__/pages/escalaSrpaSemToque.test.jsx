/**
 * SRPA na Completa: só o horário de início, sem toque (dono 26/10).
 *
 * "esse card não deve ser clicável, deve apenas informar o horário de início [...]
 * ao clicar, nada deve acontecer pois quem está nessa posição sempre assume ela às
 * 09:00h até as 13:00h, mesmo acontece a tarde (13:00 as 19:00h) e a noite (19:00h
 * as 22:00h)". O toque abria o detalhe de cirurgia (Iniciada/Terminada) para uma
 * posição de horário fixo.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import BoardView from '@/pages/escala-cirurgica/BoardView'
import { horaInicioSrpa, ehPosicaoSrpa } from '@/lib/escalaCirurgicaItens'

vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({
    atualizarCaso: vi.fn(async () => {}),
    setStatusCirurgia: vi.fn(async () => {}),
    setAnestesistaCasos: vi.fn(async () => {}),
    adicionarAjuda: vi.fn(async () => {}),
    removerAjuda: vi.fn(async () => {}),
  }),
  useEscalaCirurgica: () => ({ hoje: '2026-08-18', escalas: {}, data: '2026-08-18', loading: false }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'uid-melo', role: 'anestesiologista', displayName: 'Melo' } }),
}))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({ options: [], rosterByUid: new Map(), resolver: () => null, loading: false }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const SRPA_MANHA = { id: 's-m', sala: 'SRPA', bloco: 'srpa', ordem: 90, hora: '09:00', turno: 'matutino', anestesista: 'KLISMAN' }
const SRPA_TARDE = { id: 's-t', sala: 'SRPA', bloco: 'srpa', ordem: 90, hora: '', turno: 'vespertino', anestesista: 'DIEGO' }
const CIRURGIA = (turno, hora) => ({
  id: `c-${turno}`, sala: 'CENTRO CIRÚRGICO - SALA 1', ordem: 1, hora, turno, pacienteIniciais: 'A.J.G.',
  procedimento: 'VARIZES - TRATAMENTO CIRURGICO BILATERAL', cirurgiao: 'MARIO GOTO', anestesista: 'RODNEI',
  convenio: 'UNIMED CHAPECO - VD', statusCirurgia: 'agendada',
})
const escala = { id: 'e1', hospital: 'unimed', data: '2026-10-26', ajudaExterna: {}, casos: [SRPA_MANHA, SRPA_TARDE, CIRURGIA('matutino', '07:30'), CIRURGIA('vespertino', '13:30')] }

const renderBoard = (turno) => render(<BoardView escala={escala} meuAlias="MELO" meuUid="uid-melo" turno={turno} />, { wrapper: wrap })

describe('SRPA na Completa', () => {
  it('manhã: mostra 09:00 e não é botão (só a cirurgia abre detalhe)', () => {
    renderBoard('matutino')
    expect(screen.getByText('09:00')).toBeTruthy()
    const botoes = screen.getAllByRole('button', { name: /^Detalhes do caso/ })
    expect(botoes).toHaveLength(1)
    expect(botoes[0].getAttribute('aria-label')).toMatch(/07:30/)
    expect(screen.getByText('09:00').closest('button')).toBeNull()
  })

  it('tocar no horário da SRPA não abre nada', () => {
    renderBoard('matutino')
    fireEvent.click(screen.getByText('09:00'))
    expect(screen.queryByText('Andamento')).toBeNull()
  })

  it('tarde: a SRPA sem hora gravada mostra 13:00, também sem toque', () => {
    renderBoard('vespertino')
    expect(screen.getByText('13:00').closest('button')).toBeNull()
    expect(screen.getAllByRole('button', { name: /^Detalhes do caso/ })).toHaveLength(1)
  })
})

describe('horário de início da SRPA pelo turno exibido', () => {
  it('09:00 · 13:00 · 19:00, e a noite vence a hora gravada da tarde', () => {
    expect(horaInicioSrpa({}, 'matutino')).toBe('09:00')
    expect(horaInicioSrpa({}, 'vespertino')).toBe('13:00')
    expect(horaInicioSrpa({ hora: '13:00' }, 'noturno')).toBe('19:00')
  })

  it('hora escrita no mapa vale de dia', () => {
    expect(horaInicioSrpa({ hora: '10:00' }, 'matutino')).toBe('10:00')
  })

  it('só a SRPA: caso clínico na sala SRPA e o Consultório do HRO ficam de fora', () => {
    expect(ehPosicaoSrpa(SRPA_MANHA)).toBe(true)
    expect(ehPosicaoSrpa({ sala: 'SRPA', procedimento: 'BLOQUEIO', cirurgiao: 'X' })).toBe(false)
    expect(ehPosicaoSrpa({ sala: 'Consultório', posicaoAssistencial: true })).toBe(false)
  })
})
