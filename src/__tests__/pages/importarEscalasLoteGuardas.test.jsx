/**
 * O app para de se recarregar no meio da conferência (Onda 2, item 2.3; audit A7).
 *
 * Seis gatilhos apagavam a conferência sem perguntar. Três são desta tela e ficam
 * travados aqui: (1) o "Cancelar" — header e barra — pergunta quando há trabalho
 * pendente e diz que o rascunho fica; (2) o gesto da borda esquerda (`useSwipeBack` no
 * <main> do App) é desligado com a conferência aberta; (3) `pwaUpdate` fica SEGURO
 * enquanto o lote está na tela e é liberado ao fechar.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import ImportarEscalasPage from '@/pages/escala-cirurgica/ImportarEscalasPage'
import { atualizacaoSegura, _reiniciarAtualizacaoAdiada } from '@/lib/atualizacaoAdiada'

const { svcMock, salvarEscalaTurno, prepararImagem } = vi.hoisted(() => ({
  svcMock: {
    parseEscalaImagem: vi.fn(),
    fetchEscala: vi.fn(async () => null),
    patchLinhaOverride: vi.fn(async () => {}),
  },
  salvarEscalaTurno: vi.fn(async (p) => ({ id: `e-${p.hospital}`, ...p, casos: [] })),
  prepararImagem: vi.fn(async () => ({ base64: 'AAAA', mimeType: 'image/jpeg', bytes: 3 })),
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
vi.mock('@/lib/excelEscala', () => ({ parseExcelEscala: vi.fn(async () => ({ casos: [], headerScore: 0 })) }))
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
const caso = (sala, anestesista) => ({ sala, anestesista, hora: '08:00', procedimento: `CIRURGIA ${sala}`, cirurgiao: 'DR TESTE', pacienteIniciais: 'A.B.' })
const img = (nome) => new File(['x'], nome, { type: 'image/png' })
const abas = () => {
  const lista = screen.queryByRole('tablist', { name: /hospitais do lote/i })
  return lista ? within(lista).queryAllByRole('tab') : []
}

function montar(onClose = vi.fn()) {
  const utils = render(
    <ImportarEscalasPage data="2026-08-27" turno="matutino" onClose={onClose} onAbrirFds={vi.fn()} />,
    { wrapper: wrap },
  )
  return { ...utils, onClose }
}

async function comLote() {
  svcMock.parseEscalaImagem.mockResolvedValueOnce({ casos: [caso('Sala 1', 'CURY')], hospitalDetectado: 'hro', ordemLiberacao: ['CURY'] })
  const utils = montar()
  fireEvent.change(utils.container.querySelector('input[type="file"]'), { target: { files: [img('hro.png')] } })
  await waitFor(() => expect(abas()).toHaveLength(1))
  return utils
}

beforeEach(async () => {
  vi.clearAllMocks()
  svcMock.fetchEscala.mockResolvedValue(null)
  localStorage.clear()
  _reiniciarAtualizacaoAdiada()
  // o desempilhar do teste anterior (`history.back()`) chega num tick depois
  await waitFor(() => expect(window.history.state?.anestOverlay).not.toBe(true))
})

describe('Cancelar com trabalho pendente pergunta antes', () => {
  it('sem lote, Cancelar fecha direto — como sempre', () => {
    const { onClose } = montar()
    fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('com lote na tela, o Cancelar do header abre "Sair da conferência?" e só fecha no "Sair"', async () => {
    const { onClose } = await comLote()
    fireEvent.click(screen.getAllByRole('button', { name: /^Cancelar$/i })[0])
    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo.textContent).toMatch(/Sair da conferência\?/)
    expect(dialogo.textContent).toMatch(/fica guardado neste aparelho/i)
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(within(dialogo).getByRole('button', { name: /continuar conferindo/i }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(onClose).not.toHaveBeenCalled()
    expect(abas()).toHaveLength(1)

    fireEvent.click(screen.getAllByRole('button', { name: /^Cancelar$/i })[1]) // o da barra inferior
    const de_novo = await screen.findByRole('alertdialog')
    fireEvent.click(within(de_novo).getByRole('button', { name: /^Sair$/i }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('sair NÃO apaga o rascunho — ele volta na próxima abertura', async () => {
    const { onClose, unmount } = await comLote()
    fireEvent.click(screen.getAllByRole('button', { name: /^Cancelar$/i })[0])
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: /^Sair$/i }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    unmount()
    expect(localStorage.getItem('escala-lote:2026-08-27:matutino')).not.toBeNull()
  })
})

describe('o "voltar" do browser é o mesmo Cancelar', () => {
  /** O browser voltou: cai na entrada anterior (sem a marca) e dispara popstate. */
  const voltarDoBrowser = () => {
    window.history.replaceState({}, '')
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }))
  }

  it('ao abrir, empilha uma entrada marcada; sem lote, voltar fecha direto', async () => {
    const { onClose, unmount } = montar()
    expect(window.history.state?.anestOverlay).toBe(true)
    voltarDoBrowser()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    unmount()
  })

  it('com lote na tela, voltar pergunta — e "Continuar conferindo" mantém tudo', async () => {
    const { onClose } = await comLote()
    voltarDoBrowser()
    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo.textContent).toMatch(/Sair da conferência\?/)
    expect(onClose).not.toHaveBeenCalled()
    // a entrada marcada foi reposta: um segundo "voltar" funciona
    expect(window.history.state?.anestOverlay).toBe(true)
    fireEvent.click(within(dialogo).getByRole('button', { name: /continuar conferindo/i }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(abas()).toHaveLength(1)
    voltarDoBrowser()
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: /^Sair$/i }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })
})

describe('o gesto da borda e o reload do PWA ficam de fora com a conferência aberta', () => {
  it('a tela inteira leva data-no-swipe-back (o useSwipeBack do App respeita a marca)', () => {
    const { container } = montar()
    expect(container.querySelector('.fixed.inset-0').getAttribute('data-no-swipe-back')).toBe('true')
  })

  it('com lote na tela a atualização do PWA fica SEGURA; ao fechar, libera', async () => {
    expect(atualizacaoSegura()).toBe(false)
    const { unmount } = await comLote()
    expect(atualizacaoSegura()).toBe(true)
    unmount()
    expect(atualizacaoSegura()).toBe(false)
  })

  it('sem lote nenhum (tela aberta, nada anexado) não segura nada', () => {
    montar()
    expect(atualizacaoSegura()).toBe(false)
  })
})
