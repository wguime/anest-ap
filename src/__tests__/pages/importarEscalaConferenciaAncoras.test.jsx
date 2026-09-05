/**
 * CONFERÊNCIA — três destinos numa rolagem só (desenho escolhido pelo dono em
 * 17/08, protótipo "F · âncoras").
 *
 * Blocos, Liberações e Pendências deixaram de estar espalhados pela página: a
 * barra fixa leva até cada seção — ROLANDO, não trocando de aba, porque bloco e
 * fila precisam poder ser lidos na mesma passada — e o que impede publicar fica
 * contado numa faixa que não sai da tela.
 *
 * O que este teste protege:
 *  · os três atalhos com as contagens certas;
 *  · a fila em DUAS COLUNAS correndo para baixo e SEM o número de casos por
 *    pessoa (o número confundia — dono 17/08), mantendo o ponto âmbar de quem
 *    está na ordem sem cirurgia nenhuma;
 *  · o editor da posição abrindo FORA das colunas (numa coluna de ~200px os
 *    quatro botões não cabem);
 *  · os avisos todos dentro da seção Pendências.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import ImportarEscalaPage from '@/pages/escala-cirurgica/ImportarEscalaPage'

const { svcMock, salvarEscala, prepararImagem } = vi.hoisted(() => ({
  svcMock: { parseEscalaImagem: vi.fn(), fetchEscala: vi.fn(async () => null) },
  salvarEscala: vi.fn(async (p) => ({ id: 'e1', ...p, casos: [] })),
  prepararImagem: vi.fn(async () => ({ base64: 'AAAA', mimeType: 'image/jpeg', bytes: 3 })),
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
vi.mock('@/lib/imagemVision', () => ({ prepararImagemParaVision: prepararImagem }))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: [], aliases: [], loading: false, rosterByUid: new Map(), options: [],
    resolver: () => null, refresh: vi.fn(), upsertAlias: vi.fn(), removeAlias: vi.fn(),
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const CASOS = [
  { sala: 'SALA 1', hora: '08:00', procedimento: 'Catarata', cirurgiao: 'Bruno', anestesista: 'CURY' },
  { sala: 'SALA 2', hora: '08:30', procedimento: 'Colecistectomia', cirurgiao: 'Dirceu', anestesista: 'ERLEI' },
]
// FERNANDO está na ordem sem nenhuma cirurgia — é o detector da extração torta
const RODAPE = ['CURY', 'ERLEI', 'FERNANDO']

async function conferir(casos = CASOS, ordemLiberacao = RODAPE) {
  svcMock.parseEscalaImagem.mockResolvedValueOnce({ casos, ordemLiberacao, ajudaExterna: [] })
  const { container } = render(
    <ImportarEscalaPage hospital="unimed" data="2026-07-28" onClose={vi.fn()} />, { wrapper: wrap },
  )
  fireEvent.change(container.querySelector('input[type="file"]'), {
    target: { files: [new File(['x'], 'escala.png', { type: 'image/png' })] },
  })
  await waitFor(() => expect(svcMock.parseEscalaImagem).toHaveBeenCalled())
  await screen.findByRole('heading', { name: /Blocos por anestesista/i })
  return container
}

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-07-28T10:00:00-03:00'))
})
afterAll(() => vi.useRealTimers())

describe('Conferência — barra de âncoras', () => {
  it('leva às três seções, com as contagens do lote', async () => {
    await conferir()
    const barra = screen.getByRole('navigation', { name: /Seções da conferência/i })
    const atalho = (nome) => within(barra).getByRole('button', { name: new RegExp(nome, 'i') })
    expect(atalho('Blocos').textContent).toMatch(/2/)        // 2 blocos
    // desde 31/08 o atalho do meio é "Ordem e decisões"; com FERNANDO na ordem
    // sem cirurgia, o selo âmbar conta a conferência pendente
    expect(atalho('Ordem e decisões').textContent).toMatch(/1/)
    expect(atalho('Pendências')).toBeTruthy()
    // as seções existem para onde os atalhos rolam
    for (const id of ['conf-blocos', 'conf-liberacoes', 'conf-pendencias']) {
      expect(document.getElementById(id)).toBeTruthy()
    }
  })

  it('soma os avisos no atalho e NÃO acende a faixa de bloqueio', async () => {
    await conferir()
    const barra = screen.getByRole('navigation', { name: /Seções da conferência/i })
    // 1 nome na ordem sem cirurgia + 2 blocos ainda sem login atribuído
    expect(within(barra).getByRole('button', { name: /Pendências/i }).textContent).toMatch(/3/)
    // aviso não trava publicar: a faixa vermelha só aparece com bloqueio de verdade
    // (nome ambíguo ou duplicidade entre hospitais não classificada)
    expect(screen.queryByText(/impede[m]? publicar/i)).toBeNull()
  })
})

describe('Conferência — fila em duas colunas', () => {
  it('corre em coluna e não mostra contagem de casos por pessoa', async () => {
    const container = await conferir()
    const lista = container.querySelector('#conf-liberacoes ul')
    expect(lista.className).toContain('columns-2')
    const itens = [...lista.querySelectorAll('li')]
    expect(itens).toHaveLength(3)
    for (const li of itens) expect(li.textContent).not.toMatch(/caso/)
  })

  it('marca com o ponto âmbar quem está na ordem sem nenhuma cirurgia', async () => {
    const container = await conferir()
    const linhaDe = (nome) => within(container.querySelector('#conf-liberacoes')).getByText(nome).closest('li')
    expect(linhaDe('FERNANDO').querySelector('[title="na ordem sem nenhuma cirurgia"]')).toBeTruthy()
    expect(linhaDe('CURY').querySelector('[title="na ordem sem nenhuma cirurgia"]')).toBeNull()
  })

  it('abre o editor da posição FORA das colunas, com os quatro botões', async () => {
    const container = await conferir()
    const secao = container.querySelector('#conf-liberacoes')
    fireEvent.click(within(secao).getByText('CURY'))
    const editor = await screen.findByText(/^Posição 1$/i)
    // o editor é irmão da lista, não filho de um <li> dela
    expect(editor.closest('li')).toBeNull()
    for (const nome of ['Subir', 'Descer', 'Ajuda', 'Remover']) {
      expect(within(editor.parentElement).getByRole('button', { name: new RegExp(nome, 'i') })).toBeTruthy()
    }
  })
})

describe('Conferência — pendências num lugar só', () => {
  // DOIS avisos diferentes para o mesmo sintoma "está na ordem e não tem
  // cirurgia", e o nome cai em UM só (dono 24/08 — contar a mesma pessoa duas
  // vezes inflava o número de pendências):
  //  · na CAUDA → diz o que vai acontecer (nasce LIBERADO na fila, regra 21/08);
  //  · no MEIO, com vizinho escalado → suspeita de extração torta (IOSC 23/07).
  // Desde 31/08 (modelo B) o "na ordem sem cirurgia" mora como LINHA DE
  // DECISÃO no cartão da fila, e a distinção cauda×meio vive na FOLHA dela:
  // na cauda a folha diz o que vai acontecer (nasce LIBERADO, regra 21/08);
  // no meio, só a suspeita de extração torta (IOSC 23/07).
  it('quem FECHA a ordem sem cirurgia é nomeado, com o que vai acontecer', async () => {
    const container = await conferir()
    const ordem = container.querySelector('#conf-liberacoes')
    const linha = within(ordem).getByText(/FERNANDO — na ordem, sem cirurgia/i)
    fireEvent.click(linha)
    // a consequência mora na linha de dados do cabeçalho da folha (Onda 3, protótipo L4)
    const consequencia = await screen.findByText(
      (_t, el) => el?.tagName === 'P' && /ª posição ·/.test(el.textContent || ''),
    )
    expect(consequencia.textContent).toMatch(/nasce\s+LIBERADO/)
    // e não repete o mesmo nome em aviso solto de Pendências
    const pend = container.querySelector('#conf-pendencias')
    expect(within(pend).queryByText(/confira a extração/i)).toBeNull()
  })

  it('no MEIO da ordem, a folha fica só com a extração torta', async () => {
    // ERLEI sem cirurgia entre CURY e FERNANDO, que têm — e FERNANDO fecha a
    // ordem COM cirurgia, então não há cauda nenhuma
    const casos = [
      { sala: 'SALA 1', hora: '08:00', procedimento: 'Catarata', cirurgiao: 'Bruno', anestesista: 'CURY' },
      { sala: 'SALA 2', hora: '08:30', procedimento: 'Colecistectomia', cirurgiao: 'Dirceu', anestesista: 'FERNANDO' },
    ]
    const container = await conferir(casos, ['CURY', 'ERLEI', 'FERNANDO'])
    const ordem = container.querySelector('#conf-liberacoes')
    fireEvent.click(within(ordem).getByText(/ERLEI — na ordem, sem cirurgia/i))
    // no meio da ordem a folha abre igual, mas SEM a consequência da cauda
    const dados = await screen.findByText(
      (_t, el) => el?.tagName === 'P' && /ª posição ·/.test(el.textContent || ''),
    )
    expect(dados.textContent).not.toMatch(/LIBERADO/)
  })

  it('some com a linha do nome sem cirurgia quando a ordem casa com os casos', async () => {
    const container = await conferir(CASOS, ['CURY', 'ERLEI'])
    const ordem = container.querySelector('#conf-liberacoes')
    expect(within(ordem).queryByText(/na ordem, sem cirurgia/i)).toBeNull()
    expect(within(ordem).queryByText(/Decisões do dia/i)).toBeNull()
  })
})

describe('Conferência — botão de publicar', () => {
  it('mostra quantos casos vão ser publicados', async () => {
    await conferir()
    expect(screen.getByRole('button', { name: /Publicar 2 casos/i })).toBeTruthy()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// CIRURGIA DA MANHÃ QUE ATRAVESSA PARA A TARDE (dono 24/08)
//
// "Gabriela não estava na escala e foi adicionada como ajuda. Nenhum dos dois
// apareceu na tela de confirmação antes da publicação."
// A cirurgia dela das 07:00 ficou marcada "passa para tarde" e à tarde ela
// estava no HRO. A fila não a inventa mais — mas a cirurgia existe e alguém
// precisa decidir o que fazer com ela, e é aqui que dá para ver isso.
// ════════════════════════════════════════════════════════════════════════════
describe('Conferência — cirurgia da manhã que passa para esta tarde', () => {
  const PUBLICADA = {
    id: 'e1', hospital: 'unimed', data: '2026-07-28',
    ordemLiberacao: { matutino: ['GABRIELA', 'RAUL'], vespertino: [] },
    liberacoes: {}, linhaOverrides: {},
    casos: [
      { id: 'm1', sala: 'CC - Sala 10', ordem: 0, turno: 'matutino', hora: '07:00', anestesista: 'GABRIELA', cirurgiao: 'PAULO CALDAS', statusExtra: 'passa_tarde' },
      { id: 'm2', sala: 'CC - Sala 1', ordem: 0, turno: 'matutino', hora: '07:30', anestesista: 'RAUL', cirurgiao: 'OUTRO' },
    ],
  }

  async function conferirTarde(ordem) {
    svcMock.fetchEscala.mockImplementation(async (_d, h) => (h === 'unimed' ? PUBLICADA : null))
    svcMock.parseEscalaImagem.mockResolvedValueOnce({
      casos: [{ sala: 'CC - Sala 10', hora: '13:30', procedimento: 'X', cirurgiao: 'Bruno', anestesista: 'LOUISE' }],
      ordemLiberacao: ordem, ajudaExterna: [],
    })
    const { container } = render(
      <ImportarEscalaPage hospital="unimed" data="2026-07-28" turno="vespertino" onClose={vi.fn()} />, { wrapper: wrap },
    )
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [new File(['x'], 'escala.png', { type: 'image/png' })] },
    })
    await waitFor(() => expect(svcMock.parseEscalaImagem).toHaveBeenCalled())
    await screen.findByRole('heading', { name: /Blocos por anestesista/i })
    return container
  }

  it('avisa, com sala e cirurgião, quando a anestesista não está nesta ordem', async () => {
    const container = await conferirTarde(['LOUISE', 'VICENTE'])
    const pend = container.querySelector('#conf-pendencias')
    await waitFor(() => expect(within(pend).getByText(/passa[m]? para esta tarde/i)).toBeTruthy())
    const item = within(pend).getByText(/CC - Sala 10/)
    expect(item.textContent).toMatch(/Gabriela/i)
    expect(item.textContent).toMatch(/07:00/)
  })

  it('cala quando a anestesista ESTÁ na ordem da tarde — lá a cirurgia conta para ela', async () => {
    const container = await conferirTarde(['GABRIELA', 'LOUISE'])
    const pend = container.querySelector('#conf-pendencias')
    await waitFor(() => expect(svcMock.fetchEscala).toHaveBeenCalled())
    expect(within(pend).queryByText(/passa[m]? para esta tarde/i)).toBeNull()
  })

  it('cala na importação da MANHÃ: a travessia é para a tarde', async () => {
    svcMock.fetchEscala.mockImplementation(async (_d, h) => (h === 'unimed' ? PUBLICADA : null))
    const container = await conferir(CASOS, ['CURY', 'ERLEI'])
    const pend = container.querySelector('#conf-pendencias')
    expect(within(pend).queryByText(/passa[m]? para esta tarde/i)).toBeNull()
  })
})
