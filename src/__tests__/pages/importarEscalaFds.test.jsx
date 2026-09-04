/**
 * Conferência do documento de FIM DE SEMANA (fila única, dono 15/08) —
 * caminho real: upload da foto → Vision (mock, modo fds) → conferência → publicar.
 *
 * Trava:
 *  1. publicar grava o rodapé INVERTIDO (o doc escreve "1º→último a ser
 *     liberado"; o rodapé do app é o inverso) em hospital='fds', casos [];
 *  2. turno sem linha explícita (domingo) nasce com a SUGESTÃO — o selo saiu da
 *     coluna em 17/08 (dono: "deixe apenas a informação do turno"), mas a origem
 *     continua viajando no fds_meta.ordemFonte;
 *  3. funcionária (bloco PLANTÃO MATERNO) NUNCA vira posição/linha — só
 *     informativo;
 *  4. nome ambíguo (2+ candidatos no cadastro, sem login) BLOQUEIA publicar;
 *  5. as 4 publicações levam o fds_meta completo (grade/posições/escalação).
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import ImportarEscalaFdsPage from '@/pages/escala-cirurgica/ImportarEscalaFdsPage'

const { svcMock, salvarEscalaTurno, upsertAlias, prepararImagem, rosterHolder, getPlantoesMock} = vi.hoisted(() => ({
  getPlantoesMock: vi.fn(async () => []),
  rosterHolder: { lista: [] },
  svcMock: { parseEscalaImagem: vi.fn() },
  salvarEscalaTurno: vi.fn(async (p) => ({ id: 'fds1', ...p })),
  upsertAlias: vi.fn(async () => {}),
  prepararImagem: vi.fn(async () => ({ base64: 'AAAA', mimeType: 'image/jpeg', bytes: 3, largura: 1600, altura: 1200, reduzida: true })),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ salvarEscalaTurno }),
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u-sec', role: 'secretaria', displayName: 'Secretária' } }),
}))
vi.mock('@/lib/imagemVision', () => ({ prepararImagemParaVision: prepararImagem }))
vi.mock('@/services/supabaseEscalaAnestesistaService', () => ({ isPermissionError: () => false }))
vi.mock('@/services/pegaPlantaoApi', () => ({ getPlantoes: (...a) => getPlantoesMock(...a) }))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: rosterHolder.lista, aliases: [], loading: false,
    rosterByUid: new Map(rosterHolder.lista.map((r) => [r.uid, r])),
    options: rosterHolder.lista.map((r) => ({ value: r.uid, label: r.nome })),
    resolver: () => null,
    refresh: vi.fn(), upsertAlias, removeAlias: vi.fn(),
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

// ── resposta da edge (modo fds) com o documento real de 15–16/08 ────────────
const RESPOSTA_FDS = {
  dias: [
    {
      data: '2026-08-15',
      plantoes: { P1: 'GUILHERME DIDOMENICO', P2: 'JOAO HENRIQUE', P3: 'CRISTINA', P4: 'MATHEUS' },
      grade: {
        '7-13': { unimed: 'GUILHERME DIDOMENICO', hro: 'JOAO HENRIQUE', ret1: 'CRISTINA', ret2: 'MATHEUS' },
        '13-19': { unimed: 'CRISTINA', hro: 'MATHEUS', ret1: 'GUILHERME DIDOMENICO', ret2: 'JOAO HENRIQUE' },
        '19-07': { unimed: 'JOAO HENRIQUE', hro: 'GUILHERME DIDOMENICO', ret1: 'MATHEUS', ret2: 'CRISTINA' },
      },
      listas: {
        matutino: [
          { n: 5, nome: 'GABRIELA' }, { n: 6, nome: 'ERLEI' }, { n: 7, nome: 'MARILIO' }, { n: 8, nome: 'RAFAEL' },
          { n: 9, nome: 'ROBERTA' }, { n: 10, nome: 'STAUB' }, { n: 11, nome: 'GABRIEL' }, { n: 12, nome: 'VICENTE' },
        ],
        vespertino: [
          { n: 6, nome: 'ERLEI' }, { n: 5, nome: 'GABRIELA' }, { n: 9, nome: 'ROBERTA' },
          { n: 10, nome: 'STAUB' }, { n: 11, nome: 'GABRIEL' },
        ],
      },
      ordemLiberacaoDoc: {
        matutino: ['P4', 'P3', 'P12', 'P09', 'P10', 'P11', 'P6', 'P5', 'P8', 'P7', 'P2', 'P1'],
        vespertino: ['P11', 'P10', 'P9', 'P5', 'P6', 'P4', 'P3'],
      },
    },
    {
      data: '2026-08-16',
      grade: {
        '7-13': { unimed: 'CRISTINA', hro: 'MATHEUS', ret1: 'JOAO HENRIQUE', ret2: 'GUILHERME DIDOMENICO' },
        '13-19': { unimed: 'GUILHERME DIDOMENICO', hro: 'JOAO HENRIQUE', ret1: 'MATHEUS', ret2: 'CRISTINA' },
        '19-07': { unimed: 'JOAO RICARDO', hro: 'MATHEUS', ret1: 'GUILHERME DIDOMENICO', ret2: 'JOAO HENRIQUE' },
      },
      listas: {
        matutino: [{ n: 8, nome: 'RAFAEL' }, { n: 7, nome: 'THAYNA' }, { n: 11, nome: 'GABRIEL' }],
        vespertino: [{ n: 7, nome: 'THAYNA' }, { n: 8, nome: 'RAFAEL' }, { n: 11, nome: 'GABRIEL' }],
      },
      ordemLiberacaoDoc: { matutino: [], vespertino: [] },
    },
  ],
  ignorados: ['PLANTÃO MATERNO: 15/08 – RENATA', 'PLANTÃO MATERNO: 16/08 – ELISETE'],
}

const RODAPE_SAB_MAT = [
  'GUILHERME DIDOMENICO', 'JOAO HENRIQUE', 'MARILIO', 'RAFAEL', 'GABRIELA', 'ERLEI',
  'GABRIEL', 'STAUB', 'ROBERTA', 'VICENTE', 'CRISTINA', 'MATHEUS',
]

const LISTA_FERIADO_25_08 = [
  'FERNANDA', 'DANIELA', 'GABRIELA', 'OSCAR', 'ADRIANO', 'GIOVANA', 'MARILIO', 'VICENTE',
  'TIAGO', 'JOAO RICARDO', 'RAUL', 'NATHALIA', 'GUILHERME MELO', 'ROSE', 'GABRIEL',
  'GARIM', 'CURY', 'KLISMAN', 'KARINE', 'ALEXANDRE S', 'ALEXANDRE D', 'GUILHERME DIDOMENICO',
]
const RESPOSTA_FERIADO = {
  dias: [{ data: '2026-08-25', listaFeriado: LISTA_FERIADO_25_08 }],
  ignorados: [],
}
const SUGESTAO_DOM_MAT = [
  'CRISTINA', 'MATHEUS', 'RAFAEL', 'THAYNA', 'GABRIEL', 'JOAO HENRIQUE', 'GUILHERME DIDOMENICO',
]

/**
 * A tela abre na LISTA DE DOCUMENTOS desde 2026-08-22 (os mapas cirúrgicos do
 * fim de semana entram na mesma entrada). A tabela de posições é o primeiro item
 * e a conferência dela — que é o que este arquivo cobre — abre por "Anexar ›".
 * As asserções abaixo são as mesmas de antes; só o caminho até a tela mudou.
 */
async function importar(resposta = RESPOSTA_FDS) {
  svcMock.parseEscalaImagem.mockResolvedValueOnce(resposta)
  const utils = render(<ImportarEscalaFdsPage data="2026-08-15" onClose={vi.fn()} />, { wrapper: wrap })
  fireEvent.click(await screen.findByRole('button', { name: /Anexar/ }))
  await screen.findByText('Posições e fila', { selector: 'h1' })
  const input = utils.container.querySelector('input[type="file"]')
  fireEvent.change(input, { target: { files: [new File(['x'], 'fds.png', { type: 'image/png' })] } })
  await waitFor(() => expect(svcMock.parseEscalaImagem).toHaveBeenCalled())
  return utils
}

/** Volta da conferência da grade para a lista e publica o fim de semana. */
async function publicarFds() {
  fireEvent.click(await screen.findByRole('button', { name: /Concluir conferência/ }))
  const botao = await screen.findByRole('button', { name: /Publicar fim de semana/ })
  await waitFor(() => expect(botao).not.toBeDisabled())
  fireEvent.click(botao)
}

async function importarFeriado() {
  svcMock.parseEscalaImagem.mockResolvedValueOnce(RESPOSTA_FERIADO)
  const utils = render(<ImportarEscalaFdsPage data="2026-08-25" onClose={vi.fn()} />, { wrapper: wrap })
  fireEvent.click(await screen.findByRole('button', { name: /Anexar/ }))
  await screen.findByText('Lista e fila', { selector: 'h1' })
  const input = utils.container.querySelector('input[type="file"]')
  fireEvent.change(input, { target: { files: [new File(['x'], 'feriado.png', { type: 'image/png' })] } })
  await waitFor(() => expect(svcMock.parseEscalaImagem).toHaveBeenCalled())
  return utils
}

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-08-14T10:00:00-03:00')) // sexta: importa p/ o FDS 15–16
})
afterAll(() => vi.useRealTimers())
beforeEach(() => {
  rosterHolder.lista = []
  svcMock.parseEscalaImagem.mockReset()
  salvarEscalaTurno.mockClear()
  upsertAlias.mockClear()
})

describe('Conferência do FDS — leitura e sugestão', () => {
  it('chama a edge em modo fds com as datas de referência do FDS selecionado', async () => {
    await importar()
    expect(svcMock.parseEscalaImagem).toHaveBeenCalledWith(expect.objectContaining({
      modo: 'fds', refSabado: '2026-08-15', refDomingo: '2026-08-16',
    }))
  })

  it('sábado vem "documento"; domingo sem linha explícita nasce da SUGESTÃO', async () => {
    await importar()
    // O SELO saiu da coluna (dono 17/08: só o nome do turno). A origem segue
    // sendo publicada — é ela que a fila usa depois: 2 turnos do domingo
    // (matutino + vespertino) + a NOITE dos dois dias nascem de sugestão,
    // porque o documento não traz linha de liberação noturna (dono 16/08).
    expect(screen.queryByText(/Sugerida/)).toBeNull()
    // as três colunas de turno estão na tela, uma por dia (o rótulo se repete na
    // linha de "acrescentar por login" do mesmo turno). Conferido ANTES de
    // publicar: publicar volta para a lista de documentos.
    expect(screen.getAllByText('Manhã').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Noite').length).toBeGreaterThanOrEqual(2)
    await publicarFds()
    await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalledTimes(4))
    const chamadas = salvarEscalaTurno.mock.calls.map(([p]) => p)
    const sab = chamadas.find((p) => p.data === '2026-08-15' && p.turno === 'matutino')
    const dom = chamadas.find((p) => p.data === '2026-08-16' && p.turno === 'matutino')
    expect(sab.fdsMeta.ordemFonte.matutino).toBe('documento')
    expect(sab.fdsMeta.ordemFonte.noturno).toBe('sugerida')
    expect(dom.fdsMeta.ordemFonte.matutino).toBe('sugerida')
  })

  it('funcionárias do PLANTÃO MATERNO ficam SÓ no informativo — nunca viram posição/ordem', async () => {
    await importar()
    expect(screen.getByText(/funcionárias têm escala própria/)).toBeTruthy()
    expect(screen.getByText(/RENATA/)).toBeTruthy() // no informativo
    // nenhum input de posição/ordem contém RENATA/ELISETE
    const inputs = [...document.querySelectorAll('input')]
    expect(inputs.some((i) => /RENATA|ELISETE/i.test(i.value))).toBe(false)
  })
})

describe('Publicação — inversão na fronteira + fds_meta', () => {
  it('publica 4 turnos em hospital fds, casos [], rodapé INVERTIDO e meta completo', async () => {
    await importar()
    await publicarFds()
    await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalledTimes(4))

    const chamadas = salvarEscalaTurno.mock.calls.map(([p]) => p)
    expect(chamadas.every((p) => p.hospital === 'fds' && Array.isArray(p.casos) && p.casos.length === 0)).toBe(true)

    const sabMat = chamadas.find((p) => p.data === '2026-08-15' && p.turno === 'matutino')
    // INVERSÃO: doc "P4,P3,P12,P09,…,P2,P1" → rodapé abre com P1,P2 e fecha com P4
    expect(sabMat.ordemLiberacao).toEqual(RODAPE_SAB_MAT)
    expect(sabMat.fdsMeta.posicoes.P12).toBe('VICENTE')
    expect(sabMat.fdsMeta.grade['19-07'].unimed).toBe('JOAO HENRIQUE')
    expect(sabMat.fdsMeta.escalacao.vespertino).toEqual(['P6', 'P5', 'P9', 'P10', 'P11'])
    expect(sabMat.fdsMeta.ordemFonte.matutino).toBe('documento')

    const sabVesp = chamadas.find((p) => p.data === '2026-08-15' && p.turno === 'vespertino')
    expect(sabVesp.ordemLiberacao).toEqual(['CRISTINA', 'MATHEUS', 'ERLEI', 'GABRIELA', 'ROBERTA', 'STAUB', 'GABRIEL'])

    const domMat = chamadas.find((p) => p.data === '2026-08-16' && p.turno === 'matutino')
    // sugestão JÁ é a ordem de escalação (convenção do rodapé) — publicada como veio
    expect(domMat.ordemLiberacao).toEqual(SUGESTAO_DOM_MAT)
    expect(domMat.fdsMeta.ordemFonte.matutino).toBe('sugerida')
    // troca pessoal do domingo (7º=THAYNA) venceu a herança do sábado (7º=MARILIO)
    expect(domMat.fdsMeta.posicoes.P7).toBe('THAYNA')
    expect(domMat.fdsMeta.posicoes.P12).toBe('VICENTE') // herdado
  })

  it('a fila da NOITE viaja no fds_meta.ordemNoite (dono 16/08) — sem virar turno no banco', async () => {
    await importar()
    await publicarFds()
    await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalledTimes(4))
    const chamadas = salvarEscalaTurno.mock.calls.map(([p]) => p)
    // continua 4 publicações: 'noturno' não é turno de caso no banco
    expect(chamadas.some((p) => p.turno === 'noturno')).toBe(false)
    const sab = chamadas.find((p) => p.data === '2026-08-15' && p.turno === 'matutino')
    // A fila nasce da grade 19-07 (P2,P1,P4,P3) MAIS os numerados da noite
    // (P11,P8,P7). ⚠️ até 29/08 este teste esperava só os quatro da grade, e
    // era essa falta que fazia o dono completar a fila à mão todo fim de semana
    // ("faltam P5, P6, P7 e P8"). O valor abaixo é, caractere por caractere, o
    // que a migration 20260816120000 gravou depois de ele ditar a ordem — ou
    // seja, a importação agora produz sozinha o que antes era conserto manual.
    expect(sab.fdsMeta.ordemNoite).toEqual([
      'JOAO HENRIQUE', 'GUILHERME DIDOMENICO', 'MATHEUS', 'CRISTINA', 'GABRIEL', 'RAFAEL', 'MARILIO',
    ])
    // e vai IGUAL nas duas publicações do dia (republicar um turno não apaga a noite)
    const sabVesp = chamadas.find((p) => p.data === '2026-08-15' && p.turno === 'vespertino')
    expect(sabVesp.fdsMeta.ordemNoite).toEqual(sab.fdsMeta.ordemNoite)
  })

  it('a lista da noite é editável na conferência e o que ficar lá é o que publica', async () => {
    await importar()
    // Desde 17/08 a coluna só lista; mover/remover abre no editor abaixo dela
    // (três botões não cabem numa coluna de ~130px).
    // [0] = sábado (os dois dias ficam empilhados na mesma tela)
    const primeiroDaNoite = screen.getAllByRole('button', { name: /^Posição 1 de Noite/ })[0]
    fireEvent.click(primeiroDaNoite)
    // a lista da conferência corre na direção do DOCUMENTO (1º a ser liberado
    // no topo): remover o 1º tira quem sairia primeiro — hoje o MARILIO (P7),
    // o último numerado da fila da noite
    fireEvent.click(screen.getByRole('button', { name: /Remover/i }))
    await publicarFds()
    await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalled())
    const sab = salvarEscalaTurno.mock.calls.map(([p]) => p).find((p) => p.data === '2026-08-15' && p.turno === 'matutino')
    expect(sab.fdsMeta.ordemNoite).toEqual([
      'JOAO HENRIQUE', 'GUILHERME DIDOMENICO', 'MATHEUS', 'CRISTINA', 'GABRIEL', 'RAFAEL',
    ])
  })

  it('nome ambíguo (2+ candidatos no cadastro, sem login) BLOQUEIA a publicação', async () => {
    rosterHolder.lista = [
      { uid: 'uid-g1', nome: 'GABRIELA SILVA', apelidos: [] },
      { uid: 'uid-g2', nome: 'GABRIELA SOUZA', apelidos: [] },
    ]
    await importar()
    expect(screen.getAllByText(/mais de um candidato no cadastro/).length).toBeGreaterThan(0)
    fireEvent.click(await screen.findByRole('button', { name: /Concluir conferência/ }))
    const botao = await screen.findByRole('button', { name: /Publicar fim de semana/ })
    expect(botao.disabled).toBe(true)
    fireEvent.click(botao)
    expect(salvarEscalaTurno).not.toHaveBeenCalled()
  })
})

describe('FERIADO — lista simples na mesma entrada da fila única', () => {
  it('publica os 22 nomes nos dois turnos, com sentidos opostos e sem posições Pn', async () => {
    await importarFeriado()
    expect(svcMock.parseEscalaImagem).toHaveBeenCalledWith(expect.objectContaining({
      modo: 'fds', refFeriado: '2026-08-25',
    }))
    expect(svcMock.parseEscalaImagem.mock.calls[0][0]).not.toHaveProperty('refSabado')
    expect(screen.queryByText('Plantões (grade)')).toBeNull()
    expect(screen.queryByText('Posições (Pn → pessoa)')).toBeNull()
    expect(screen.getAllByRole('button', { name: /^Posição 1 de Manhã/ })[0].textContent).toContain('Fernanda')
    expect(screen.getByText(/Em cada turno, quem está no FIM da fila/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Posição 1 de Tarde/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Concluir conferência/ }))
    const botao = await screen.findByRole('button', { name: /Publicar feriado/ })
    await waitFor(() => expect(botao).not.toBeDisabled())
    fireEvent.click(botao)
    await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalledTimes(2))

    const chamadas = salvarEscalaTurno.mock.calls.map(([p]) => p)
    const manha = chamadas.find((p) => p.turno === 'matutino')
    const tarde = chamadas.find((p) => p.turno === 'vespertino')
    expect(manha.hospital).toBe('fds')
    expect(manha.ordemLiberacao).toHaveLength(22)
    expect(tarde.ordemLiberacao).toHaveLength(22)
    // RODAPÉ (1ª posição = ÚLTIMA a sair): a manhã sai na ordem da folha, a
    // tarde de trás para frente. Invertido, o defeito de 24/08 volta.
    expect(manha.ordemLiberacao).toEqual(LISTA_FERIADO_25_08)
    expect(manha.ordemLiberacao.at(-1)).toBe('GUILHERME DIDOMENICO') // 1º liberado de manhã
    expect(tarde.ordemLiberacao).toEqual([...LISTA_FERIADO_25_08].reverse())
    expect(tarde.ordemLiberacao.at(-1)).toBe('FERNANDA')             // 1ª liberada à tarde
    expect(manha.fdsMeta).toMatchObject({
      tipo: 'feriado', posicoes: {}, ordemNoite: [], listaFonte: LISTA_FERIADO_25_08,
    })
  })

  /**
   * A conferência é a TRANSCRIÇÃO da folha: ela mostra a lista na ordem escrita
   * e é por esse índice que Subir/Descer/Remover cortam o array. Exibir a lista
   * já invertida por turno (como ficou na 1ª tentativa) faz o botão mexer na
   * pessoa errada, em silêncio.
   */
  it('mostra a folha na ordem escrita e Descer move a linha que está na tela', async () => {
    await importarFeriado()
    const rotulos = () => screen.getAllByRole('button', { name: /^Posição \d+ de Manhã/ })
      .map((b) => b.getAttribute('aria-label'))
    expect(rotulos()).toHaveLength(22)
    expect(rotulos()[0]).toMatch(/Posição 1 de Manhã: FERNANDA/i)
    expect(rotulos()[1]).toMatch(/Posição 2 de Manhã: DANIELA/i)
    expect(rotulos().at(-1)).toMatch(/Posição 22 de Manhã: GUILHERME DIDOMENICO/i)

    fireEvent.click(screen.getByRole('button', { name: /^Posição 1 de Manhã/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Descer uma posição' }))
    expect(rotulos()[0]).toMatch(/Posição 1 de Manhã: DANIELA/i)
    expect(rotulos()[1]).toMatch(/Posição 2 de Manhã: FERNANDA/i)
  })
})

/**
 * LAYOUT DA CONFERÊNCIA (dono 17/08, escolha em protótipo a 430px):
 *  · P1–P12 corre em DUAS COLUNAS, para baixo — em linha, as doze posições
 *    empurravam a ordem de liberação para fora da tela;
 *  · as três listas de liberação ficam LADO A LADO (manhã · tarde · noite), com
 *    o cabeçalho só do turno e o ordinal colado ao nome;
 *  · o que não cabe em coluna estreita — o par texto+login, os botões de mover —
 *    abre num editor FORA das colunas.
 */
describe('FDS — colunas da conferência', () => {
  it('lista P1–P12 em duas colunas e abre texto+login fora delas', async () => {
    await importar()
    const chips = screen.getAllByRole('button', { expanded: false })
      .filter((b) => /^P\d+/.test(b.textContent))
    expect(chips.length).toBeGreaterThanOrEqual(12)
    expect(chips[0].closest('div').className).toContain('columns-2')
    // fechado, o chip não traz campo nenhum; ao abrir, vêm o texto e o login
    fireEvent.click(chips[0])
    const editor = await screen.findByText(/^Posição P1$/)
    expect(editor.parentElement.querySelector('input')).toBeTruthy()
    expect(within(editor.parentElement).getByText(/login escolhido vence o texto/i)).toBeTruthy()
  })

  it('põe manhã, tarde e noite lado a lado, com o ordinal antes do nome', async () => {
    await importar()
    const primeiro = screen.getAllByRole('button', { name: /^Posição 1 de Manhã/ })[0]
    // "1º Matheus": ordinal colado ao nome, nome curto para caber na coluna
    expect(primeiro.textContent).toMatch(/1º\s*Matheus/)
    // as três colunas vivem no mesmo grid
    expect(primeiro.closest('.grid').className).toContain('grid-cols-3')
  })

  it('cabeçalho da coluna leva SÓ o nome do turno', async () => {
    await importar()
    const primeiro = screen.getAllByRole('button', { name: /^Posição 1 de Manhã/ })[0]
    const coluna = primeiro.closest('div')            // a coluna do turno
    const cabecalho = coluna.querySelector('p')
    expect(cabecalho.textContent.trim()).toBe('Manhã') // sem "do documento"/"Sugerida"
    expect(screen.queryByText(/Sugerida/)).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// A FOLHA LIDA × A ESCALA DE FERIADOS PUBLICADA (dono 03/09).
//
// No feriado a fila do dia inteiro sai de UMA folha fotografada: se a leitura troca, perde
// ou embaralha um nome, a fila nasce errada e não havia segunda fonte na tela. O documento
// "FERIADOS 2026" que o grupo publica é essa segunda fonte e vive no mesmo dataset da
// escala numérica. Divergência é AVISO — troca de plantão acontece —, nunca bloqueio.
// ════════════════════════════════════════════════════════════════════════════
describe('feriado — a folha lida é conferida contra a escala publicada', () => {
  // 25/08, Dia do Município, como publicado
  const PUBLICADA_25_08 = [
    'FERNANDA', 'GABRIELA', 'RAQUEL', 'ADRIANO', 'ROBERTA', 'LOUISE', 'MARILIO', 'KLISMAN',
    'TIAGO', 'JOAO', 'RAUL', 'GUILHERME', 'ROSE/ALINE', 'GABRIEL', 'GARIM', 'CURY',
    'VICENTE', 'KARINE', 'ALEXANDRE S', 'MATHEUS',
  ]
  const importarLista = async (lista) => {
    svcMock.parseEscalaImagem.mockResolvedValueOnce({ dias: [{ data: '2026-08-25', listaFeriado: lista }], ignorados: [] })
    const utils = render(<ImportarEscalaFdsPage data="2026-08-25" onClose={vi.fn()} />, { wrapper: wrap })
    fireEvent.click(await screen.findByRole('button', { name: /Anexar/ }))
    await screen.findByText('Lista e fila', { selector: 'h1' })
    fireEvent.change(utils.container.querySelector('input[type="file"]'), {
      target: { files: [new File(['x'], 'feriado.png', { type: 'image/png' })] },
    })
    await waitFor(() => expect(svcMock.parseEscalaImagem).toHaveBeenCalled())
    fireEvent.click(await screen.findByRole('button', { name: /Concluir conferência/ }))
    return utils
  }

  it('folha igual à publicada não gera aviso', async () => {
    await importarLista(PUBLICADA_25_08)
    await waitFor(() => expect(screen.queryByText(/Difere da escala de/i)).toBeNull())
  })

  it('nome trocado na leitura é nomeado, dos dois lados', async () => {
    const comErro = PUBLICADA_25_08.map((n) => (n === 'RAQUEL' ? 'RAFAEL' : n))
    await importarLista(comErro)
    const aviso = await screen.findByText(/Difere da escala de DIA DO MUNICIPIO/i)
    expect(aviso.textContent).toMatch(/RAQUEL/)   // está na publicada e sumiu da leitura
    expect(aviso.textContent).toMatch(/RAFAEL/)   // apareceu na leitura e não é do feriado
  })

  it('feriado fora do documento publicado não compara nada', async () => {
    // 15/11 é feriado no app e NÃO está na folha "FERIADOS 2026" — sem segunda fonte,
    // a tela não inventa comparação (a lacuna está registrada para o dono)
    svcMock.parseEscalaImagem.mockResolvedValueOnce({ dias: [{ data: '2026-11-15', listaFeriado: ['FERNANDA', 'TIAGO'] }], ignorados: [] })
    const utils = render(<ImportarEscalaFdsPage data="2026-11-15" onClose={vi.fn()} />, { wrapper: wrap })
    fireEvent.click(await screen.findByRole('button', { name: /Anexar/ }))
    await screen.findByText('Lista e fila', { selector: 'h1' })
    fireEvent.change(utils.container.querySelector('input[type="file"]'), {
      target: { files: [new File(['x'], 'f.png', { type: 'image/png' })] },
    })
    await waitFor(() => expect(svcMock.parseEscalaImagem).toHaveBeenCalled())
    fireEvent.click(await screen.findByRole('button', { name: /Concluir conferência/ }))
    await waitFor(() => expect(screen.queryByText(/Difere da escala de/i)).toBeNull())
  })
})

// ════════════════════════════════════════════════════════════════════════════
// A TABELA DE POSIÇÕES É CONFERIDA CONTRA O PEGA PLANTÃO (dono 04/09).
//
// Era o buraco que sobrava: no dia útil a escala numérica confere o rodapé, no feriado a
// folha publicada confere a lista, e no fim de semana a única fonte era a própria foto. O
// dono apontou a segunda fonte: "a escala é vista no Pega Plantão; de P1 a P4 a ordem pode
// variar entre esses quatro, de P5 a P12 a ordem está correta". Só o SÁBADO é consultado —
// a tabela vale os dois dias.
// ════════════════════════════════════════════════════════════════════════════
describe('fim de semana — posições conferidas no Pega Plantão', () => {
  // o documento da fixture traz P1–P4; o Pega Plantão do sábado 15/08 espelha as MESMAS
  // pessoas, escritas como o sistema de plantão escreve (nome completo, "Di Domenico")
  const pp = (n, nome) => ({ Setor: `${n} - P${n}`, ProfDePlantao: nome, Inicio: '2026-08-15T07:00:00' })
  const PP_IGUAL = [
    pp(1, 'Guilherme Xavier Di Domenico'), pp(2, 'Joao Henrique Salvao Vanni'),
    pp(3, 'Cristina Bertol Barbosa Marcon'), pp(4, 'Matheus Lemos Vieira da Cunha'),
    pp(5, 'Gabriela Citron Vedana'), pp(6, 'Erlei Perini'), pp(7, 'Marilio Jose Flach'),
    pp(8, 'Rafael Pelissaro'), pp(9, 'Roberta Marina Grando'), pp(10, 'Guilherme Jonck Staub'),
    pp(11, 'Gabriel Juan Kettenhuber Costa'), pp(12, 'Vicente Antonio Alves Pons'),
  ]
  const conferir = async () => {
    await importar()
    fireEvent.click(await screen.findByRole('button', { name: /Concluir conferência/ }))
    await waitFor(() => expect(getPlantoesMock).toHaveBeenCalled())
  }

  it('leitura que bate com o Pega Plantão não gera aviso', async () => {
    getPlantoesMock.mockResolvedValueOnce(PP_IGUAL)
    await conferir()
    expect(screen.queryByText(/Tabela de posições —/i)).toBeNull()
  })

  it('pessoa que não está no bloco P1–P4 do Pega Plantão é divergência, com os dois lados', async () => {
    getPlantoesMock.mockResolvedValueOnce([
      ...PP_IGUAL.slice(0, 2), pp(3, 'Thayna Regina Santos'), ...PP_IGUAL.slice(3),
    ])
    await conferir()
    const aviso = await screen.findByText(/Tabela de posições —/i)
    expect(aviso.textContent).toMatch(/P3/)
    expect(aviso.textContent).toMatch(/Thayna/i)
    expect(aviso.textContent).toMatch(/CRISTINA/i)
  })

  it('as MESMAS pessoas em posições trocadas dentro de P1–P4 pedem confirmação, não acusam erro', async () => {
    getPlantoesMock.mockResolvedValueOnce([
      pp(1, 'Joao Henrique Salvao Vanni'), pp(2, 'Guilherme Xavier Di Domenico'),
      ...PP_IGUAL.slice(2),
    ])
    await conferir()
    const aviso = await screen.findByText(/Tabela de posições —/i)
    expect(aviso.textContent).toMatch(/confirme a ordem entre P1 e P4/i)
    expect(aviso.textContent).not.toMatch(/difere no Pega Plantão/i)
  })

  it('sem resposta do Pega Plantão a tela não inventa comparação', async () => {
    getPlantoesMock.mockRejectedValueOnce(new Error('sem rede'))
    await conferir()
    expect(screen.queryByText(/Tabela de posições —/i)).toBeNull()
  })

  it('consulta SÓ o sábado — a tabela vale os dois dias (dono 04/09)', async () => {
    getPlantoesMock.mockResolvedValueOnce(PP_IGUAL)
    await conferir()
    const [filtros] = getPlantoesMock.mock.calls[0]
    expect(filtros.dataInicio).toMatch(/^2026-08-15/)
    expect(filtros.dataFim).toMatch(/^2026-08-15/)
  })
})
