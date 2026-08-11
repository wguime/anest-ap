/**
 * Conferência da importação — pedido do dono 27/07: sala/bloco com MAIS DE UM
 * anestesista (IOSC, Exames, seções de outro hospital) tem que aparecer SEPARADO,
 * cada anestesista com o seu cirurgião. Agrupar tudo numa sala só foi o que
 * achatou o IOSC em 23/07 (3 linhas saíram para uma pessoa e 2 sumiram).
 *
 * Exercita o caminho real: upload da imagem → Vision (mock) → conferência.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import ImportarEscalaPage from '@/pages/escala-cirurgica/ImportarEscalaPage'

// roster MUTÁVEL: o guardrail de nome ambíguo (dono 11/08) precisa de dois
// homônimos cadastrados; os demais testes seguem com o roster vazio.
const { svcMock, salvarEscala, upsertAlias, prepararImagem, rosterHolder } = vi.hoisted(() => ({
  rosterHolder: { lista: [] },
  svcMock: { parseEscalaImagem: vi.fn(), fetchEscala: vi.fn(async () => null) },
  salvarEscala: vi.fn(async (p) => ({ id: 'e1', ...p, casos: p.casos.map((c, i) => ({ ...c, id: `c${i}`, ordem: i })) })),
  upsertAlias: vi.fn(async () => {}),
  prepararImagem: vi.fn(async () => ({
    base64: 'AAAA', mimeType: 'image/jpeg', bytes: 3, largura: 1600, altura: 1200, reduzida: true,
  })),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseCirurgiasParticularesService', () => ({
  default: { completarPacienteDoCaso: vi.fn(async () => {}) },
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
async function importar(casos, ordemLiberacao = []) {
  svcMock.parseEscalaImagem.mockResolvedValueOnce({ casos, ordemLiberacao, ajudaExterna: [] })
  const { container } = render(<ImportarEscalaPage hospital="hro" data="2026-07-28" onClose={vi.fn()} />, { wrapper: wrap })
  const input = container.querySelector('input[type="file"]')
  const file = new File(['x'], 'escala.png', { type: 'image/png' })
  fireEvent.change(input, { target: { files: [file] } })
  await waitFor(() => expect(svcMock.parseEscalaImagem).toHaveBeenCalled())
  return container
}

/** Cabeçalho de um bloco da conferência (o botão que abre os casos). */
const blocos = (container) =>
  [...container.querySelectorAll('button[aria-expanded]')].filter((b) => /\d+ caso/.test(b.textContent))

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
  salvarEscala.mockClear()
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

    const [b1, b2, b3] = blocos(container)
    expect(b1.textContent).toContain('IOSC')
    expect(b1.textContent).toContain('· CURY')
    expect(b1.textContent).toContain('Dr. Souza')
    expect(b1.textContent).not.toContain('Dr. Lima')     // cirurgião do colega não vaza
    expect(b2.textContent).toContain('· MELO')
    expect(b2.textContent).toContain('Dr. Lima')
    expect(b3.textContent).toContain('· DIDOMENICO')
    expect(b3.textContent).toContain('Dr. Dias')
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
    expect(blocos(container)[0].textContent).not.toContain('·') // sem sufixo de anestesista
  })

  it('linha "?" vira bloco próprio e não recebe o anestesista do vizinho', async () => {
    const container = await importar([
      { sala: 'Exames', hora: '08:00', anestesista: 'CURY', cirurgiao: 'DR. ANA SOUZA' },
      { sala: 'Exames', hora: '09:00', anestesista: '?', semAnestesista: true, cirurgiao: 'DR. BRUNO LIMA' },
    ])
    await waitFor(() => expect(blocos(container)).toHaveLength(2))
    expect(blocos(container)[1].textContent).toContain('sem anestesista')

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

    expect(await screen.findByRole('heading', { name: /Conferir 2 blocos · 9 cirurgias/i })).toBeTruthy()
    expect(await screen.findByText(/3 item\(ns\) do outro turno não serão adicionados/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Vespertino' }))
    expect(await screen.findByRole('heading', { name: /Conferir 1 bloco · 3 cirurgias/i })).toBeTruthy()
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

    expect(await screen.findByRole('heading', { name: /1 cirurgia \+ 1 posição/i })).toBeTruthy()
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

  it('avisa quem tem caso e ficou fora da ordem, com a contagem de casos', async () => {
    // rodapé só com CURY — CRISTINA tem 2 casos e não aparece nele
    const container = await importar(EXAMES_CRISTINA, ['CURY'])
    await waitFor(() => expect(blocos(container)).toHaveLength(2))

    const aviso = await screen.findByText(/NÃO está na ordem de liberação nem na ajuda/i)
    expect(aviso.textContent).toMatch(/Cristina \(2\)/)
    // e diz as DUAS saídas, porque a causa pode ser azul não lido ou rodapé mal extraído
    expect(aviso.textContent).toMatch(/AZUL/)
    expect(aviso.textContent).toMatch(/acrescente na ordem/i)
  })

  it('um toque põe o nome na ajuda e o aviso sai', async () => {
    const container = await importar(EXAMES_CRISTINA, ['CURY'])
    await waitFor(() => expect(blocos(container)).toHaveLength(2))

    fireEvent.click(await screen.findByRole('button', { name: /\+ Cristina como ajuda/i }))
    await waitFor(() => expect(screen.queryByText(/NÃO está na ordem de liberação nem na ajuda/i)).toBeNull())

    // e a ajuda vai para o banco no publicar (é o que dá o badge e a posição)
    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(salvarEscala).toHaveBeenCalled())
    expect(salvarEscala.mock.calls[0][0].ajudaExterna).toEqual({ matutino: ['CRISTINA'] })
  })

  it('quem está no rodapé não é acusado, e sem rodapé o guardrail se cala', async () => {
    const comRodape = await importar(EXAMES_CRISTINA, ['CURY', 'CRISTINA'])
    await waitFor(() => expect(blocos(comRodape)).toHaveLength(2))
    expect(screen.queryByText(/NÃO está na ordem de liberação nem na ajuda/i)).toBeNull()
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

  it('sugere como ajuda quem está no rodapé do outro hospital e tem caso aqui', async () => {
    const container = await importar(casosAqui, ['CURY'])
    await waitFor(() => expect(blocos(container)).toHaveLength(2))

    const aviso = await screen.findByText(/Já publicado em outro hospital hoje/i)
    expect(aviso.textContent).toMatch(/Fernando \(Unimed\)/)
    // CURY tem caso aqui mas NÃO está no rodapé de lá — não é sugerido
    expect(aviso.textContent).not.toMatch(/Cury/)
  })

  it('um toque marca como ajuda e a sugestão sai', async () => {
    const container = await importar(casosAqui, ['CURY'])
    await waitFor(() => expect(blocos(container)).toHaveLength(2))

    fireEvent.click(await screen.findByRole('button', { name: /\+ Fernando como ajuda/i }))
    await waitFor(() => expect(screen.queryByText(/Já publicado em outro hospital hoje/i)).toBeNull())
  })

  it('mesma pessoa com casos nos DOIS hospitais vira conflito, não sugestão de ajuda', async () => {
    const container = await importar([
      { sala: 'Sala 1', hora: '08:00', anestesista: 'ADRIANO', cirurgiao: 'DR. ANA SOUZA', procedimento: 'Hérnia' },
    ], ['ADRIANO'])
    await waitFor(() => expect(blocos(container)).toHaveLength(1))

    const aviso = await screen.findByText(/Com casos nos DOIS hospitais no mesmo turno/i)
    expect(aviso.textContent).toMatch(/Adriano \(Unimed: 1\)/)
    // e lembra que amarelo = escalado em dois locais de propósito
    expect(aviso.textContent).toMatch(/AMARELO/)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Adicionar linha à mão (bug 30/07): o texto da SALA alimenta a CHAVE do bloco —
// atualizar o estado a cada tecla trocava a key, o React remontava o bloco e o
// input saía do DOM com o foco (só entrava UMA letra por vez; e o bloco novo
// ainda nascia colapsado). O campo passou a commitar no BLUR.
// ════════════════════════════════════════════════════════════════════════════
describe('Adicionar linha — digitação da Sala (bug 30/07)', () => {
  const UMA = [{ sala: 'Sala 1', hora: '08:00', anestesista: 'CURY', cirurgiao: 'DR. ANA SOUZA', procedimento: 'Catarata', pacienteIniciais: 'A.B.' }]

  it('"+ Linha" abre o bloco novo já expandido, com os campos visíveis', async () => {
    const container = await importar(UMA)
    await waitFor(() => expect(blocos(container)).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Linha' }))
    expect(screen.getByPlaceholderText('Sala')).toBeTruthy()
    expect(screen.getByPlaceholderText('Procedimento')).toBeTruthy()
  })

  it('digitação contínua na Sala: mesmo input, sem remount, foco preservado', async () => {
    const container = await importar(UMA)
    await waitFor(() => expect(blocos(container)).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Linha' }))

    const sala = screen.getByPlaceholderText('Sala')
    sala.focus()
    for (const parcial of ['S', 'Sa', 'Sal', 'Sala', 'Sala ', 'Sala 9']) {
      fireEvent.change(sala, { target: { value: parcial } })
    }
    // o mesmo nó continua no DOM com o valor inteiro e o foco — antes a 1ª
    // tecla remontava o bloco e o activeElement caía no body
    expect(screen.getByPlaceholderText('Sala')).toBe(sala)
    expect(sala.value).toBe('Sala 9')
    expect(document.activeElement).toBe(sala)
  })

  it('blur commita: a linha migra para o bloco da sala digitada, que abre junto', async () => {
    const container = await importar(UMA)
    await waitFor(() => expect(blocos(container)).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Linha' }))

    const sala = screen.getByPlaceholderText('Sala')
    fireEvent.change(sala, { target: { value: 'Sala 9' } })
    fireEvent.blur(sala)
    await waitFor(() => expect(blocos(container).some((b) => b.textContent.includes('Sala 9'))).toBe(true))
    // bloco de destino aberto — os campos não "somem" atrás de um bloco fechado
    expect(screen.getByDisplayValue('Sala 9')).toBeTruthy()
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
    RODAPE.forEach((nome, i) => {
      const chip = within(caixa).getByText(nome).closest('span')
      expect(chip.textContent).toContain(String(i + 1))
    })
    // 1º = plantonista, último = sai primeiro (as duas regras posicionais)
    const chipDe = (nome) => within(caixa).getByText(nome).closest('span')
    expect(chipDe('NATHALIA').textContent).toMatch(/plantonista/i)
    expect(chipDe('CURY').textContent).toMatch(/sai 1º/i)
    expect(chipDe('ERLEI').textContent).not.toMatch(/plantonista|sai 1º/i)
    expect(numerada.textContent).toMatch(/5 nomes/)
  })

  it('o texto inteiro fica editável (textarea, não uma linha só)', async () => {
    const container = await importar(UM, RODAPE)
    const campo = container.querySelector('textarea')
    expect(campo).toBeTruthy()
    expect(campo.value).toBe(RODAPE.join(', '))
  })
})
