/**
 * Conferência do documento de FIM DE SEMANA (fila única, dono 15/08) —
 * caminho real: upload da foto → Vision (mock, modo fds) → conferência → publicar.
 *
 * Trava:
 *  1. publicar grava o rodapé INVERTIDO (o doc escreve "1º→último a ser
 *     liberado"; o rodapé do app é o inverso) em hospital='fds', casos [];
 *  2. turno sem linha explícita (domingo) nasce com a SUGESTÃO marcada
 *     "Sugerida — ajuste antes de publicar";
 *  3. funcionária (bloco PLANTÃO MATERNO) NUNCA vira posição/linha — só
 *     informativo;
 *  4. nome ambíguo (2+ candidatos no cadastro, sem login) BLOQUEIA publicar;
 *  5. as 4 publicações levam o fds_meta completo (grade/posições/escalação).
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import ImportarEscalaFdsPage from '@/pages/escala-cirurgica/ImportarEscalaFdsPage'

const { svcMock, salvarEscalaTurno, upsertAlias, prepararImagem, rosterHolder } = vi.hoisted(() => ({
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
const SUGESTAO_DOM_MAT = [
  'CRISTINA', 'MATHEUS', 'RAFAEL', 'THAYNA', 'GABRIEL', 'JOAO HENRIQUE', 'GUILHERME DIDOMENICO',
]

async function importar(resposta = RESPOSTA_FDS) {
  svcMock.parseEscalaImagem.mockResolvedValueOnce(resposta)
  const utils = render(<ImportarEscalaFdsPage data="2026-08-15" onClose={vi.fn()} />, { wrapper: wrap })
  const input = utils.container.querySelector('input[type="file"]')
  fireEvent.change(input, { target: { files: [new File(['x'], 'fds.png', { type: 'image/png' })] } })
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

  it('sábado vem "documento"; domingo sem linha explícita nasce com a SUGESTÃO marcada', async () => {
    await importar()
    // 2 turnos do domingo (matutino + vespertino) + a NOITE dos dois dias: o
    // documento não traz linha de liberação noturna, então ela nasce da grade
    // 19-07 marcada como sugestão, para o conferente ajustar (dono 16/08)
    expect(screen.getAllByText('Sugerida — ajuste antes de publicar')).toHaveLength(4)
    // 1º a ser liberado do domingo (sugestão exibida na direção do doc) =
    // reverse(escalação) → GUILHERME DIDOMENICO abre a lista
    const blocosDomingo = screen.getAllByText(/Ordem de liberação · Matutino/)[1]
    expect(blocosDomingo).toBeTruthy()
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
    fireEvent.click(screen.getByRole('button', { name: /Publicar fim de semana \(4 turnos\)/ }))
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
    fireEvent.click(screen.getByRole('button', { name: /Publicar fim de semana \(4 turnos\)/ }))
    await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalledTimes(4))
    const chamadas = salvarEscalaTurno.mock.calls.map(([p]) => p)
    // continua 4 publicações: 'noturno' não é turno de caso no banco
    expect(chamadas.some((p) => p.turno === 'noturno')).toBe(false)
    const sab = chamadas.find((p) => p.data === '2026-08-15' && p.turno === 'matutino')
    // sem linha de noite no documento, a fila nasce da grade 19-07 (P2,P1,P4,P3)
    expect(sab.fdsMeta.ordemNoite).toEqual(['JOAO HENRIQUE', 'GUILHERME DIDOMENICO', 'MATHEUS', 'CRISTINA'])
    // e vai IGUAL nas duas publicações do dia (republicar um turno não apaga a noite)
    const sabVesp = chamadas.find((p) => p.data === '2026-08-15' && p.turno === 'vespertino')
    expect(sabVesp.fdsMeta.ordemNoite).toEqual(sab.fdsMeta.ordemNoite)
  })

  it('a lista da noite é editável na conferência e o que ficar lá é o que publica', async () => {
    await importar()
    const titulo = [...document.querySelectorAll('p')].find((el) => /Ordem de liberação · Noturno/.test(el.textContent))
    const secao = titulo.parentElement.parentElement // div do turno
    const remover = secao.querySelectorAll('[aria-label^="Remover"]')
    expect(remover.length).toBe(4) // os 4 da grade 19-07
    // a lista da conferência corre na direção do DOCUMENTO (1º a ser liberado
    // no topo): remover o 1º tira quem sairia primeiro
    fireEvent.click(remover[0])
    fireEvent.click(screen.getByRole('button', { name: /Publicar fim de semana \(4 turnos\)/ }))
    await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalled())
    const sab = salvarEscalaTurno.mock.calls.map(([p]) => p).find((p) => p.data === '2026-08-15' && p.turno === 'matutino')
    expect(sab.fdsMeta.ordemNoite).toEqual(['JOAO HENRIQUE', 'GUILHERME DIDOMENICO', 'MATHEUS'])
  })

  it('nome ambíguo (2+ candidatos no cadastro, sem login) BLOQUEIA a publicação', async () => {
    rosterHolder.lista = [
      { uid: 'uid-g1', nome: 'GABRIELA SILVA', apelidos: [] },
      { uid: 'uid-g2', nome: 'GABRIELA SOUZA', apelidos: [] },
    ]
    await importar()
    expect(screen.getAllByText(/mais de um candidato no cadastro/).length).toBeGreaterThan(0)
    const botao = screen.getByRole('button', { name: /Publicar fim de semana/ })
    expect(botao.disabled).toBe(true)
    fireEvent.click(botao)
    expect(salvarEscalaTurno).not.toHaveBeenCalled()
  })
})
