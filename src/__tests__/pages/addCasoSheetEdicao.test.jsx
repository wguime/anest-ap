/**
 * AddCasoSheet — MODO EDIÇÃO e EXCLUSÃO do caso publicado (dono 2026-09-01:
 * "quero poder editar o novo caso após publicado e ou excluir se for
 * necessário"). O mesmo formulário do "Adicionar caso" reabre preenchido; o
 * excluir só alcança o caso adicionado à mão.
 *
 * Os quatro invariantes que o desenho depende e que são fáceis de perder num
 * refactor futuro:
 *   1. só o que MUDOU vai no patch (o formulário inteiro apagaria a dupla
 *      "A + B" e a `ordem`, que não têm campo nesta tela);
 *   2. iniciais já gravadas NÃO são reprocessadas ("M.C.G." virava "M.");
 *   3. Excluir só existe em `origem === 'manual'`;
 *   4. hora que cai no outro período PERGUNTA antes de mover.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import AddCasoSheet from '@/pages/escala-cirurgica/AddCasoSheet'

const { adicionarCaso, atualizarCaso, excluirCaso, definirSalasUrgencia } = vi.hoisted(() => ({
  adicionarCaso: vi.fn(async (_e, c) => ({ id: 'novo-1', ...c })),
  atualizarCaso: vi.fn(async () => {}),
  excluirCaso: vi.fn(async () => {}),
  definirSalasUrgencia: vi.fn(async () => {}),
}))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ adicionarCaso, atualizarCaso, excluirCaso, definirSalasUrgencia }),
  useEscalaCirurgica: () => ({ hoje: '2026-09-01', escalas: {}, data: '2026-09-01', loading: false }),
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
vi.mock('@/hooks/useRosterResidentes', () => ({
  default: () => ({
    residentes: [{ uid: 'uid-augusto', nome: 'Augusto' }],
    residenteByUid: new Map([['uid-augusto', { uid: 'uid-augusto', nome: 'Augusto' }]]),
    options: [{ value: 'uid-augusto', label: 'Augusto' }],
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

/** Caso publicado à MÃO (o que ganha Excluir). Convênio e sala já estão na
 *  escala, então abrem escolhidos na lista, não no campo livre. */
const casoManual = {
  id: 'c-1',
  sala: 'Sala 2',
  ordem: 3,
  hora: '08:30',
  turno: 'matutino',
  pacienteIniciais: 'M.C.G.',
  idade: '47a',
  procedimento: 'Colecistectomia',
  convenio: 'Unimed',
  cirurgiao: 'Eduardo Baldissera',
  anestesista: 'CURY',
  anestesistaUserId: 'uid-cury',
  tipo: 'urgencia',
  gravidade: 'urgente',
  origem: 'manual',
  statusCirurgia: 'agendada',
}
const escala = { id: 'e1', hospital: 'hro', casos: [casoManual] }

/** O caso editado SEMPRE faz parte da escala — é dela que saem as listas de
 *  sala e convênio, e é por isso que o valor gravado no caso nunca some do
 *  formulário. Montar de outro jeito testaria um estado que não existe. */
const abrir = (caso = casoManual, props = {}) =>
  render(
    <AddCasoSheet escala={{ ...escala, casos: [caso] }} turno="matutino" caso={caso}
      onClose={props.onClose || vi.fn()} />,
    { wrapper: wrap },
  )

const salvar = () => fireEvent.click(screen.getByRole('button', { name: /^Salvar/ }))

/** Escolhe uma opção num Select do DS (combobox → listbox → option). */
const escolher = (gatilho, nomeOpcao) => {
  fireEvent.click(gatilho)
  fireEvent.click(screen.getByRole('option', { name: nomeOpcao }))
}

beforeEach(() => {
  adicionarCaso.mockClear(); atualizarCaso.mockClear()
  excluirCaso.mockClear(); definirSalasUrgencia.mockClear()
})

describe('AddCasoSheet — modo edição (dono 01/09)', () => {
  it('abre com o caso preenchido e salva SÓ o campo alterado', async () => {
    abrir()
    expect(screen.getByDisplayValue('Colecistectomia')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Eduardo Baldissera')).toBeInTheDocument()
    expect(screen.getByDisplayValue('08:30')).toBeInTheDocument()

    fireEvent.change(screen.getByDisplayValue('Eduardo Baldissera'), { target: { value: 'Mateus Baptistella' } })
    salvar()

    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    const [, casoId, patch] = atualizarCaso.mock.calls[0]
    expect(casoId).toBe('c-1')
    // O patch é o DIFF: mandar o formulário inteiro reenviaria `anestesista` a
    // partir de um campo que nem existe nesta tela e apagaria a dupla "A + B".
    expect(patch).toEqual({ cirurgiao: 'Mateus Baptistella' })
  })

  it('abrir e fechar sem tocar em nada não escreve no banco', async () => {
    const onClose = vi.fn()
    abrir(casoManual, { onClose })
    salvar()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(atualizarCaso).not.toHaveBeenCalled()
  })

  it('iniciais já gravadas sobrevivem ao blur — "M.C.G." não vira "M."', async () => {
    abrir()
    const campo = screen.getByDisplayValue('M.C.G.')
    fireEvent.blur(campo)
    expect(campo).toHaveValue('M.C.G.')
    salvar()
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Salvar/ })).toBeTruthy())
    // nada mudou → nada foi gravado (se o guard caísse, viria pacienteIniciais: 'M.')
    expect(atualizarCaso).not.toHaveBeenCalled()
  })

  it('nome completo digitado na edição ainda vira INICIAIS (LGPD)', async () => {
    abrir()
    fireEvent.change(screen.getByDisplayValue('M.C.G.'), { target: { value: 'Maria Aparecida Souza' } })
    salvar()
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ pacienteIniciais: 'M.A.S.' })
  })

  it('o anestesista NÃO é editável aqui — o sheet próprio continua sendo a porta', () => {
    abrir()
    expect(screen.queryByText('Definir depois')).not.toBeInTheDocument()
    expect(screen.getByText(/se troca no detalhe/i)).toBeInTheDocument()
  })

  it('voltar para eletiva limpa a gravidade no mesmo patch', async () => {
    abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Eletiva' }))
    salvar()
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ tipo: 'eletiva', gravidade: null })
  })
})

/**
 * Invariantes que MORAVAM no `casoDetalheSheet.test.jsx` até 01/09, quando os
 * editores de campo saíram do painel. O que eles protegem não mudou — só o
 * caminho até o controle. Ver o cabeçalho daquele arquivo.
 */
describe('AddCasoSheet — o que os editores do detalhe protegiam (migrado 01/09)', () => {
  it('residente grava uid + NOME em par (dono 29/07)', async () => {
    abrir()
    escolher(screen.getByText('Sem residente'), 'Augusto')
    salvar()
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    // gravar só um dos dois deixaria a aba "Minhas" do residente e o nome no
    // card apontando para pessoas diferentes
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ residente: 'Augusto', residenteUserId: 'uid-augusto' })
  })

  it('"Sem residente" limpa os DOIS campos', async () => {
    abrir({ ...casoManual, residente: 'Augusto', residenteUserId: 'uid-augusto' })
    escolher(screen.getByText('Augusto'), 'Sem residente')
    salvar()
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ residente: null, residenteUserId: null })
  })

  it('o cirurgião é campo ABERTO, sem lista de sugestões (dono 17/08)', () => {
    abrir()
    // quem corrige o nome do cirurgião já sabe o nome certo; a lista atrapalhava
    expect(screen.getByDisplayValue('Eduardo Baldissera').tagName).toBe('INPUT')
    expect(screen.queryByRole('option')).toBeNull()
  })

  it('sala escolhida na lista grava sem passar pela normalização do HRO', async () => {
    abrir()
    escolher(screen.getByText('Sala 2'), 'Bloco M - Sala 3')
    salvar()
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    // a opção da lista já vem canônica OU na grafia do dia, que vence: normalizar
    // reescreveria a sala de uma escala antiga e a partiria em dois blocos
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ sala: 'Bloco M - Sala 3' })
  })

  it('convênio escolhido na lista grava, com o aviso da cobrança à vista', async () => {
    abrir()
    expect(screen.getByText(/cancele em Cirurgias Particulares/i)).toBeTruthy()
    escolher(screen.getByText('Unimed'), 'SUS')
    salvar()
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ convenio: 'SUS' })
  })

  it('convênio NOVO ainda entra digitado (dono 20/08: a lista não fecha a porta)', async () => {
    abrir()
    escolher(screen.getByText('Unimed'), '+ Outro convênio…')
    fireEvent.change(screen.getByPlaceholderText('Nome do convênio'), { target: { value: 'Sindicato Rural' } })
    salvar()
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ convenio: 'Sindicato Rural' })
  })

  it('a grafia do dia sobrevive a abrir e salvar — nada de renormalizar sozinho', async () => {
    // "Sala 4" numa escala publicada antes de 20/08 não pode virar
    // "Bloco A - Sala 4" só por alguém ter aberto o formulário: seria o segundo
    // bloco no quadro, pelo avesso. Como o caso está na escala, a grafia dele é
    // uma OPÇÃO da lista, e sair sem tocar nela não escreve nada.
    const onClose = vi.fn()
    abrir({ ...casoManual, sala: 'Sala 4' }, { onClose })
    expect(screen.getByText('Sala 4')).toBeTruthy()
    salvar()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(atualizarCaso).not.toHaveBeenCalled()
  })
})

describe('AddCasoSheet — hora que muda de período pergunta antes de mover (dono 01/09)', () => {
  it('08:30 → 15:00 grava a hora e PERGUNTA se move para a tarde', async () => {
    abrir()
    fireEvent.change(screen.getByDisplayValue('08:30'), { target: { value: '1500' } })
    salvar()

    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ hora: '15:00' })
    // a hora já está gravada; o turno é a segunda pergunta, nunca automática
    expect(await screen.findByText(/15:00 é da tarde/i)).toBeInTheDocument()
    expect(atualizarCaso).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /Mover para a tarde/i }))
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalledTimes(2))
    expect(atualizarCaso.mock.calls[1][2]).toEqual({ turno: 'vespertino' })
  })

  it('"Deixar na manhã" fecha sem mexer no turno', async () => {
    const onClose = vi.fn()
    abrir(casoManual, { onClose })
    fireEvent.change(screen.getByDisplayValue('08:30'), { target: { value: '1500' } })
    salvar()
    await screen.findByText(/15:00 é da tarde/i)
    fireEvent.click(screen.getByRole('button', { name: /Deixar na manhã/i }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(atualizarCaso).toHaveBeenCalledTimes(1) // só a hora
  })

  it('hora que fica no mesmo período não pergunta nada', async () => {
    const onClose = vi.fn()
    abrir(casoManual, { onClose })
    fireEvent.change(screen.getByDisplayValue('08:30'), { target: { value: '1015' } })
    salvar()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(screen.queryByText(/é da tarde/i)).not.toBeInTheDocument()
  })
})

describe('AddCasoSheet — excluir só o caso adicionado à mão (dono 01/09)', () => {
  it('caso manual oferece Excluir, e a confirmação NOMEIA a cirurgia', async () => {
    abrir()
    fireEvent.click(screen.getByRole('button', { name: /Excluir este caso/i }))
    expect(await screen.findByText(/Excluir este caso\?/i)).toBeInTheDocument()
    expect(screen.getByText(/Colecistectomia/)).toBeInTheDocument()
    expect(screen.getByText(/Eduardo Baldissera/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Excluir$/ }))
    await waitFor(() => expect(excluirCaso).toHaveBeenCalledWith(escala, 'c-1'))
  })

  it('caso vindo do MAPA não tem Excluir — conserta-se republicando o turno', () => {
    abrir({ ...casoManual, origem: 'importacao' })
    expect(screen.queryByRole('button', { name: /Excluir este caso/i })).not.toBeInTheDocument()
    expect(screen.getByText(/veio do mapa importado/i)).toBeInTheDocument()
  })

  it('caso sem a marca (legado) também não tem Excluir — a marca vem do banco', () => {
    abrir({ ...casoManual, origem: undefined })
    expect(screen.queryByRole('button', { name: /Excluir este caso/i })).not.toBeInTheDocument()
  })

  it('cirurgia já iniciada empurra para Suspensa em vez de excluir', async () => {
    abrir({ ...casoManual, statusCirurgia: 'iniciada' })
    fireEvent.click(screen.getByRole('button', { name: /Excluir este caso/i }))
    expect(await screen.findByText(/marque Suspensa/i)).toBeInTheDocument()
  })

  it('caso particular avisa que a cobrança NÃO some junto', async () => {
    abrir({ ...casoManual, convenio: 'Particular' })
    fireEvent.click(screen.getByRole('button', { name: /Excluir este caso/i }))
    expect(await screen.findByText(/cobrança já criada em Cirurgias Particulares NÃO some junto/i)).toBeInTheDocument()
  })

  it('o formulário de ADICIONAR não tem Excluir', () => {
    render(<AddCasoSheet escala={escala} turno="matutino" onClose={vi.fn()} />, { wrapper: wrap })
    expect(screen.queryByRole('button', { name: /Excluir este caso/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Adicionar/ })).toBeInTheDocument()
  })
})
