/**
 * LOTE do dia útil (dono 2026-08-27) — anexar as escalas dos hospitais de uma
 * vez e conferir em ABAS, uma por hospital.
 *
 * O que estas travas protegem, na ordem em que doeriam:
 *  1. trocar de aba NÃO pode apagar a conferência já feita (o `Tabs` do DS
 *     desmonta o painel inativo — por isso as abas aqui são instâncias
 *     escondidas, e é isso que o teste vigia);
 *  2. o arquivo entra na aba do hospital que o LAYOUT declarou, e o que não se
 *     declarou PERGUNTA em vez de chutar;
 *  3. a publicação continua sendo uma por hospital, e hospital com bloqueio não
 *     leva os outros junto.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import ImportarEscalasPage from '@/pages/escala-cirurgica/ImportarEscalasPage'

const { svcMock, salvarEscalaTurno, prepararImagem, parseExcel } = vi.hoisted(() => ({
  svcMock: {
    parseEscalaImagem: vi.fn(),
    fetchEscala: vi.fn(async () => null),
    patchLinhaOverride: vi.fn(async () => {}),
  },
  salvarEscalaTurno: vi.fn(async (p) => ({
    id: `e-${p.hospital}`, ...p, casos: (p.casos || []).map((c, i) => ({ ...c, id: `c${i}`, ordem: i })),
  })),
  prepararImagem: vi.fn(async () => ({ base64: 'AAAA', mimeType: 'image/jpeg', bytes: 3 })),
  parseExcel: vi.fn(async () => ({ casos: [], headerScore: 0 })),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseCirurgiasParticularesService', () => ({
  default: { reservarAvisoTempo: vi.fn(async () => false), completarPacienteDoCaso: vi.fn(async () => {}) },
}))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ salvarEscalaTurno, executarSubstituicao: vi.fn() }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u-sec', role: 'secretaria', displayName: 'Secretária' } }),
}))
vi.mock('@/lib/imagemVision', () => ({ prepararImagemParaVision: prepararImagem }))
vi.mock('@/lib/excelEscala', () => ({ parseExcelEscala: parseExcel }))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: [], aliases: [], loading: false,
    rosterByUid: new Map([['uid-cury', { uid: 'uid-cury', nome: 'GUSTAVO CURY', apelidos: ['CURY'] }]]),
    options: [{ value: 'uid-cury', label: 'Gustavo Cury' }],
    resolver: (nome) => (String(nome).trim().toUpperCase() === 'CURY' ? 'uid-cury' : null),
    refresh: vi.fn(), upsertAlias: vi.fn(async () => {}), removeAlias: vi.fn(),
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const caso = (sala, anestesista, hora = '08:00') => ({
  sala, anestesista, hora, procedimento: `CIRURGIA ${sala}`, cirurgiao: 'DR TESTE',
  pacienteIniciais: 'A.B.', convenio: 'UNIMED', ordem: 0,
})

/** Solta N arquivos de uma vez na caixa de anexo, como o dono faz. */
async function soltarArquivos(container, arquivos) {
  const input = container.querySelector('input[type="file"]')
  fireEvent.change(input, { target: { files: arquivos } })
  await waitFor(() => expect(svcMock.parseEscalaImagem).toHaveBeenCalled())
}

const img = (nome) => new File(['x'], nome, { type: 'image/png' })
/** Só as abas de HOSPITAL: o seletor de período também é um tablist. */
const abas = () => {
  const lista = screen.queryByRole('tablist', { name: /hospitais do lote/i })
  return lista ? within(lista).queryAllByRole('tab') : []
}

function montar() {
  return render(
    <ImportarEscalasPage data="2026-08-27" turno="matutino" onClose={vi.fn()} onAbrirFds={vi.fn()} />,
    { wrapper: wrap },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  svcMock.fetchEscala.mockResolvedValue(null)
  parseExcel.mockResolvedValue({ casos: [], headerScore: 0 })
})

describe('anexo em lote — cada arquivo vai para a aba do seu hospital', () => {
  it('dois arquivos soltos juntos viram duas abas, pelo layout de cada um', async () => {
    svcMock.parseEscalaImagem
      .mockResolvedValueOnce({ casos: [caso('Sala 1', 'CURY')], hospitalDetectado: 'hro', ordemLiberacao: ['CURY'] })
      .mockResolvedValueOnce({ casos: [caso('Sala 2', 'PAULO')], hospitalDetectado: 'materno', ordemLiberacao: ['PAULO'] })

    const { container } = montar()
    await soltarArquivos(container, [img('a.png'), img('b.png')])

    await waitFor(() => expect(abas()).toHaveLength(2))
    expect(abas().map((b) => b.textContent.replace(/\d+$/, ''))).toEqual(
      expect.arrayContaining([expect.stringContaining('HRO'), expect.stringContaining('Materno')]),
    )
    // uma leitura por arquivo — não duas para achar o hospital
    expect(svcMock.parseEscalaImagem).toHaveBeenCalledTimes(2)
  })

  it('reanexar o MESMO hospital substitui a aba, não cria uma segunda', async () => {
    // reanexo é anexar DE NOVO, num segundo lote — e aí substituir é o certo
    svcMock.parseEscalaImagem
      .mockResolvedValueOnce({ casos: [caso('Sala 1', 'CURY')], hospitalDetectado: 'hro' })
      .mockResolvedValueOnce({ casos: [caso('Sala 9', 'PAULO')], hospitalDetectado: 'hro' })

    const { container } = montar()
    const anexar = (f) => fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [f] } })
    anexar(img('hro-velho.png'))
    await waitFor(() => expect(abas()).toHaveLength(1))

    // o input é outro nó depois do 1º lote (a caixa vira botão) — reconsultar
    anexar(img('hro-novo.png'))
    await waitFor(() => expect(svcMock.parseEscalaImagem).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(abas()).toHaveLength(1))
    // nada a perguntar: quem reanexa está mandando trocar
    expect(screen.queryByText(/o lote já tem uma escala/i)).toBeNull()
  })

  it('dois arquivos para o mesmo hospital NO MESMO lote: o segundo pergunta', async () => {
    // ⚠️ trava nascida do relato de 30/08 ("não está reconhecendo a escala do
    // HRO"): dois arquivos caindo no mesmo hospital de uma vez não é reanexo, é
    // classificação errada de um dos dois. Substituir em silêncio apagaria uma
    // escala inteira que a tela ACABOU de dizer que leu.
    svcMock.parseEscalaImagem
      .mockResolvedValueOnce({ casos: [caso('Sala 1', 'CURY')], hospitalDetectado: 'hro' })
      .mockResolvedValueOnce({ casos: [caso('Sala 9', 'PAULO')], hospitalDetectado: 'hro' })

    const { container } = montar()
    await soltarArquivos(container, [img('hro-a.png'), img('hro-b.png')])

    await waitFor(() => expect(abas()).toHaveLength(1))
    expect(await screen.findByText(/o lote já tem uma escala do HRO/i)).toBeTruthy()
  })

  it('a escala do HRO em planilha não vai para a aba da Unimed', async () => {
    // "planilha = Unimed" valia enquanto só a Unimed exportava planilha; o mapa
    // do HRO também chega em .xlsx, e ia inteiro para a aba errada, por cima dela
    parseExcel.mockResolvedValueOnce({
      casos: [caso('Sala 3', 'CURY')], headerScore: 6,
      headers: ['Hora', 'Leito', 'Paciente', 'Cirurgião', 'Procedimento', 'ANEST', 'Conv.', 'Sala'],
    })
    const { container } = montar()
    const input = container.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [new File(['x'], 'hro.xlsx', { type: '' })] } })

    await waitFor(() => expect(abas()).toHaveLength(1))
    expect(abas()[0].textContent).toMatch(/HRO/)
  })

  it('layout e conteúdo discordando: pergunta, e diz o que o conteúdo mostrou', async () => {
    // HRO e Materno têm as MESMAS colunas — a assinatura do HRO é a cor, que um
    // print desbotado não entrega. Aí a escala ia para a aba do Materno.
    svcMock.parseEscalaImagem.mockResolvedValueOnce({
      casos: [caso('IOSC', 'CURY'), { ...caso('Hemodinâmica', 'PAULO'), bloco: 'hemodinamica' }],
      hospitalDetectado: 'materno',
    })
    const { container } = montar()
    await soltarArquivos(container, [img('hro-desbotado.png')])

    expect(await screen.findByText(/o conteúdo é do HRO/i)).toBeTruthy()
    expect(abas()).toHaveLength(0)
  })

  it('arquivo que não se declarou PERGUNTA o hospital em vez de chutar', async () => {
    svcMock.parseEscalaImagem.mockResolvedValueOnce({
      casos: [caso('Sala 3', 'CURY')], hospitalDetectado: '',
    })
    const { container } = montar()
    await soltarArquivos(container, [img('sem-layout.png')])

    expect(await screen.findByText(/não reconheci o hospital pelo layout/i)).toBeTruthy()
    expect(abas()).toHaveLength(0)
  })

  it('nenhuma cirurgia reconhecida não abre aba nenhuma', async () => {
    svcMock.parseEscalaImagem.mockResolvedValueOnce({ casos: [], hospitalDetectado: 'hro' })
    const { container } = montar()
    await soltarArquivos(container, [img('borrada.png')])

    await waitFor(() => expect(abas()).toHaveLength(0))
  })
})

describe('a conferência só abre com o lote inteiro lido (dono 27/08)', () => {
  it('nenhuma aba aparece enquanto ainda há arquivo em leitura', async () => {
    // entregando aba por aba, quem anexou três arquivos começava a conferir o
    // primeiro enquanto os outros ainda estavam na Vision — e a tela mudava de
    // tamanho embaixo do dedo, com "Lendo…" ao lado de uma escala já aberta
    let liberarSegunda
    const segunda = new Promise((resolve) => { liberarSegunda = resolve })
    svcMock.parseEscalaImagem
      .mockResolvedValueOnce({ casos: [caso('Sala 1', 'CURY')], hospitalDetectado: 'hro' })
      .mockImplementationOnce(() => segunda)

    const { container } = montar()
    const input = container.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [img('hro.png'), img('materno.png')] } })

    // a primeira já foi lida — e mesmo assim nada de abas
    await waitFor(() => expect(svcMock.parseEscalaImagem).toHaveBeenCalledTimes(2))
    expect(abas()).toHaveLength(0)
    expect(screen.getByText(/Lendo 2 de 2/i)).toBeTruthy()

    liberarSegunda({ casos: [caso('Sala 2', 'PAULO')], hospitalDetectado: 'materno' })
    await waitFor(() => expect(abas()).toHaveLength(2))
  })

  it('o lote entra INTEIRO de uma vez, não uma aba de cada vez', async () => {
    svcMock.parseEscalaImagem
      .mockResolvedValueOnce({ casos: [caso('Sala 1', 'CURY')], hospitalDetectado: 'hro' })
      .mockResolvedValueOnce({ casos: [caso('Sala 2', 'PAULO')], hospitalDetectado: 'materno' })

    const { container } = montar()
    await soltarArquivos(container, [img('hro.png'), img('materno.png')])
    // nunca existe um estado intermediário de UMA aba: ou nenhuma, ou as duas
    await waitFor(() => expect(abas()).toHaveLength(2))
  })
})

describe('a troca de aba não pode apagar a conferência', () => {
  it('o que foi digitado no rodapé de um hospital continua lá depois de ir e voltar', async () => {
    // é a trava do desenho: `TabsContent` do DS desmontaria o painel inativo e
    // levaria junto casos, atribuições e rodapé já conferidos
    svcMock.parseEscalaImagem
      .mockResolvedValueOnce({ casos: [caso('Sala 1', 'CURY')], hospitalDetectado: 'hro', ordemLiberacao: ['CURY'] })
      .mockResolvedValueOnce({ casos: [caso('Sala 2', 'PAULO')], hospitalDetectado: 'materno', ordemLiberacao: ['PAULO'] })

    const { container } = montar()
    await soltarArquivos(container, [img('hro.png'), img('materno.png')])
    await waitFor(() => expect(abas()).toHaveLength(2))

    // as duas abas estão montadas: o campo procurado é o da aba VISÍVEL
    const visivel = (re) => screen.getAllByPlaceholderText(re).find((el) => !el.closest('.hidden'))
    const ajudaDoHro = visivel(/vão ao fim da liberação/i)
    fireEvent.change(ajudaDoHro, { target: { value: 'DIEGO' } })
    expect(ajudaDoHro.value).toBe('DIEGO')

    fireEvent.click(abas().find((b) => b.textContent.includes('Materno')))
    fireEvent.click(abas().find((b) => b.textContent.includes('HRO')))

    // o campo é o MESMO nó (nunca desmontou) e guardou o que foi digitado
    expect(ajudaDoHro.value).toBe('DIEGO')
    expect(ajudaDoHro.isConnected).toBe(true)
  })

  it('a aba inativa fica escondida, não removida do DOM', async () => {
    svcMock.parseEscalaImagem
      .mockResolvedValueOnce({ casos: [caso('Sala 1', 'CURY')], hospitalDetectado: 'hro' })
      .mockResolvedValueOnce({ casos: [caso('Sala 2', 'PAULO')], hospitalDetectado: 'materno' })

    const { container } = montar()
    await soltarArquivos(container, [img('hro.png'), img('materno.png')])
    await waitFor(() => expect(abas()).toHaveLength(2))

    const escondidas = container.querySelectorAll('.hidden[aria-hidden="true"]')
    expect(escondidas.length).toBe(1)
  })
})

describe('duplicidade entre hospitais — antes da primeira publicação', () => {
  it('mesma pessoa com caso em dois hospitais do lote aparece SEM ninguém ter publicado', async () => {
    // antes, o cruzamento só via o que já estava publicado: quem publicasse
    // primeiro saía sem aviso nenhum e o último decidia pelos dois
    svcMock.parseEscalaImagem
      .mockResolvedValueOnce({ casos: [caso('Sala 1', 'CURY')], hospitalDetectado: 'hro', ordemLiberacao: ['CURY'] })
      .mockResolvedValueOnce({ casos: [caso('Sala 2', 'CURY')], hospitalDetectado: 'materno', ordemLiberacao: ['CURY'] })

    const { container } = montar()
    await soltarArquivos(container, [img('hro.png'), img('materno.png')])
    await waitFor(() => expect(abas()).toHaveLength(2))

    expect(await screen.findAllByText(/Duplicidade entre hospitais/i)).not.toHaveLength(0)
    expect(salvarEscalaTurno).not.toHaveBeenCalled()
  })

  it('duplicidade não classificada TRAVA a publicação daquele hospital', async () => {
    svcMock.parseEscalaImagem
      .mockResolvedValueOnce({ casos: [caso('Sala 1', 'CURY')], hospitalDetectado: 'hro', ordemLiberacao: ['CURY'] })
      .mockResolvedValueOnce({ casos: [caso('Sala 2', 'CURY')], hospitalDetectado: 'materno', ordemLiberacao: ['CURY'] })

    const { container } = montar()
    await soltarArquivos(container, [img('hro.png'), img('materno.png')])
    await waitFor(() => expect(abas()).toHaveLength(2))

    fireEvent.click(screen.getByRole('button', { name: /revisar e publicar/i }))
    expect(await screen.findByText(/revisar antes de publicar/i)).toBeTruthy()
    // nada a publicar enquanto os dois lados estiverem por classificar
    expect(screen.getByRole('button', { name: /nada a publicar/i }).disabled).toBe(true)
    expect(salvarEscalaTurno).not.toHaveBeenCalled()
  })
})

describe('folha de revisão e publicação em sequência', () => {
  async function loteDeDois() {
    svcMock.parseEscalaImagem
      .mockResolvedValueOnce({ casos: [caso('Sala 1', 'CURY')], hospitalDetectado: 'hro', ordemLiberacao: ['CURY'] })
      .mockResolvedValueOnce({ casos: [caso('Sala 2', 'PAULO')], hospitalDetectado: 'materno', ordemLiberacao: ['PAULO'] })
    const utils = montar()
    await soltarArquivos(utils.container, [img('hro.png'), img('materno.png')])
    await waitFor(() => expect(abas()).toHaveLength(2))
    return utils
  }

  it('publica UMA VEZ POR HOSPITAL, no dia e no turno do lote', async () => {
    await loteDeDois()
    fireEvent.click(screen.getByRole('button', { name: /revisar e publicar/i }))

    const publicar = await screen.findByRole('button', { name: /publicar as 2/i })
    fireEvent.click(publicar)

    await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalledTimes(2))
    const hospitais = salvarEscalaTurno.mock.calls.map(([p]) => p.hospital)
    expect(hospitais.sort()).toEqual(['hro', 'materno'])
    for (const [payload] of salvarEscalaTurno.mock.calls) {
      expect(payload.data).toBe('2026-08-27')
      expect(payload.turno).toBe('matutino')
      expect(payload.status).toBe('publicada')
    }
  })

  it('a folha lista cada hospital com a contagem que vai ser publicada', async () => {
    await loteDeDois()
    fireEvent.click(screen.getByRole('button', { name: /revisar e publicar/i }))

    const folha = await screen.findByText(/revisar antes de publicar/i)
    expect(folha).toBeTruthy()
    expect(screen.getAllByText(/1 caso\b/).length).toBeGreaterThanOrEqual(2)
  })
})
