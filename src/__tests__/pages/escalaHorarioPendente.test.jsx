/**
 * HORÁRIO PENDENTE na tela — INDIVIDUAL (dono 27/10, 3ª e 4ª rodadas de `.tmp/horarios-auditoria/`).
 *
 * MUDOU DE LADO em 27/10: até aqui este arquivo travava o alerta PÚBLICO de 05/10 (a faixa com
 * o nome de todos, a pílula "Você N", o "Na equipe", a lista por anestesista). O dono pediu:
 * "retire a visualização de toda a equipe (deixe apenas individual até o usuário resolver
 * todos os horários, inclusive de dias anteriores)". As regras de QUEM ENTRA no alerta não
 * mudaram (a lib e `useHorarioPendente` são os mesmos) — o que mudou é QUEM VÊ.
 *
 * Travas:
 *  · só quem tem horário a preencher vê; a conta de hospital (sem "eu") não vê nada, e o
 *    nome de nenhum colega aparece;
 *  · a regra de entrada continua: turno encerrado, liberado na fila, início vencido; some com
 *    início e término ou suspensa; só vendo HOJE; a manhã de 05/10 não conta;
 *  · Minhas: caixa com o número, os DIAS como cabeçalho, até 5 linhas e "Ver todas"; nas
 *    outras abas, a faixa de uma linha que abre a lista;
 *  · as de DIAS ANTERIORES (prop `anteriores`) entram na mesma conta e na mesma lista;
 *  · o toque abre DIRETO a folha do horário: só início ou os dois;
 *  · o selo no card da cirurgia continua (público).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

import { ThemeProvider } from '@/design-system'
import FaixaHorarioPendente from '@/pages/escala-cirurgica/FaixaHorarioPendente'
import useHorarioPendente from '@/pages/escala-cirurgica/useHorarioPendente'
import { CasoCard } from '@/pages/escala-cirurgica/BoardView'
import { anestesistaDoCasoEh } from '@/pages/escala-cirurgica/utils'
import { compararPendencias } from '@/lib/escalaHorarioPendente'

const estado = vi.hoisted(() => ({ ctx: null }))
vi.mock('@/contexts/EscalaCirurgicaContext', async (orig) => ({
  ...(await orig()),
  useEscalaCirurgica: () => estado.ctx,
}))
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ user: { uid: 'uid-ana' } }) }))
const ROSTER = [
  { uid: 'uid-ana', nome: 'ANA RIBEIRO', apelidos: ['ANA'] },
  { uid: 'uid-bruno', nome: 'BRUNO LIMA', apelidos: ['BRUNO'] },
]
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: ROSTER, rosterByUid: new Map(ROSTER.map((r) => [r.uid, r])), options: [], loading: false,
    resolver: (n) => ROSTER.find((r) => r.apelidos.includes(String(n || '').trim().toUpperCase()))?.uid || null,
  }),
}))
vi.mock('@/pages/escala-cirurgica/CasoDetalheSheet', () => ({
  default: ({ caso, escala }) => <div role="dialog" aria-label="detalhe">detalhe {escala.hospital} {caso.id}</div>,
}))

const HOJE = '2026-10-29'
const caso = (o = {}) => ({
  id: 'c1', sala: 'CC - Sala 2', ordem: 0, turno: 'matutino', hora: '07:30',
  procedimento: 'COLECISTECTOMIA VIDEOLAPAROSCOPICA', anestesista: 'ANA', anestesistaUserId: 'uid-ana',
  statusCirurgia: 'terminada', inicioReal: null, terminoReal: '09:10', ...o,
})
const escala = (casos, o = {}) => ({
  id: 'e-unimed', hospital: 'unimed', data: HOJE, status: 'publicada', liberacoes: {}, linhaOverrides: {}, casos, ...o,
})
const setStatusCirurgia = vi.fn(() => Promise.resolve())
const atualizarCaso = vi.fn(() => Promise.resolve())
const contexto = (escalas, o = {}) => {
  estado.ctx = { hoje: HOJE, data: HOJE, escalas: { unimed: null, hro: null, materno: null, fds: null, ...escalas }, setStatusCirurgia, atualizarCaso, ...o }
}
const agoraEm = (hhmm, dia = HOJE) => vi.setSystemTime(new Date(`${dia}T${hhmm}:00-03:00`))
const ANA = { uid: 'uid-ana', alias: 'ANA', resolverUid: () => null }

function Tela({ eu = ANA, aba = 'minhas', anteriores = null }) {
  const p = useHorarioPendente()
  // a página monta a lista pessoal pelo critério da aba Minhas (login > apelido)
  const minhas = eu ? p.itens.filter((i) => anestesistaDoCasoEh(i.caso, eu)).sort(compararPendencias) : null
  // ...e só monta a faixa vendo HOJE (EscalaCirurgicaPage)
  if (estado.ctx.data !== estado.ctx.hoje) return null
  return <FaixaHorarioPendente podeEditar minhas={minhas} anteriores={anteriores} eu={eu} abaMinhas={aba === 'minhas'} />
}
const montar = (props = {}) => render(<ThemeProvider><Tela {...props} /></ThemeProvider>)
const caixa = () => screen.queryByRole('region', { name: /^Você tem .* sem horário$/ })
const faixa = () => screen.queryByRole('button', { name: /sem horário\. Ver a lista$/ })

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); setStatusCirurgia.mockClear(); atualizarCaso.mockClear() })
afterEach(() => vi.useRealTimers())

describe('quem vê: só quem tem horário a preencher (dono 27/10)', () => {
  it('a dona da cirurgia vê a caixa na Minhas; o nome de nenhum colega aparece', () => {
    agoraEm('13:05')
    contexto({ unimed: escala([caso(), caso({ id: 'bru', anestesista: 'BRUNO', anestesistaUserId: 'uid-bruno' })]) })
    montar()
    expect(caixa().getAttribute('aria-label')).toBe('Você tem 1 cirurgia sem horário')
    expect(screen.queryByText(/Bruno/)).toBeNull()
    expect(screen.queryByText(/Na equipe|Horário pendente|Você em dia/)).toBeNull()
  })

  it('quem não deve nada não vê nada — mesmo com colegas devendo', () => {
    agoraEm('13:05')
    contexto({ unimed: escala([caso({ id: 'bru', anestesista: 'BRUNO', anestesistaUserId: 'uid-bruno' })]) })
    montar()
    expect(caixa()).toBeNull()
    expect(faixa()).toBeNull()
  })

  it('conta de hospital (sem "eu") não vê nada', () => {
    agoraEm('13:05')
    contexto({ unimed: escala([caso()]) })
    montar({ eu: null })
    expect(caixa()).toBeNull()
    expect(faixa()).toBeNull()
  })

  it('na Completa e nas Liberações, a faixa de uma linha abre a lista', () => {
    agoraEm('13:05')
    contexto({ unimed: escala([caso()]) })
    montar({ aba: 'board' })
    expect(faixa()).toBeTruthy()
    fireEvent.click(faixa())
    expect(screen.getByText('Suas cirurgias sem horário')).toBeTruthy()
  })
})

describe('a regra de quem entra continua a mesma (lib + useHorarioPendente)', () => {
  it('antes das 13h, sem liberação e com o início informado, não há aviso', () => {
    agoraEm('12:55')
    contexto({ unimed: escala([caso({ statusCirurgia: 'iniciada', inicioReal: '07:40', terminoReal: null })]) })
    montar()
    expect(caixa()).toBeNull()
  })

  it('liberado na fila, antes do fim do turno → já entra; o marcador de escalado do repasse não é liberação', () => {
    agoraEm('10:00')
    contexto({ unimed: escala([caso()], { liberacoes: { 'matutino:uid-ana': { liberadoEm: 'x' } } }) })
    const { unmount } = montar()
    expect(caixa()).toBeTruthy()
    unmount()
    contexto({ unimed: escala([caso({ statusCirurgia: 'iniciada', inicioReal: '07:40', terminoReal: null })], { liberacoes: { 'matutino:uid-ana': { escalado: true } } }) })
    montar()
    expect(caixa()).toBeNull()
  })

  it('passou 30 min do horário agendado sem início → entra no turno, com "Falta início"', () => {
    agoraEm('08:05')
    contexto({ unimed: escala([caso({ statusCirurgia: 'agendada', terminoReal: null })]) })
    montar()
    expect(within(caixa()).getByText('Falta início')).toBeTruthy()
  })

  it('some com início e término preenchidos, ou com a cirurgia suspensa', () => {
    agoraEm('14:00')
    contexto({ unimed: escala([caso({ inicioReal: '07:40' })]) })
    const { unmount } = montar()
    expect(caixa()).toBeNull()
    unmount()
    contexto({ unimed: escala([caso({ statusCirurgia: 'agendada', terminoReal: null, statusExtra: 'suspensa' })]) })
    montar()
    expect(caixa()).toBeNull()
  })

  it('só vendo HOJE', () => {
    agoraEm('14:00')
    contexto({ unimed: escala([caso()]) }, { data: '2026-10-30' })
    montar()
    expect(caixa()).toBeNull()
  })

  it('a manhã de 05/10 não conta; a tarde de 05/10 conta', () => {
    agoraEm('19:30', '2026-10-05')
    const e = escala([caso({ id: 'manha' }), caso({ id: 'tarde', turno: 'vespertino', hora: '14:00' })], { data: '2026-10-05' })
    contexto({ unimed: e }, { hoje: '2026-10-05', data: '2026-10-05' })
    montar()
    expect(caixa().getAttribute('aria-label')).toBe('Você tem 1 cirurgia sem horário')
  })
})

describe('a caixa da Minhas: por dia, até 5 linhas', () => {
  const anteriores = (n) => ({
    itens: Array.from({ length: n }, (_, i) => ({
      caso: caso({ id: `ant${i}`, hora: `0${7 + (i % 3)}:00`, terminoReal: null }),
      hospital: 'hro', turno: 'matutino', falta: 'ambos', motivo: 'turno', data: i < 2 ? '2026-10-28' : '2026-10-27',
    })),
    informar: vi.fn(), naoAconteceu: vi.fn(),
  })

  it('soma hoje e os dias anteriores; os dias viram cabeçalho, hoje primeiro', () => {
    agoraEm('13:05')
    contexto({ unimed: escala([caso()]) })
    montar({ anteriores: anteriores(3) })
    expect(caixa().getAttribute('aria-label')).toBe('Você tem 4 cirurgias sem horário')
    const dias = within(caixa()).getAllByRole('region').map((r) => r.getAttribute('aria-label'))
    expect(dias).toEqual(['Hoje: 1 cirurgia', 'Ontem · qua 28/10: 2 cirurgias', 'ter 27/10: 1 cirurgia'])
  })

  it('com 12, a caixa mostra 5 linhas e "Ver todas as 12" abre a lista inteira', () => {
    agoraEm('13:05')
    contexto({ unimed: escala([caso()]) })
    montar({ anteriores: anteriores(11) })
    expect(within(caixa()).getAllByRole('button', { name: /^Informar o horário/ })).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: /Ver todas as 12/ }))
    const lista = screen.getByRole('dialog')
    expect(within(lista).getAllByRole('button', { name: /^Informar o horário/ })).toHaveLength(12)
  })

  it('nas outras abas a faixa diz quantas são de dias anteriores', () => {
    agoraEm('13:05')
    contexto({ unimed: escala([caso()]) })
    montar({ aba: 'board', anteriores: anteriores(3) })
    expect(within(faixa()).getByText(/3 de dias anteriores/)).toBeTruthy()
  })

  it('só com dias anteriores (nada hoje), o aviso continua até resolver', () => {
    agoraEm('09:00')
    contexto({ unimed: escala([caso({ inicioReal: '07:40' })]) })
    montar({ anteriores: anteriores(1) })
    expect(caixa().getAttribute('aria-label')).toBe('Você tem 1 cirurgia sem horário')
  })
})

describe('o toque abre direto a folha do horário', () => {
  it('"Falta início" de uma cirurgia aberta pede SÓ o início', () => {
    agoraEm('08:05')
    contexto({ unimed: escala([caso({ statusCirurgia: 'agendada', terminoReal: null })]) })
    montar()
    fireEvent.click(within(caixa()).getByRole('button', { name: /^Informar o horário/ }))
    expect(screen.getByText(/^Início · 07:30/)).toBeTruthy()
    expect(screen.queryByText('Confirmar os dois')).toBeNull()
  })

  it('terminada sem início pede os dois, lado a lado, e grava pelo caminho de sempre', () => {
    agoraEm('13:05')
    contexto({ unimed: escala([caso()]) })
    montar()
    fireEvent.click(within(caixa()).getByRole('button', { name: /^Informar o horário/ }))
    expect(screen.getByText(/^Início e término · 07:30/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Horário de início'), { target: { value: '0735' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar os dois' }))
    expect(atualizarCaso).toHaveBeenCalledWith(expect.objectContaining({ hospital: 'unimed' }), 'c1',
      { terminoReal: '09:10', inicioReal: '07:35' }, { silencioso: true })
  })

  it('a de dia anterior grava pelo id (prop `anteriores`) e não oferece "Ver a cirurgia"', () => {
    agoraEm('09:00')
    contexto({ unimed: escala([]) })
    const ant = {
      itens: [{ caso: caso({ id: 'ontem', terminoReal: null }), hospital: 'hro', turno: 'matutino', falta: 'ambos', motivo: 'turno', data: '2026-10-28' }],
      informar: vi.fn(), naoAconteceu: vi.fn(),
    }
    montar({ anteriores: ant })
    fireEvent.click(within(caixa()).getByRole('button', { name: /^Informar o horário/ }))
    expect(screen.queryByText('Ver a cirurgia')).toBeNull()
    fireEvent.change(screen.getByLabelText('Horário de início'), { target: { value: '0730' } })
    fireEvent.change(screen.getByLabelText('Horário de término'), { target: { value: '0915' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar os dois' }))
    expect(ant.informar).toHaveBeenCalledWith(ant.itens[0], { inicio: '07:30', termino: '09:15' })
  })

  it('"Não aconteceu" marca Suspensa na cirurgia aberta', () => {
    agoraEm('08:05')
    contexto({ unimed: escala([caso({ statusCirurgia: 'agendada', terminoReal: null })]) })
    montar()
    fireEvent.click(within(caixa()).getByRole('button', { name: /^Informar o horário/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Não aconteceu (suspensa)' }))
    expect(setStatusCirurgia).toHaveBeenCalledWith(expect.objectContaining({ hospital: 'unimed' }), expect.objectContaining({ id: 'c1' }), 'suspensa', { userId: 'uid-ana' })
  })
})

describe('o selo no card da cirurgia (continua público)', () => {
  it('diz o que falta, ao lado do estado', () => {
    render(<ThemeProvider><CasoCard caso={caso()} pendencia="ini" onClick={() => {}} /></ThemeProvider>)
    expect(screen.getByText('Terminada')).toBeTruthy()
    expect(screen.getByText('Falta início')).toBeTruthy()
  })

  it('sem pendência, sem selo', () => {
    render(<ThemeProvider><CasoCard caso={caso({ inicioReal: '07:40' })} onClick={() => {}} /></ThemeProvider>)
    expect(screen.queryByText(/Falta|Sem horário/)).toBeNull()
  })
})
