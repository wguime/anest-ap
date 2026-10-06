/**
 * HORÁRIO PENDENTE na tela (dono 05/10, modelo A em `.tmp/alerta-horario-pendente.html`).
 *
 * Travas:
 *  · a faixa aparece com a cirurgia que entrou no alerta — turno encerrado OU anestesista
 *    liberado — e diz quem deve e quanto; some quando os horários são preenchidos ou a
 *    cirurgia é suspensa;
 *  · só vendo HOJE; a manhã de 05/10 (antes do alerta existir) não conta;
 *  · liberado com a cirurgia ABERTA: a lista oferece "Preencher horário" e "Colega
 *    assumiu" (este abre o Definir anestesista do caso — dono 05/10);
 *  · o card da cirurgia mostra o que falta ("Falta início");
 *  · início VENCIDO (dono 05/10 à tarde): 30 min depois do horário agendado já entra, no
 *    turno, e a lista sugere "Atrasada" para quem ainda não começou.
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
  useEscalaCirurgicaActions: () => ({}),
}))
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ user: { uid: 'uid-gabriel' } }) }))
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
// as folhas de destino têm testes próprios; aqui vale o CAMINHO até elas
vi.mock('@/pages/escala-cirurgica/CasoDetalheSheet', () => ({
  default: ({ caso, escala }) => <div role="dialog" aria-label="detalhe">detalhe {escala.hospital} {caso.id}</div>,
}))
vi.mock('@/pages/escala-cirurgica/DefinirAnestesistaSheet', () => ({
  default: ({ sala, casosAlvo, escala }) => (
    <div role="dialog" aria-label="definir">definir {escala.hospital} {sala} {casosAlvo.map((c) => c.id).join(',')}</div>
  ),
}))

const HOJE = '2026-10-06'
const caso = (o = {}) => ({
  id: 'c1', sala: 'CC - Sala 2', ordem: 0, turno: 'matutino', hora: '07:30',
  procedimento: 'COLECISTECTOMIA VIDEOLAPAROSCOPICA', anestesista: 'ANA', anestesistaUserId: 'uid-ana',
  statusCirurgia: 'terminada', inicioReal: null, terminoReal: '09:10', ...o,
})
const escala = (casos, o = {}) => ({
  id: 'e-unimed', hospital: 'unimed', data: HOJE, status: 'publicada', liberacoes: {}, linhaOverrides: {}, casos, ...o,
})
const contexto = (escalas, o = {}) => {
  estado.ctx = { hoje: HOJE, data: HOJE, escalas: { unimed: null, hro: null, materno: null, fds: null, ...escalas }, ...o }
}
const agoraEm = (hhmm, dia = HOJE) => vi.setSystemTime(new Date(`${dia}T${hhmm}:00-03:00`))

function Tela({ eu = null }) {
  const p = useHorarioPendente()
  // a página monta a lista pessoal na aba Minhas pelo critério da aba (login > apelido)
  const minhas = eu ? p.itens.filter((i) => anestesistaDoCasoEh(i.caso, eu)).sort(compararPendencias) : null
  return <FaixaHorarioPendente pendencias={p} podeEditar minhas={minhas} />
}
const montar = (eu) => render(<ThemeProvider><Tela eu={eu} /></ThemeProvider>)
const faixa = () => screen.queryByRole('button', { name: /^Horário pendente:/ })

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }) })
afterEach(() => vi.useRealTimers())

describe('a faixa: quando aparece', () => {
  it('turno da manhã encerrado (13h) com cirurgia sem início → faixa com o nome e a conta', () => {
    agoraEm('13:05')
    contexto({ unimed: escala([caso()]) })
    montar()
    const f = faixa()
    expect(f).toBeTruthy()
    expect(f.getAttribute('aria-label')).toBe('Horário pendente: 1 cirurgia de 1 anestesista. Ver a lista')
    // a pílula visível (a fileira de medida, invisível, repete os nomes)
    expect(within(f).getAllByText('Ana Ribeiro')[0].closest('[aria-hidden]')).toBeNull()
  })

  it('a fileira de MEDIDA não vaza da tela (06/10, Android: folhas abriam fora da tela)', () => {
    // Com os nomes de um dia cheio a fileira invisível passava de 1.000px; o Chrome do
    // Android alarga a página até caber o vazamento e todo `fixed bottom-0` (as folhas
    // do detalhe, da lista, do tempo) ia parar abaixo da tela — escurecia e nada subia.
    // O jsdom não mede layout: a trava é o CORTE no pai posicionado, que é o que
    // impede a fileira absoluta de contar na largura da página.
    agoraEm('13:05')
    contexto({ unimed: escala([caso()]) })
    montar()
    const medida = within(faixa()).getAllByText('Ana Ribeiro')
      .map((el) => el.closest('[aria-hidden="true"]')).find(Boolean)
    expect(medida.className).toMatch(/\babsolute\b/)
    const moldura = medida.parentElement
    expect(moldura.className).toMatch(/\brelative\b/)
    expect(moldura.className).toMatch(/\boverflow-hidden\b/)
  })

  it('antes das 13h, sem liberação e com o início informado, não há faixa', () => {
    agoraEm('12:55')
    contexto({ unimed: escala([caso({ statusCirurgia: 'iniciada', inicioReal: '07:40', terminoReal: null })]) })
    montar()
    expect(faixa()).toBeNull()
  })

  it('liberado na fila, antes do fim do turno → já entra', () => {
    agoraEm('10:00')
    contexto({ unimed: escala([caso()], { liberacoes: { 'matutino:uid-ana': { liberadoEm: 'x' } } }) })
    montar()
    expect(faixa()).toBeTruthy()
  })

  it('o marcador de escalado do repasse NÃO é liberação', () => {
    agoraEm('10:00')
    contexto({ unimed: escala([caso({ statusCirurgia: 'iniciada', inicioReal: '07:40', terminoReal: null })], { liberacoes: { 'matutino:uid-ana': { escalado: true } } }) })
    montar()
    expect(faixa()).toBeNull()
  })

  it('passou 30 min do horário agendado sem início → faixa já no turno, com "Falta início"', () => {
    agoraEm('08:05')
    contexto({ unimed: escala([caso({ statusCirurgia: 'agendada', terminoReal: null })]) })
    montar()
    fireEvent.click(faixa())
    expect(screen.getByText('Falta início')).toBeTruthy()
    expect(screen.getByText(/Passou do horário agendado/)).toBeTruthy()
  })

  it('some com início e término preenchidos, ou com a cirurgia suspensa', () => {
    agoraEm('14:00')
    contexto({ unimed: escala([caso({ inicioReal: '07:40' })]) })
    const { unmount } = montar()
    expect(faixa()).toBeNull()
    unmount()
    contexto({ unimed: escala([caso({ statusCirurgia: 'agendada', terminoReal: null, statusExtra: 'suspensa' })]) })
    montar()
    expect(faixa()).toBeNull()
  })

  it('só vendo HOJE', () => {
    agoraEm('14:00')
    contexto({ unimed: escala([caso()]) }, { data: '2026-10-07' })
    montar()
    expect(faixa()).toBeNull()
  })

  it('a manhã de 05/10 não conta; a tarde de 05/10 conta', () => {
    agoraEm('19:30', '2026-10-05')
    const e = escala([
      caso({ id: 'manha' }),
      caso({ id: 'tarde', turno: 'vespertino', hora: '14:00', anestesista: 'BRUNO', anestesistaUserId: 'uid-bruno' }),
    ], { data: '2026-10-05' })
    contexto({ unimed: e }, { hoje: '2026-10-05', data: '2026-10-05' })
    montar()
    expect(faixa().getAttribute('aria-label')).toMatch(/^Horário pendente: 1 cirurgia de 1 anestesista/)
    expect(within(faixa()).getAllByText('Bruno Lima')[0].closest('[aria-hidden]')).toBeNull()
  })
})

describe('a lista por anestesista', () => {
  it('agrupa por pessoa, quem deve mais primeiro, e cada linha abre a cirurgia no hospital dela', () => {
    agoraEm('13:30')
    contexto({
      unimed: escala([caso({ id: 'u1' }), caso({ id: 'u2', hora: '09:30', statusCirurgia: 'iniciada', inicioReal: '09:35', terminoReal: null })]),
      hro: escala([caso({ id: 'h1', anestesista: 'BRUNO', anestesistaUserId: 'uid-bruno', sala: 'Sala 6' })], { id: 'e-hro', hospital: 'hro' }),
    })
    montar()
    fireEvent.click(faixa())
    const ana = screen.getByRole('region', { name: 'Ana Ribeiro: 2 cirurgias sem horário' })
    const bruno = screen.getByRole('region', { name: 'Bruno Lima: 1 cirurgia sem horário' })
    expect(ana.compareDocumentPosition(bruno) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(ana).getByText('Falta início')).toBeTruthy()
    expect(within(ana).getByText('Falta término')).toBeTruthy()
    expect(within(bruno).getByText('Manhã · HRO · Sala 6')).toBeTruthy()
    fireEvent.click(within(bruno).getByRole('button', { name: /Abrir a cirurgia/ }))
    expect(screen.getByRole('dialog', { name: 'detalhe' }).textContent).toBe('detalhe hro h1')
  })

  it('liberado com a cirurgia ABERTA: "Preencher horário" ou "Colega assumiu"', () => {
    agoraEm('10:00')
    contexto({ unimed: escala([
      caso({ id: 'a1', statusCirurgia: 'agendada', terminoReal: null, hora: '10:30' }),
    ], { liberacoes: { 'matutino:uid-ana': { liberadoEm: 'x' } } }) })
    montar()
    fireEvent.click(faixa())
    expect(screen.getByText('Liberado com a cirurgia aberta')).toBeTruthy()
    expect(screen.getByText('Sem horário')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Colega assumiu' }))
    expect(screen.getByRole('dialog', { name: 'definir' }).textContent).toBe('definir unimed CC - Sala 2 a1')
  })

  it('a cirurgia terminada de quem foi liberado pede só o horário (sem "Colega assumiu")', () => {
    agoraEm('10:00')
    contexto({ unimed: escala([caso()], { liberacoes: { 'matutino:uid-ana': { liberadoEm: 'x' } } }) })
    montar()
    fireEvent.click(faixa())
    expect(screen.queryByText('Liberado com a cirurgia aberta')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Colega assumiu' })).toBeNull()
  })
})

describe('aba Minhas: o detalhamento de quem está logado (dono 05/10)', () => {
  const doDia = () => contexto({
    unimed: escala([
      caso({ id: 'ana2', hora: '09:30', statusCirurgia: 'iniciada', inicioReal: '09:35', terminoReal: null }),
      caso({ id: 'ana1' }),
      caso({ id: 'bru', anestesista: 'BRUNO', anestesistaUserId: 'uid-bruno' }),
    ]),
  })
  const caixa = () => screen.queryByRole('region', { name: /^Você tem/ })

  it('mostra SÓ as cirurgias do login, em ordem de hora, com o atalho para preencher', () => {
    agoraEm('13:30')
    doDia()
    montar({ uid: 'uid-ana', alias: 'Ana' })
    const c = caixa()
    expect(c.getAttribute('aria-label')).toBe('Você tem 2 cirurgias sem horário')
    const linhas = within(c).getAllByRole('button', { name: /^Abrir a cirurgia/ })
    expect(linhas.map((b) => b.getAttribute('aria-label').match(/\d\d:\d\d/)[0])).toEqual(['07:30', '09:30'])
    fireEvent.click(linhas[1])
    expect(screen.getByRole('dialog', { name: 'detalhe' }).textContent).toBe('detalhe unimed ana2')
  })

  it('início vencido: a dica do "Atrasada" sai UMA vez, no cabeçalho da caixa', () => {
    agoraEm('08:30')
    contexto({ unimed: escala([
      caso({ id: 'x1', statusCirurgia: 'agendada', terminoReal: null }),
      caso({ id: 'x2', hora: '07:45', statusCirurgia: 'agendada', terminoReal: null }),
    ]) })
    montar({ uid: 'uid-ana', alias: 'Ana' })
    const c = caixa()
    expect(within(c).getAllByText(/marque Atrasada/)).toHaveLength(1)
  })

  it('o login manda: o apelido igual de outra pessoa não puxa a cirurgia dela', () => {
    agoraEm('13:30')
    doDia()
    montar({ uid: 'uid-outro', alias: 'Bruno' })
    expect(caixa()).toBeNull()
  })

  it('quem não deve nada não vê caixa — a faixa pública continua', () => {
    agoraEm('13:30')
    doDia()
    montar({ uid: 'uid-gabriel', alias: 'Gabriel' })
    expect(caixa()).toBeNull()
    expect(faixa()).toBeTruthy()
  })
})

describe('o selo no card da cirurgia', () => {
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
