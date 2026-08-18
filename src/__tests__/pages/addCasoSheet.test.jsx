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
// residentes têm lista PRÓPRIA desde 29/07 (fora de qualquer seletor de anestesista)
vi.mock('@/hooks/useRosterResidentes', () => ({
  default: () => ({
    residentes: [{ uid: 'uid-augusto', nome: 'Augusto' }],
    residenteByUid: new Map([['uid-augusto', { uid: 'uid-augusto', nome: 'Augusto' }]]),
    options: [{ value: 'uid-augusto', label: 'Augusto' }],
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>
const escala = { id: 'e1', hospital: 'hro', casos: [{ sala: 'Sala 2', ordem: 0 }] }

/** Escolhe uma opção num Select do DS (combobox → listbox → option). */
const escolher = (combo, nomeOpcao) => {
  fireEvent.click(combo)
  fireEvent.click(screen.getByRole('option', { name: nomeOpcao }))
}
/** Select ainda vazio, localizado pelo placeholder — índice de combobox quebrava
 *  a cada campo novo no formulário (o residente entrou depois do anestesista). */
const escolherPorPlaceholder = (placeholder, nomeOpcao) =>
  escolher(screen.getByText(placeholder), nomeOpcao)

/** Cirurgião e convênio passaram a ser OBRIGATÓRIOS (dono 29/07): o cirurgião
 *  agrupa a linha na coluna de liberação e o convênio decide se o caso vira
 *  cobrança particular. A GRAVIDADE entrou em 18/08 pelo mesmo critério: ela
 *  ordena a fila de urgências do HRO (o tipo default do formulário é urgência).
 *  Todo teste que salva precisa preenchê-los. */
const preencherObrigatorios = () => {
  fireEvent.change(screen.getByPlaceholderText('ex.: Mateus Baptistella'), { target: { value: 'Dr. Ivo' } })
  fireEvent.change(screen.getByPlaceholderText('SUS, Unimed, BRF…'), { target: { value: 'Unimed' } })
  escolherPorPlaceholder('Quem entra primeiro', 'Urgente')
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
    escolherPorPlaceholder('Selecionar anestesista…', 'Marcos Cury')

    preencherObrigatorios()
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

  it('residente escolhido entra no caso com uid + nome, sem virar anestesista', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    escolher(screen.getAllByRole('combobox')[0], 'Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Drenagem' } })
    escolherPorPlaceholder('Selecionar residente…', 'Augusto')
    preencherObrigatorios()
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    const payload = adicionarCaso.mock.calls[0][1]
    expect(payload.residente).toBe('Augusto')
    expect(payload.residenteUserId).toBe('uid-augusto')
    // o residente ACOMPANHA: não pode escorrer p/ o responsável do caso —
    // sem anestesista escolhido o caso entra declarado como "?" (bug 30/07)
    expect(payload.anestesista).toBe('?')
    expect(payload.anestesistaUserId).toBeNull()
    expect(payload.semAnestesista).toBe(true)
  })

  it('sem anestesista escolhido, o caso entra sem dono declarado — "?" com a flag', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    escolher(screen.getAllByRole('combobox')[0], 'Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Drenagem' } })
    preencherObrigatorios()
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    const payload = adicionarCaso.mock.calls[0][1]
    // '' sem flag herdava o dono da sala na exibição e sumia do alerta das
    // Liberações (bug 30/07) — "?" + flag é ausência DECLARADA, não nome inventado
    expect(payload.anestesista).toBe('?')
    expect(payload.anestesistaUserId).toBeNull()
    expect(payload.semAnestesista).toBe(true)
  })

  it('paciente é gravado só como iniciais mesmo sem sair do campo (LGPD)', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    escolher(screen.getAllByRole('combobox')[0], 'Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Drenagem' } })
    fireEvent.change(screen.getByPlaceholderText(/Nome ou iniciais/), { target: { value: 'Maria Aparecida Souza' } })
    preencherObrigatorios()
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(adicionarCaso.mock.calls[0][1].pacienteIniciais).toBe('M.A.S.')
  })

  it('sala nova digitada à mão entra como sala do caso', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    escolher(screen.getAllByRole('combobox')[0], '+ Nova sala…')
    fireEvent.change(screen.getByPlaceholderText(/Nome da sala/), { target: { value: 'Sala 12' } })
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Drenagem' } })
    preencherObrigatorios()
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(adicionarCaso.mock.calls[0][1].sala).toBe('Sala 12')
  })
})

/**
 * Obrigatoriedade de cirurgião, convênio e tipo (dono 29/07).
 *
 * Não é burocracia: cada campo alimenta uma decisão a jusante — o CIRURGIÃO
 * agrupa a linha na coluna de liberação, o CONVÊNIO é o que o trigger
 * `fn_convenio_particular` lê para criar (ou não) a cobrança particular, e o TIPO
 * pinta urgência/emergência no board. Caso adicionado sem eles nascia incompleto
 * e alguém tinha de caçar a informação depois.
 */
describe('AddCasoSheet — campos obrigatórios', () => {
  const abrir = () => render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })

  it('sem cirurgião não salva, e a tela diz o que falta', () => {
    abrir()
    escolher(screen.getAllByRole('combobox')[0], 'Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Drenagem' } })
    fireEvent.change(screen.getByPlaceholderText('SUS, Unimed, BRF…'), { target: { value: 'Unimed' } })

    expect(screen.getByRole('button', { name: /Adicionar/ })).toBeDisabled()
    // botão cinza sem explicação vira tentativa e erro no meio do plantão
    expect(screen.getByText(/Falta preencher/i).textContent).toMatch(/cirurgião/i)
  })

  it('sem convênio não salva', () => {
    abrir()
    escolher(screen.getAllByRole('combobox')[0], 'Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Drenagem' } })
    fireEvent.change(screen.getByPlaceholderText('ex.: Mateus Baptistella'), { target: { value: 'Dr. Ivo' } })

    expect(screen.getByRole('button', { name: /Adicionar/ })).toBeDisabled()
    expect(screen.getByText(/Falta preencher/i).textContent).toMatch(/convênio/i)
  })

  it('com os obrigatórios preenchidos, salva e o aviso some', async () => {
    abrir()
    escolher(screen.getAllByRole('combobox')[0], 'Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Drenagem' } })
    preencherObrigatorios()

    expect(screen.queryByText(/Falta preencher/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    const payload = adicionarCaso.mock.calls[0][1]
    expect(payload.cirurgiao).toBe('Dr. Ivo')
    expect(payload.convenio).toBe('Unimed')
    expect(payload.tipo).toBeTruthy() // tipo já entra com default, nunca vazio
  })
})

/**
 * GRAVIDADE (dono 18/08) — exigida só em urgência/emergência, pelo mesmo critério
 * dos outros obrigatórios: alimenta uma decisão a jusante (a ORDEM DA FILA de
 * urgências do HRO). Urgência sem gravidade nasceria sem lugar na fila.
 */
describe('AddCasoSheet — gravidade da urgência', () => {
  it('bloqueia e diz o que falta enquanto a urgência não tem gravidade', () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    escolher(screen.getAllByRole('combobox')[0], 'Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Apendicectomia' } })
    fireEvent.change(screen.getByPlaceholderText('ex.: Mateus Baptistella'), { target: { value: 'Dr. Ivo' } })
    fireEvent.change(screen.getByPlaceholderText('SUS, Unimed, BRF…'), { target: { value: 'SUS' } })

    expect(screen.getByText(/Falta preencher/i).textContent).toMatch(/gravidade/)
    expect(screen.getByRole('button', { name: /Adicionar/ })).toBeDisabled()
  })

  it('eletiva não pede gravidade — o campo some e o caso salva sem ele', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    escolher(screen.getAllByRole('combobox')[0], 'Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Herniorrafia' } })
    fireEvent.change(screen.getByPlaceholderText('ex.: Mateus Baptistella'), { target: { value: 'Dr. Ivo' } })
    fireEvent.change(screen.getByPlaceholderText('SUS, Unimed, BRF…'), { target: { value: 'SUS' } })
    escolherPorPlaceholder('Quem entra primeiro', 'Urgente')
    escolher(screen.getByText('Urgência'), 'Eletiva / encaixe') // o Select do TIPO

    expect(screen.queryByText('Quem entra primeiro')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(adicionarCaso.mock.calls[0][1].gravidade).toBeNull()
  })

  it('emergência já nasce "imediata" — pré-preenchimento, não default silencioso', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    escolher(screen.getAllByRole('combobox')[0], 'Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Laparotomia' } })
    fireEvent.change(screen.getByPlaceholderText('ex.: Mateus Baptistella'), { target: { value: 'Dr. Ivo' } })
    fireEvent.change(screen.getByPlaceholderText('SUS, Unimed, BRF…'), { target: { value: 'SUS' } })
    escolher(screen.getByText('Urgência'), 'Emergência') // o Select do TIPO
    // o campo de gravidade já vem preenchido: nada mais a escolher
    expect(screen.queryByText('Quem entra primeiro')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(adicionarCaso.mock.calls[0][1].gravidade).toBe('imediata')
  })
})
