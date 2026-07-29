/**
 * AddCasoSheet — urgência/encaixe entra na escala publicada. O dono relatou
 * (29/07) "problema de salvar procedimento e anestesista": este teste exercita
 * o caminho real do formulário até o payload que vai para o banco.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import AddCasoSheet from '@/pages/escala-cirurgica/AddCasoSheet'

const { adicionarCaso } = vi.hoisted(() => ({
  adicionarCaso: vi.fn(async (_e, c) => ({ id: 'novo-1', ...c })),
}))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ adicionarCaso }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ user: { uid: 'u-1', displayName: 'Fulano' } }) }))
vi.mock('@/services/supabaseCirurgiasParticularesService', () => ({
  default: { completarPacienteDoCaso: vi.fn(async () => {}) },
}))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: [], aliases: [], loading: false,
    rosterByUid: new Map([['uid-cury', { uid: 'uid-cury', nome: 'MARCOS TADEU CURY', apelidos: ['CURY'] }]]),
    options: [{ value: 'uid-cury', label: 'Marcos Cury' }],
    resolver: () => null, refresh: vi.fn(), upsertAlias: vi.fn(), removeAlias: vi.fn(),
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>
const escala = { id: 'e1', hospital: 'hro', casos: [{ sala: 'Sala 2', ordem: 0 }] }

/** Escolhe uma opção num Select do DS (combobox → listbox → option). */
const escolher = (combo, nomeOpcao) => {
  fireEvent.click(combo)
  fireEvent.click(screen.getByRole('option', { name: nomeOpcao }))
}

beforeEach(() => adicionarCaso.mockClear())

describe('AddCasoSheet — salvar procedimento e anestesista (dono 29/07)', () => {
  it('salva procedimento, anestesista (apelido + uid) e o resto do formulário', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })

    const combos = screen.getAllByRole('combobox')
    escolher(combos[0], 'Sala 2') // sala
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Apendicectomia' } })
    fireEvent.change(screen.getByPlaceholderText('ex.: Mateus Baptistella'), { target: { value: 'Dr. Ivo' } })
    fireEvent.change(screen.getByPlaceholderText('ex.: 15:30'), { target: { value: '1530' } })
    // anestesista é o ÚLTIMO combobox (sala, tipo, anestesista)
    const combosAgora = screen.getAllByRole('combobox')
    escolher(combosAgora[combosAgora.length - 1], 'Marcos Cury')

    const botao = screen.getByRole('button', { name: /Adicionar/ })
    expect(botao).not.toBeDisabled()
    fireEvent.click(botao)

    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    const payload = adicionarCaso.mock.calls[0][1]
    expect(payload.procedimento).toBe('Apendicectomia')
    expect(payload.anestesista).toBe('CURY')
    expect(payload.anestesistaUserId).toBe('uid-cury')
    expect(payload.cirurgiao).toBe('Dr. Ivo')
    expect(payload.hora).toBe('15:30')
    expect(payload.sala).toBe('Sala 2')
    expect(payload.turno).toBe('vespertino') // 15:30 → tarde, mesmo publicando de manhã
  })

  it('sem anestesista escolhido, o caso entra sem dono (não inventa nome)', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    escolher(screen.getAllByRole('combobox')[0], 'Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Drenagem' } })
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    const payload = adicionarCaso.mock.calls[0][1]
    expect(payload.anestesista).toBe('')
    expect(payload.anestesistaUserId).toBeNull()
  })

  it('paciente é gravado só como iniciais mesmo sem sair do campo (LGPD)', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    escolher(screen.getAllByRole('combobox')[0], 'Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Drenagem' } })
    fireEvent.change(screen.getByPlaceholderText(/Nome ou iniciais/), { target: { value: 'Maria Aparecida Souza' } })
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(adicionarCaso.mock.calls[0][1].pacienteIniciais).toBe('M.A.S.')
  })

  it('sala nova digitada à mão entra como sala do caso', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    escolher(screen.getAllByRole('combobox')[0], '+ Nova sala…')
    fireEvent.change(screen.getByPlaceholderText(/Nome da sala/), { target: { value: 'Sala 12' } })
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Drenagem' } })
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(adicionarCaso.mock.calls[0][1].sala).toBe('Sala 12')
  })
})
