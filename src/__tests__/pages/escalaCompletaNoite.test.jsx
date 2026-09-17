/**
 * LIMPEZA NA VIRADA DAS 19h (dono 17/09: "na transição da escala da tarde para
 * noite, quero que exclua todos os procedimentos terminados e/ou suspensos [...]
 * a partir das 19 seguem os procedimentos da tarde que ainda não terminaram e
 * urgências").
 *
 * ⚠️ É um EVENTO da virada, não um filtro contínuo (2ª rodada, mesmo dia: "após
 * as 19h selecionar 'terminada' não deve excluir da aba completa, deve
 * permanecer assim como é nos outros turnos"). Quem já estava concluído às 19h
 * sai; quem conclui depois fica.
 *
 * O que este teste protege:
 *  1. `visaoNoturna` é do RELÓGIO e da DATA: 19:00 de HOJE liga, 18:59 não,
 *     outra data nunca, e só sobre os casos da TARDE.
 *  2. `concluidoAntesDaNoite` lê o carimbo certo de cada eixo: terminada pelo
 *     `statusAtualizadoEm`, suspensa (extra) pelo `updatedAt`; sem carimbo conta
 *     como antes; carimbo de ontem conta como antes.
 *  3. Na Completa, o que já estava fechado às 19h some (e a sala junto); o que
 *     terminou/suspendeu DEPOIS das 19h continua no quadro.
 *  4. Com tudo limpo, o "Adicionar caso" NÃO some com o quadro — é a hora da
 *     urgência. O vazio é o noturno, não o "troque para o outro turno".
 *  5. A Minhas segue a mesma regra, com o vazio dizendo o porquê.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import BoardView from '@/pages/escala-cirurgica/BoardView'
import MinhasEscalasView from '@/pages/escala-cirurgica/MinhasEscalasView'
import { concluidoAntesDaNoite, limparConcluidosNaVirada, visaoNoturna } from '@/pages/escala-cirurgica/utils'

const HOJE = '2026-09-17' // quinta
// Carimbos com fuso explícito — a suíte roda em America/Sao_Paulo (-03:00 em setembro).
const as = (hhmm, dia = HOJE) => `${dia}T${hhmm}:00-03:00`

// Relógio controlável por teste.
const { relogio } = vi.hoisted(() => ({ relogio: { min: 19 * 60 + 30 } }))
vi.mock('@/pages/escala-cirurgica/useAgoraMinuto', () => ({ default: () => relogio.min }))

vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({
    atualizarCaso: vi.fn(async () => {}),
    setStatusCirurgia: vi.fn(async () => {}),
    setAnestesistaCasos: vi.fn(async () => {}),
    adicionarAjuda: vi.fn(async () => {}),
    removerAjuda: vi.fn(async () => {}),
  }),
  useEscalaCirurgica: () => ({ hoje: HOJE, escalas: {}, data: HOJE, loading: false }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
// anestesiologista está em PAPEIS_COM_ACESSO do gate → canEdit verdadeiro
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'uid-melo', role: 'anestesiologista', displayName: 'Melo' } }),
}))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({ options: [], rosterByUid: new Map(), resolver: () => null, loading: false }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const caso = (over = {}) => ({
  id: 'c1', sala: 'Sala 2', ordem: 0, hora: '13:30', turno: 'vespertino',
  pacienteIniciais: 'D.P.', idade: '75a', procedimento: 'ARTROPLASTIA TOTAL PRIMÁRIA DO QUADRIL',
  cirurgiao: 'MAURICIO SANAGIOTTO', anestesista: 'MELO', convenio: 'SUS',
  statusCirurgia: 'agendada', ...over,
})
const escalaCom = (casos, data = HOJE) => ({ id: 'e1', hospital: 'unimed', data, ajudaExterna: {}, casos })

const renderBoard = (casos, { data = HOJE, turno = 'vespertino' } = {}) => render(
  <BoardView escala={escalaCom(casos, data)} meuAlias="MELO" meuUid="uid-melo" turno={turno} />,
  { wrapper: wrap },
)
const renderMinhas = (casos, { data = HOJE, turno = 'vespertino' } = {}) => render(
  <MinhasEscalasView escala={escalaCom(casos, data)} meuAlias="MELO" meuUid="uid-melo" turno={turno} onVerBoard={() => {}} />,
  { wrapper: wrap },
)

// A tarde de um dia real, vista às 19:30:
//   A.B. iniciada · C.D. agendada · E.F./G.H. terminadas às 15h/17h numa sala que
//   já fechou · I.J. suspensa às 14:30 · K.L. urgência iniciada ·
//   M.N. terminada às 19:20 (DEPOIS da virada) · O.P. suspensa às 19:10 (idem)
const tardeCheia = () => [
  caso({ id: 'c1', sala: 'Sala 2', hora: '13:30', statusCirurgia: 'iniciada', statusAtualizadoEm: as('13:40'), pacienteIniciais: 'A.B.' }),
  caso({ id: 'c2', sala: 'Sala 2', hora: '16:00', statusCirurgia: 'agendada', pacienteIniciais: 'C.D.' }),
  caso({ id: 'c3', sala: 'Sala 5', hora: '13:00', statusCirurgia: 'terminada', statusAtualizadoEm: as('15:00'), pacienteIniciais: 'E.F.' }),
  caso({ id: 'c4', sala: 'Sala 5', hora: '15:00', statusCirurgia: 'terminada', statusAtualizadoEm: as('17:00'), pacienteIniciais: 'G.H.' }),
  caso({ id: 'c5', sala: 'Sala 7', hora: '14:00', statusExtra: 'suspensa', updatedAt: as('14:30'), pacienteIniciais: 'I.J.' }),
  caso({ id: 'c6', sala: 'Sala 9', hora: '18:40', tipo: 'urgencia', statusCirurgia: 'iniciada', statusAtualizadoEm: as('18:45'), pacienteIniciais: 'K.L.' }),
  caso({ id: 'c7', sala: 'Sala 3', hora: '16:30', statusCirurgia: 'terminada', statusAtualizadoEm: as('19:20'), pacienteIniciais: 'M.N.' }),
  caso({ id: 'c8', sala: 'Sala 4', hora: '17:00', statusExtra: 'suspensa', updatedAt: as('19:10'), pacienteIniciais: 'O.P.' }),
]
const TODAS = ['A.B.', 'C.D.', 'E.F.', 'G.H.', 'I.J.', 'K.L.', 'M.N.', 'O.P.']
const iniciaisNaTela = () => TODAS.filter((i) => screen.queryByText(i))

beforeEach(() => { relogio.min = 19 * 60 + 30 })

describe('visaoNoturna — relógio, data e turno', () => {
  const base = { dataEscala: HOJE, hojeIso: HOJE, turno: 'vespertino' }
  it('liga às 19:00 de hoje e não antes', () => {
    expect(visaoNoturna({ ...base, agoraMin: 18 * 60 + 59 })).toBe(false)
    expect(visaoNoturna({ ...base, agoraMin: 19 * 60 })).toBe(true)
    expect(visaoNoturna({ ...base, agoraMin: 23 * 60 + 30 })).toBe(true) // segue a noite toda
  })
  it('outra data nunca vira noite; a manhã aberta à noite fica inteira', () => {
    expect(visaoNoturna({ ...base, agoraMin: 20 * 60, dataEscala: '2026-09-16' })).toBe(false)
    expect(visaoNoturna({ ...base, agoraMin: 20 * 60, turno: 'matutino' })).toBe(false)
    expect(visaoNoturna({ ...base, agoraMin: null })).toBe(false)
  })
})

describe('concluidoAntesDaNoite — o carimbo de cada eixo decide', () => {
  const opts = { dataEscala: HOJE }
  it('aberta nunca é "concluída antes", com ou sem carimbo', () => {
    expect(concluidoAntesDaNoite(caso({ statusCirurgia: 'agendada' }), opts)).toBe(false)
    expect(concluidoAntesDaNoite(caso({ statusCirurgia: 'iniciada', statusAtualizadoEm: as('10:00') }), opts)).toBe(false)
    expect(concluidoAntesDaNoite(caso({ statusCirurgia: 'iniciada', statusExtra: 'atrasada' }), opts)).toBe(false)
  })
  it('terminada: statusAtualizadoEm antes das 19h sai, depois fica', () => {
    expect(concluidoAntesDaNoite(caso({ statusCirurgia: 'terminada', statusAtualizadoEm: as('18:59') }), opts)).toBe(true)
    expect(concluidoAntesDaNoite(caso({ statusCirurgia: 'terminada', statusAtualizadoEm: as('19:00') }), opts)).toBe(false)
    // snake_case também (select('*') sem conversão em fixture antiga)
    expect(concluidoAntesDaNoite(caso({ statusCirurgia: 'terminada', status_atualizado_em: as('12:00') }), opts)).toBe(true)
  })
  it('suspensa (extra) NÃO carimba o status — usa o updatedAt do toggle', () => {
    expect(concluidoAntesDaNoite(caso({ statusExtra: 'suspensa', updatedAt: as('15:00') }), opts)).toBe(true)
    expect(concluidoAntesDaNoite(caso({ statusExtra: 'suspensa', updatedAt: as('19:05') }), opts)).toBe(false)
    expect(concluidoAntesDaNoite(caso({ statusExtra: 'suspensa', updated_at: as('15:00') }), opts)).toBe(true)
    // um statusAtualizadoEm antigo (do "iniciada" das 10h) NÃO é a hora da suspensão
    expect(concluidoAntesDaNoite(caso({ statusCirurgia: 'iniciada', statusAtualizadoEm: as('10:00'), statusExtra: 'suspensa', updatedAt: as('19:15') }), opts)).toBe(false)
  })
  it('"suspensa" legada no eixo principal lê o carimbo do eixo principal', () => {
    expect(concluidoAntesDaNoite(caso({ statusCirurgia: 'suspensa', statusAtualizadoEm: as('16:00'), updatedAt: as('19:30') }), opts)).toBe(true)
  })
  it('sem carimbo, carimbo inválido ou de ontem: já estava concluída', () => {
    expect(concluidoAntesDaNoite(caso({ statusCirurgia: 'terminada' }), opts)).toBe(true)
    expect(concluidoAntesDaNoite(caso({ statusCirurgia: 'terminada', statusAtualizadoEm: 'xx' }), opts)).toBe(true)
    expect(concluidoAntesDaNoite(caso({ statusCirurgia: 'terminada', statusAtualizadoEm: as('21:00', '2026-09-16') }), opts)).toBe(true)
  })
  it('limparConcluidosNaVirada mantém as abertas e as concluídas DEPOIS das 19h', () => {
    expect(limparConcluidosNaVirada(tardeCheia(), opts).map((c) => c.pacienteIniciais))
      .toEqual(['A.B.', 'C.D.', 'K.L.', 'M.N.', 'O.P.'])
  })
})

describe('Completa na virada das 19h', () => {
  it('às 19:30 some o que já estava fechado às 19h (e a sala junto); o que fechou depois fica', () => {
    renderBoard(tardeCheia())
    expect(iniciaisNaTela()).toEqual(['A.B.', 'C.D.', 'K.L.', 'M.N.', 'O.P.'])
    expect(screen.queryByText('Sala 5')).toBeNull() // só tinha terminadas da tarde
    expect(screen.queryByText('Sala 7')).toBeNull() // só tinha a suspensa das 14:30
    expect(screen.getByText('Sala 3')).toBeTruthy() // terminada às 19:20 continua
    expect(screen.getByText('Sala 4')).toBeTruthy() // suspensa às 19:10 continua
    // e continua com o selo de estado, como em qualquer turno
    expect(screen.getAllByText('Terminada').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Suspensa').length).toBeGreaterThan(0)
  })

  it('às 18:30 o quadro está inteiro — terminadas e suspensas ainda aparecem', () => {
    relogio.min = 18 * 60 + 30
    renderBoard(tardeCheia())
    expect(iniciaisNaTela()).toEqual(TODAS)
  })

  it('a escala de OUTRA data fica inteira mesmo às 19:30', () => {
    renderBoard(tardeCheia(), { data: '2026-09-16' })
    expect(iniciaisNaTela()).toEqual(TODAS)
  })

  it('a manhã consultada à noite fica inteira', () => {
    const manha = tardeCheia().map((c) => ({ ...c, turno: 'matutino', hora: c.hora.replace(/^1[3-8]/, '08') }))
    renderBoard(manha, { turno: 'matutino' })
    expect(iniciaisNaTela()).toEqual(TODAS)
  })

  it('tudo limpo na virada: o vazio é o noturno e o "Adicionar caso" fica de pé', () => {
    renderBoard([
      caso({ id: 'c3', statusCirurgia: 'terminada', statusAtualizadoEm: as('15:00'), pacienteIniciais: 'E.F.' }),
      caso({ id: 'c5', statusExtra: 'suspensa', updatedAt: as('14:30'), pacienteIniciais: 'I.J.' }),
    ])
    expect(screen.getByText('Nenhuma cirurgia em andamento')).toBeTruthy()
    expect(screen.queryByText('Nenhum caso neste turno')).toBeNull()
    expect(screen.getByRole('button', { name: /Adicionar caso/ })).toBeTruthy()
    // sem sala não há o que recolher
    expect(screen.queryByRole('button', { name: /Recolher todas|Expandir todas/ })).toBeNull()
  })

  it('de dia, o turno sem caso continua com o vazio de sempre', () => {
    relogio.min = 15 * 60
    renderBoard([caso({ turno: 'matutino', hora: '08:00' })])
    expect(screen.getByText('Nenhum caso neste turno')).toBeTruthy()
  })
})

describe('Minhas na virada das 19h', () => {
  it('às 19:30 mostra as minhas ainda abertas e as que fecharam depois das 19h', () => {
    renderMinhas(tardeCheia())
    expect(iniciaisNaTela()).toEqual(['A.B.', 'C.D.', 'K.L.', 'M.N.', 'O.P.'])
  })

  it('todas as minhas já tinham fechado: o vazio diz isso, não "você não está escalado"', () => {
    renderMinhas([caso({ id: 'c3', statusCirurgia: 'terminada', statusAtualizadoEm: as('15:00'), pacienteIniciais: 'E.F.' })])
    expect(screen.getByText('Nenhuma cirurgia sua em andamento')).toBeTruthy()
    expect(screen.queryByText('Você não está escalado aqui')).toBeNull()
  })

  it('sem caso meu nenhum, o vazio segue o de sempre', () => {
    renderMinhas([caso({ id: 'x', anestesista: 'GABRIEL', statusCirurgia: 'terminada', statusAtualizadoEm: as('15:00') })])
    expect(screen.getByText('Você não está escalado aqui')).toBeTruthy()
  })

  it('às 18:30 as terminadas ainda aparecem', () => {
    relogio.min = 18 * 60 + 30
    renderMinhas(tardeCheia())
    expect(iniciaisNaTela()).toEqual(TODAS)
  })
})
