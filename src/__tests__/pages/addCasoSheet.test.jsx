/**
 * AddCasoSheet — urgência/encaixe entra na escala publicada. O dono relatou
 * (29/07) "problema de salvar procedimento e anestesista": este teste exercita
 * o caminho real do formulário até o payload que vai para o banco.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import AddCasoSheet from '@/pages/escala-cirurgica/AddCasoSheet'
import { CONVENIOS_BASE, familiaConvenio, conveniosDaEscala, convenioDeEscolha, convenioExibicao } from '@/pages/escala-cirurgica/utils'

const { adicionarCaso, definirSalasUrgencia } = vi.hoisted(() => ({
  adicionarCaso: vi.fn(async (_e, c) => ({ id: 'novo-1', ...c })),
  definirSalasUrgencia: vi.fn(async () => {}),
}))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ adicionarCaso, definirSalasUrgencia }),
  // o hook das urgências lê `hoje` do context (fonte única desde 21/08)
  useEscalaCirurgica: () => ({ hoje: '2026-08-18', escalas: {}, data: '2026-08-18', loading: false }),
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
const escolherSala = (nomeOpcao) => escolherPorPlaceholder('A definir', nomeOpcao)

/** Tipo e gravidade são PASTILHAS desde 20/08 (ChipsEscolha, as mesmas do
 *  detalhe do caso) — não são mais Select. */
const marcarChip = (nome) => fireEvent.click(screen.getByRole('button', { name: nome }))
// 11/11/2026 (dono): com campo obrigatório faltando o botão NÃO fica `disabled` — o toque é a
// "tentativa" que acende o aviso da gravidade —, mas continua sem salvar (`aria-disabled`).
// Estes testes travavam `toBeDisabled()`; o que protegem é o mesmo: inválido não grava.
const naoSalva = () => {
  const botao = screen.getByRole('button', { name: /Adicionar/ })
  expect(botao.getAttribute('aria-disabled')).toBe('true')
  fireEvent.click(botao)
  expect(adicionarCaso).not.toHaveBeenCalled()
}

/** Cirurgião e convênio passaram a ser OBRIGATÓRIOS (dono 29/07): o cirurgião
 *  agrupa a linha na coluna de liberação e o convênio decide se o caso vira
 *  cobrança particular. A GRAVIDADE entrou em 18/08 pelo mesmo critério: ela
 *  ordena a fila de urgências do HRO (o tipo default do formulário é urgência).
 *  Todo teste que salva precisa preenchê-los. */
const preencherObrigatorios = () => {
  fireEvent.change(screen.getByPlaceholderText('ex.: Mateus Baptistella'), { target: { value: 'Dr. Ivo' } })
  escolherPorPlaceholder('Selecionar…', 'Unimed')
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
    fireEvent.change(screen.getByPlaceholderText(/ex\.: M\.A\./), { target: { value: 'Maria Aparecida Souza' } })
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
    escolherPorPlaceholder('Selecionar…', 'Unimed')

    naoSalva()
    // botão cinza sem explicação vira tentativa e erro no meio do plantão
    expect(screen.getByText(/Falta preencher/i).textContent).toMatch(/cirurgião/i)
  })

  it('sem convênio não salva', () => {
    abrir()
    escolherSala('Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Drenagem' } })
    fireEvent.change(screen.getByPlaceholderText('ex.: Mateus Baptistella'), { target: { value: 'Dr. Ivo' } })

    naoSalva()
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
    escolherPorPlaceholder('Selecionar…', 'SUS')

    expect(screen.getByText(/Falta preencher/i).textContent).toMatch(/gravidade/)
    naoSalva()
  })

  it('eletiva não pede gravidade — o campo some e o caso salva sem ele', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    escolherSala('Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Herniorrafia' } })
    fireEvent.change(screen.getByPlaceholderText('ex.: Mateus Baptistella'), { target: { value: 'Dr. Ivo' } })
    escolherPorPlaceholder('Selecionar…', 'SUS')
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
    escolherPorPlaceholder('Selecionar…', 'SUS')
    marcarChip('Emergência') // pastilha do TIPO
    // a gravidade já vem preenchida: "Imediata" marcada, nada mais a escolher
    expect(screen.getByRole('button', { name: 'Imediata' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(adicionarCaso.mock.calls[0][1].gravidade).toBe('imediata')
  })
})

/**
 * POSTO DO CONTRATO — o campo SAIU da tela (dono 11/11/2026).
 *
 * ⚠️ ESTE BLOCO MUDOU DE LADO. De 19/08 a 10/11 a folha tinha "Quem vai fazer esta urgência"
 * (Automático/Plantonista/Sobreaviso/Ortopedia/CO) e um parágrafo sobre o contrato do HRO; os
 * testes travavam o campo e a gravação da sala em `urgencias_meta`. O dono mandou tirar o campo
 * e o parágrafo: por baixo vale o "Automático — decide pela sala". A engrenagem "Salas do
 * contrato" continua na faixa de urgências, e o toque num posto VAZIO da faixa ainda abre a
 * folha com `postoInicial` (é a intenção de quem tocou naquele posto).
 */
describe('AddCasoSheet — o posto do contrato não é mais perguntado (dono 11/11/2026)', () => {
  const preencherUrgencia = (salaNome = 'Sala 2') => {
    escolherSala(salaNome)
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Laparotomia' } })
    fireEvent.change(screen.getByPlaceholderText('ex.: Mateus Baptistella'), { target: { value: 'Dr. Ivo' } })
    escolherPorPlaceholder('Selecionar…', 'SUS')
    marcarChip('Urgente')
  }

  it('urgência no HRO: nem o campo nem o parágrafo do contrato aparecem', () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    expect(screen.queryByText('Quem vai fazer esta urgência')).toBeNull()
    expect(screen.queryByText('Automático — decide pela sala')).toBeNull()
    expect(document.body.textContent).not.toMatch(/2 vagas de\s+urgência por turno/)
  })

  it('salvar uma urgência não grava configuração de sala nenhuma — vale o automático', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    preencherUrgencia('Sala 2')
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(definirSalasUrgencia).not.toHaveBeenCalled()
  })

  it('aberta por um posto vazio da faixa (`postoInicial`), grava a sala naquele posto — sem campo na tela', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} postoInicial="plantao" />, { wrapper: wrap })
    expect(screen.queryByText('Quem vai fazer esta urgência')).toBeNull()
    preencherUrgencia('Sala 2')
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(definirSalasUrgencia).toHaveBeenCalled())
    const [, turnoArg, cfgArg] = definirSalasUrgencia.mock.calls[0]
    expect(turnoArg).toBe('matutino')
    expect(cfgArg).toEqual({ plantao: 'Sala 2' })
  })

  it('config existente do posto NUNCA é sobrescrita por aqui — o excedente vira Extra sozinho', async () => {
    render(
      <AddCasoSheet
        escala={{ ...escala, urgenciasMeta: { matutino: { plantao: 'Sala 6' } } }}
        turno="matutino" onClose={vi.fn()} postoInicial="plantao"
      />,
      { wrapper: wrap },
    )
    preencherUrgencia('Sala 2')
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
    // UMA Unimed (dono 11/2026): este teste escolhia "Unimed Chapecó - VD", que saiu da
    // lista — o que ele trava (a grafia DA LISTA é a que vai ao banco) segue igual.
    escolherPorPlaceholder('Selecionar…', 'SC Saúde')

    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(adicionarCaso.mock.calls[0][1].convenio).toBe('SC Saúde')
  })

  it('"+ Outro convênio…" abre a digitação e é ela que vale', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    escolherSala('Sala 2')
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Cesárea' } })
    fireEvent.change(screen.getByPlaceholderText('ex.: Mateus Baptistella'), { target: { value: 'Dr. Ivo' } })
    marcarChip('Urgente')
    escolherPorPlaceholder('Selecionar…', '+ Outro convênio…')
    // enquanto o campo está vazio o botão continua travado
    naoSalva()
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

/**
 * UMA UNIMED SÓ (dono 11/2026): "os convênios Unimed sejam todos unificados e seja apenas
 * Unimed (não quero mais a variedade de nomes diferentes para se referir a Unimed)".
 *
 * Vale para a ESCOLHA e a EXIBIÇÃO. O que já está no banco e o que a importação lê do mapa
 * não são reescritos, e particular × não particular (a cobrança) não muda. O INTERCÂMBIO
 * entrou junto por decisão dele ("também viram Unimed").
 */
describe('AddCasoSheet — uma Unimed só', () => {
  it('a lista oferece "Unimed" uma vez, mesmo com as grafias do mapa do dia', () => {
    const lista = conveniosDaEscala([
      { convenio: 'UNIMED CHAPECÓ - VD' }, { convenio: 'Unimed Fundação' }, { convenio: 'Unimed Regional' }, { convenio: 'unimed' },
    ])
    expect(lista.filter((c) => familiaConvenio(c) === 'unimed')).toEqual(['Unimed'])
    expect(CONVENIOS_BASE.filter((c) => familiaConvenio(c) === 'unimed')).toEqual(['Unimed'])
  })

  it('o INTERCÂMBIO também vira "Unimed" — na escolha e na exibição', () => {
    // ⚠️ MUDOU DE LADO na 2ª rodada do dono: a 1ª versão deixava os três intercâmbios à
    // parte até ele decidir; a resposta foi "também viram Unimed".
    for (const c of ['Unimed Intercâmbio Estadual', 'Unimed Intercâmbio Nacional', 'Intercâmbio Mercosul - PR/RS', 'INTERCAMBIO NACIONAL']) {
      expect(convenioDeEscolha(c)).toBe('Unimed')
      expect(convenioExibicao(c)).toBe('Unimed')
    }
    expect(CONVENIOS_BASE.filter((c) => /interc/i.test(c))).toEqual([])
    expect(conveniosDaEscala([{ convenio: 'Unimed Intercâmbio Estadual' }, { convenio: 'Intercâmbio Mercosul - PR/RS' }])
      .filter((c) => /unimed|interc/i.test(c))).toEqual(['Unimed'])
  })

  it('a distinção INTERNA continua: nenhuma regra dependia dela, e a cobrança não muda', () => {
    // só `=== 'particular'` decide alguma coisa no app; a família do intercâmbio segue à parte
    expect(familiaConvenio('Unimed Intercâmbio Estadual')).toBe('intercambio')
    expect(familiaConvenio('Unimed')).toBe('unimed')
    expect(familiaConvenio('Particular')).toBe('particular')
    expect(convenioDeEscolha('Particular')).toBe('Particular')
    expect(convenioDeEscolha(' SUS ')).toBe('SUS')
    expect(convenioDeEscolha('SC Saúde')).toBe('SC Saúde')
  })

  it('digitar uma grafia da Unimed no campo livre grava "Unimed"', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Cesárea' } })
    fireEvent.change(screen.getByPlaceholderText('ex.: Mateus Baptistella'), { target: { value: 'Dr. Ivo' } })
    marcarChip('Urgente')
    escolherPorPlaceholder('Selecionar…', '+ Outro convênio…')
    fireEvent.change(screen.getByPlaceholderText('Nome do convênio'), { target: { value: 'unimed chapeco vd' } })
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(adicionarCaso.mock.calls[0][1].convenio).toBe('Unimed')
  })

  it('a exibição já lia "Unimed" para toda grafia — e continua', () => {
    for (const c of ['Unimed Chapecó - VD', 'UNIMED FUNDAÇÃO', 'Unimed']) expect(convenioExibicao(c)).toBe('Unimed')
  })
})

/**
 * SALA NÃO É OBRIGATÓRIA (dono 11/2026): "nem sempre ela está definida" — a urgência chega
 * antes de o centro cirúrgico dizer onde vai ser. O banco aceita sala vazia
 * (`sala text not null default ''`); o quadro junta os sem-sala em "Sala a definir".
 */
describe('AddCasoSheet — sala opcional', () => {
  const preencherSemSala = () => {
    fireEvent.change(screen.getByPlaceholderText('ex.: Apendicectomia'), { target: { value: 'Laparotomia' } })
    preencherObrigatorios()
  }

  it('salva sem sala, e a sala vai vazia (não um texto inventado)', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    preencherSemSala()
    expect(screen.queryByText(/Falta preencher/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(adicionarCaso.mock.calls[0][1].sala).toBe('')
  })

  it('"Falta preencher" não cobra mais a sala', () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    const falta = screen.getByText(/Falta preencher/)
    expect(falta.textContent).not.toMatch(/sala/)
    expect(falta.textContent).toMatch(/procedimento, cirurgião, convênio, gravidade/)
  })

  it('posto do contrato (vindo da faixa) SEM sala não grava configuração de sala nenhuma', async () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} postoInicial="plantao" />, { wrapper: wrap })
    preencherSemSala()
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    await waitFor(() => expect(adicionarCaso).toHaveBeenCalled())
    expect(definirSalasUrgencia).not.toHaveBeenCalled()
  })
})

/**
 * UM BLOCO SÓ "A CIRURGIA", EM GRADE (dono 11/11/2026, opção A de `modelos-5/3-adicionar-caso.html`).
 *
 * ⚠️ MUDOU DE LADO: o teste travava TRÊS cartões ("A cirurgia", "Tipo e prioridade", "Paciente e
 * equipe") com sala e hora na frente. Agora os dados da cirurgia e do paciente moram num bloco
 * só, com os campos curtos lado a lado; a frase vermelha da gravidade só aparece depois de
 * tentar salvar; e os botões ficam presos no rodapé. Os avisos seguem no laranja-escuro (o
 * `text-warning` media 2,13:1 sobre o cartão claro).
 */
describe('AddCasoSheet — um bloco só, em grade (dono 11/11/2026)', () => {
  const rotulos = (a) => [...a.querySelectorAll('label')].map((l) => l.textContent)

  it('dois cartões; o 1º traz todos os dados, na ordem do modelo', () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    const cartoes = [...document.querySelectorAll('article')]
    expect(cartoes.map((a) => a.querySelector('h3').textContent)).toEqual(['A cirurgia', 'Tipo e prioridade'])
    expect(rotulos(cartoes[0])).toEqual([
      'Procedimento *', 'Cirurgião *', 'Convênio *', 'Hora', 'Sala', 'Idade', 'Paciente (iniciais)', 'Residente', 'Anestesista',
    ])
    // campos curtos em pares, lado a lado
    expect(cartoes[0].querySelectorAll('.grid.grid-cols-2')).toHaveLength(3)
  })

  it('a frase vermelha da gravidade só aparece DEPOIS de tentar salvar', () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    expect(screen.queryByText(/Sem classificação a urgência/)).toBeNull()
    expect(screen.getByText(/Falta preencher/).textContent).toMatch(/gravidade/)
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    const aviso = screen.getByText(/Sem classificação a urgência/)
    expect(aviso.className).toContain('text-category-orange-fg')
    expect(adicionarCaso).not.toHaveBeenCalled()
  })

  it('os botões ficam presos no rodapé da folha', () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    const rodape = document.querySelector('[data-rodape-caso]')
    expect(rodape.className).toContain('sticky')
    expect(rodape.className).toContain('bottom-0')
    expect(rodape.querySelector('button')).not.toBeNull()
  })

  it('o aviso do que falta usa o laranja-escuro, não o âmbar do token', () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    const el = screen.getByText(/Falta preencher/)
    expect(el.className).toContain('text-category-orange-fg')
    expect(el.className).not.toContain('text-warning')
  })
})
