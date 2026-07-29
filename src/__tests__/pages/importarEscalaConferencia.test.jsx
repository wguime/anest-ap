/**
 * Conferência da importação — pedido do dono 27/07: sala/bloco com MAIS DE UM
 * anestesista (IOSC, Exames, seções de outro hospital) tem que aparecer SEPARADO,
 * cada anestesista com o seu cirurgião. Agrupar tudo numa sala só foi o que
 * achatou o IOSC em 23/07 (3 linhas saíram para uma pessoa e 2 sumiram).
 *
 * Exercita o caminho real: upload da imagem → Vision (mock) → conferência.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import ImportarEscalaPage from '@/pages/escala-cirurgica/ImportarEscalaPage'

const { svcMock, salvarEscala, upsertAlias, prepararImagem } = vi.hoisted(() => ({
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
    roster: [], aliases: [], loading: false,
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
