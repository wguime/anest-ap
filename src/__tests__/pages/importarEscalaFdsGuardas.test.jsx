/**
 * As mesmas guardas do lote de dia útil no fluxo de FIM DE SEMANA (Onda 2, item 2.3).
 *
 * O FDS não tem rascunho: o que protege a conferência é não deixar o app recarregar no
 * meio (a atualização do PWA fica SEGURA com documento/mapa anexado), o gesto da borda
 * desligado (`data-no-swipe-back`) e o "Cancelar"/"voltar" perguntando antes de jogar fora
 * o que foi anexado — sem nada anexado, fecha direto como sempre.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import ImportarEscalaFdsPage from '@/pages/escala-cirurgica/ImportarEscalaFdsPage'
import { atualizacaoSegura, _reiniciarAtualizacaoAdiada } from '@/lib/atualizacaoAdiada'

const { svcMock, salvarEscalaTurno, prepararImagem } = vi.hoisted(() => ({
  svcMock: { parseEscalaImagem: vi.fn(), fetchEscala: vi.fn(async () => null) },
  salvarEscalaTurno: vi.fn(async (p) => ({ id: 'e1', ...p })),
  prepararImagem: vi.fn(async () => ({ base64: 'AAAA', mimeType: 'image/jpeg' })),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseEscalaAnestesistaService', () => ({ isPermissionError: () => false }))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ salvarEscalaTurno }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u-sec', role: 'secretaria', displayName: 'Secretária' } }),
}))
vi.mock('@/lib/imagemVision', () => ({ prepararImagemParaVision: prepararImagem }))
vi.mock('@/services/pegaPlantaoApi', () => ({ getPlantoes: vi.fn(async () => []) }))
const ROSTER = [{ uid: 'uid-thayna', nome: 'THAYNA REGINA SANTOS', apelidos: ['THAYNA'] }]
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: ROSTER, aliases: [], loading: false,
    rosterByUid: new Map(ROSTER.map((r) => [r.uid, r])),
    options: ROSTER.map((r) => ({ value: r.uid, label: r.nome })),
    resolver: (nome) => (String(nome || '').trim().toUpperCase() === 'THAYNA' ? 'uid-thayna' : null),
    refresh: vi.fn(), upsertAlias: vi.fn(async () => {}), removeAlias: vi.fn(),
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const MAPA_HRO_SABADO = {
  hospitalDetectado: 'hro',
  dataDetectada: '2026-08-22',
  casos: [
    { sala: 'Sala 1', ordem: 0, hora: '07:00', turno: 'matutino', pacienteIniciais: 'R.F.C.', anestesista: 'THAYNA', procedimento: 'VARIZES', cirurgiao: 'Alexandre Medeiros', convenio: 'PART' },
  ],
  ordemLiberacao: [], ajudaExterna: [], posicoesAssistenciais: [],
}

function montar(onClose = vi.fn()) {
  const utils = render(<ImportarEscalaFdsPage data="2026-08-22" onClose={onClose} />, { wrapper: wrap })
  return { ...utils, onClose }
}

/** Um mapa entra pelo dropzone da lista — é o que faz existir trabalho a proteger. */
async function comMapa() {
  const utils = montar()
  svcMock.parseEscalaImagem.mockResolvedValueOnce(MAPA_HRO_SABADO)
  fireEvent.change(utils.container.querySelector('input[type="file"]'), { target: { files: [new File(['x'], 'hro.png', { type: 'image/png' })] } })
  await waitFor(() => expect(svcMock.parseEscalaImagem).toHaveBeenCalledTimes(1))
  await screen.findAllByText(/HRO/)
  return utils
}

const voltarDoBrowser = () => {
  window.history.replaceState({}, '')
  window.dispatchEvent(new PopStateEvent('popstate', { state: {} }))
}

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-08-21T10:00:00-03:00'))
})
afterAll(() => vi.useRealTimers())

beforeEach(async () => {
  vi.clearAllMocks()
  svcMock.fetchEscala.mockResolvedValue(null)
  _reiniciarAtualizacaoAdiada()
  // o desempilhar do teste anterior (`history.back()`) chega num tick depois
  await waitFor(() => expect(window.history.state?.anestOverlay).not.toBe(true))
})

describe('Cancelar e voltar com documento/mapa anexado perguntam antes', () => {
  it('sem nada anexado, Cancelar fecha direto — como sempre', () => {
    const { onClose } = montar()
    fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('com mapa anexado, Cancelar abre "Sair da conferência?" e só fecha no "Sair"', async () => {
    const { onClose } = await comMapa()
    fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/i }))
    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo.textContent).toMatch(/Sair da conferência\?/)
    expect(dialogo.textContent).toMatch(/não guarda rascunho/i)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(within(dialogo).getByRole('button', { name: /continuar conferindo/i }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/i }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: /^Sair$/i }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('o "voltar" do browser é o mesmo Cancelar', async () => {
    const { onClose } = await comMapa()
    expect(window.history.state?.anestOverlay).toBe(true)
    voltarDoBrowser()
    expect((await screen.findByRole('alertdialog')).textContent).toMatch(/Sair da conferência\?/)
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('gesto da borda e reload do PWA ficam de fora', () => {
  it('a tela leva data-no-swipe-back', () => {
    const { container } = montar()
    expect(container.querySelector('.fixed.inset-0').getAttribute('data-no-swipe-back')).toBe('true')
  })

  it('com mapa anexado a atualização do PWA fica SEGURA; ao fechar, libera', async () => {
    expect(atualizacaoSegura()).toBe(false)
    const { unmount } = await comMapa()
    expect(atualizacaoSegura()).toBe(true)
    unmount()
    expect(atualizacaoSegura()).toBe(false)
  })
})
