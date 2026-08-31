/**
 * ENTRADA da importação — desenho escolhido pelo dono em 17/08 ("dois passos
 * declarados"), depois de comparar quatro protótipos a 430px.
 *
 * Anexar e conferir são dois MOMENTOS para quem usa: a secretária anexa e só
 * depois confere. O stepper diz em qual deles ela está, e hospital/data/período
 * moram num cartão único ("Para qual escala") — soltos no corpo, os três
 * pareciam etapas independentes.
 *
 * O que este teste protege:
 *  · os dois passos, com o 2º acendendo só quando a base entra;
 *  · o cartão com os três campos juntos;
 *  · o atalho do documento de fim de semana DEPOIS do anexo (é desvio de rota,
 *    não etapa) — antes ele aparecia entre os seletores e o arquivo;
 *  · as sugestões do anexo continuam SUGERINDO: mostram o botão e não trocam
 *    hospital nem data sozinhas (regra antiga que o redesenho não pode perder).
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import ImportarEscalaPage from '@/pages/escala-cirurgica/ImportarEscalaPage'

const { svcMock, salvarEscala, prepararImagem, parseExcel } = vi.hoisted(() => ({
  svcMock: { parseEscalaImagem: vi.fn(), fetchEscala: vi.fn(async () => null) },
  salvarEscala: vi.fn(async (p) => ({ id: 'e1', ...p, casos: [] })),
  prepararImagem: vi.fn(async () => ({ base64: 'AAAA', mimeType: 'image/jpeg', bytes: 3 })),
  parseExcel: vi.fn(),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/lib/excelEscala', () => ({ parseExcelEscala: parseExcel }))
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

const abrir = (props = {}) => render(
  <ImportarEscalaPage hospital="unimed" data="2026-07-28" onClose={vi.fn()} onAbrirFds={vi.fn()} {...props} />,
  { wrapper: wrap },
)

async function anexar(container, resposta) {
  svcMock.parseEscalaImagem.mockResolvedValueOnce(resposta)
  const input = container.querySelector('input[type="file"]')
  fireEvent.change(input, { target: { files: [new File(['x'], 'escala.png', { type: 'image/png' })] } })
  await waitFor(() => expect(svcMock.parseEscalaImagem).toHaveBeenCalled())
}

// mesma lição do importarEscalaConferencia: `periodo` nasce de turnoAtual(), então
// o relógio precisa estar congelado para o teste não mudar de turno à tarde.
beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-07-28T10:00:00-03:00'))
})
afterAll(() => vi.useRealTimers())

describe('Entrada — dois passos declarados', () => {
  it('mostra os dois passos, com "Anexar" ativo antes da base', () => {
    abrir()
    const etapas = screen.getByRole('list', { name: /Etapas da importação/i })
    expect(within(etapas).getByText('Anexar')).toBeTruthy()
    expect(within(etapas).getByText('Conferir')).toBeTruthy()
    expect(within(etapas).getByText('Anexar').className).toContain('text-primary')
    expect(within(etapas).getByText('Conferir').className).toContain('text-muted-foreground')
  })

  it('passa o destaque para "Conferir" quando a base entra', async () => {
    const { container } = abrir()
    await anexar(container, {
      casos: [{ sala: 'SALA 1', hora: '08:00', procedimento: 'Catarata', cirurgiao: 'Bruno', anestesista: 'CURY' }],
      ordemLiberacao: ['CURY'], ajudaExterna: [],
    })
    const etapas = screen.getByRole('list', { name: /Etapas da importação/i })
    await waitFor(() => expect(within(etapas).getByText('Conferir').className).toContain('text-primary'))
  })

  it('agrupa hospital, data e período no cartão "Para qual escala"', () => {
    abrir()
    const titulo = screen.getByText('Para qual escala')
    const cartao = titulo.closest('section')
    expect(within(cartao).getByText('Hospital')).toBeTruthy()
    expect(within(cartao).getByText('Data')).toBeTruthy()
    expect(within(cartao).getByText('Período')).toBeTruthy()
    // os três seletores continuam operáveis dentro do cartão (o SegmentedSelector
    // do DS expõe cada opção como role="tab")
    expect(within(cartao).getByRole('tab', { name: 'HRO' })).toBeTruthy()
    expect(within(cartao).getByRole('tab', { name: 'Vespertino' })).toBeTruthy()
  })

  it('põe o atalho do fim de semana DEPOIS do campo de anexo', () => {
    const { container } = abrir()
    const fds = screen.getByRole('button', { name: /documento de FDS/i })
    const upload = container.querySelector('input[type="file"]')
    // Node.compareDocumentPosition: 4 = o argumento vem DEPOIS do nó
    expect(upload.compareDocumentPosition(fds) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('feriado destaca a fila única e repassa a data escolhida ao importador especial', () => {
    const onAbrirFds = vi.fn()
    abrir({ data: '2026-08-25', onAbrirFds })
    const botao = screen.getByRole('button', { name: /Esta data é feriado/i })
    expect(botao.className).toContain('border-primary')
    fireEvent.click(botao)
    expect(onAbrirFds).toHaveBeenCalledWith('2026-08-25')
  })
})

describe('Entrada — o anexo SUGERE, nunca troca sozinho', () => {
  it('hospital divergente: oferece o botão e mantém o hospital escolhido', async () => {
    const { container } = abrir()
    await anexar(container, {
      casos: [{ sala: 'SALA 1', hora: '08:00', procedimento: 'Catarata', cirurgiao: 'Bruno', anestesista: 'CURY' }],
      ordemLiberacao: [], ajudaExterna: [], hospitalDetectado: 'hro',
    })
    const aviso = await screen.findByText(/O anexo parece ser do/i)
    expect(aviso.textContent).toMatch(/HRO/)
    expect(screen.getByRole('button', { name: /Usar HRO/i })).toBeTruthy()
    // o cartão segue no hospital que a secretária escolheu
    const cartao = screen.getByText('Para qual escala').closest('section')
    expect(within(cartao).getByRole('tab', { name: 'Unimed' }).getAttribute('aria-selected')).toBe('true')
  })

  it('data divergente: oferece "Usar esta data" sem mexer na data selecionada', async () => {
    const { container } = abrir()
    await anexar(container, {
      casos: [{ sala: 'SALA 1', hora: '08:00', procedimento: 'Catarata', cirurgiao: 'Bruno', anestesista: 'CURY' }],
      ordemLiberacao: [], ajudaExterna: [], dataDetectada: '2026-07-25',
    })
    expect(await screen.findByText(/O anexo mostra a data/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Usar esta data/i })).toBeTruthy()
  })
})

// ── PLANILHA: a sugestão sai das COLUNAS, não da extensão (auditoria 31/08) ──
// "Planilha = Unimed" era suposição de extensão, e o lote a corrigiu em 30/08
// (o mapa do HRO também chega em .xlsx — cabeçalho LEITO). A tela de UMA escala
// ficou com a regra antiga: recebendo o xlsx do HRO com o HRO já escolhido, ela
// sugeria "Usar Unimed" — a correção existia e não alcançava este fluxo.
describe('Entrada — planilha se declara pelo cabeçalho', () => {
  const anexarExcel = async (container, resposta) => {
    parseExcel.mockResolvedValueOnce(resposta)
    const input = container.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [new File(['x'], 'escala.xlsx')] } })
    await waitFor(() => expect(parseExcel).toHaveBeenCalled())
  }

  it('xlsx com coluna LEITO e Unimed escolhida: sugere o HRO', async () => {
    const { container } = abrir()
    await anexarExcel(container, {
      casos: [{ sala: 'Sala 3', hora: '08:00', procedimento: 'ATJ', cirurgiao: 'Bruno', anestesista: 'CURY' }],
      headerScore: 5,
      headers: ['LEITO', 'PACIENTE', 'CIRURGIÃO', 'PROCEDIMENTO', 'ANEST', 'CONV.', 'SALA'],
    })
    const aviso = await screen.findByText(/O anexo parece ser do/i)
    expect(aviso.textContent).toMatch(/HRO/)
  })

  it('xlsx com colunas do HRO e HRO já escolhido: NÃO sugere Unimed', async () => {
    const { container } = abrir({ hospital: 'hro' })
    await anexarExcel(container, {
      casos: [{ sala: 'Sala 3', hora: '08:00', procedimento: 'ATJ', cirurgiao: 'Bruno', anestesista: 'CURY' }],
      headerScore: 5,
      headers: ['LEITO', 'PACIENTE', 'CIRURGIÃO', 'PROCEDIMENTO', 'ANEST', 'CONV.', 'SALA'],
    })
    expect(screen.queryByText(/O anexo parece ser do/i)).toBeNull()
  })

  it('xlsx sem marca nenhuma segue sendo o export da Unimed (fallback de sempre)', async () => {
    const { container } = abrir({ hospital: 'hro' })
    await anexarExcel(container, {
      casos: [{ sala: '6', hora: '08:00', procedimento: 'Facectomia', cirurgiao: 'Bruno', anestesista: 'CURY' }],
      headerScore: 3,
      headers: ['SALA', 'PACIENTE', 'PROCEDIMENTO', 'ANEST'],
    })
    const aviso = await screen.findByText(/O anexo parece ser do/i)
    expect(aviso.textContent).toMatch(/Unimed/)
  })
})
