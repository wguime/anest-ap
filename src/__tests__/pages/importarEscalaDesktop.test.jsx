/**
 * Conferência no DESKTOP (dono 09/10/2026, modelo C): a mesma conferência, Por fila.
 *
 * O que trava, pelo caminho real (aba do lote com a leitura já feita → publicar):
 *  - a fila aparece NA ORDEM do rodapé, cada pessoa com as suas cirurgias, e o "?" no grupo
 *    sem anestesista;
 *  - marcar pelo teclado grava no MESMO canal da publicação: E → `naEquipe` (Equipe até 19h),
 *    C → nota (CONSULT) na posição do rodapé;
 *  - editar a cirurgia na própria linha muda o caso publicado;
 *  - "+ Cirurgia para X" cria o caso já no nome da pessoa.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { createRef } from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import ImportarEscalaPage from '@/pages/escala-cirurgica/ImportarEscalaPage'

const { svcMock, salvarEscalaTurno } = vi.hoisted(() => ({
  svcMock: { fetchEscala: vi.fn(async () => null), updateAnestesistaCasos: vi.fn(async () => {}) },
  salvarEscalaTurno: vi.fn(async (p) => ({ id: 'e1', ...p, casos: p.casos.map((c, i) => ({ ...c, id: `c${i}`, ordem: i })) })),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseCirurgiasParticularesService', () => ({
  default: { reservarAvisoTempo: vi.fn(async () => false), completarPacienteDoCaso: vi.fn(async () => {}) },
}))
vi.mock('@/services/pegaPlantaoApi', () => ({ getFeriasDoAno: vi.fn(async () => []) }))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ salvarEscalaTurno }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u-sec', role: 'secretaria', displayName: 'Secretária' } }),
}))
const ROSTER = [
  { uid: 'u-raul', nome: 'RAUL PERIZZOLO', apelidos: ['RAUL'] },
  { uid: 'u-edu', nome: 'EDUARDO SAVOLDI', apelidos: ['EDUARDO'] },
  { uid: 'u-gx', nome: 'GUILHERME XAVIER', apelidos: ['GUILHERME XAVIER'] },
]
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: ROSTER, aliases: [], loading: false,
    rosterByUid: new Map(ROSTER.map((r) => [r.uid, r])),
    options: ROSTER.map((r) => ({ value: r.uid, label: r.nome })),
    resolver: (nome) => ROSTER.find((r) => r.apelidos.includes(String(nome || '').trim().toUpperCase()))?.uid || null,
    vocabulario: [], refresh: vi.fn(), upsertAlias: vi.fn(async () => {}), removeAlias: vi.fn(),
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>
const c = (sala, hora, anestesista, procedimento, cirurgiao = 'Dr X') => ({ sala, hora, anestesista, procedimento, cirurgiao, pacienteIniciais: '', bloco: 'normal', tipo: 'eletiva' })
const LEITURA = {
  rows: [
    c('Imagem', '13:30', 'RAUL', '07 RM'),
    c('Sala 2', '13:00', 'EDUARDO', 'ARTRODESE'),
    c('Sala 4', '13:00', 'GUILHERME XAVIER', 'FRATURA'),
    c('Sala 3', '13:00', '?', 'OOFORECTOMIA'),
  ],
  ordemLiberacao: ['RAUL', 'EDUARDO', 'GUILHERME XAVIER'],
  ajudaExterna: [],
}

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-10-09T14:00:00-03:00'))
})
afterAll(() => vi.useRealTimers())
beforeEach(() => { salvarEscalaTurno.mockClear(); svcMock.fetchEscala.mockResolvedValue(null) })

function montar() {
  const ref = createRef()
  render(
    <ImportarEscalaPage ref={ref} embutida desktop hospital="hro" data="2026-10-09" turno="vespertino"
      dataLote="2026-10-09" periodoLote="vespertino" loteInicial={LEITURA} onClose={vi.fn()} />,
    { wrapper: wrap },
  )
  return ref
}
const pessoa = (pos) => document.querySelector(`[data-pos="${pos}"]`)
async function publicarPelaAba(ref) {
  let r
  await act(async () => { r = await ref.current.publicar() })
  return { r, payload: salvarEscalaTurno.mock.calls.at(-1)?.[0] }
}

describe('Conferência no desktop — Por fila', () => {
  it('pessoas na ordem do rodapé, cada uma com as suas cirurgias; "?" no grupo sem anestesista', async () => {
    montar()
    await waitFor(() => expect(screen.getByTestId('conferencia-desktop')).toBeInTheDocument())
    expect(pessoa(0).textContent).toMatch(/RAUL/)
    expect(pessoa(0).textContent).toMatch(/Imagem/)
    expect(pessoa(1).textContent).toMatch(/EDUARDO/)
    expect(pessoa(1).textContent).toMatch(/ARTRODESE/)
    expect(pessoa(2).textContent).toMatch(/FRATURA/)
    expect(screen.getByText('Sem anestesista')).toBeInTheDocument()
    expect(screen.getByText('OOFORECTOMIA')).toBeInTheDocument()
  })

  it('E marca "Equipe até 19h" — a publicação grava naEquipe na linha da pessoa', async () => {
    const ref = montar()
    await waitFor(() => expect(pessoa(2)).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar GUILHERME XAVIER' }))
    fireEvent.keyDown(window, { key: 'e' })
    await waitFor(() => expect(pessoa(2).textContent).toMatch(/Equipe até 19h/))
    const { payload } = await publicarPelaAba(ref)
    expect(payload.linhaOverrides['u-gx']).toMatchObject({ naEquipe: { ate: '19:00' } })
  })

  it('C marca Consultório — vira nota na posição do rodapé publicado', async () => {
    const ref = montar()
    await waitFor(() => expect(pessoa(1)).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar EDUARDO' }))
    fireEvent.keyDown(window, { key: 'c' })
    await waitFor(() => expect(pessoa(1).textContent).toMatch(/Consultório/))
    const { payload } = await publicarPelaAba(ref)
    expect(payload.ordemLiberacao).toEqual(['RAUL', 'EDUARDO (CONSULT)', 'GUILHERME XAVIER'])
  })

  it('editar a cirurgia na própria linha muda o caso publicado', async () => {
    const ref = montar()
    await waitFor(() => expect(pessoa(1)).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /Editar Sala 2 13:00 ARTRODESE/ }))
    const proc = await screen.findByLabelText('Procedimento')
    fireEvent.change(proc, { target: { value: 'ARTRODESE LOMBAR' } })
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '13:15' } })
    const { payload } = await publicarPelaAba(ref)
    const caso = payload.casos.find((x) => x.sala === 'Sala 2')
    expect(caso).toMatchObject({ procedimento: 'ARTRODESE LOMBAR', hora: '13:15' })
  })

  it('"+ Cirurgia para Raul" cria o caso no nome dele', async () => {
    const ref = montar()
    await waitFor(() => expect(pessoa(0)).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /Cirurgia para Raul/ }))
    fireEvent.change(await screen.findByLabelText('Procedimento'), { target: { value: 'ANGIO' } })
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '15:00' } })
    const { payload } = await publicarPelaAba(ref)
    expect(payload.casos.find((x) => x.procedimento === 'ANGIO')).toMatchObject({ anestesistaUserId: 'u-raul', hora: '15:00' })
  })
})
