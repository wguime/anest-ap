/**
 * Quem está "na equipe" de outro hospital e VOLTA com caso para casa não é ajuda de lá (dono 20/10).
 *
 * Foto das 13:46, Unimed da tarde: "Giovana Noll — Ajuda (HRO)" com a continuação da hemodinâmica.
 * O recado dizia "Giovana na equipe do HRO no período vespertino, até as 19h": ela é da Unimed pela
 * numérica, foi publicada no rodapé do HRO com o selo Equipe e, liberada lá às 13:44, voltou para a
 * hemodinâmica da Unimed (repassada pela Gabriela às 13:02). Fora do rodapé da Unimed e dentro do do
 * HRO, a fila a deduzia "Ajuda (HRO)" e a jogava para o fim — saindo primeiro. "Ela estava de ajuda no
 * HRO mas voltou para a unimed… para que esses casos não desajustem a ordem de liberações."
 *
 * ⚠️ Trava de PÁGINA: o selo Equipe mora na escala do OUTRO hospital e a numérica vem da página —
 * o fio é o que pode quebrar. O JSON entra por import dinâmico, daí o `findBy`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'

const { estado, svcMock } = vi.hoisted(() => ({
  estado: { ctx: null },
  svcMock: {
    fetchEscala: vi.fn(async () => null),
    fetchLocaisHospital: vi.fn(async () => []),
    reservarAvisoTempo: vi.fn(async () => false),
  },
}))

vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgica: () => estado.ctx,
  hojeISO: () => '2026-10-20',
  diaOperacionalISO: () => '2026-10-20',
  HOSPITAIS: ['unimed', 'hro', 'materno'],
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
  OBSERVACAO_MAX: 120,
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u-x', role: 'anestesiologista', displayName: 'X' } }),
}))
vi.mock('@/hooks/usePegaPlantao', () => ({ useEscalaDia: () => ({ plantoes: [] }) }))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: [], rosterByUid: new Map(), aliases: [], options: [],
    resolver: () => null, loading: false, pronto: true,
    refresh: vi.fn(), upsertAlias: vi.fn(), removeAlias: vi.fn(),
  }),
}))

import EscalaCirurgicaPage from '@/pages/escala-cirurgica/EscalaCirurgicaPage'

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const caso = (id, sala, anestesista, hora = '13:30') => ({
  id, sala, ordem: 0, hora, anestesista, cirurgiao: 'Cirurgião', turno: 'vespertino',
  bloco: 'normal', isContinuacao: false, semAnestesista: false,
})

const acoes = () => ({
  setData: vi.fn(), toggleLiberacao: vi.fn(), toggleEscalado: vi.fn(), setLinhaOverride: vi.fn(),
  adicionarAjuda: vi.fn(), removerAjuda: vi.fn(), reordenarAjuda: vi.fn(), definirP4Hospital: vi.fn(),
  setAnestesistaCasos: vi.fn(), marcarTroca: vi.fn(), executarSubstituicao: vi.fn(),
  desfazerSubstituicao: vi.fn(), salvarEscalaTurno: vi.fn(), atualizarCaso: vi.fn(),
  definirOrigemLinha: vi.fn(),
  setStatusCirurgia: vi.fn(), adicionarCaso: vi.fn(), definirSalasUrgencia: vi.fn(),
})

// Unimed da tarde de 20/10 como foi publicada (sem a Giovana, emprestada ao HRO).
const UNIMED = {
  id: 'u1', hospital: 'unimed', data: '2026-10-20',
  ordemLiberacao: { vespertino: ['DIEGO', 'ROMULO', 'KARINE', 'GABRIEL', 'JOAO RICARDO', 'LEANDRO', 'MARILIO'] },
  ajudaExterna: { vespertino: [] },
  liberacoes: {}, linhaOverrides: {},
  casos: [
    caso('c1', 'CC - Sala 1', 'DIEGO'),
    caso('c2', 'CC - Sala 2', 'ROMULO'),
    caso('c3', 'Accurata', 'KARINE'),
    caso('c4', 'CO - Sala 3', 'GABRIEL'),
    caso('c5', 'Umanitá', 'JOAO RICARDO'),
    caso('c6', 'CC - Sala 7', 'LEANDRO'),
    caso('c7', 'Hemodinâmica', 'GIOVANA', '13:00'),
  ],
}
const hro = ({ equipe }) => ({
  id: 'h1', hospital: 'hro', data: '2026-10-20',
  ordemLiberacao: { vespertino: ['ALEXANDRE D', 'RAFAEL', 'ROBERTA', 'GIOVANA', 'VICENTE'] },
  ajudaExterna: { vespertino: [] },
  liberacoes: {},
  linhaOverrides: equipe ? { 'vespertino:GIOVANA': { naEquipe: { ate: '19:00' } } } : {},
  casos: [caso('h-c1', 'Sala 1', 'ALEXANDRE D', '13:00'), caso('h-c2', 'Sala 4', 'ROBERTA', '13:00')],
})

const montar = (escalaHro) => {
  estado.ctx = {
    escalas: { unimed: UNIMED, hro: escalaHro, materno: null, fds: null },
    p4Hospital: null, data: '2026-10-20', hoje: '2026-10-20', loading: false, ...acoes(),
  }
  render(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />, { wrapper: wrap })
  fireEvent.click(screen.getByRole('tab', { name: 'Liberações' }))
}

/** Nomes da fila, de cima para baixo. O ÚLTIMO é o PRIMEIRO a ir embora. */
const fila = () => screen.queryAllByLabelText(/^Editar local\/cirurgião de /)
  .map((b) => b.getAttribute('aria-label').replace('Editar local/cirurgião de ', ''))
const cardDe = (nome) => screen.getByLabelText(`Editar local/cirurgião de ${nome}`).closest('[data-linha]')

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-10-20T14:00:00-03:00')) // terça, turno vespertino
})
afterEach(() => vi.useRealTimers())

describe('voltou da equipe de outro hospital: entra na posição da numérica, não como ajuda (dono 20/10)', () => {
  it('Giovana entra entre Gabriel e João Ricardo, como na numérica da Unimed', async () => {
    montar(hro({ equipe: true }))
    await vi.waitFor(() => {
      const nomes = fila()
      expect(nomes.indexOf('Giovana')).toBe(nomes.indexOf('Gabriel') + 1)
    }, { timeout: 4000 })
    const nomes = fila()
    expect(nomes[nomes.indexOf('Giovana') + 1]).toBe('João Ricardo')
  })

  it('não leva o selo "Ajuda (HRO)"', async () => {
    montar(hro({ equipe: true }))
    await vi.waitFor(() => expect(fila().indexOf('Giovana')).toBe(fila().indexOf('Gabriel') + 1), { timeout: 4000 })
    expect(cardDe('Giovana').textContent).not.toMatch(/Ajuda/)
  })

  it('sem o selo Equipe no HRO nada muda: segue a regra de 27/08 (ajuda de lá, no fim)', async () => {
    montar(hro({ equipe: false }))
    await new Promise((r) => setTimeout(r, 300))
    const nomes = fila()
    expect(nomes.indexOf('Giovana')).toBeGreaterThan(nomes.indexOf('Marilio'))
    expect(cardDe('Giovana').textContent).toMatch(/Ajuda \(HRO\)/)
  })
})
