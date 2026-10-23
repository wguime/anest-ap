/**
 * "LIBERADO FORA DA ORDEM" — Unimed, 23/10/2026, foto das 10:39 (dono: "esse é um erro que
 * está acontecendo com frequência mesmo após várias correções").
 *
 * Diego (14º do rodapé do HRO) saiu vermelho ACIMA de Paulo (9º do HRO) e Rodnei (12º), os
 * dois em sala. O toque foi NA VEZ: com a cesárea no nome dele, a ordem do hospital de
 * origem (27/08) o punha em último. A cesárea foi passada ao Costa na folha "Antes de
 * liberar"; o repasse o gravou no array de ajuda; e a tela repartia a lista por `isExtra`,
 * jogando a ajuda do array acima de todos os extras. A folha liberou sem reconferir.
 *
 * Duas travas, as duas de TELA (o defeito morava no fio entre lib e view, não na lib):
 *   1. a lista renderizada mantém a ordem do HRO — Diego em último e próximo a sair;
 *   2. o "Salvar e liberar" da folha reconfere a ordem com a fila de AGORA.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'

vi.mock('@/contexts/EscalaCirurgicaContext', async (orig) => ({
  ...(await orig()),
  useEscalaCirurgicaActions: () => ({ atualizarCaso: vi.fn(), setStatusCirurgia: vi.fn(), setLinhaOverride: vi.fn(), adicionarAjuda: vi.fn(), removerAjuda: vi.fn() }),
  useEscalaCirurgica: () => ({ hoje: '2026-10-23', escalas: {}, data: '2026-10-23', loading: false }),
}))
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ user: { uid: 'u-gabriela', displayName: 'Gabriela' } }) }))

const ROSTER = [
  { uid: 'u-gabriela', nome: 'GABRIELA CITRON VEDANA', apelidos: ['GABRIELA'] },
  { uid: 'u-costa', nome: 'MARCOS COSTA', apelidos: ['COSTA'] },
  { uid: 'u-alexandre', nome: 'ALEXANDRE DANIELI', apelidos: ['ALEXANDRE D'] },
  { uid: 'u-matheus', nome: 'MATHEUS CUNHA', apelidos: ['MATHEUS'] },
  { uid: 'u-paulo', nome: 'PAULO TONINI', apelidos: ['PAULO'] },
  { uid: 'u-rodnei', nome: 'RODNEI CABRAL LIMA', apelidos: ['RODNEI'] },
  { uid: 'u-diego', nome: 'DIEGO BONIATTI RIGOTTI', apelidos: ['DIEGO'] },
  { uid: 'u-leandro', nome: 'LEANDRO BERNARDES', apelidos: ['LEANDRO'] },
]
const POR_APELIDO = Object.fromEntries(ROSTER.flatMap((r) => r.apelidos.map((a) => [a, r.uid])))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: ROSTER, rosterByUid: new Map(ROSTER.map((r) => [r.uid, r])),
    options: ROSTER.map((r) => ({ value: r.uid, label: r.nome })), aliases: [], loading: false,
    resolver: (n) => POR_APELIDO[String(n || '').trim().toUpperCase()] || null,
    upsertAlias: vi.fn(), refresh: vi.fn(), removeAlias: vi.fn(),
  }),
}))
vi.mock('@/hooks/useRosterResidentes', () => ({ default: () => ({ residentes: [], residenteByUid: new Map(), options: [] }) }))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({
  default: { reservarAvisoTempo: vi.fn(async () => false), fetchLocaisHospital: vi.fn(async () => []) },
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

// rodapé do HRO da manhã de 23/10 (o que importa: Paulo 9º, Rodnei 12º, Diego 14º)
const HRO = ['THAYNA', 'GUILHERME DIDOMENICO', 'OSCAR', 'NATHALIA', 'PELISSARO', 'DANIELA', 'KARINE', 'ROMULO', 'PAULO', 'CURY', 'RAQUEL', 'RODNEI', 'GARIM', 'DIEGO', 'MARILIO', 'LEONARDO']
const presencaHro = HRO.map((nome, i) => ({ nome, uid: null, hospital: 'hro', hospitalLabel: 'HRO', rodapeIdx: i }))

const caso = (id, anestesista, extra = {}) => ({
  id, ordem: 0, sala: `CC - Sala ${id}`, hora: '08:00', procedimento: 'COLECISTECTOMIA VIDEOLAPAROSCOPICA',
  cirurgiao: 'Marcos Zanella', anestesista, anestesistaUserId: POR_APELIDO[anestesista] || null,
  statusCirurgia: 'iniciada', inicioReal: '08:00', turno: 'matutino', bloco: 'normal', origem: 'importacao', ...extra,
})
const escalaDe = (casos, ajuda = []) => ({
  id: 'e1', hospital: 'unimed', data: '2026-10-23', status: 'publicada',
  ordemLiberacao: { matutino: ['GABRIELA', 'COSTA', 'ALEXANDRE D', 'MATHEUS'] },
  ajudaExterna: { matutino: ajuda }, liberacoes: {}, linhaOverrides: {}, casos,
})

const montar = (casos, ajuda = []) => {
  const onToggle = vi.fn(async () => {})
  const props = { onToggle, onDefinirTerminoRealCaso: vi.fn(async () => {}), onDefinirInicioCaso: vi.fn(async () => {}), onDefinirCasos: vi.fn(async () => {}), onSuspenderCaso: vi.fn(async () => {}) }
  const ui = (cs, aj) => (
    <LiberacoesView escala={escalaDe(cs, aj)} hospital="unimed" hospitalLabel="Unimed" turno="matutino"
      canEdit onSetOverride={() => {}} presencaOutros={presencaHro} {...props} />
  )
  const r = render(ui(casos, ajuda), { wrapper: wrap })
  return { onToggle, rerender: (cs, aj = ajuda) => r.rerender(ui(cs, aj)) }
}
const ordemNaTela = () => [...document.querySelectorAll('[data-linha]')].map((el) => el.getAttribute('data-linha'))
const cardDe = (uid) => document.querySelector(`[data-linha="${uid}"]`)

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-10-23T10:36:00-03:00'))
})
afterAll(() => vi.useRealTimers())
beforeEach(() => vi.clearAllMocks())

// depois do repasse: a cesárea é do Costa, o Diego está no array de ajuda, sem caso aqui
const daCasa = [caso('1', 'GABRIELA'), caso('7', 'COSTA'), caso('9', 'ALEXANDRE D')]
const depoisDoRepasse = [...daCasa, caso('im', 'PAULO'), caso('um', 'RODNEI')]

describe('Unimed 23/10 — a tela mantém a ordem do hospital de origem', () => {
  it('Diego, que veio pelo array de ajuda, fica abaixo de Paulo e Rodnei e é o próximo', () => {
    montar(depoisDoRepasse, ['DIEGO'])
    expect(ordemNaTela()).toEqual(['u-gabriela', 'u-costa', 'u-alexandre', 'u-paulo', 'u-rodnei', 'u-diego', 'u-matheus'])
    expect(cardDe('u-diego').textContent).toContain('Próximo a ser liberado')
    expect(cardDe('u-rodnei').textContent).not.toContain('Próximo a ser liberado')
  })

  it('liberar o Diego passa; liberar o Rodnei antes dele é recusado', async () => {
    const { onToggle } = montar(depoisDoRepasse, ['DIEGO'])
    fireEvent.click(screen.getByRole('button', { name: 'Marcar Rodnei Lima liberado' }))
    expect(await screen.findByText('Libere Diego Rigotti primeiro')).toBeTruthy()
    expect(onToggle).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Marcar Diego Rigotti liberado' }))
    await waitFor(() => expect(onToggle).toHaveBeenCalledTimes(1))
    expect(onToggle.mock.calls[0][0].anestesista).toBe('Diego Rigotti')
  })
})

describe('a folha "Antes de liberar" reconfere a ordem no "Salvar e liberar"', () => {
  const folhaAntes = () => screen.getAllByRole('dialog').find((d) => d.textContent.includes('Antes de liberar'))
  // o Alexandre fecha os que trabalham (o Matheus, sem cirurgia, é a cauda) e tem cirurgia aberta
  const alexandreEmSala = [caso('1', 'GABRIELA'), caso('7', 'COSTA'), caso('9', 'ALEXANDRE D')]
  const alexandreTerminou = [caso('1', 'GABRIELA'), caso('7', 'COSTA'), caso('9', 'ALEXANDRE D', { statusCirurgia: 'terminada', terminoReal: '10:30' })]

  it('a fila mudou com a folha aberta: não libera e diz quem é o próximo agora', async () => {
    const { onToggle, rerender } = montar(alexandreEmSala)
    fireEvent.click(screen.getByRole('button', { name: 'Marcar Alexandre Danieli liberado' }))
    expect(folhaAntes()).toBeTruthy()
    // enquanto a folha está aberta: o término é preenchido e chega uma urgência para o
    // Leandro, que não está em rodapé nenhum — ele entra no fim e passa a ser o próximo
    rerender([...alexandreTerminou, caso('u', 'LEANDRO', { origem: 'manual', hora: '10:35' })])
    fireEvent.click(within(folhaAntes()).getByRole('button', { name: 'Salvar e liberar Alexandre' }))
    expect(await screen.findByText('Libere Leandro Bernardes primeiro')).toBeTruthy()
    expect(screen.getByText(/Horários salvos\. Com o que mudou na fila, falta 1 anestesista antes de Alexandre Danieli\./)).toBeTruthy()
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('a fila não mudou: libera como sempre', async () => {
    const { onToggle, rerender } = montar(alexandreEmSala)
    fireEvent.click(screen.getByRole('button', { name: 'Marcar Alexandre Danieli liberado' }))
    rerender(alexandreTerminou)
    fireEvent.click(within(folhaAntes()).getByRole('button', { name: 'Salvar e liberar Alexandre' }))
    await waitFor(() => expect(onToggle).toHaveBeenCalledTimes(1))
    expect(onToggle.mock.calls[0][0].anestesista).toBe('Alexandre Danieli')
  })
})
