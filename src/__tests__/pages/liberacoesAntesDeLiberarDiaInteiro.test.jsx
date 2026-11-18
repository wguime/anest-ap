/**
 * LIBERAR CONFERE O DIA (dono 15/10/2026) — causa 1 do relatório das 24 cirurgias com
 * "Horário pendente" na faixa das 19h: a folha "Antes de liberar" (14/10) só olhava o
 * hospital e o turno da fila. Assim:
 *  - o Oscar foi liberado no HRO às 12h25 com 2 cirurgias abertas na Unimed, no mesmo turno;
 *  - Marílio, Leonardo, Raul e Guilherme Xavier foram liberados à TARDE com a cirurgia da
 *    MANHÃ sem horário (no mesmo hospital ou em outro).
 * Agora a folha confere os três hospitais, no turno da liberação e nos anteriores. De manhã
 * a cirurgia da tarde não conta (ainda não aconteceu); a que "passa para tarde" segue com
 * quem a assume, como já era.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'

const { atualizarCaso, setStatusCirurgia, setLinhaOverride } = vi.hoisted(() => ({
  atualizarCaso: vi.fn(async () => {}),
  setStatusCirurgia: vi.fn(async () => {}),
  setLinhaOverride: vi.fn(async () => {}),
}))
vi.mock('@/contexts/EscalaCirurgicaContext', async (orig) => ({
  ...(await orig()),
  useEscalaCirurgicaActions: () => ({ atualizarCaso, setStatusCirurgia, setLinhaOverride, adicionarAjuda: vi.fn(), removerAjuda: vi.fn() }),
  useEscalaCirurgica: () => ({ hoje: '2026-10-02', escalas: {}, data: '2026-10-02', loading: false }),
}))
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ user: { uid: 'uid-paulo', displayName: 'Paulo' } }) }))

const ROSTER = [
  { uid: 'uid-paulo', nome: 'PAULO TONINI', apelidos: ['PAULO'] },
  { uid: 'uid-ana', nome: 'ANA LIMA', apelidos: ['ANA'] },
]
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: ROSTER, rosterByUid: new Map(ROSTER.map((r) => [r.uid, r])),
    options: ROSTER.map((r) => ({ value: r.uid, label: r.nome })), aliases: [], loading: false,
    resolver: (n) => ({ PAULO: 'uid-paulo', ANA: 'uid-ana' })[String(n || '').trim().toUpperCase()] || null,
    upsertAlias: vi.fn(), refresh: vi.fn(), removeAlias: vi.fn(),
  }),
}))
vi.mock('@/hooks/useRosterResidentes', () => ({ default: () => ({ residentes: [], residenteByUid: new Map(), options: [] }) }))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({
  default: { reservarAvisoTempo: vi.fn(async () => false), fetchLocaisHospital: vi.fn(async () => []) },
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const base = { anestesista: 'PAULO', anestesistaUserId: 'uid-paulo', cirurgiao: 'Marcos Zanella', bloco: 'normal', procedimento: 'HERNIORRAFIA INGUINAL' }
const daAna = (turno) => ({ ...base, id: `ana-${turno}`, ordem: 0, sala: 'CC - Sala 1', hora: turno === 'matutino' ? '07:30' : '13:00', turno, anestesista: 'ANA', anestesistaUserId: 'uid-ana', statusCirurgia: 'iniciada', inicioReal: '13:10' })
// a cirurgia do Paulo NESTA fila está completa: sem a conferência do dia, ele sairia direto
const tardeCompleta = { ...base, id: 'u-t', ordem: 1, sala: 'CC - Sala 3', hora: '13:30', turno: 'vespertino', statusCirurgia: 'terminada', inicioReal: '13:35', terminoReal: '15:00' }
const manhaCompleta = { ...tardeCompleta, id: 'u-m', hora: '07:30', turno: 'matutino', inicioReal: '07:40', terminoReal: '10:00' }
// a cesárea da manhã no HRO, iniciada e nunca terminada (o caso do Oscar / Marílio)
const hroManhaAberta = { ...base, id: 'h-m', ordem: 0, sala: 'Sala 3', hora: '08:00', turno: 'matutino', procedimento: 'CESARIANA', statusCirurgia: 'iniciada', inicioReal: '08:10', terminoReal: null }

const escalaDe = (hospital, turno, casos, o = {}) => ({
  id: `e-${hospital}`, hospital, data: '2026-10-15', status: 'publicada',
  ordemLiberacao: { [turno]: ['ANA', 'PAULO'] }, ajudaExterna: {}, liberacoes: {}, linhaOverrides: {}, casos, ...o,
})

const montar = ({ turno = 'vespertino', unimed, hro, comDia = true }) => {
  const onToggle = vi.fn(async () => {})
  const props = { onToggle, onDefinirTerminoRealCaso: vi.fn(async () => {}), onDefinirInicioCaso: vi.fn(async () => {}), onDefinirCasos: vi.fn(async () => {}), onSuspenderCaso: vi.fn(async () => {}) }
  const ui = (u, h) => (
    <LiberacoesView escala={u} hospital="unimed" hospitalLabel="Unimed" turno={turno}
      canEdit onSetOverride={() => {}} escalasDoDia={comDia ? { unimed: u, hro: h, materno: null } : null} {...props} />
  )
  const r = render(ui(unimed, hro), { wrapper: wrap })
  return { onToggle, rerender: (u, h) => r.rerender(ui(u, h)) }
}
const tocarLiberar = () => fireEvent.click(screen.getByRole('button', { name: 'Marcar Paulo Tonini liberado' }))

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-10-15T15:45:00-03:00'))
})
afterAll(() => vi.useRealTimers())
beforeEach(() => vi.clearAllMocks())

describe('liberar não confere mais o dia (dono 18/11 revoga 15/10)', () => {
  // "só não quero mais que a mensagem apareça, para não travar as liberações": a cirurgia
  // aberta em outro hospital ou turno fica no débito de quem está nela; o toque libera direto.
  it('à tarde, a cirurgia da MANHÃ aberta em OUTRO hospital não segura mais', async () => {
    const unimed = escalaDe('unimed', 'vespertino', [daAna('vespertino'), tardeCompleta])
    const { onToggle } = montar({ unimed, hro: escalaDe('hro', 'matutino', [hroManhaAberta]) })
    tocarLiberar()
    expect(screen.queryAllByRole('dialog').find((d) => d.textContent.includes('Antes de liberar'))).toBeUndefined()
    await waitFor(() => expect(onToggle).toHaveBeenCalledTimes(1))
  })

  it('de manhã, a aberta em outro hospital no MESMO turno também não segura (caso Oscar)', async () => {
    const unimed = escalaDe('unimed', 'matutino', [daAna('matutino'), manhaCompleta])
    const { onToggle } = montar({ turno: 'matutino', unimed, hro: escalaDe('hro', 'matutino', [hroManhaAberta]) })
    tocarLiberar()
    await waitFor(() => expect(onToggle).toHaveBeenCalledTimes(1))
  })

  it('de manhã, a cirurgia da TARDE (ainda não aconteceu) não segura', async () => {
    const unimed = escalaDe('unimed', 'matutino', [daAna('matutino'), manhaCompleta])
    const hroTarde = { ...hroManhaAberta, id: 'h-t', hora: '14:00', turno: 'vespertino', statusCirurgia: 'agendada', inicioReal: null }
    const { onToggle } = montar({ turno: 'matutino', unimed, hro: escalaDe('hro', 'vespertino', [hroTarde]) })
    tocarLiberar()
    await waitFor(() => expect(onToggle).toHaveBeenCalledTimes(1))
  })

  it('a da manhã marcada "Passa para tarde" segue com quem assume — não segura', async () => {
    const passa = { ...hroManhaAberta, statusExtra: 'passa_tarde' }
    const unimed = escalaDe('unimed', 'vespertino', [daAna('vespertino'), tardeCompleta])
    const { onToggle } = montar({ unimed, hro: escalaDe('hro', 'matutino', [passa]) })
    tocarLiberar()
    await waitFor(() => expect(onToggle).toHaveBeenCalledTimes(1))
  })

  it('cirurgia de outra pessoa em outro hospital não entra na conta', async () => {
    const daAnaNoHro = { ...hroManhaAberta, anestesista: 'ANA', anestesistaUserId: 'uid-ana' }
    const unimed = escalaDe('unimed', 'vespertino', [daAna('vespertino'), tardeCompleta])
    const { onToggle } = montar({ unimed, hro: escalaDe('hro', 'matutino', [daAnaNoHro]) })
    tocarLiberar()
    await waitFor(() => expect(onToggle).toHaveBeenCalledTimes(1))
  })
})
