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
  svcMock.fetchEscala.mockReset()
  svcMock.fetchEscala.mockResolvedValue(null)
  parseExcel.mockResolvedValue({ casos: [], headerScore: 0 })
  // o rascunho do lote é durável de propósito (Onda 2): sem isto um teste restauraria a
  // conferência do teste anterior
  localStorage.clear()
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
      casos: [caso('IOSC', 'CURY'), caso('Bloco M - Sala 2', 'PAULO')],
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

  it('o que sobra no lote é DEDUZIDO: 2 identificados, o 3º é o que falta', async () => {
    // ⚠️ dono 30/08, 2ª rodada: "mesmo após mudanças não reconheceu a escala do
    // HRO, mas apareceu opção de selecionar o hospital". O mapa daquela segunda
    // não tinha marca nenhuma — as salas eram "Sala 3", "Sala 6", e "Sala N"
    // pelado é dos dois hospitais. O lote sabe o que o arquivo sozinho não sabe.
    svcMock.parseEscalaImagem
      .mockResolvedValueOnce({ casos: [caso('CC - Sala 1', 'CURY')], hospitalDetectado: 'unimed' })
      .mockResolvedValueOnce({ casos: [caso('Sala 2 HC', 'PAULO')], hospitalDetectado: 'materno' })
      .mockResolvedValueOnce({ casos: [caso('Sala 3', 'CURY'), caso('Sala 6', 'PAULO')], hospitalDetectado: '' })

    const { container } = montar()
    await soltarArquivos(container, [img('a.png'), img('b.png'), img('c.png')])

    await waitFor(() => expect(abas()).toHaveLength(3))
    expect(abas().map((b) => b.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('HRO')]),
    )
    // e a dedução é DITA, não silenciosa
    expect(await screen.findByText(/era o único hospital que faltava no lote/i)).toBeTruthy()
  })

  it('com DUAS vagas livres a dedução não fecha — continua perguntando', () => {
    // dois arquivos, um identificado: sobra HRO e Materno. Deduzir aqui seria
    // chute, e chute põe a escala na aba errada — o defeito de origem.
    svcMock.parseEscalaImagem
      .mockResolvedValueOnce({ casos: [caso('CC - Sala 1', 'CURY')], hospitalDetectado: 'unimed' })
      .mockResolvedValueOnce({ casos: [caso('Sala 3', 'PAULO')], hospitalDetectado: '' })

    const { container } = montar()
    return soltarArquivos(container, [img('a.png'), img('b.png')])
      .then(async () => {
        await waitFor(() => expect(abas()).toHaveLength(1))
        expect(await screen.findByText(/não reconheci o hospital pelo layout/i)).toBeTruthy()
      })
  })

  it('nenhuma cirurgia reconhecida não abre aba nenhuma', async () => {
    svcMock.parseEscalaImagem.mockResolvedValueOnce({ casos: [], hospitalDetectado: 'hro' })
    const { container } = montar()
    await soltarArquivos(container, [img('borrada.png')])

    await waitFor(() => expect(abas()).toHaveLength(0))
  })

  it('leitura CORTADA (truncado) entra na aba COM o aviso — não em silêncio', async () => {
    // auditoria 31/08: a tela de uma escala avisa "leitura incompleta" desde
    // 06/08; o lote guardava o flag e não avisava nada — a escala sem as
    // últimas linhas ia para a conferência como se estivesse inteira, que é o
    // modo de falha silencioso que o teto de tokens da edge existe para expor.
    svcMock.parseEscalaImagem.mockResolvedValueOnce({
      casos: [caso('Sala 1', 'CURY')], hospitalDetectado: 'hro',
      ordemLiberacao: ['CURY'], truncado: true,
    })
    const { container } = montar()
    await soltarArquivos(container, [img('vespertina-grande.png')])

    await waitFor(() => expect(abas()).toHaveLength(1))
    expect(await screen.findByText(/leitura foi cortada/i)).toBeTruthy()
  })
})

describe('o anestesista é perguntado UMA vez por bloco (dono 30/08)', () => {
  const abrirBlocos = () => fireEvent.click(screen.getByRole('button', { name: /Expandir todos os blocos/i }))

  it('bloco de UM caso não repete o seletor dentro do caso', async () => {
    // "na tela de confirmação aparece duas vezes para selecionar o anestesista":
    // com um caso só, o seletor do bloco JÁ é o daquele caso
    svcMock.parseEscalaImagem.mockResolvedValueOnce({
      // PAULO não resolve no roster do teste: sem valor, o Select mostra o
      // PLACEHOLDER — que é o texto por onde estas duas travas o encontram
      casos: [caso('Sala 3', 'PAULO')], hospitalDetectado: 'hro', ordemLiberacao: ['PAULO'],
    })
    const { container } = montar()
    await soltarArquivos(container, [img('hro.png')])
    await waitFor(() => expect(abas()).toHaveLength(1))

    abrirBlocos()
    expect(screen.queryByText(/defina o do bloco acima/i)).toBeNull()
  })

  it('com DOIS casos a linha LÊ o anestesista — o lápis abre o seletor (31/08)', async () => {
    // ⚠️ esta trava MUDOU DE LADO em 31/08 (modelo B escolhido em protótipo):
    // ela travava "o seletor por caso volta com 2+ casos"; renderizado sempre,
    // ele era a mesma pergunta N vezes no mesmo bloco. Agora a linha do caso lê
    // o nome herdado e o seletor abre SÓ pelo lápis — furar é exceção (22% das
    // salas têm 2+ anestesistas, medido no banco).
    svcMock.parseEscalaImagem.mockResolvedValueOnce({
      casos: [
        { ...caso('Exames', 'PAULO', '07:30'), procedimento: 'ENDOSCOPIA' },
        { ...caso('Exames', 'PAULO', '09:00'), procedimento: 'COLONOSCOPIA', ordem: 1 },
      ],
      hospitalDetectado: 'hro', ordemLiberacao: ['PAULO'],
    })
    const { container } = montar()
    await soltarArquivos(container, [img('hro.png')])
    await waitFor(() => expect(abas()).toHaveLength(1))

    abrirBlocos()
    expect(screen.queryByText(/defina o do bloco acima/i)).toBeNull()
    const lapis = screen.getAllByRole('button', { name: /alterar o anestesista deste caso/i })
    expect(lapis.length).toBe(2)
    fireEvent.click(lapis[0])
    expect(await screen.findByText(/defina o do bloco acima/i)).toBeTruthy()
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
    // desde 03/09 (protótipo L8) a espera é um cartão com barra e um item por arquivo; o
    // contador diz quantas já TERMINARAM, como na imagem aprovada
    expect(screen.getByText(/Lendo as escalas/i)).toBeTruthy()
    expect(screen.getByText('1 de 2')).toBeTruthy()
    expect(screen.getByText('hro.png')).toBeTruthy()
    expect(screen.getByText('materno.png')).toBeTruthy()

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
    // (o Input de ajuda saiu em 31/08 — o proxy de estado agora é a HORA de um
    // caso, digitada com o bloco aberto)
    const visivel = (els) => els.find((el) => !el.closest('.hidden'))
    fireEvent.click(visivel(screen.getAllByRole('button', { name: /Expandir todos os blocos/i })))
    const horaDoHro = visivel(screen.getAllByPlaceholderText('Hora'))
    fireEvent.change(horaDoHro, { target: { value: '09:45' } })
    expect(horaDoHro.value).toBe('09:45')

    fireEvent.click(abas().find((b) => b.textContent.includes('Materno')))
    fireEvent.click(abas().find((b) => b.textContent.includes('HRO')))

    // o campo é o MESMO nó (nunca desmontou) e guardou o que foi digitado
    expect(horaDoHro.value).toBe('09:45')
    expect(horaDoHro.isConnected).toBe(true)
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

    // desde 31/08 a duplicidade é linha de DECISÃO no cartão da fila de cada aba
    expect(await screen.findAllByText(/em dois hospitais/i)).not.toHaveLength(0)
    expect(salvarEscalaTurno).not.toHaveBeenCalled()
  })

  it('classificar numa aba vale para TODAS — a duplicidade é da pessoa', async () => {
    // dono 30/08: "tive que clicar a mesma informação nas 3 abas dos hospitais,
    // mesmo já tendo informado e no caso não tendo relação com o Materno"
    svcMock.parseEscalaImagem
      .mockResolvedValueOnce({ casos: [caso('Sala 1', 'CURY')], hospitalDetectado: 'hro', ordemLiberacao: ['CURY'] })
      .mockResolvedValueOnce({ casos: [caso('Sala 2', 'CURY')], hospitalDetectado: 'materno', ordemLiberacao: ['CURY'] })

    const { container } = montar()
    await soltarArquivos(container, [img('hro.png'), img('materno.png')])
    await waitFor(() => expect(abas()).toHaveLength(2))

    // a decisão abre pela LINHA da aba visível (folha com as saídas — 31/08);
    // o cartão-resumo também fala "em dois hospitais", então o filtro é a
    // seção da ordem, onde a linha mora
    const linhas = await screen.findAllByText(/em dois hospitais/i)
    fireEvent.click(linhas.find((l) => !l.closest('.hidden') && l.closest('#conf-liberacoes')))
    fireEvent.click(await screen.findByRole('button', { name: /trabalha nos dois/i }))
    // as DUAS abas passam a mostrar resolvido — sem um segundo toque
    expect(await screen.findAllByText(/confirmada como intencional/i)).toHaveLength(2)

    // UM toque destrava o LOTE INTEIRO: sem compartilhar, a aba não classificada
    // seguiria travada e a folha diria "Nada a publicar" (é o que o teste vizinho
    // trava para o caso não classificado)
    fireEvent.click(screen.getByRole('button', { name: /revisar e publicar/i }))
    expect(await screen.findByRole('button', { name: /publicar as 2/i })).toBeTruthy()
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

// ESPERA COM ESTADO POR ARQUIVO (dono 03/09, protótipo L8): a leitura leva de 30 a 90 s e
// mostrava uma linha de texto; o que deu errado chegava num toast de 12 s que sumia sozinho.
describe('espera da leitura', () => {
  it('mostra um item por arquivo e o problema FICA na tela depois da leitura', async () => {
    svcMock.parseEscalaImagem
      .mockResolvedValueOnce({ casos: [caso('Sala 1', 'CURY')], hospitalDetectado: 'hro', ordemLiberacao: ['CURY'], truncado: true })
      .mockResolvedValueOnce({ casos: [caso('Sala 2', 'PAULO')], hospitalDetectado: 'materno', ordemLiberacao: ['PAULO'] })
    const { container } = montar()
    await soltarArquivos(container, [img('hro.png'), img('materno.png')])
    await waitFor(() => expect(abas()).toHaveLength(2))

    // terminou a leitura e o aviso da escala cortada continua visível, com o arquivo
    expect(screen.getByText('hro.png')).toBeTruthy()
    expect(screen.getByText(/leitura cortada/i)).toBeTruthy()
    expect(screen.getByText(/HRO · 1 caso/)).toBeTruthy()

    // e sai só quando a pessoa tira
    fireEvent.click(screen.getByRole('button', { name: /tirar estes avisos/i }))
    await waitFor(() => expect(screen.queryByText(/leitura cortada/i)).toBeNull())
  })

  it('leitura sem ressalva nenhuma não deixa cartão na tela', async () => {
    svcMock.parseEscalaImagem
      .mockResolvedValueOnce({ casos: [caso('Sala 1', 'CURY')], hospitalDetectado: 'hro', ordemLiberacao: ['CURY'] })
      .mockResolvedValueOnce({ casos: [caso('Sala 2', 'PAULO')], hospitalDetectado: 'materno', ordemLiberacao: ['PAULO'] })
    const { container } = montar()
    await soltarArquivos(container, [img('hro.png'), img('materno.png')])
    await waitFor(() => expect(abas()).toHaveLength(2))
    expect(screen.queryByText(/Leitura com ressalvas/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /tirar estes avisos/i })).toBeNull()
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

  // O hospital com campo que o BANCO recusaria não entra no lote (Onda 1, item 1.2): antes,
  // ele passava pelo plano com selo de "pronto" e derrubava a própria publicação no meio da
  // sequência — o incidente de 02/09 visto do lado do lote.
  it('escala com paciente fora de iniciais fica de fora; a outra publica normalmente', async () => {
    svcMock.parseEscalaImagem
      .mockResolvedValueOnce({ casos: [caso('Sala 1', 'CURY')], hospitalDetectado: 'hro', ordemLiberacao: ['CURY'] })
      .mockResolvedValueOnce({
        casos: [{ ...caso('Sala 2', 'PAULO'), pacienteIniciais: 'MARIA DA SILVA' }],
        hospitalDetectado: 'materno', ordemLiberacao: ['PAULO'],
      })
    const { container } = montar()
    await soltarArquivos(container, [img('hro.png'), img('materno.png')])
    await waitFor(() => expect(abas()).toHaveLength(2))

    fireEvent.click(screen.getByRole('button', { name: /revisar e publicar/i }))
    // o botão já diz que só uma está pronta
    const botao = await screen.findByRole('button', { name: /publicar a que está pronta/i })
    fireEvent.click(botao)

    await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalledTimes(1))
    expect(salvarEscalaTurno.mock.calls[0][0].hospital).toBe('hro')
    // e a folha diz por que o Materno ficou de fora
    expect(screen.getAllByText(/nome em vez de iniciais/i).length).toBeGreaterThan(0)
  })

  // ── PUBLICAÇÃO PARCIAL (dono 02/09 → regra fechada em 03/09) ──────────────
  // Naquela noite HRO e Materno subiram, a Unimed caiu por uma CHECK do banco, e a tela
  // deu três recados ao mesmo tempo — o erro cru do Postgres, um "Escala publicada" VERDE
  // de outra aba e o "Publicação parcial" — com o botão ainda dizendo "Publicar as 3".
  // O segundo toque republicaria as duas que já estavam no ar, e publicar é DELETE+reinsert:
  // apagaria as liberações já marcadas naquele turno. Regra do dono: "o segundo toque deve
  // publicar só o que faltou sem perder as informações já registradas nas outras escalas".
  describe('quando uma escala falha', () => {
    it('a aba embutida NÃO emite toast próprio: sai UM aviso só, com o motivo humano', async () => {
      salvarEscalaTurno.mockImplementation(async (p) => {
        if (p.hospital === 'materno') {
          throw Object.assign(new Error('salvarEscalaTurno:rpc: new row for relation "escala_cirurgica_caso" violates check constraint "escala_cirurgica_caso_paciente_iniciais_check"'), { code: '23514' })
        }
        return { id: `e-${p.hospital}`, ...p, casos: [] }
      })
      await loteDeDois()
      fireEvent.click(screen.getByRole('button', { name: /revisar e publicar/i }))
      fireEvent.click(await screen.findByRole('button', { name: /publicar as 2/i }))

      await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalledTimes(2))
      // nenhum verde de aba: quem fala é a folha
      await waitFor(() => expect(screen.queryByText('Escala publicada')).toBeNull())
      // o aviso diz o que corrigir, não o texto do banco — em lugar nenhum da tela
      await waitFor(() => expect(screen.getAllByText(/nome em vez de iniciais/i).length).toBeGreaterThan(0))
      expect(document.body.textContent).not.toMatch(/violates check constraint|new row for relation/i)
    })

    it('o segundo toque publica SÓ o que faltou, e o botão nomeia quem falta', async () => {
      salvarEscalaTurno.mockImplementation(async (p) => {
        if (p.hospital === 'materno') throw Object.assign(new Error('salvarEscalaTurno:rpc: falhou'), { code: '23514' })
        return { id: `e-${p.hospital}`, ...p, casos: [] }
      })
      await loteDeDois()
      fireEvent.click(screen.getByRole('button', { name: /revisar e publicar/i }))
      fireEvent.click(await screen.findByRole('button', { name: /publicar as 2/i }))
      await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalledTimes(2))

      // o HRO subiu: o botão passa a nomear só o Materno
      const tentarDeNovo = await screen.findByRole('button', { name: /tentar de novo · materno/i })
      salvarEscalaTurno.mockClear()
      salvarEscalaTurno.mockImplementation(async (p) => ({ id: `e-${p.hospital}`, ...p, casos: [] }))
      fireEvent.click(tentarDeNovo)

      await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalledTimes(1))
      expect(salvarEscalaTurno.mock.calls[0][0].hospital).toBe('materno')
    })

    it('a folha continua aberta dizendo quem subiu e quem não subiu', async () => {
      salvarEscalaTurno.mockImplementation(async (p) => {
        if (p.hospital === 'materno') throw Object.assign(new Error('salvarEscalaTurno:rpc: falhou'), { code: '23514' })
        return { id: `e-${p.hospital}`, ...p, casos: [] }
      })
      await loteDeDois()
      fireEvent.click(screen.getByRole('button', { name: /revisar e publicar/i }))
      fireEvent.click(await screen.findByRole('button', { name: /publicar as 2/i }))
      await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalledTimes(2))

      expect(screen.getByText(/revisar antes de publicar/i)).toBeTruthy()
      // o card do HRO (na folha, não a aba) diz que subiu; o do Materno, o motivo
      const cardHro = screen.getAllByText('HRO').map((n) => n.closest('button')).find((b) => /caso/.test(b?.textContent || ''))
      expect(cardHro.textContent).toMatch(/Publicada/)
      const cardMaterno = screen.getAllByText('Materno').map((n) => n.closest('button')).find((b) => /caso/.test(b?.textContent || ''))
      expect(cardMaterno.textContent).not.toMatch(/Publicada/)
    })
  })
})

// ════════════════════════════════════════════════════════════════════════════
// AZUL DE EMPRESTADO não é ajuda DAQUI (dono 01/09 — caso Eduardo, corrigido à
// mão DUAS vezes em dois dias antes desta trava).
//
// No mapa do HRO, o azul de quem está no RODAPÉ DAQUI e trabalha em OUTRO
// hospital significa "nosso, emprestado" — mas a leitura devolvia esse azul em
// `ajudaExterna` DO HRO, que quer dizer o oposto ("gente de fora ajudando
// AQUI"): a fila daqui o jogava para o fim (sai primeiro AQUI, errado) e a
// ajuda-declarada do lado errado silenciava a pergunta de duplicidade. Com o
// lote na tela, o sinal é inequívoco: rodapé daqui + casos dele na escala irmã
// + nenhum caso REAL daqui (pseudo-linha "MATERNO | EDUARDO" não conta). A
// conferência realoca na CARGA, mostra a decisão informativa com a saída de
// desfazer, e a marca MANUAL nunca é tocada de novo (lição do campo grudento).
// O "mantém a posição na origem / sai primeiro onde ajuda" já deriva dos casos.
// ════════════════════════════════════════════════════════════════════════════
describe('azul de quem está no rodapé daqui com trabalho em outro hospital', () => {
  const anexarHroEMaterno = async (casosHro) => {
    svcMock.parseEscalaImagem
      .mockResolvedValueOnce({
        casos: casosHro,
        hospitalDetectado: 'hro',
        ordemLiberacao: ['CURY', 'EDUARDO'],
        ajudaExterna: ['EDUARDO'], // o AZUL lido do mapa
      })
      .mockResolvedValueOnce({
        casos: [caso('Sala 2 HC', 'EDUARDO'), { ...caso('Sala 2 HC', 'EDUARDO'), ordem: 1 }],
        hospitalDetectado: 'materno',
        ordemLiberacao: [],
      })
    const { container } = montar()
    await soltarArquivos(container, [img('hro.png'), img('materno.png')])
    await waitFor(() => expect(abas()).toHaveLength(2))
    return container
  }
  const PSEUDO_LINHA = { ...caso('MATERNO', 'EDUARDO'), procedimento: '', cirurgiao: '', pacienteIniciais: '' }

  it('a leitura NÃO grava o azul como ajuda daqui — a ajuda nasce no hospital de DESTINO', async () => {
    await anexarHroEMaterno([caso('Sala 1', 'CURY'), PSEUDO_LINHA])

    // a linha informativa aparece na aba do HRO, com a saída de desfazer
    expect(await screen.findByText(/emprestado ao Materno/i)).toBeTruthy()
    // e a ajuda ATRAVESSA para a aba do Materno (declaração da foto no lugar
    // certo) — sem isso a duplicidade do Eduardo travaria a publicação
    expect(await screen.findByText(/marcado como ajuda/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /revisar e publicar/i }))
    fireEvent.click(await screen.findByRole('button', { name: /publicar as 2/i }))
    await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalledTimes(2))
    const doHro = salvarEscalaTurno.mock.calls.map(([p]) => p).find((p) => p.hospital === 'hro')
    expect(doHro.ajudaExterna).toEqual([])
    // o rodapé segue intacto — a posição dele aqui não muda
    expect(doHro.ordemLiberacao).toEqual(['CURY', 'EDUARDO'])
    // e o Materno publica com a ajuda declarada NELE — é lá que ele sai primeiro
    const doMaterno = salvarEscalaTurno.mock.calls.map(([p]) => p).find((p) => p.hospital === 'materno')
    expect(doMaterno.ajudaExterna).toEqual(['EDUARDO'])
  })

  it('desfazer devolve a ajuda daqui — e a marca manual não é removida de novo', async () => {
    await anexarHroEMaterno([caso('Sala 1', 'CURY'), PSEUDO_LINHA])
    await screen.findByText(/emprestado ao Materno/i)

    const linha = screen.getByText(/emprestado ao Materno/i).closest('div').parentElement
    fireEvent.click(within(linha).getByRole('button', { name: /refazer/i }))
    await waitFor(() => expect(screen.queryByText(/emprestado ao Materno/i)).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: /revisar e publicar/i }))
    fireEvent.click(await screen.findByRole('button', { name: /publicar as 2/i }))
    await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalledTimes(2))
    const doHro = salvarEscalaTurno.mock.calls.map(([p]) => p).find((p) => p.hospital === 'hro')
    expect(doHro.ajudaExterna).toEqual(['EDUARDO'])
  })

  it('com caso REAL aqui, o azul fica: a pessoa veio ajudar AQUI (caso Tiago 30/07)', async () => {
    // EDUARDO com cirurgia de verdade no HRO além da presença no materno —
    // sinal ambíguo, a leitura fica como veio
    await anexarHroEMaterno([caso('Sala 1', 'CURY'), caso('Sala 3', 'EDUARDO')])

    expect(screen.queryByText(/emprestado ao Materno/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /revisar e publicar/i }))
    fireEvent.click(await screen.findByRole('button', { name: /publicar as 2/i }))
    await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalledTimes(2))
    const doHro = salvarEscalaTurno.mock.calls.map(([p]) => p).find((p) => p.hospital === 'hro')
    expect(doHro.ajudaExterna).toEqual(['EDUARDO'])
  })
})

// ════════════════════════════════════════════════════════════════════════════
// RASCUNHO DURÁVEL (Onda 2 da auditoria de 02/09; audit A7).
//
// A conferência vivia só na memória do React, e o app se recarrega sozinho: o
// `pwaUpdate` recarrega ao voltar do 2º plano quando houve deploy (3 a 5 por dia
// na janela da escala da tarde) e a cada 15 min; o iOS mata a PWA; Cancelar e o
// gesto da borda apagavam tudo. É a explicação mais provável de "várias vezes as
// alterações não persistem". Agora o trabalho vai para `escala-lote:<data>:<turno>`
// e volta ao reabrir a mesma data e turno — com a faixa dizendo de quando é.
// ════════════════════════════════════════════════════════════════════════════
describe('rascunho durável — a conferência sobrevive a desmontar e remontar', () => {
  const visivel = (els) => els.find((el) => !el.closest('.hidden'))
  const CHAVE = 'escala-lote:2026-08-27:matutino'

  async function conferirEDesmontar() {
    // CURY nos dois hospitais = uma duplicidade para responder; rodapé do HRO com 2 nomes
    svcMock.parseEscalaImagem
      .mockResolvedValueOnce({ casos: [caso('Sala 1', 'CURY')], hospitalDetectado: 'hro', ordemLiberacao: ['CURY', 'PAULO'] })
      .mockResolvedValueOnce({ casos: [caso('Sala 2', 'CURY')], hospitalDetectado: 'materno', ordemLiberacao: ['CURY'] })
    const { container, unmount } = montar()
    await soltarArquivos(container, [img('hro.png'), img('materno.png')])
    await waitFor(() => expect(abas()).toHaveLength(2))

    // 1) um CASO editado: a hora da Sala 1 do HRO
    fireEvent.click(visivel(screen.getAllByRole('button', { name: /Expandir todos os blocos/i })))
    fireEvent.change(visivel(screen.getAllByPlaceholderText('Hora')), { target: { value: '09:45' } })
    // 2) a ORDEM editada: a 2ª posição do rodapé do HRO renomeada
    fireEvent.click(visivel(screen.getAllByRole('button', { name: /^2\s*PAULO/i })))
    const nome = await screen.findByLabelText(/Nome na posição 2/i)
    fireEvent.change(nome, { target: { value: 'PAULO R' } })
    fireEvent.blur(nome)
    expect(visivel(screen.getAllByText('PAULO R'))).toBeTruthy()
    // 3) uma DECISÃO respondida: a duplicidade do CURY
    const linhas = await screen.findAllByText(/em dois hospitais/i)
    fireEvent.click(linhas.find((l) => !l.closest('.hidden') && l.closest('#conf-liberacoes')))
    fireEvent.click(await screen.findByRole('button', { name: /trabalha nos dois/i }))
    expect(await screen.findAllByText(/confirmada como intencional/i)).toHaveLength(2)

    unmount()
    return { chamadasVision: svcMock.parseEscalaImagem.mock.calls.length }
  }

  it('desmontar e remontar na MESMA data e turno restaura casos, ordem e decisões — sem reler a imagem', async () => {
    const { chamadasVision } = await conferirEDesmontar()
    expect(localStorage.getItem(CHAVE)).not.toBeNull()
    // nada de imagem no rascunho
    expect(localStorage.getItem(CHAVE)).not.toContain('AAAA')

    montar()
    await waitFor(() => expect(abas()).toHaveLength(2))
    // a faixa diz que voltou, e de quando
    expect(await screen.findByText(/Rascunho de \d{2}:\d{2} restaurado/i)).toBeTruthy()
    // a imagem NÃO foi relida
    expect(svcMock.parseEscalaImagem.mock.calls.length).toBe(chamadasVision)

    // o caso editado
    fireEvent.click(visivel(screen.getAllByRole('button', { name: /Expandir todos os blocos/i })))
    expect(visivel(screen.getAllByPlaceholderText('Hora')).value).toBe('09:45')
    // a ordem editada
    expect(visivel(screen.getAllByText('PAULO R'))).toBeTruthy()
    // a decisão respondida — nas duas abas
    expect(await screen.findAllByText(/confirmada como intencional/i)).toHaveLength(2)
  })

  it('"Descartar" na faixa pergunta, e confirmado apaga o rascunho e limpa a tela', async () => {
    await conferirEDesmontar()
    montar()
    await waitFor(() => expect(abas()).toHaveLength(2))
    fireEvent.click(await screen.findByRole('button', { name: /^Descartar$/i }))
    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo.textContent).toMatch(/Descartar o rascunho\?/)
    fireEvent.click(within(dialogo).getByRole('button', { name: /^Descartar$/i }))

    await waitFor(() => expect(abas()).toHaveLength(0))
    expect(localStorage.getItem(CHAVE)).toBeNull()
    expect(screen.queryByText(/Rascunho de/i)).toBeNull()
  })

  it('publicar TUDO apaga o rascunho: reabrir não restaura nada', async () => {
    // `vi.clearAllMocks` não desfaz `mockImplementation`: o describe da publicação parcial
    // deixa o Materno FALHANDO — aqui os dois precisam subir
    salvarEscalaTurno.mockImplementation(async (p) => ({ id: `e-${p.hospital}`, ...p, casos: [] }))
    svcMock.parseEscalaImagem
      .mockResolvedValueOnce({ casos: [caso('Sala 1', 'CURY')], hospitalDetectado: 'hro', ordemLiberacao: ['CURY'] })
      .mockResolvedValueOnce({ casos: [caso('Sala 2', 'PAULO')], hospitalDetectado: 'materno', ordemLiberacao: ['PAULO'] })
    const { container, unmount } = montar()
    await soltarArquivos(container, [img('hro.png'), img('materno.png')])
    await waitFor(() => expect(abas()).toHaveLength(2))
    // o rascunho existe enquanto a conferência está aberta (flush no pagehide/unmount;
    // aqui, o debounce de 500 ms)
    await waitFor(() => expect(localStorage.getItem(CHAVE)).not.toBeNull(), { timeout: 3000 })

    fireEvent.click(screen.getByRole('button', { name: /revisar e publicar/i }))
    fireEvent.click(await screen.findByRole('button', { name: /publicar as 2/i }))
    await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalledTimes(2))
    // a aba ainda roda o pós-publicação (vínculos, trocas, cruzamento) depois do RPC — sob
    // carga isso passa de 1 s, e o rascunho só sai quando o lote inteiro devolve o resultado
    await waitFor(() => expect(localStorage.getItem(CHAVE)).toBeNull(), { timeout: 8000 })
    unmount()
    expect(localStorage.getItem(CHAVE)).toBeNull()

    montar()
    await new Promise((r) => setTimeout(r, 50))
    expect(abas()).toHaveLength(0)
    expect(screen.queryByText(/Rascunho de/i)).toBeNull()
  })

  it('escala publicada que mudou DEPOIS do rascunho: a aba avisa e o hospital sai do botão grande', async () => {
    svcMock.parseEscalaImagem
      .mockResolvedValueOnce({ casos: [caso('Sala 1', 'CURY')], hospitalDetectado: 'hro', ordemLiberacao: ['CURY'] })
      .mockResolvedValueOnce({ casos: [caso('Sala 2', 'PAULO')], hospitalDetectado: 'materno', ordemLiberacao: ['PAULO'] })
    const { container, unmount } = montar()
    await soltarArquivos(container, [img('hro.png'), img('materno.png')])
    await waitFor(() => expect(abas()).toHaveLength(2))
    unmount()

    // outro aparelho publicou o HRO depois: a escala publicada é mais nova que o rascunho
    const depois = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    svcMock.fetchEscala.mockImplementation(async (_data, h) => (h === 'hro'
      ? { id: 'e-hro', hospital: 'hro', data: '2026-08-27', casos: [], ordemLiberacao: [], ajudaExterna: [], updatedAt: depois }
      : null))
    montar()
    await waitFor(() => expect(abas()).toHaveLength(2))
    expect(await screen.findByText(/A escala do HRO mudou às \d{2}:\d{2}, depois deste rascunho/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /revisar e publicar/i }))
    // só o Materno vai no botão grande; o HRO tem o seu "Republicar"
    expect(await screen.findByRole('button', { name: /^publicar a escala$/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /republicar hro/i }))
    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo.textContent).toMatch(/liberações/i)
    fireEvent.click(within(dialogo).getByRole('button', { name: /republicar por cima/i }))
    await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalledTimes(1))
    expect(salvarEscalaTurno.mock.calls[0][0].hospital).toBe('hro')
  })
})
