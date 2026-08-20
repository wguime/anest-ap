/**
 * CasoDetalheSheet — o detalhe do caso é o MESMO sheet nas abas Completa, Minhas e
 * no painel da linha (Liberações). Os três pedidos do dono de 29/07 que moram no
 * caso passam por aqui, e é isso que estes testes travam:
 *   • RESIDENTE por caso (acompanha; não vira responsável)
 *   • TEMPO faltante DESTA CIRURGIA (≠ do tempo da pessoa, que fica na fila)
 *   • AJUDA marcada à mão, escrevendo no MESMO `ajudaExterna` que a fila lê
 *
 * REDESENHO 17/08 ("Andamento no topo", escolhido em protótipo): o estado abre o
 * painel, a identidade do caso virou cabeçalho e cada campo da Equipe mostra o
 * valor atual com um botão que abre o editor. Os testes seguem o desenho novo —
 * a asserção não afrouxou, mudou o caminho até o mesmo controle.
 *
 * Novo aqui: TROCAR O CIRURGIÃO (dono 17/08). Era o único dado da cirurgia sem
 * conserto no app; grava em `cirurgiao`, o mesmo campo do "Adicionar caso".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import CasoDetalheSheet from '@/pages/escala-cirurgica/CasoDetalheSheet'

const { atualizarCaso, adicionarAjuda, removerAjuda, setStatusCirurgia, setLinhaOverride } = vi.hoisted(() => ({
  atualizarCaso: vi.fn(async () => {}),
  adicionarAjuda: vi.fn(async () => {}),
  removerAjuda: vi.fn(async () => {}),
  setStatusCirurgia: vi.fn(async () => {}),
  setLinhaOverride: vi.fn(async () => {}),
}))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ atualizarCaso, adicionarAjuda, removerAjuda, setStatusCirurgia, setLinhaOverride }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u-eu', displayName: 'Eu Mesmo' } }),
}))
// o detalhe usa o roster de anestesistas só para EXIBIR o nome do cadastro
// (mesma função do cabeçalho da sala) — sem vínculo, cai no texto importado
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({ options: [], rosterByUid: new Map(), resolver: () => null, loading: false }),
}))
vi.mock('@/hooks/useRosterResidentes', () => ({
  default: () => ({
    residentes: [{ uid: 'uid-augusto', nome: 'Augusto' }, { uid: 'uid-jacinta', nome: 'Jacinta' }],
    residenteByUid: new Map([
      ['uid-augusto', { uid: 'uid-augusto', nome: 'Augusto' }],
      ['uid-jacinta', { uid: 'uid-jacinta', nome: 'Jacinta' }],
    ]),
    options: [{ value: 'uid-augusto', label: 'Augusto' }, { value: 'uid-jacinta', label: 'Jacinta' }],
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const caso = {
  id: 'c1', sala: 'Sala 1', ordem: 0, hora: '07:30', anestesista: 'MARILIO',
  cirurgiao: 'Taciana A', procedimento: 'Colecistectomia', turno: 'matutino',
}
const escala = { id: 'e1', hospital: 'hro', data: '2026-07-29', ajudaExterna: {}, casos: [caso] }

const montar = (props = {}, esc = escala) => render(
  <CasoDetalheSheet escala={esc} caso={esc.casos[0]} onClose={vi.fn()} podeEditar {...props} />,
  { wrapper: wrap }
)

/** Abre o bloco de tempo (a linha mostra o valor; o botão abre o editor). */
const abrirTempo = () =>
  fireEvent.click(screen.getByRole('button', { name: /Término desta cirurgia/ }))

beforeEach(() => vi.clearAllMocks())

describe('Residente do caso (dono 29/07)', () => {
  // A LISTA JÁ ABRE (dono 17/08): o seletor fechado exigia um segundo toque só
  // para ver os nomes. O editor vem num sheet próprio, de baixo para cima, para o
  // cartão do caso não mudar de tamanho no meio da leitura.
  it('escolher o residente grava uid + nome no CASO', async () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Trocar residente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Augusto' }))
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ residente: 'Augusto', residenteUserId: 'uid-augusto' })
  })

  it('"Sem residente" limpa os dois campos', async () => {
    const comResidente = { ...caso, residente: 'Augusto', residenteUserId: 'uid-augusto' }
    montar({}, { ...escala, casos: [comResidente] })
    fireEvent.click(screen.getByRole('button', { name: 'Trocar residente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sem residente' }))
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ residente: null, residenteUserId: null })
  })

  it('quem não edita vê o residente só como leitura (sem seletor)', () => {
    const comResidente = { ...caso, residente: 'Augusto', residenteUserId: 'uid-augusto' }
    montar({ podeEditar: false }, { ...escala, casos: [comResidente] })
    expect(screen.getByText('Residente')).toBeTruthy()
    expect(screen.queryByRole('option')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Trocar residente' })).toBeNull()
  })

  it('a interface deixa claro que o residente não responde pelo caso', () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Trocar residente' }))
    expect(screen.getByText(/quem responde por ele continua sendo o anestesista/i)).toBeTruthy()
  })
})

describe('Cirurgião do caso (dono 17/08)', () => {
  // SÓ DIGITAÇÃO (dono 17/08): a lista de sugestões saiu — quem corrige o nome do
  // cirurgião aqui já sabe o nome certo, e a lista atrapalhava mais que ajudava.
  it('trocar o cirurgião grava no CASO — mesmo campo do "Adicionar caso"', async () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Trocar cirurgião' }))
    fireEvent.change(screen.getByPlaceholderText(/Eduardo Baldissera/), { target: { value: 'Liana W' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ cirurgiao: 'Liana W' })
  })

  it('o editor do cirurgião é campo aberto, sem lista de sugestões', () => {
    const outro = { ...caso, id: 'c2', ordem: 1, cirurgiao: 'Liana Winkelmann' }
    montar({}, { ...escala, casos: [caso, outro] })
    fireEvent.click(screen.getByRole('button', { name: 'Trocar cirurgião' }))
    expect(screen.getByPlaceholderText(/Eduardo Baldissera/)).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('option')).toBeNull()
  })

  it('quem não edita não troca o cirurgião', () => {
    montar({ podeEditar: false })
    expect(screen.getByText('Cirurgião')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Trocar cirurgião' })).toBeNull()
  })
})

describe('Dois eixos de status (dono 21/07, desenho 17/08)', () => {
  it('cirurgia TERMINADA desabilita os avisos — os eixos nunca se contradizem', () => {
    montar({}, { ...escala, casos: [{ ...caso, statusCirurgia: 'terminada' }] })
    for (const aviso of ['Atrasada', 'Suspensa', 'Passa para tarde']) {
      expect(screen.getByRole('button', { name: aviso }).disabled).toBe(true)
    }
    expect(screen.getByRole('button', { name: 'Terminada' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('o aviso convive com Iniciada', () => {
    montar({}, { ...escala, casos: [{ ...caso, statusCirurgia: 'iniciada', statusExtra: 'atrasada' }] })
    expect(screen.getByRole('button', { name: 'Iniciada' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Atrasada' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Atrasada' }).disabled).toBe(false)
  })

  it('agrupa em três cartões por assunto (desenho 17/08)', () => {
    // uma pergunta por cartão: que cirurgia é · como ela vai · quem está e onde
    montar()
    expect(screen.getByText('Andamento')).toBeTruthy()
    expect(screen.getByText('Quem está e onde')).toBeTruthy()
  })

  it('o painel acompanha o conteúdo — não nasce com 85% da tela', () => {
    // `POSITION_CLASSES.bottom` do DS fixa h-[85vh]; sem soltar isso, o painel
    // ocupa 85% da tela mesmo com pouca coisa dentro (jsdom não mede layout, então
    // o que dá para travar aqui é a classe que produz o comportamento)
    montar()
    expect(document.querySelector('[data-slot="sheet-content"]').className).toContain('!h-auto')
  })

  it('o procedimento usa a MESMA grafia do card no quadro', () => {
    // o texto importado vem em caixa alta; o card já o passa por fraseClinica e o
    // painel repetia cru — mesmo dado, duas grafias em duas telas do mesmo caso
    montar({}, { ...escala, casos: [{ ...caso, procedimento: 'EXERESE DE NODULO' }] })
    expect(screen.getByText('Exerese de nodulo')).toBeTruthy()
  })

  it('o tipo do caso é badge vermelho, não linha de texto (auditoria 17/08)', () => {
    montar({}, { ...escala, casos: [{ ...caso, tipo: 'emergencia' }] })
    // desde 20/08 "Emergência" aparece duas vezes de propósito: o BADGE do
    // cabeçalho (identidade) e o botão de reclassificar do Andamento (ação).
    expect(document.querySelector('[data-slot="badge"][data-variant="destructive"]').textContent).toBe('Emergência')
    expect(screen.getByRole('button', { name: 'Emergência' }).getAttribute('aria-pressed')).toBe('true')
  })
})

describe('Término DESTA cirurgia (dono 29/07)', () => {
  it('grava o término previsto no caso — e ESPELHA no tempo total (única cirurgia, dono 30/07)', async () => {
    montar()
    abrirTempo()
    fireEvent.click(screen.getByRole('button', { name: '1h' }))
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    const patch = atualizarCaso.mock.calls[0][2]
    expect(patch).toHaveProperty('terminoPrevisto')
    expect(patch.terminoPrevisto).toMatch(/^\d{2}:\d{2}$/)
    // MARILIO tem UMA só cirurgia no turno → o cronômetro da linha (Liberações)
    // acompanha sozinho, com o MESMO horário — os dois campos divergiam
    await waitFor(() => expect(setLinhaOverride).toHaveBeenCalled())
    const [, linha, override] = setLinhaOverride.mock.calls[0]
    expect(linha.chave).toBe('MARILIO')
    expect(override.termino).toBe(patch.terminoPrevisto)
  })

  it('com 2+ cirurgias ativas NÃO espelha — o total da pessoa segue manual', async () => {
    const segundo = { ...caso, id: 'c2', ordem: 1, hora: '09:00', cirurgiao: 'Liana W' }
    montar({}, { ...escala, casos: [caso, segundo] })
    abrirTempo()
    fireEvent.click(screen.getByRole('button', { name: '1h' }))
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(setLinhaOverride).not.toHaveBeenCalled()
  })

  it('o rótulo separa os dois tempos para o plantonista não confundir', () => {
    montar()
    // o bloco diz que é DESTA cirurgia; o tempo da PESSOA é outro campo, na fila
    expect(screen.getByText(/Término desta cirurgia/)).toBeTruthy()
    abrirTempo()
    expect(screen.getByText(/Só desta cirurgia/)).toBeTruthy()
    // as duas entradas são ALTERNATIVAS: o painel abre numa e o alternador leva à outra
    expect(screen.getByRole('button', { name: '1h30' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Horário de término' }))
    expect(document.querySelector('[data-slot="termino-hora"]')).toBeTruthy()
  })

  it('limpar devolve null (o campo volta a vazio, não a "00:00")', async () => {
    montar({}, { ...escala, casos: [{ ...caso, terminoPrevisto: '10:30' }] })
    abrirTempo()
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }))
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ terminoPrevisto: null })
  })
})

describe('Ajuda marcada pela aba Completa (dono 29/07)', () => {
  it('marca a ajuda no turno DO CASO — a fila lê o mesmo ajudaExterna', async () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: /Marcar Marilio como ajuda/ }))
    await waitFor(() => expect(adicionarAjuda).toHaveBeenCalled())
    const [, turno, nome] = adicionarAjuda.mock.calls[0]
    expect(turno).toBe('matutino')
    expect(nome).toBe('MARILIO')
  })

  it('quem já é ajuda desmarca (volta ao estado anterior)', async () => {
    montar({}, { ...escala, ajudaExterna: { matutino: ['MARILIO'] } })
    fireEvent.click(screen.getByRole('button', { name: /Marilio não é ajuda/ }))
    await waitFor(() => expect(removerAjuda).toHaveBeenCalledWith(expect.anything(), 'matutino', 'MARILIO'))
  })

  it('sala compartilhada ("A + B") não oferece marcar — não há um nome só', () => {
    montar({}, { ...escala, casos: [{ ...caso, anestesista: 'MARILIO + KARINE' }] })
    expect(screen.queryByRole('button', { name: /como ajuda/ })).toBeNull()
  })

  it('caso sem dono ("?") também não oferece', () => {
    montar({}, { ...escala, casos: [{ ...caso, anestesista: '?' }] })
    expect(screen.queryByRole('button', { name: /como ajuda/ })).toBeNull()
  })
})

describe('Editores em sheet próprio (dono 17/08)', () => {
  // Expandindo dentro do cartão, o painel mudava de altura no meio da leitura e a
  // pessoa perdia o lugar. Agora cada editor chega por cima, de baixo para cima.
  it('"Definir término" abre um sheet por cima, sem crescer o cartão', () => {
    montar()
    const antes = document.querySelectorAll('[data-slot="sheet-content"], [role="dialog"]').length
    fireEvent.click(screen.getByRole('button', { name: /Definir término|Término desta cirurgia/i }))
    const depois = document.querySelectorAll('[data-slot="sheet-content"], [role="dialog"]').length
    expect(depois).toBeGreaterThan(antes)
    expect(screen.getByText('Tempo faltante')).toBeTruthy()
  })

  it('a lista de sala já vem aberta, com o local atual marcado', () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Mudar sala/local' }))
    // opções visíveis de imediato — sem um segundo toque para abrir seletor
    expect(screen.getByRole('button', { name: /Bloco M - Sala 3/i })).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})

/**
 * GRAVIDADE da urgência (dono 18/08) — mora no cartão Andamento, não no cabeçalho:
 * o cabeçalho é identidade e é leitura; gravidade é decisão que MUDA no tempo (um
 * "pode aguardar" que descompensa vira "imediata"). É ela que ordena a fila de
 * urgências do HRO quando as 2 salas do contrato estão ocupadas.
 */
describe('Gravidade da urgência (dono 18/08)', () => {
  const urgente = { ...caso, tipo: 'urgencia' }
  const escalaUrg = { ...escala, casos: [urgente] }

  it('só aparece em urgência/emergência — cirurgia eletiva não tem fila', () => {
    montar()
    expect(screen.queryByRole('button', { name: 'Pode aguardar' })).toBeNull()

    montar({}, escalaUrg)
    expect(screen.getByRole('button', { name: 'Pode aguardar' })).toBeTruthy()
  })

  it('escolher o nível grava só `gravidade`, sem tocar no status da cirurgia', async () => {
    montar({}, escalaUrg)
    fireEvent.click(screen.getByRole('button', { name: 'Imediata' }))
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ gravidade: 'imediata' })
    expect(setStatusCirurgia).not.toHaveBeenCalled()
  })

  it('tocar de novo no nível ativo desmarca (volta a "sem classificação")', async () => {
    montar({}, { ...escala, casos: [{ ...urgente, gravidade: 'urgente' }] })
    fireEvent.click(screen.getByRole('button', { name: 'Urgente' }))
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ gravidade: null })
  })

  it('sem classificação, avisa que a urgência entra no fim da fila', () => {
    montar({}, escalaUrg)
    expect(screen.getByText(/entra no fim da fila/i)).toBeTruthy()

    montar({}, { ...escala, casos: [{ ...urgente, gravidade: 'imediata' }] })
    expect(screen.queryAllByText(/entra no fim da fila/i)).toHaveLength(1) // só o 1º render
  })
})
