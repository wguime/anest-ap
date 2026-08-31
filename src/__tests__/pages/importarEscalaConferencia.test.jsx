/**
 * Conferência da importação — pedido do dono 27/07: sala/bloco com MAIS DE UM
 * anestesista (IOSC, Exames, seções de outro hospital) tem que aparecer SEPARADO,
 * cada anestesista com o seu cirurgião. Agrupar tudo numa sala só foi o que
 * achatou o IOSC em 23/07 (3 linhas saíram para uma pessoa e 2 sumiram).
 *
 * Exercita o caminho real: upload da imagem → Vision (mock) → conferência.
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import ImportarEscalaPage from '@/pages/escala-cirurgica/ImportarEscalaPage'

// roster MUTÁVEL: o guardrail de nome ambíguo (dono 11/08) precisa de dois
// homônimos cadastrados; os demais testes seguem com o roster vazio.
const { svcMock, salvarEscala, upsertAlias, prepararImagem, rosterHolder } = vi.hoisted(() => ({
  rosterHolder: { lista: [] },
  svcMock: {
    parseEscalaImagem: vi.fn(),
    fetchEscala: vi.fn(async () => null),
    updateAnestesistaCasos: vi.fn(async () => {}),
  },
  salvarEscala: vi.fn(async (p) => ({ id: 'e1', ...p, casos: p.casos.map((c, i) => ({ ...c, id: `c${i}`, ordem: i })) })),
  upsertAlias: vi.fn(async () => {}),
  prepararImagem: vi.fn(async () => ({
    base64: 'AAAA', mimeType: 'image/jpeg', bytes: 3, largura: 1600, altura: 1200, reduzida: true,
  })),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseCirurgiasParticularesService', () => ({
  default: {
    // aviso de tempo estourado (24/08): sem isto o hook rejeita solto
    reservarAvisoTempo: vi.fn(async () => false), completarPacienteDoCaso: vi.fn(async () => {}) },
}))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ salvarEscala }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u-sec', role: 'secretaria', displayName: 'Secretária' } }),
}))
// Preparo da imagem tem teste próprio (src/__tests__/lib/imagemVision.test.js).
// Aqui ele é mockado: em jsdom o <img> nunca responde e a conferência ficaria
// esperando o timeout de decodificação em cada caso.
vi.mock('@/lib/imagemVision', () => ({
  prepararImagemParaVision: prepararImagem,
}))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: rosterHolder.lista, aliases: [], loading: false,
    rosterByUid: new Map([['uid-cury', { uid: 'uid-cury', nome: 'GUSTAVO CURY', apelidos: ['CURY'] }]]),
    options: [{ value: 'uid-cury', label: 'Gustavo Cury' }],
    resolver: (nome) => (String(nome).trim().toUpperCase() === 'CURY' ? 'uid-cury' : null),
    refresh: vi.fn(), upsertAlias, removeAlias: vi.fn(),
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

/** Sobe uma "imagem" da escala — a extração em si é o mock da Vision. */
async function importar(casos, ordemLiberacao = [], { hospital = 'hro' } = {}) {
  svcMock.parseEscalaImagem.mockResolvedValueOnce({ casos, ordemLiberacao, ajudaExterna: [] })
  const { container } = render(<ImportarEscalaPage hospital={hospital} data="2026-07-28" onClose={vi.fn()} />, { wrapper: wrap })
  const input = container.querySelector('input[type="file"]')
  const file = new File(['x'], 'escala.png', { type: 'image/png' })
  fireEvent.change(input, { target: { files: [file] } })
  await waitFor(() => expect(svcMock.parseEscalaImagem).toHaveBeenCalled())
  return container
}

/** Cabeçalho de um bloco da conferência (o botão que abre os casos). */
const blocos = (container) =>
  [...container.querySelectorAll('button[aria-expanded]')]
    // a lista do rodapé também tem linhas expansíveis com "N casos" — ela vive
    // em <li>, os blocos da conferência não.
    .filter((b) => !b.closest('li'))
    .filter((b) => /\d+ caso/.test(b.textContent))

// RELÓGIO CONGELADO às 10h (mesma lição do liberacoesPainelLinha, ontem às 23h):
// `periodo` da página nasce de turnoAtual(), então testes com fixture MATUTINA
// passavam de manhã e quebravam à tarde — o publicar gravava em `vespertino` e o
// cruzamento não achava o rodapé matutino do outro hospital.
beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-07-28T10:00:00-03:00'))
})
afterAll(() => vi.useRealTimers())

beforeEach(() => {
  svcMock.parseEscalaImagem.mockReset()
  // sem isto, a implementação instalada pelo describe do cruzamento VAZA para os
  // testes seguintes: a tela enxerga uma escala de outro hospital que não existe
  // no fixture e o publicar para no guardrail de duplicidade.
  svcMock.fetchEscala.mockReset()
  svcMock.fetchEscala.mockResolvedValue(null)
  salvarEscala.mockClear()
  svcMock.updateAnestesistaCasos.mockClear()
  upsertAlias.mockReset()
  upsertAlias.mockResolvedValue({})
  prepararImagem.mockReset()
  prepararImagem.mockResolvedValue({
    base64: 'AAAA', mimeType: 'image/jpeg', bytes: 3, largura: 1600, altura: 1200, reduzida: true,
  })
})

describe('Conferência — bloco por anestesista (dono 27/07)', () => {
  const IOSC = [
    { sala: 'IOSC', hora: '08:00', anestesista: 'CURY', cirurgiao: 'DR. ANA SOUZA', procedimento: 'Catarata', pacienteIniciais: 'A.B.' },
    { sala: 'IOSC', hora: '09:00', anestesista: 'MELO', cirurgiao: 'DR. BRUNO LIMA', procedimento: 'Vitrectomia', pacienteIniciais: 'C.D.' },
    { sala: 'IOSC', hora: '10:00', anestesista: 'DIDOMENICO', cirurgiao: 'DR. CARLA DIAS', procedimento: 'Facectomia', pacienteIniciais: 'E.F.' },
  ]

  it('IOSC com 3 anestesistas rende 3 blocos, cada um com o SEU cirurgião', async () => {
    const container = await importar(IOSC)
    await waitFor(() => expect(blocos(container)).toHaveLength(3))

    // O que separa os blocos na TELA é o CIRURGIÃO (dono 27/08: o anestesista
    // saiu do título e ficou só no seletor, porque aparecia duas vezes). O que
    // este teste protege continua sendo o mesmo de 27/07: três blocos, um por
    // anestesista, cada um com os SEUS casos e o SEU cirurgião.
    const [b1, b2, b3] = blocos(container)
    expect(b1.textContent).toContain('IOSC')
    expect(b1.textContent).toContain('Dr. Souza')
    expect(b1.textContent).not.toContain('Dr. Lima')     // cirurgião do colega não vaza
    expect(b2.textContent).toContain('Dr. Lima')
    expect(b2.textContent).not.toContain('Dr. Souza')
    expect(b3.textContent).toContain('Dr. Dias')
    // o nome do anestesista NÃO se repete no título — ele vive no seletor
    expect(b1.querySelector('p').textContent).not.toContain('CURY')
    // cada bloco anuncia 1 caso — nenhum concentra os 3
    expect(blocos(container).every((b) => b.textContent.includes('1 caso'))).toBe(true)
  })

  it('atribuir um anestesista do bloco NÃO alcança os casos dos colegas', async () => {
    const container = await importar(IOSC)
    await waitFor(() => expect(blocos(container)).toHaveLength(3))
    // o bloco do CURY já resolve pelo dicionário; publica e confere os uids
    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(salvarEscala).toHaveBeenCalled())

    const casos = salvarEscala.mock.calls[0][0].casos
    expect(casos.map((c) => c.anestesistaUserId)).toEqual(['uid-cury', null, null])
    expect(casos[1].anestesista).toBe('MELO')          // colega preservado
    expect(casos[2].anestesista).toBe('DIDOMENICO')
    expect(casos.some((c) => c.semAnestesista)).toBe(false)
  })

  it('sala de um anestesista só continua num bloco único', async () => {
    const container = await importar([
      { sala: 'Sala 2', hora: '08:00', anestesista: 'CURY', cirurgiao: 'DR. ANA SOUZA' },
      { sala: 'Sala 2', hora: '10:00', anestesista: '//', cirurgiao: 'DR. ANA SOUZA' },
    ])
    await waitFor(() => expect(blocos(container)).toHaveLength(1))
    expect(blocos(container)[0].textContent).toContain('2 casos')
    // sala não repartida e sem sufixo de ANESTESISTA no título (o "·" que hoje
    // aparece é o do cirurgião, que passou a identificar o bloco)
    expect(blocos(container)[0].querySelector('p').textContent).not.toContain('CURY')
  })

  it('linha "?" vira bloco próprio e não recebe o anestesista do vizinho', async () => {
    const container = await importar([
      { sala: 'Exames', hora: '08:00', anestesista: 'CURY', cirurgiao: 'DR. ANA SOUZA' },
      { sala: 'Exames', hora: '09:00', anestesista: '?', semAnestesista: true, cirurgiao: 'DR. BRUNO LIMA' },
    ])
    await waitFor(() => expect(blocos(container)).toHaveLength(2))
    // o "?" continua sendo um bloco à parte; quem anuncia o estado é o seletor
    // do bloco (o título agora leva sala · cirurgião)
    expect(blocos(container)[1].textContent).toContain('Dr. Lima')
    expect(blocos(container)[1].parentElement.textContent).toContain('Sem anestesista')

    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(salvarEscala).toHaveBeenCalled())
    const casos = salvarEscala.mock.calls[0][0].casos
    expect(casos[0].anestesistaUserId).toBe('uid-cury')
    expect(casos[1].anestesistaUserId).toBeNull()
    expect(casos[1].semAnestesista).toBe(true)
  })

  it('abrir um bloco mostra só os casos dele', async () => {
    const container = await importar(IOSC)
    await waitFor(() => expect(blocos(container)).toHaveLength(3))
    fireEvent.click(blocos(container)[1])
    const painel = blocos(container)[1].parentElement
    expect(within(painel).getByDisplayValue('Vitrectomia')).toBeTruthy()
    expect(within(painel).queryByDisplayValue('Catarata')).toBeNull()
  })
})

describe('Conferência — anexo misto e data impressa', () => {
  const MAPA_MATERNO = [
    ...['07:30', '08:30', '09:30', '10:30'].map((hora) => ({ sala: 'Sala 2 HC', hora, anestesista: 'ANEST A', cirurgiao: 'CIRURGIAO A', procedimento: 'ORL' })),
    ...['07:30', '08:30', '09:30', '10:30', '11:30', '13:30', '14:30', '15:30'].map((hora) => ({ sala: 'Sala 3 HC', hora, anestesista: 'ANEST B', cirurgiao: 'CIRURGIAO B', procedimento: 'ORTOPEDIA' })),
  ]

  it('mostra e publica somente o turno selecionado; trocar turno reutiliza o mesmo anexo', async () => {
    svcMock.parseEscalaImagem.mockResolvedValueOnce({
      casos: MAPA_MATERNO,
      ordemLiberacao: [],
      ajudaExterna: [],
      hospitalDetectado: 'materno',
    })
    const { container } = render(
      <ImportarEscalaPage hospital="materno" data="2026-08-03" onClose={vi.fn()} />, { wrapper: wrap },
    )
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [new File(['x'], 'materno.png', { type: 'image/png' })] },
    })

    // desde 17/08 o título é fixo ("Blocos por anestesista") e o resumo do lote
    // fica ao lado, em texto menor
    expect(await screen.findByRole('heading', { name: /Blocos por anestesista/i })).toBeTruthy()
    expect(screen.getAllByText(/9 cirurgias/i).length).toBeGreaterThan(0)
    expect(await screen.findByText(/3 item\(ns\) do outro turno não serão adicionados/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Vespertino' }))
    expect(await screen.findByRole('heading', { name: /Blocos por anestesista/i })).toBeTruthy()
    expect(screen.getAllByText(/3 cirurgias/i).length).toBeGreaterThan(0)
    expect(svcMock.parseEscalaImagem).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(salvarEscala).toHaveBeenCalled())
    const publicados = salvarEscala.mock.calls[0][0].casos
    expect(publicados).toHaveLength(3)
    expect(publicados.map((c) => c.hora)).toEqual(['13:30', '14:30', '15:30'])
    expect(publicados.every((c) => c.turno === 'vespertino')).toBe(true)
  })

  it('avisa quando a data impressa diverge e aplica a data com um toque', async () => {
    svcMock.parseEscalaImagem.mockResolvedValueOnce({
      casos: [MAPA_MATERNO[0]],
      ordemLiberacao: [],
      ajudaExterna: [],
      hospitalDetectado: 'materno',
      dataDetectada: '2026-08-03',
    })
    const { container } = render(
      <ImportarEscalaPage hospital="materno" data="2026-08-02" onClose={vi.fn()} />, { wrapper: wrap },
    )
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [new File(['x'], 'materno.png', { type: 'image/png' })] },
    })

    expect(await screen.findByText(/anexo mostra a data/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Usar esta data/i }))
    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(salvarEscala).toHaveBeenCalled())
    expect(salvarEscala.mock.calls[0][0].data).toBe('2026-08-03')
  })

  it('mantém SRPA como posição, separada da contagem de cirurgias e presa ao turno do upload', async () => {
    svcMock.parseEscalaImagem.mockResolvedValueOnce({
      casos: [{ sala: 'CC - Sala 1', hora: '07:30', anestesista: 'ANEST A', cirurgiao: 'CIRURGIAO A', procedimento: 'ARTROSCOPIA' }],
      posicoesAssistenciais: [{ local: 'SRPA', anestesista: 'ANEST B' }],
      ordemLiberacao: ['ANEST A', 'ANEST B'],
      ajudaExterna: [],
      hospitalDetectado: 'unimed',
    })
    const { container } = render(
      <ImportarEscalaPage hospital="unimed" data="2026-08-03" onClose={vi.fn()} />, { wrapper: wrap },
    )
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [new File(['x'], 'unimed.png', { type: 'image/png' })] },
    })

    expect(await screen.findByRole('heading', { name: /Blocos por anestesista/i })).toBeTruthy()
    expect(screen.getAllByText(/1 cirurgia \+ 1 posição/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/1 posição$/i).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('tab', { name: 'Vespertino' }))
    await waitFor(() => expect(screen.queryByText(/1 posição$/i)).toBeNull())
  })

  it('preserva posição sem caso, ordem e vírgula interna ao preencher o rodapé', async () => {
    const ordem = ['ANEST A', 'ANEST B (CONSULT, APOIO)', 'ANEST C']
    const container = await importar([
      { sala: 'Sala 1', hora: '08:00', anestesista: 'ANEST A', cirurgiao: 'CIRURGIAO A', procedimento: 'PROCEDIMENTO A' },
    ], ordem)
    await waitFor(() => expect(blocos(container)).toHaveLength(1))

    fireEvent.click(screen.getByRole('button', { name: /Preencher da atribuição/i }))
    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))

    await waitFor(() => expect(salvarEscala).toHaveBeenCalled())
    expect(salvarEscala.mock.calls[0][0].ordemLiberacao.matutino).toEqual(ordem)
  })
})

/**
 * Vínculo nome→login que FALHA (bug de produção 29/07): a RLS deixa cada um
 * vincular só o próprio login, então vincular um colega toma 42501. O código
 * engolia esse erro; sem o vínculo, o rodapé fica com o texto importado e o caso
 * vai com o uid escolhido, e a pessoa aparece como linha EXTRA no fim da fila
 * enquanto a linha do rodapé fica vazia — o "não sincronizou" que o dono relatou.
 */
describe('Conferência — vínculo recusado pela RLS', () => {
  /** Atribui um login ao bloco pelo Select (é o que dispara o aprendizado). */
  async function atribuir(container, indiceBloco, rotulo) {
    const bloco = blocos(container)[indiceBloco].parentElement
    fireEvent.click(within(bloco).getByRole('combobox'))
    fireEvent.click(await screen.findByRole('option', { name: rotulo }))
  }

  const UM_CASO = [
    { sala: 'Sala 5', hora: '08:00', anestesista: 'STAUB', cirurgiao: 'DR. ANA SOUZA', procedimento: 'Hérnia' },
  ]

  it('publica a escala E avisa quem ficou sem vínculo, com a saída', async () => {
    const err = new Error('upsertAlias: new row violates row-level security policy')
    err.code = '42501'
    upsertAlias.mockRejectedValueOnce(err)

    const container = await importar(UM_CASO)
    await waitFor(() => expect(blocos(container)).toHaveLength(1))
    await atribuir(container, 0, 'Gustavo Cury')

    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))

    // a escala FOI publicada — esconder isso faria o usuário republicar à toa
    await waitFor(() => expect(salvarEscala).toHaveBeenCalled())
    expect(await screen.findByText('Escala publicada')).toBeTruthy()

    // e o aviso nomeia a pessoa, explica a causa e diz o que fazer
    expect(await screen.findByText(/ficou sem vínculo/i)).toBeTruthy()
    // descrição: nomeia a pessoa, dá a causa e a saída (Sonner renderiza título
    // e descrição em nós separados, daí a busca pelo texto e não pelo container)
    const descricao = await screen.findByText(/seu próprio login/i)
    expect(descricao.textContent).toMatch(/Staub/i)
    expect(descricao.textContent).toMatch(/secretaria|admin/i)
    // e diz o efeito prático de não haver vínculo, que é o que o dono viu
    expect(descricao.textContent).toMatch(/duas vezes na fila/i)
  })

  it('imagem que não pôde ser enviada mostra a instrução, não "Falha na extração"', async () => {
    // Bug 29/07: o POST com a foto morria no navegador (base64 do arquivo cru,
    // 4–7 MB) e a tela dizia só "Falha na extração — preencha manualmente", o
    // mesmo texto de quando o servidor falha. Quem está no centro cirúrgico não
    // tinha como saber que era o tamanho da foto.
    const err = new Error('A imagem ficou grande demais mesmo depois de reduzida. Recorte só a parte da escala e envie de novo.')
    err.name = 'ErroImagem'
    err.motivo = 'grande'
    prepararImagem.mockRejectedValueOnce(err)

    svcMock.parseEscalaImagem.mockResolvedValueOnce({ casos: [], ordemLiberacao: [], ajudaExterna: [] })
    const { container } = render(
      <ImportarEscalaPage hospital="hro" data="2026-07-28" onClose={vi.fn()} />, { wrapper: wrap },
    )
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [new File(['x'], 'foto.jpg', { type: 'image/jpeg' })] },
    })

    expect(await screen.findByText('A imagem não foi enviada')).toBeTruthy()
    expect(await screen.findByText(/Recorte só a parte da escala/i)).toBeTruthy()
    // e não chegou a chamar o servidor — a imagem nem saiu
    expect(svcMock.parseEscalaImagem).not.toHaveBeenCalled()
  })

  it('vínculo que dá certo não gera aviso nenhum', async () => {
    const container = await importar(UM_CASO)
    await waitFor(() => expect(blocos(container)).toHaveLength(1))
    await atribuir(container, 0, 'Gustavo Cury')

    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(salvarEscala).toHaveBeenCalled())
    expect(upsertAlias).toHaveBeenCalledWith(expect.objectContaining({ apelido: 'STAUB', userId: 'uid-cury' }))
    expect(screen.queryByText(/sem vínculo/i)).toBeNull()
  })
})

/**
 * GUARDRAIL INVERSO (incidente 30/07 — Unimed matutino).
 *
 * CRISTINA tinha 2 casos nos Exames e NÃO estava no rodapé nem na ajuda: sem
 * posição na ordem, `gerarColunaLiberacao` a joga como linha EXTRA no fim da fila
 * e ela parece "não estar na escala". O guardrail que existia só olhava o sentido
 * oposto — nome do rodapé SEM caso — então este passou calado.
 *
 * A causa mais comum é nome AZUL (ajuda de outro hospital) que a Vision não
 * reconheceu como azul, e foi exatamente o que aconteceu: `ajuda_externa` da
 * Unimed gravou vazio enquanto o HRO do mesmo dia gravou ['FERNANDO'].
 */
describe('Conferência — caso com anestesista fora do rodapé', () => {
  const EXAMES_CRISTINA = [
    { sala: 'Exames', hora: '08:00', anestesista: 'CRISTINA', cirurgiao: 'WALDIR', procedimento: 'Endoscopia' },
    { sala: 'Exames', hora: '10:00', anestesista: 'CRISTINA', cirurgiao: 'MILTON', procedimento: 'Colonoscopia' },
    { sala: 'Sala 1', hora: '08:00', anestesista: 'CURY', cirurgiao: 'DR. ANA SOUZA', procedimento: 'Hérnia' },
  ]

  it('vira DECISÃO no cartão da fila, com a contagem de casos (31/08)', async () => {
    // rodapé só com CURY — CRISTINA tem 2 casos e não aparece nele
    const container = await importar(EXAMES_CRISTINA, ['CURY'])
    await waitFor(() => expect(blocos(container)).toHaveLength(2))

    // a linha mora na seção da ordem — era aviso solto no fim da página
    const linha = await screen.findByText(/Cristina — com caso, fora da ordem/i)
    expect(linha.closest('button').textContent).toMatch(/2 casos/)
    // e a folha diz as DUAS saídas, porque a causa pode ser azul não lido
    // ou rodapé mal extraído
    fireEvent.click(linha)
    expect(await screen.findByText(/AZUL/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /acrescentar à ordem/i })).toBeTruthy()
  })

  it('marcar como ajuda pela folha grava e a decisão sai', async () => {
    const container = await importar(EXAMES_CRISTINA, ['CURY'])
    await waitFor(() => expect(blocos(container)).toHaveLength(2))

    fireEvent.click(await screen.findByText(/Cristina — com caso, fora da ordem/i))
    fireEvent.click(await screen.findByRole('button', { name: /marcar como ajuda/i }))
    await waitFor(() => expect(screen.queryByText(/com caso, fora da ordem/i)).toBeNull())

    // e a ajuda vai para o banco no publicar (é o que dá o badge e a posição)
    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(salvarEscala).toHaveBeenCalled())
    expect(salvarEscala.mock.calls[0][0].ajudaExterna).toEqual({ matutino: ['CRISTINA'] })
  })

  it('quem está no rodapé não é acusado, e sem rodapé o guardrail se cala', async () => {
    const comRodape = await importar(EXAMES_CRISTINA, ['CURY', 'CRISTINA'])
    await waitFor(() => expect(blocos(comRodape)).toHaveLength(2))
    expect(screen.queryByText(/com caso, fora da ordem/i)).toBeNull()
  })
})

/**
 * CRUZAMENTO COM AS ESCALAS JÁ PUBLICADAS (dono 30/07).
 *
 * "Ajuda" dependia de UM sinal: a COR da tinta no rodapé — e foi ele que falhou em
 * 30/07 (a Vision não leu o azul da Unimed). As regras de cor seguem no prompt;
 * este é um segundo sinal, estrutural: "está no rodapé de outro hospital hoje, no
 * mesmo turno, e tem caso aqui". Dado contra dado.
 *
 * Assimétrico de propósito: o PRIMEIRO hospital do dia não tem com o que cruzar.
 */
describe('Conferência — cruzamento com outro hospital', () => {
  const outraEscala = {
    id: 'e-unimed', hospital: 'unimed', data: '2026-07-28',
    ordemLiberacao: { matutino: ['ADRIANO', 'FERNANDO'] },
    ajudaExterna: {},
    casos: [{ sala: 'CC - Sala 1', ordem: 0, hora: '08:00', anestesista: 'ADRIANO', turno: 'matutino' }],
  }
  const casosAqui = [
    { sala: 'Sala 1', hora: '08:00', anestesista: 'CURY', cirurgiao: 'DR. ANA SOUZA', procedimento: 'Hérnia' },
    { sala: 'IOSC', hora: '09:00', anestesista: 'FERNANDO', cirurgiao: 'DR. BRUNO LIMA', procedimento: 'Catarata' },
  ]

  beforeEach(() => {
    // a tela busca as OUTRAS escalas do dia; devolve a da Unimed nas duas chamadas
    svcMock.fetchEscala.mockImplementation(async (_d, h) => (h === 'unimed' ? outraEscala : null))
  })

  it('quem está no rodapé do outro hospital vira linha AZUL "ajuda de fora?" (31/08)', async () => {
    const container = await importar(casosAqui, ['CURY'])
    await waitFor(() => expect(blocos(container)).toHaveLength(2))

    const linha = await screen.findByText(/Fernando — ajuda de fora\?/i)
    expect(linha.closest('button').textContent).toMatch(/Unimed/)
    // CURY tem caso aqui mas NÃO está no rodapé de lá — não é sugerido
    expect(screen.queryByText(/Cury — ajuda de fora/i)).toBeNull()
  })

  it('a folha marca como ajuda e a pergunta vira decisão respondida', async () => {
    const container = await importar(casosAqui, ['CURY'])
    await waitFor(() => expect(blocos(container)).toHaveLength(2))

    fireEvent.click(await screen.findByText(/Fernando — ajuda de fora\?/i))
    fireEvent.click(await screen.findByRole('button', { name: /marcar como ajuda/i }))
    await waitFor(() => expect(screen.queryByText(/ajuda de fora\?/i)).toBeNull())
    expect(await screen.findByText(/Fernando — marcado como ajuda/i)).toBeTruthy()
  })

  it('mesma pessoa com casos nos DOIS hospitais é "em dois hospitais", não ajuda', async () => {
    const container = await importar([
      { sala: 'Sala 1', hora: '08:00', anestesista: 'ADRIANO', cirurgiao: 'DR. ANA SOUZA', procedimento: 'Hérnia' },
    ], ['ADRIANO'])
    await waitFor(() => expect(blocos(container)).toHaveLength(1))

    const linha = await screen.findByText(/Adriano — em dois hospitais/i)
    expect(linha.closest('button').textContent).toMatch(/Unimed: 1/)
    expect(screen.queryByText(/ajuda de fora\?/i)).toBeNull()
    // e a folha lembra que amarelo = escalado em dois locais de propósito
    fireEvent.click(linha)
    expect(await screen.findByText(/AMARELO/)).toBeTruthy()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Adicionar linha à mão (bug 30/07): o texto da SALA alimenta a CHAVE do bloco —
// atualizar o estado a cada tecla trocava a key, o React remontava o bloco e o
// input saía do DOM com o foco (só entrava UMA letra por vez; e o bloco novo
// ainda nascia colapsado). O campo passou a commitar no BLUR.
//
// Desde 27/08 a sala é ESCOLHIDA na lista do hospital (dono: "apenas selecionar
// a sala referente àquele hospital e com a opção de digitar caso não haja
// nenhuma") — o datalist antigo praticamente não abria no iPhone, e a sala
// acabava sempre digitada, que é como a mesma sala vira três grafias. A trava do
// foco continua valendo onde a digitação existe: dentro de "Outra sala…".
// ════════════════════════════════════════════════════════════════════════════
/** Gatilho do seletor de SALA (o do anestesista também é combobox). */
const abrirSeletorDeSala = () =>
  screen.getAllByRole('combobox').find((el) => /Escolher a sala|Sala|IOSC/.test(el.textContent)
    && !/anestesista/i.test(el.textContent))

describe('Adicionar linha — digitação da Sala (bug 30/07)', () => {
  const UMA = [{ sala: 'Sala 1', hora: '08:00', anestesista: 'CURY', cirurgiao: 'DR. ANA SOUZA', procedimento: 'Catarata', pacienteIniciais: 'A.B.' }]

  it('"+ Linha" abre o bloco novo já expandido, com os campos visíveis', async () => {
    const container = await importar(UMA)
    await waitFor(() => expect(blocos(container)).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Linha' }))
    expect(screen.getByText('Escolher a sala…')).toBeTruthy()
    expect(screen.getByPlaceholderText('Procedimento')).toBeTruthy()
  })

  it('a lista de salas é a do HOSPITAL da escala, e não a de outro', async () => {
    const container = await importar(UMA, [], { hospital: 'hro' })
    await waitFor(() => expect(blocos(container)).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Linha' }))
    fireEvent.click(abrirSeletorDeSala())

    expect(await screen.findByRole('option', { name: 'IOSC' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Bloco M - Sala 1' })).toBeTruthy()
    // sala da Unimed não entra na lista do HRO
    expect(screen.queryByRole('option', { name: 'CO - Cesárea' })).toBeNull()
    expect(screen.getByRole('option', { name: 'Outra sala…' })).toBeTruthy()
  })

  it('digitação contínua na Sala: mesmo input, sem remount, foco preservado', async () => {
    const container = await importar(UMA)
    await waitFor(() => expect(blocos(container)).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Linha' }))

    fireEvent.click(abrirSeletorDeSala())
    fireEvent.click(await screen.findByRole('option', { name: 'Outra sala…' }))

    const sala = screen.getByPlaceholderText('Digite a sala')
    sala.focus()
    for (const parcial of ['S', 'Sa', 'Sal', 'Sala', 'Sala ', 'Sala 9']) {
      fireEvent.change(sala, { target: { value: parcial } })
    }
    // o mesmo nó continua no DOM com o valor inteiro e o foco — antes a 1ª
    // tecla remontava o bloco e o activeElement caía no body
    expect(screen.getByPlaceholderText('Digite a sala')).toBe(sala)
    expect(sala.value).toBe('Sala 9')
    expect(document.activeElement).toBe(sala)
  })

  it('blur commita: a linha migra para o bloco da sala digitada, que abre junto', async () => {
    const container = await importar(UMA)
    await waitFor(() => expect(blocos(container)).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Linha' }))

    fireEvent.click(abrirSeletorDeSala())
    fireEvent.click(await screen.findByRole('option', { name: 'Outra sala…' }))
    const sala = screen.getByPlaceholderText('Digite a sala')
    fireEvent.change(sala, { target: { value: 'Sala 9' } })
    fireEvent.blur(sala)
    await waitFor(() => expect(blocos(container).some((b) => b.textContent.includes('Sala 9'))).toBe(true))
    // bloco de destino ABERTO — os campos não "somem" atrás de um bloco fechado.
    // (a sala digitada que existe na lista do hospital volta a ser mostrada pelo
    // seletor, então o que se verifica é o bloco expandido, não o input)
    const destino = blocos(container).find((b) => b.textContent.includes('Sala 9'))
    expect(destino.getAttribute('aria-expanded')).toBe('true')
    expect(within(destino.parentElement).getByPlaceholderText('Procedimento')).toBeTruthy()
  })
})

// NOME AMBÍGUO (dono 11/08) — incidente da CO - Cesárea: a escala veio com
// "JOAO" e o rodapé daquele dia tinha JOAO HENRIQUE e JOAO RICARDO. O
// dicionário não resolve primeiro nome com dois donos (regra da casa:
// perguntar, nunca chutar), então os 3 casos ficaram órfãos numa linha "Fora do
// rodapé" e o João dono deles nasceu liberado por aparecer sem cirurgia — o que
// ainda fez a fila parecer publicada fora de ordem.
describe('Conferência — nome ambíguo bloqueia a publicação', () => {
  const DOIS_JOAOS = [
    { uid: 'uid-jh', nome: 'JOÃO HENRIQUE SALVÃO VANNI', apelidos: ['JOAO HENRIQUE', 'JOAO VANNI'] },
    { uid: 'uid-jr', nome: 'JOÃO RICARDO MOREIRA', apelidos: ['JOAO RICARDO', 'JOAO MOREIRA'] },
  ]
  const CESAREA = [
    { sala: 'CO - Cesárea', hora: '07:30', anestesista: 'JOAO', cirurgiao: 'DRA. TACIANA ALFLEN', procedimento: 'Cesariana' },
  ]

  beforeEach(() => { rosterHolder.lista = DOIS_JOAOS })
  afterAll(() => { rosterHolder.lista = [] })

  it('avisa na tela quem são os candidatos e não deixa publicar', async () => {
    await importar(CESAREA)
    expect(await screen.findByText(/pode ser/i)).toBeTruthy()
    const aviso = screen.getByText(/pode ser/i)
    // nomes como a fila os mostra (1º + último), que é como a secretária os conhece
    expect(aviso.textContent).toMatch(/João Vanni/i)
    expect(aviso.textContent).toMatch(/João Moreira/i)

    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    expect(await screen.findByText(/qual deles/i)).toBeTruthy()
    expect(salvarEscala).not.toHaveBeenCalled()
  })

  it('escolhido o login, o bloqueio sai e a escala publica', async () => {
    const container = await importar(CESAREA)
    await waitFor(() => expect(blocos(container)).toHaveLength(1))
    const bloco = blocos(container)[0].parentElement
    fireEvent.click(within(bloco).getByRole('combobox'))
    fireEvent.click(await screen.findByRole('option', { name: 'Gustavo Cury' }))

    await waitFor(() => expect(screen.queryByText(/pode ser/i)).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(salvarEscala).toHaveBeenCalled())
  })

  it('nome com sobrenome não é ambíguo — publica direto', async () => {
    await importar([{ ...CESAREA[0], anestesista: 'JOAO RICARDO' }])
    expect(screen.queryByText(/pode ser/i)).toBeNull()
  })
})

// ORDEM DE LIBERAÇÃO VISÍVEL (dono 11/08: "difícil de visualizar"). O rodapé é
// o dado mais sagrado da importação e cabia numa linha só — com 17 nomes
// apareciam 4. Agora o texto inteiro é editável num textarea e a lista NUMERADA
// embaixo é o que se confere contra a imagem, posição por posição.
describe('Conferência — ordem de liberação numerada', () => {
  const UM = [{ sala: 'Sala 1', hora: '08:00', anestesista: 'CURY', cirurgiao: 'DR. ANA', procedimento: 'Hérnia' }]
  const RODAPE = ['NATHALIA', 'ERLEI', 'FERNANDO', 'JOAO HENRIQUE', 'CURY']

  it('numera cada posição e marca o plantonista e quem sai primeiro', async () => {
    await importar(UM, RODAPE)
    const numerada = await screen.findByText(/confira contra o rodapé da imagem/i)
    const caixa = numerada.parentElement
    // uma LINHA por posição, na ordem do rodapé — é assim que se lê a foto
    const linhas = [...caixa.querySelectorAll('li')]
    expect(linhas.map((l) => l.textContent)).toEqual(
      RODAPE.map((nome, i) => expect.stringContaining(`${i + 1}${nome}`)),
    )
    // 1º = plantonista, último = sai primeiro (as duas regras posicionais)
    const linhaDe = (nome) => within(caixa).getByText(nome).closest('li')
    expect(linhaDe('NATHALIA').textContent).toMatch(/plantonista/i)
    expect(linhaDe('CURY').textContent).toMatch(/sai 1º/i)
    expect(linhaDe('ERLEI').textContent).not.toMatch(/plantonista|sai 1º/i)
    expect(numerada.textContent).toMatch(/5 nomes/)
  })

  // A conferência é contra a FOTO: o aviso de "está no rodapé mas não tem
  // cirurgia" só serve se estiver NA POSIÇÃO do nome. Listá-lo num parágrafo à
  // parte obrigava a procurar o nome no meio da lista.
  // A CONTAGEM POR PESSOA SAIU (dono 17/08): o número na posição confundia quem
  // confere. Quem está na ordem sem cirurgia nenhuma — o detector da extração
  // torta — segue MARCADO, agora com o ponto âmbar, e o porquê é lido uma vez em
  // Pendências.
  it('marca com o ponto âmbar quem está na ordem sem nenhuma cirurgia, sem contar casos', async () => {
    await importar(UM, RODAPE)
    const caixa = (await screen.findByText(/confira contra o rodapé da imagem/i)).parentElement
    // a FILA continua sem contagem por pessoa; o porquê saiu do aviso solto e
    // mora na linha de decisão + folha (31/08)
    const fila = caixa.querySelector('ul')
    const linhaDe = (nome) => within(fila).getByText(nome).closest('li')
    expect(linhaDe('CURY').textContent).not.toMatch(/caso/)
    expect(linhaDe('CURY').querySelector('[title="na ordem sem nenhuma cirurgia"]')).toBeNull()
    expect(linhaDe('JOAO HENRIQUE').querySelector('[title="na ordem sem nenhuma cirurgia"]')).toBeTruthy()
    fireEvent.click(within(caixa).getByText(/na ordem, sem cirurgia/i))
    expect(await screen.findByText(/pode ter saído para outra pessoa/i)).toBeTruthy()
  })

  // A LISTA É A ÚNICA SUPERFÍCIE (dono 11/08): o campo de texto saiu e a
  // correção acontece na própria posição. Editar aqui é legítimo — é a
  // transcrição da foto, e a conferência é o último ponto em que dá para
  // consertar o que a Vision leu torto (depois de publicada a ordem é imutável).
  it('o campo de texto do rodapé saiu — a lista é a única superfície', async () => {
    const container = await importar(UM, RODAPE)
    expect(container.querySelector('textarea')).toBeNull()
  })

  /** Abre os controles da posição de um nome. */
  const abrir = async (nome) => {
    const caixa = (await screen.findByText(/confira contra o rodapé da imagem/i)).parentElement
    fireEvent.click(within(caixa).getByText(nome).closest('button'))
    return caixa
  }

  it('mover um nome muda a posição — e o selo posicional vai junto', async () => {
    await importar(UM, RODAPE)
    const caixa = await abrir('ERLEI')
    fireEvent.click(screen.getByRole('button', { name: /Subir/i }))
    const linhas = [...caixa.querySelectorAll('li')]
    expect(linhas[0].textContent).toContain('ERLEI')
    expect(linhas[0].textContent).toMatch(/plantonista/i)      // 1ª posição manda
    expect(linhas[1].textContent).toContain('NATHALIA')
    expect(linhas[1].textContent).not.toMatch(/plantonista/i)
  })

  it('a ordem corrigida é a que vai para a publicação', async () => {
    await importar(UM, RODAPE)
    await abrir('ERLEI')
    fireEvent.click(screen.getByRole('button', { name: /Subir/i }))
    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(salvarEscala).toHaveBeenCalled())
    expect(salvarEscala.mock.calls[0][0].ordemLiberacao).toEqual({
      matutino: ['ERLEI', 'NATHALIA', 'FERNANDO', 'JOAO HENRIQUE', 'CURY'],
    })
  })

  // AJUDA é o único selo que não vem da posição — e o que mais falha na
  // extração (30/07: a Vision não viu o azul e a escala foi ao ar sem ajuda).
  it('marcar ajuda à mão põe o selo e vai junto na publicação', async () => {
    await importar(UM, RODAPE)
    const caixa = await abrir('FERNANDO')
    fireEvent.click(screen.getByRole('button', { name: /^Ajuda$/i }))
    expect(within(caixa).getByText('FERNANDO').closest('li').textContent).toMatch(/ajuda/i)

    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(salvarEscala).toHaveBeenCalled())
    expect(salvarEscala.mock.calls[0][0].ajudaExterna).toEqual({ matutino: ['FERNANDO'] })
  })

  it('corrigir o nome de uma posição não mexe nas outras', async () => {
    await importar(UM, RODAPE)
    const caixa = await abrir('JOAO HENRIQUE')
    const campo = within(caixa).getByLabelText(/Nome na posição 4/i)
    fireEvent.change(campo, { target: { value: 'JOAO RICARDO' } })
    fireEvent.blur(campo)
    expect([...caixa.querySelectorAll('li')].map((l) => l.textContent)).toEqual(
      ['NATHALIA', 'ERLEI', 'FERNANDO', 'JOAO RICARDO', 'CURY'].map((n) => expect.stringContaining(n)),
    )
  })

  // Acrescentar é POR LOGIN (dono 11/08, "para evitar duplicidades"): digitar
  // criava a mesma pessoa duas vezes na fila — o rodapé casa por apelido, e
  // "CURY" escrito à mão ao lado de um caso do mesmo login vira duas linhas.
  it('acrescenta quem a extração perdeu escolhendo o login, com o apelido do dicionário', async () => {
    await importar(UM, ['NATHALIA', 'ERLEI', 'FERNANDO'])
    const caixa = (await screen.findByText(/confira contra o rodapé da imagem/i)).parentElement
    fireEvent.click(within(caixa).getByRole('combobox'))
    fireEvent.click(await screen.findByRole('option', { name: 'Gustavo Cury' }))

    await waitFor(() => expect(caixa.querySelectorAll('li')).toHaveLength(4))
    // entra como CURY (apelido), o mesmo texto do caso — não como "Gustavo Cury"
    const ultima = [...caixa.querySelectorAll('li')].at(-1)
    expect(ultima.textContent).toContain('CURY')
  })

  it('quem já está no rodapé não aparece na lista de acrescentar', async () => {
    await importar(UM, RODAPE)                 // RODAPE já tem CURY
    const caixa = (await screen.findByText(/confira contra o rodapé da imagem/i)).parentElement
    fireEvent.click(within(caixa).getByRole('combobox'))
    await waitFor(() => expect(screen.queryByRole('option', { name: 'Gustavo Cury' })).toBeNull())
  })

  it('remove a posição que sobrou na extração', async () => {
    await importar(UM, RODAPE)
    const caixa = (await screen.findByText(/confira contra o rodapé da imagem/i)).parentElement
    fireEvent.click(within(caixa).getByText('ERLEI').closest('button'))
    fireEvent.click(screen.getByRole('button', { name: /Remover/i }))
    await waitFor(() => expect(caixa.querySelectorAll('li')).toHaveLength(4))
    expect(caixa.textContent).not.toContain('ERLEI')
  })
})

// A leitura por imagem pode falhar por CONTA/CHAVE (não passa sozinha) ou por
// sobrecarga (passa). Em 17–18/08 a chave ficou sem crédito no meio da tarde e
// a tela pediu "tente de novo" — a foto foi reenviada oito vezes e o vespertino
// do dia 18 ficou sem escala.
describe('Falha da IA na leitura (incidente 17–18/08)', () => {
  const subir = () => {
    const { container } = render(<ImportarEscalaPage hospital="hro" data="2026-07-28" onClose={vi.fn()} />, { wrapper: wrap })
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [new File(['x'], 'escala.png', { type: 'image/png' })] },
    })
    return container
  }

  it('conta sem crédito: diz que reenviar não resolve e aponta a saída', async () => {
    svcMock.parseEscalaImagem.mockResolvedValueOnce({
      error: 'ia_falhou',
      iaStatus: 400,
      iaTipo: 'invalid_request_error',
      iaMensagem: 'Your credit balance is too low to access the Anthropic API.',
      casos: [], ordemLiberacao: [],
    })
    subir()
    expect(await screen.findByText(/sem créditos/i)).toBeTruthy()
    expect(screen.queryByText(/Tente de novo em alguns instantes/i)).toBeNull()
  })

  it('sobrecarga: aí sim manda tentar de novo', async () => {
    svcMock.parseEscalaImagem.mockResolvedValueOnce({
      error: 'ia_falhou', iaStatus: 529, iaTipo: 'overloaded_error', iaMensagem: 'Overloaded',
      casos: [], ordemLiberacao: [],
    })
    subir()
    expect(await screen.findByText(/sobrecarregado/i)).toBeTruthy()
  })
})


// ════════════════════════════════════════════════════════════════════════════
// CRUZAMENTO DA URGÊNCIA QUE ATRAVESSA O TURNO (dono 21/08): "ao passar salas de
// urgência da manhã para tarde cruze os dados com a escala da tarde (no momento
// da importação) e ajuste os anestesistas conforme escala da tarde; se não houver
// anestesista escalado, mantenha na fila". A urgência aberta é do DIA: às 13h ela
// segue ocupando a sala, mas quem responde por ela é quem a escala NOVA pôs lá.
// ════════════════════════════════════════════════════════════════════════════
describe('publicação cruza a urgência aberta do turno anterior (dono 21/08)', () => {
  // O cruzamento só existe quando se publica o turno SEGUINTE — o relógio do
  // arquivo está às 10h (matutino), aqui ele vai para as 14h para o `periodo`
  // nascer vespertino, que é o cenário do dono.
  beforeEach(() => vi.setSystemTime(new Date('2026-07-28T14:00:00-03:00')))
  afterEach(() => vi.setSystemTime(new Date('2026-07-28T10:00:00-03:00')))

  // a RPC devolve TODOS os casos da escala (os dois turnos) — é disso que o
  // cruzamento vive; o mock replica esse contrato.
  const publicarComManhaAberta = (urgenciaManha) => {
    salvarEscala.mockImplementationOnce(async (p) => ({
      id: 'e1',
      ...p,
      casos: [
        ...p.casos.map((c, i) => ({ ...c, id: `c${i}`, ordem: i, turno: 'vespertino' })),
        urgenciaManha,
      ],
    }))
  }

  const TARDE = [
    { sala: 'Sala 7', hora: '13:30', anestesista: 'CURY', cirurgiao: 'DR. ANA SOUZA', procedimento: 'Cesariana', pacienteIniciais: 'A.B.' },
  ]

  it('a urgência da manhã passa para quem a escala nova pôs na sala', async () => {
    publicarComManhaAberta({
      id: 'urg-manha', sala: 'Sala 7 - CO', turno: 'matutino', tipo: 'urgencia',
      statusCirurgia: 'iniciada', anestesista: 'MAURICIO', anestesistaUserId: 'uid-mau',
    })
    await importar(TARDE)
    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(svcMock.updateAnestesistaCasos).toHaveBeenCalled())
    const [ids, patch] = svcMock.updateAnestesistaCasos.mock.calls[0]
    expect(ids).toEqual(['urg-manha'])
    expect(patch).toMatchObject({ uid: 'uid-cury', apelido: 'CURY' })
  })

  it('sem ninguém escalado na sala, o caso fica SEM anestesista e segue na fila', async () => {
    publicarComManhaAberta({
      id: 'urg-sozinha', sala: 'Sala 9', turno: 'matutino', tipo: 'urgencia',
      statusCirurgia: 'agendada', anestesista: 'MAURICIO', anestesistaUserId: 'uid-mau',
    })
    await importar(TARDE)
    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(svcMock.updateAnestesistaCasos).toHaveBeenCalled())
    const [ids, patch] = svcMock.updateAnestesistaCasos.mock.calls[0]
    expect(ids).toEqual(['urg-sozinha'])
    expect(patch.uid).toBeNull()
  })

  it('fora do HRO o cruzamento nem roda — o contrato é do HRO', async () => {
    publicarComManhaAberta({
      id: 'urg-manha', sala: 'Sala 7', turno: 'matutino', tipo: 'urgencia',
      statusCirurgia: 'iniciada', anestesista: 'MAURICIO', anestesistaUserId: 'uid-mau',
    })
    await importar(TARDE, [], { hospital: 'unimed' })
    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(salvarEscala).toHaveBeenCalled())
    expect(svcMock.updateAnestesistaCasos).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// SEÇÕES QUE SOMEM NA LEITURA DO HRO (dono 27–28/08). O rótulo HEMO/EXAMES/
// IMAGEM vem na PRÓPRIA linha da cirurgia (hora + procedimento + cirurgião), e
// o prompt mandava tratá-lo como cabeçalho de seção — lida como título, a linha
// não vira caso e a cirurgia desaparece. Medido nas 41 importações do HRO dos
// 60 dias anteriores: Exames chegou em 90%, Hemodinâmica em 49%, Imagem em 15%.
// A leitura foi corrigida na edge; aqui fica a rede de segurança da tela, que é
// o último lugar onde alguém percebe a falta antes de publicar.
// ════════════════════════════════════════════════════════════════════════════
describe('HRO — aviso das seções que não vieram na leitura', () => {
  const comSalas = (salas) => salas.map((sala, i) => ({
    sala, hora: `0${7 + i}:00`, anestesista: 'CURY', cirurgiao: 'DR. ANA SOUZA',
    procedimento: 'Procedimento', pacienteIniciais: 'A.B.',
  }))

  it('nomeia CADA seção que faltou, não só quando faltam as três', async () => {
    // era o buraco do aviso de 27/08: exigir as três juntas pegava 3 das 41
    // importações, enquanto a Imagem sozinha se perdia em 35 delas
    await importar(comSalas(['Sala 1', 'Exames']), [], { hospital: 'hro' })
    const aviso = await screen.findByText(/não trouxe nenhuma linha de/i)
    expect(aviso.textContent).toContain('Imagem')
    expect(aviso.textContent).toContain('Hemodinâmica')
    expect(aviso.textContent).not.toContain('Exames')   // essa veio
  })

  it('com as três presentes, nenhum aviso', async () => {
    await importar(comSalas(['Sala 1', 'Exames', 'Imagem', 'Hemodinâmica']), [], { hospital: 'hro' })
    await waitFor(() => expect(screen.getByText('Blocos por anestesista')).toBeTruthy())
    expect(screen.queryByText(/não trouxe nenhuma linha de/i)).toBeNull()
  })

  it('é regra do HRO — a Unimed não é cobrada por essas seções', async () => {
    // lá esses locais existem, mas o padrão de perda medido é do mapa do HRO
    await importar(comSalas(['CC - Sala 1']), [], { hospital: 'unimed' })
    await waitFor(() => expect(screen.getByText('Blocos por anestesista')).toBeTruthy())
    expect(screen.queryByText(/não trouxe nenhuma linha de/i)).toBeNull()
  })
})
