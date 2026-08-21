/**
 * AddCasoSheet — urgência/encaixe entra na escala publicada. O dono relatou
 * (29/07) "problema de salvar procedimento e anestesista": este teste exercita
 * o caminho real do formulário até o payload que vai para o banco.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import AddCasoSheet from '@/pages/escala-cirurgica/AddCasoSheet'
import { CONVENIOS_BASE, familiaConvenio } from '@/pages/escala-cirurgica/utils'

const { adicionarCaso, definirSalasUrgencia } = vi.hoisted(() => ({
  adicionarCaso: vi.fn(async (_e, c) => ({ id: 'novo-1', ...c })),
  definirSalasUrgencia: vi.fn(async () => {}),
}))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ adicionarCaso, definirSalasUrgencia }),
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
 *  a cada campo novo no formulário (o residente entrou depois do anestesista, e o
 *  redesenho de 20/08 desceu a sala para o cartão "Quem está e onde"). */
const escolherPorPlaceholder = (placeholder, nomeOpcao) =>
  escolher(screen.getByText(placeholder), nomeOpcao)

/** A sala é sempre o mesmo Select, esteja ele em que cartão estiver. */
const escolherSala = (nomeOpcao) => escolherPorPlaceholder('Selecionar sala…', nomeOpcao)

/** Tipo e gravidade são PASTILHAS desde 20/08 (ChipsEscolha, as mesmas do
 *  detalhe do caso) — não são mais Select. */
const marcarChip = (nome) => fireEvent.click(screen.getByRole('button', { name: nome }))

/** Cirurgião e convênio passaram a ser OBRIGATÓRIOS (dono 29/07): o cirurgião
 *  agrupa a linha na coluna de liberação e o convênio decide se o caso vira
 *  cobrança particular. A GRAVIDADE entrou em 18/08 pelo mesmo critério: ela
 *  ordena a fila de urgências do HRO (o tipo default do formulário é urgência).
 *  Todo teste que salva precisa preenchê-los. */
const preencherObrigatorios = () => {
  fireEvent.change(screen.getByPlaceholderText('ex.: Mateus Baptistella'), { target: { value: 'Dr. Ivo' } })
  escolherPorPlaceholder('Selecionar convênio…', 'Unimed')
  marcarChip('Urgente')
}

beforeEach(() => { adicionarCaso.mockClear(); definirSalasUrgencia.mockClear() })

describe('AddCasoSheet — salvar procedimento e anestesista (dono 29/07)', () => {
  it('salva procedimento, anestesista (apelido + uid) e o resto do formulário', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })

    escolherSala('Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Apendicectomia' } })
    fireEvent.change(screen.getByPlaceholderText('ex.: Mateus Baptistella'), { target: { value: 'Dr. Ivo' } })
    fireEvent.change(screen.getByPlaceholderText('15:30'), { target: { value: '1530' } })
    escolherPorPlaceholder('Definir depois', 'Marcos Cury')

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
    escolherSala('Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Drenagem' } })
    escolherPorPlaceholder('Sem residente', 'Augusto')
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
    escolherSala('Sala 2')
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
    escolherSala('Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Drenagem' } })
    fireEvent.change(screen.getByPlaceholderText(/Nome ou iniciais/), { target: { value: 'Maria Aparecida Souza' } })
    preencherObrigatorios()
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(adicionarCaso.mock.calls[0][1].pacienteIniciais).toBe('M.A.S.')
  })

  // Numéricas do HRO ganharam o bloco em 20/08, mas escala publicada ANTES tem
  // "Sala 2" gravado. Escolher a sala do dia na lista não pode reescrevê-la: o
  // quadro agrupa por TEXTO e a mesma sala apareceria em dois blocos.
  it('sala escolhida na lista entra como está — a grafia do dia vence', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    escolherSala('Sala 2') // grafia do dia (o caso da escala está em "Sala 2")
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Drenagem' } })
    preencherObrigatorios()
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(adicionarCaso.mock.calls[0][1].sala).toBe('Sala 2')
  })

  it('sala nova digitada à mão entra como sala do caso', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    escolherSala('+ Nova sala…')
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
    escolherSala('Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Drenagem' } })
    escolherPorPlaceholder('Selecionar convênio…', 'Unimed')

    expect(screen.getByRole('button', { name: /Adicionar/ })).toBeDisabled()
    // botão cinza sem explicação vira tentativa e erro no meio do plantão
    expect(screen.getByText(/Falta preencher/i).textContent).toMatch(/cirurgião/i)
  })

  it('sem convênio não salva', () => {
    abrir()
    escolherSala('Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Drenagem' } })
    fireEvent.change(screen.getByPlaceholderText('ex.: Mateus Baptistella'), { target: { value: 'Dr. Ivo' } })

    expect(screen.getByRole('button', { name: /Adicionar/ })).toBeDisabled()
    expect(screen.getByText(/Falta preencher/i).textContent).toMatch(/convênio/i)
  })

  it('com os obrigatórios preenchidos, salva e o aviso some', async () => {
    abrir()
    escolherSala('Sala 2')
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
    escolherSala('Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Apendicectomia' } })
    fireEvent.change(screen.getByPlaceholderText('ex.: Mateus Baptistella'), { target: { value: 'Dr. Ivo' } })
    escolherPorPlaceholder('Selecionar convênio…', 'SUS')

    expect(screen.getByText(/Falta preencher/i).textContent).toMatch(/gravidade/)
    expect(screen.getByRole('button', { name: /Adicionar/ })).toBeDisabled()
  })

  it('eletiva não pede gravidade — o campo some e o caso salva sem ele', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    escolherSala('Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Herniorrafia' } })
    fireEvent.change(screen.getByPlaceholderText('ex.: Mateus Baptistella'), { target: { value: 'Dr. Ivo' } })
    escolherPorPlaceholder('Selecionar convênio…', 'SUS')
    marcarChip('Urgente')
    marcarChip('Eletiva') // pastilha do TIPO

    expect(screen.queryByText(/Gravidade/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(adicionarCaso.mock.calls[0][1].gravidade).toBeNull()
  })

  it('emergência já nasce "imediata" — pré-preenchimento, não default silencioso', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    escolherSala('Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Laparotomia' } })
    fireEvent.change(screen.getByPlaceholderText('ex.: Mateus Baptistella'), { target: { value: 'Dr. Ivo' } })
    escolherPorPlaceholder('Selecionar convênio…', 'SUS')
    marcarChip('Emergência') // pastilha do TIPO
    // a gravidade já vem preenchida: "Imediata" marcada, nada mais a escolher
    expect(screen.getByRole('button', { name: 'Imediata' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(adicionarCaso.mock.calls[0][1].gravidade).toBe('imediata')
  })
})

/**
 * POSTO DO CONTRATO (dono 19/08): no HRO, quem adiciona urgência/emergência já
 * diz QUEM a faz (Plantão/Sobreaviso/Ortopedia/CO). A escolha vira CONFIG de
 * sala (urgencias_meta) — o mesmo dado do ⚙ da faixa —, nunca campo do caso;
 * posto ocupado pode ser escolhido e o excedente entra como Extra sozinho.
 */
describe('AddCasoSheet — posto do contrato (só HRO)', () => {
  const preencherUrgencia = (salaNome = 'Sala 2') => {
    escolherSala(salaNome)
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Laparotomia' } })
    fireEvent.change(screen.getByPlaceholderText('ex.: Mateus Baptistella'), { target: { value: 'Dr. Ivo' } })
    escolherPorPlaceholder('Selecionar convênio…', 'SUS')
    marcarChip('Urgente')
  }

  it('o campo existe no HRO em urgência e some fora do HRO', () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    expect(screen.getByText('Quem vai fazer esta urgência')).toBeTruthy()

    render(
      <AddCasoSheet escala={{ id: 'e2', hospital: 'unimed', casos: [] }} turno="matutino" onClose={vi.fn()} />,
      { wrapper: wrap },
    )
    // só um campo — o do HRO do primeiro render
    expect(screen.getAllByText('Quem vai fazer esta urgência')).toHaveLength(1)
  })

  it('escolher Plantão grava a sala do caso na config daquele posto/turno', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    preencherUrgencia('Sala 2')
    escolher(screen.getByText('Automático — decide pela sala'), 'Plantonista do HRO')
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(definirSalasUrgencia).toHaveBeenCalled())
    const [, turnoArg, cfgArg] = definirSalasUrgencia.mock.calls[0]
    expect(turnoArg).toBe('matutino')
    expect(cfgArg).toEqual({ plantao: 'Sala 2' })
  })

  it('Automático não grava config nenhuma', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    preencherUrgencia('Sala 2')
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(definirSalasUrgencia).not.toHaveBeenCalled()
  })

  it('Ortopedia na Sala 4 (o default) não precisa de config — nada é gravado', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    preencherUrgencia('Sala 4')
    escolher(screen.getByText('Automático — decide pela sala'), 'Anestesista da ortopedia')
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(definirSalasUrgencia).not.toHaveBeenCalled()
  })

  it('config existente do posto NUNCA é sobrescrita por aqui — o excedente vira Extra sozinho', async () => {
    render(
      <AddCasoSheet
        escala={{ ...escala, urgenciasMeta: { matutino: { plantao: 'Sala 6' } } }}
        turno="matutino" onClose={vi.fn()}
      />,
      { wrapper: wrap },
    )
    preencherUrgencia('Sala 2')
    escolher(screen.getByText('Automático — decide pela sala'), 'Plantonista do HRO')
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(definirSalasUrgencia).not.toHaveBeenCalled()
  })
})

/**
 * CONVÊNIO EM LISTA (dono 20/08): o campo era texto livre e o banco acumulou
 * "Unirmd", "Umimed", "Particulae", "Sua", "sUS" — cada erro de digitação some do
 * agrupamento por família e, no particular, da COBRANÇA (o trigger casa o texto).
 */
describe('AddCasoSheet — convênio', () => {
  it('oferece a lista e grava a grafia canônica', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    escolherSala('Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Cesárea' } })
    fireEvent.change(screen.getByPlaceholderText('ex.: Mateus Baptistella'), { target: { value: 'Dr. Ivo' } })
    marcarChip('Urgente')
    escolherPorPlaceholder('Selecionar convênio…', 'Unimed Chapecó - VD')

    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(adicionarCaso.mock.calls[0][1].convenio).toBe('Unimed Chapecó - VD')
  })

  it('"+ Outro convênio…" abre a digitação e é ela que vale', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    escolherSala('Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Cesárea' } })
    fireEvent.change(screen.getByPlaceholderText('ex.: Mateus Baptistella'), { target: { value: 'Dr. Ivo' } })
    marcarChip('Urgente')
    escolherPorPlaceholder('Selecionar convênio…', '+ Outro convênio…')
    // enquanto o campo está vazio o botão continua travado
    expect(screen.getByRole('button', { name: /Adicionar/ })).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText('Nome do convênio'), { target: { value: 'Sindicato Rural' } })

    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(adicionarCaso.mock.calls[0][1].convenio).toBe('Sindicato Rural')
  })

  it('"Particular" da lista continua casando o classificador da cobrança', () => {
    // A grafia da lista É a que vai ao banco: o trigger fn_convenio_particular e o
    // familiaConvenio casam ^PART(ICULAR)?[^A-Z]*$ — trocar o rótulo por
    // "Particular (sem convênio)" tiraria a cirurgia da cobrança em silêncio.
    expect(familiaConvenio('Particular')).toBe('particular')
    expect(CONVENIOS_BASE).toContain('Particular')
    expect(CONVENIOS_BASE.filter((c) => familiaConvenio(c) === 'outro')).toEqual(['GEAP'])
  })
})
