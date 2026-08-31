/**
 * Conferência — DECISÕES DO DIA na seção da ordem (reforma modelo B, dono 31/08,
 * escolhido em protótipo a 430px: .tmp/conferencia-decisoes-modelos.html).
 *
 * As decisões operacionais (ajuda de fora, pessoa em dois hospitais, caso fora
 * da ordem) moravam no FIM da página como avisos espalhados, sem lugar de
 * preencher. Agora são LINHAS dentro do cartão da fila — porque toda decisão é
 * sobre quem entra, sai ou muda de lugar NESTA fila — e cada uma abre uma folha
 * com as saídas explícitas. Os dados gravados são os MESMOS de sempre
 * (ajudaExterna, decisões de duplicidade, ordem); só a superfície mudou.
 *
 * E o anestesista passa a ser perguntado UMA vez por bloco: a linha do caso lê
 * o nome herdado, e o seletor por caso só abre pelo lápis (medido no banco:
 * 63% dos blocos têm 1 caso; sala multi-anestesista é 22% — o Select repetido
 * em cada caso quase nunca trabalhava, e era a "mesma pergunta duas vezes").
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import ImportarEscalaPage from '@/pages/escala-cirurgica/ImportarEscalaPage'

const { svcMock, salvarEscala, upsertAlias, prepararImagem } = vi.hoisted(() => ({
  svcMock: {
    parseEscalaImagem: vi.fn(),
    fetchEscala: vi.fn(async () => null),
    updateAnestesistaCasos: vi.fn(async () => {}),
    patchLinhaOverride: vi.fn(async () => {}),
  },
  salvarEscala: vi.fn(async (p) => ({ id: 'e1', ...p, casos: p.casos.map((c, i) => ({ ...c, id: `c${i}`, ordem: i })) })),
  upsertAlias: vi.fn(async () => {}),
  prepararImagem: vi.fn(async () => ({
    base64: 'AAAA', mimeType: 'image/jpeg', bytes: 3, largura: 1600, altura: 1200, reduzida: true,
  })),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseCirurgiasParticularesService', () => ({
  default: { reservarAvisoTempo: vi.fn(async () => false), completarPacienteDoCaso: vi.fn(async () => {}) },
}))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ salvarEscala }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u-sec', role: 'secretaria', displayName: 'Secretária' } }),
}))
vi.mock('@/lib/imagemVision', () => ({ prepararImagemParaVision: prepararImagem }))
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

async function importar(casos, ordemLiberacao = [], { hospital = 'hro' } = {}) {
  svcMock.parseEscalaImagem.mockResolvedValueOnce({ casos, ordemLiberacao, ajudaExterna: [] })
  const { container } = render(<ImportarEscalaPage hospital={hospital} data="2026-07-28" onClose={vi.fn()} />, { wrapper: wrap })
  const input = container.querySelector('input[type="file"]')
  fireEvent.change(input, { target: { files: [new File(['x'], 'escala.png', { type: 'image/png' })] } })
  await waitFor(() => expect(svcMock.parseEscalaImagem).toHaveBeenCalled())
  return container
}

const blocos = (container) =>
  [...container.querySelectorAll('button[aria-expanded]')]
    .filter((b) => !b.closest('li'))
    .filter((b) => /\d+ caso/.test(b.textContent))

/** A seção da ordem — é DENTRO dela que as decisões do dia moram agora. */
const secaoOrdem = (container) => container.querySelector('#conf-liberacoes')

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-07-28T10:00:00-03:00'))
})
afterAll(() => vi.useRealTimers())

beforeEach(() => {
  svcMock.parseEscalaImagem.mockReset()
  svcMock.fetchEscala.mockReset()
  svcMock.fetchEscala.mockResolvedValue(null)
  svcMock.patchLinhaOverride.mockClear()
  salvarEscala.mockClear()
  upsertAlias.mockReset()
  upsertAlias.mockResolvedValue({})
})

// ════════════════════════════════════════════════════════════════════════════
// O anestesista é perguntado UMA vez por bloco — a linha lê, o lápis abre
// ════════════════════════════════════════════════════════════════════════════
describe('bloco com 2+ casos — a linha do caso LÊ o anestesista; o lápis fura', () => {
  const EXAMES = [
    { sala: 'Exames', hora: '07:30', anestesista: 'PAULO', cirurgiao: 'WALDIR', procedimento: 'ENDOSCOPIA' },
    { sala: 'Exames', hora: '09:00', anestesista: 'PAULO', cirurgiao: 'MILTON', procedimento: 'COLONOSCOPIA' },
  ]

  it('não repete o seletor por caso — mostra o nome herdado como leitura', async () => {
    const container = await importar(EXAMES, ['PAULO'])
    await waitFor(() => expect(blocos(container)).toHaveLength(1))
    fireEvent.click(blocos(container)[0])

    // era a "mesma pergunta duas vezes" (dono 30/08 para 1 caso; 31/08 fecha o
    // resto): nenhum Select por caso renderizado de saída
    expect(screen.queryByText(/defina o do bloco acima/i)).toBeNull()
    // no lugar, cada caso LÊ o anestesista efetivo, com a origem
    expect(screen.getAllByText(/do bloco/i).length).toBe(2)
    // e o caminho de furar continua existindo, um por caso
    expect(screen.getAllByRole('button', { name: /alterar o anestesista deste caso/i }).length).toBe(2)
  })

  it('o lápis abre o seletor daquele caso e a escolha vai para a publicação', async () => {
    const container = await importar(EXAMES, ['PAULO'])
    await waitFor(() => expect(blocos(container)).toHaveLength(1))
    fireEvent.click(blocos(container)[0])

    fireEvent.click(screen.getAllByRole('button', { name: /alterar o anestesista deste caso/i })[1])
    // o seletor aparece SÓ agora, e só para este caso
    const seletor = await screen.findByText(/defina o do bloco acima/i)
    fireEvent.click(seletor.closest('[role="combobox"]') || seletor)
    fireEvent.click(await screen.findByRole('option', { name: 'Gustavo Cury' }))

    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(salvarEscala).toHaveBeenCalled())
    const casos = salvarEscala.mock.calls[0][0].casos
    expect(casos[1].anestesistaUserId).toBe('uid-cury')
    // o primeiro caso segue com o dono do bloco
    expect(casos[0].anestesistaUserId).not.toBe('uid-cury')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Pessoa em dois hospitais — decisão na seção da ordem, folha com 3 saídas
// ════════════════════════════════════════════════════════════════════════════
describe('duplicidade entre hospitais vira decisão na seção da ordem', () => {
  const outraEscala = {
    id: 'e-unimed', hospital: 'unimed', data: '2026-07-28',
    ordemLiberacao: { matutino: ['ADRIANO', 'FERNANDO'] },
    ajudaExterna: {},
    casos: [{ sala: 'CC - Sala 1', ordem: 0, hora: '08:00', anestesista: 'ADRIANO', turno: 'matutino' }],
  }
  const AQUI = [
    { sala: 'Sala 1', hora: '08:00', anestesista: 'ADRIANO', cirurgiao: 'DR. ANA', procedimento: 'Hérnia' },
  ]
  beforeEach(() => {
    svcMock.fetchEscala.mockImplementation(async (_d, h) => (h === 'unimed' ? outraEscala : null))
  })

  it('a linha mora DENTRO do cartão da ordem, não em Pendências', async () => {
    const container = await importar(AQUI, ['ADRIANO'])
    await waitFor(() => expect(blocos(container)).toHaveLength(1))

    const ordem = secaoOrdem(container)
    expect(await within(ordem).findByText(/em dois hospitais/i)).toBeTruthy()
    // e a publicação continua travada até responder
    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(screen.getAllByText(/duplicidade/i).length).toBeGreaterThan(0))
    expect(salvarEscala).not.toHaveBeenCalled()
  })

  it('a folha traz os dois lados e "trabalha nos dois" destrava a publicação', async () => {
    const container = await importar(AQUI, ['ADRIANO'])
    await waitFor(() => expect(blocos(container)).toHaveLength(1))

    fireEvent.click(await within(secaoOrdem(container)).findByText(/em dois hospitais/i))
    // a folha mostra os dois lados e lembra a convenção da foto
    expect(await screen.findByText(/AMARELO/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /trabalha nos dois/i }))

    // a linha vira respondida, com a saída de refazer
    expect(await within(secaoOrdem(container)).findByText(/confirmada como intencional/i)).toBeTruthy()
    expect(within(secaoOrdem(container)).getByRole('button', { name: /refazer/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(salvarEscala).toHaveBeenCalled())
  })

  it('declarar a troca pela folha grava a decisão com o parceiro', async () => {
    const container = await importar(AQUI, ['ADRIANO'])
    await waitFor(() => expect(blocos(container)).toHaveLength(1))

    fireEvent.click(await within(secaoOrdem(container)).findByText(/em dois hospitais/i))
    // escolhe o parceiro no Select da folha e declara
    const folha = (await screen.findByText(/AMARELO/i)).closest('[role="dialog"]') || document.body
    fireEvent.click(within(folha).getByRole('combobox'))
    fireEvent.click(await screen.findByRole('option', { name: 'Gustavo Cury' }))
    fireEvent.click(screen.getByRole('button', { name: /declarar a troca/i }))

    expect(await within(secaoOrdem(container)).findByText(/troca declarada/i)).toBeTruthy()
    // e ao publicar a troca declarada segue o caminho de sempre (trocaCom)
    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(salvarEscala).toHaveBeenCalled())
    await waitFor(() => expect(svcMock.patchLinhaOverride).toHaveBeenCalled())
    const [, chave, override] = svcMock.patchLinhaOverride.mock.calls[0]
    expect(chave).toMatch(/^matutino:/)
    expect(override.trocaCom.uid).toBe('uid-cury')
  })

  it('"é ajuda aqui" grava a ajuda — a regra de 30/08 destrava sozinha', async () => {
    const container = await importar(AQUI, ['ADRIANO'])
    await waitFor(() => expect(blocos(container)).toHaveLength(1))

    fireEvent.click(await within(secaoOrdem(container)).findByText(/em dois hospitais/i))
    fireEvent.click(await screen.findByRole('button', { name: /ajuda aqui/i }))

    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(salvarEscala).toHaveBeenCalled())
    expect(salvarEscala.mock.calls[0][0].ajudaExterna).toEqual({ matutino: ['ADRIANO'] })
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Ajuda de fora — sugestão do cruzamento e ajuda marcada com lugar próprio
// ════════════════════════════════════════════════════════════════════════════
describe('ajuda de fora — decisão com lugar próprio na seção da ordem', () => {
  const outraEscala = {
    id: 'e-unimed', hospital: 'unimed', data: '2026-07-28',
    ordemLiberacao: { matutino: ['ADRIANO', 'FERNANDO'] },
    ajudaExterna: {},
    casos: [{ sala: 'CC - Sala 1', ordem: 0, hora: '08:00', anestesista: 'ADRIANO', turno: 'matutino' }],
  }
  const AQUI = [
    { sala: 'Sala 1', hora: '08:00', anestesista: 'CURY', cirurgiao: 'DR. ANA', procedimento: 'Hérnia' },
    { sala: 'IOSC', hora: '09:00', anestesista: 'FERNANDO', cirurgiao: 'DR. BRUNO', procedimento: 'Catarata' },
  ]
  beforeEach(() => {
    svcMock.fetchEscala.mockImplementation(async (_d, h) => (h === 'unimed' ? outraEscala : null))
  })

  it('quem está no rodapé do outro hospital vira linha "ajuda de fora?" na ordem', async () => {
    const container = await importar(AQUI, ['CURY'])
    await waitFor(() => expect(blocos(container)).toHaveLength(2))

    const linha = await within(secaoOrdem(container)).findByText(/ajuda de fora\?/i)
    expect(linha.closest('button').textContent).toMatch(/Unimed/i)
    fireEvent.click(linha)
    fireEvent.click(await screen.findByRole('button', { name: /marcar como ajuda/i }))

    // respondida: a linha verde diz o efeito e dá a saída de refazer
    expect(await within(secaoOrdem(container)).findByText(/marcado como ajuda/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(salvarEscala).toHaveBeenCalled())
    expect(salvarEscala.mock.calls[0][0].ajudaExterna).toEqual({ matutino: ['FERNANDO'] })
  })

  it('Refazer remove a ajuda marcada — era a única forma que o Input dava', async () => {
    const container = await importar(AQUI, ['CURY'])
    await waitFor(() => expect(blocos(container)).toHaveLength(2))

    fireEvent.click(await within(secaoOrdem(container)).findByText(/ajuda de fora\?/i))
    fireEvent.click(await screen.findByRole('button', { name: /marcar como ajuda/i }))
    await within(secaoOrdem(container)).findByText(/marcado como ajuda/i)

    fireEvent.click(within(secaoOrdem(container)).getByRole('button', { name: /refazer/i }))
    await waitFor(() => expect(within(secaoOrdem(container)).queryByText(/marcado como ajuda/i)).toBeNull())

    // sem a ajuda, a PERGUNTA volta (rodapé lá + caso aqui é pendência de
    // duplicidade) — e a publicação volta a travar, a regra de 30/08 pelo avesso
    expect(await within(secaoOrdem(container)).findByText(/ajuda de fora\?/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(screen.getAllByText(/duplicidade/i).length).toBeGreaterThan(0))
    expect(salvarEscala).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Com caso, fora da ordem — as DUAS saídas com botão
// ════════════════════════════════════════════════════════════════════════════
describe('caso fora da ordem — a folha dá as duas saídas', () => {
  const EXAMES_CRISTINA = [
    { sala: 'Exames', hora: '08:00', anestesista: 'CRISTINA', cirurgiao: 'WALDIR', procedimento: 'Endoscopia' },
    { sala: 'Exames', hora: '10:00', anestesista: 'CRISTINA', cirurgiao: 'MILTON', procedimento: 'Colonoscopia' },
    { sala: 'Sala 1', hora: '08:00', anestesista: 'CURY', cirurgiao: 'DR. ANA', procedimento: 'Hérnia' },
  ]

  it('marcar como ajuda pela folha grava e publica', async () => {
    const container = await importar(EXAMES_CRISTINA, ['CURY'])
    await waitFor(() => expect(blocos(container)).toHaveLength(2))

    fireEvent.click(await within(secaoOrdem(container)).findByText(/fora da ordem/i))
    // a folha explica as duas causas clássicas antes das saídas
    expect(await screen.findByText(/AZUL/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /marcar como ajuda/i }))

    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(salvarEscala).toHaveBeenCalled())
    expect(salvarEscala.mock.calls[0][0].ajudaExterna).toEqual({ matutino: ['CRISTINA'] })
  })

  it('acrescentar à ordem pela folha põe o nome no FIM da fila publicada', async () => {
    const container = await importar(EXAMES_CRISTINA, ['CURY'])
    await waitFor(() => expect(blocos(container)).toHaveLength(2))

    fireEvent.click(await within(secaoOrdem(container)).findByText(/fora da ordem/i))
    fireEvent.click(await screen.findByRole('button', { name: /acrescentar à ordem/i }))

    fireEvent.click(screen.getByRole('button', { name: /Publicar/i }))
    await waitFor(() => expect(salvarEscala).toHaveBeenCalled())
    // formato legado (merge por turno) — o mesmo dos demais testes da página
    expect(salvarEscala.mock.calls[0][0].ordemLiberacao).toEqual({ matutino: ['CURY', 'CRISTINA'] })
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Na ordem sem cirurgia — a explicação mora na folha, não num aviso solto
// ════════════════════════════════════════════════════════════════════════════
describe('na ordem sem cirurgia — linha de conferência com a explicação', () => {
  it('nome sem caso entre escalados vira linha na ordem e a folha explica', async () => {
    const container = await importar(
      [
        { sala: 'Sala 1', hora: '08:00', anestesista: 'CURY', cirurgiao: 'DR. ANA', procedimento: 'Hérnia' },
        { sala: 'Sala 2', hora: '08:00', anestesista: 'ERLEI', cirurgiao: 'DR. BETO', procedimento: 'CVL' },
      ],
      ['CURY', 'NATHALIA', 'ERLEI'],
    )
    await waitFor(() => expect(blocos(container)).toHaveLength(2))

    const linha = await within(secaoOrdem(container)).findByText(/sem cirurgia/i)
    fireEvent.click(linha)
    // o porquê que morava no aviso de Pendências agora é lido aqui
    expect(await screen.findByText(/pode ter saído para outra pessoa/i)).toBeTruthy()
  })
})
