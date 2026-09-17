/**
 * A FILA ESPELHA A COMPLETA (dono 16/09/2026, 16h15, com a tarde no ar):
 *
 *  · "há anestesista (Karine) sem os procedimentos informados na aba completa" —
 *    a Louise liberou a Karine e desfez; a marca `renovado` do desfazer escondia
 *    a Accurata EM CURSO. Regra: cirurgia ABERTA neste turno vence a marca; sem
 *    cirurgia aberta a marca segue valendo (nada de "…" de escala que já acabou).
 *
 *  · "Romulo também está sem informações sobre procedimentos" — emprestado ao
 *    HRO num caso SEM cirurgião (C.O, 04 cesáreas): o card dizia só "Ajuda Sala
 *    7/HRO" e um "…". Sem cirurgião, o PROCEDIMENTO diz o que a pessoa faz lá.
 *
 *  · "Anestesista da SRPA está com a informação duplicada" — a posição vira caso
 *    sem hora nem procedimento; o card dizia "SRPA", depois "— —", depois "SRPA"
 *    na sala. Cada informação aparece UMA vez: título do grupo; a linha da
 *    cirurgia só existe se acrescenta algo (hora); a sala igual ao título sai.
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'

const ROSTER = [
  { uid: 'uid-lou', nome: 'LOUISE WARNAVA', apelidos: ['LOUISE'] },
  { uid: 'uid-kar', nome: 'KARINE BEDIN', apelidos: ['KARINE'] },
  { uid: 'uid-rom', nome: 'RÔMULO ROXO', apelidos: ['ROMULO'] },
  { uid: 'uid-joa', nome: 'JOÃO RICARDO MOREIRA', apelidos: ['JOAO RICARDO'] },
  { uid: 'uid-raq', nome: 'RAQUEL FELICIANI', apelidos: ['RAQUEL'] },
  { uid: 'uid-mat', nome: 'MATHEUS CUNHA', apelidos: ['MATHEUS'] },
]
const APELIDO_UID = Object.fromEntries(ROSTER.flatMap((r) => r.apelidos.map((a) => [a, r.uid])))

vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: ROSTER,
    rosterByUid: new Map(ROSTER.map((r) => [r.uid, r])),
    options: ROSTER.map((r) => ({ value: r.uid, label: r.nome })),
    aliases: [], loading: false,
    resolver: (nome) => APELIDO_UID[String(nome || '').trim().toUpperCase()] || null,
    upsertAlias: vi.fn(), refresh: vi.fn(), removeAlias: vi.fn(),
  }),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({
  default: { reservarAvisoTempo: vi.fn(async () => false), fetchLocaisHospital: vi.fn(async () => []) },
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-09-16T15:00:00-03:00'))
})
afterAll(() => vi.useRealTimers())

const cardDe = (nome) => screen.getByLabelText(`Editar local/cirurgião de ${nome}`).closest('[data-linha]')
const textoDe = (nome) => cardDe(nome).textContent
const vezes = (texto, palavra) => texto.split(palavra).length - 1

const escalaCom = (casos, extra = {}) => ({
  id: 'e-uni', hospital: 'unimed', data: '2026-09-16',
  ordemLiberacao: { vespertino: ['LOUISE', 'KARINE', 'ROMULO', 'JOAO RICARDO', 'RAQUEL'] },
  ajudaExterna: {}, liberacoes: {}, linhaOverrides: {},
  casos,
  ...extra,
})
const montar = (escala, props = {}) => render(
  <LiberacoesView escala={escala} hospital="unimed" hospitalLabel="Unimed" turno="vespertino"
    canEdit onToggle={() => {}} onSetOverride={() => {}} {...props} />,
  { wrapper: wrap },
)
const accurata = (statusCirurgia) => ({
  id: 'c-kar', sala: 'Accurata', ordem: 0, hora: '13:30', anestesista: 'KARINE', anestesistaUserId: 'uid-kar',
  cirurgiao: 'RONEY', procedimento: '03 FACO', bloco: 'accurata', turno: 'vespertino', statusCirurgia,
})

describe('Karine — a marca `renovado` (desfazer liberação) não esconde cirurgia aberta', () => {
  const renovada = { linhaOverrides: { 'vespertino:uid-kar': { renovado: true, por: 'uid-lou', em: '2026-09-16T18:57:28Z' } } }

  it('com a Accurata EM CURSO, o card mostra o cirurgião e a cirurgia, como a Completa', () => {
    montar(escalaCom([accurata('iniciada')], renovada))
    const t = textoDe('Karine Bedin')
    expect(t).toMatch(/Roney/)
    expect(t).toMatch(/13:30/)
    expect(t).not.toMatch(/…/)
  })

  it('com a Accurata TERMINADA, a marca segue valendo: nada derivado, nem "…"', () => {
    montar(escalaCom([accurata('terminada')], renovada))
    const t = textoDe('Karine Bedin')
    expect(t).not.toMatch(/Roney/)
    expect(t).not.toMatch(/13:30/)
    expect(t).not.toMatch(/…/)
  })

  it('sem a marca, a cirurgia aberta já aparecia — a correção não muda esse card', () => {
    montar(escalaCom([accurata('iniciada')]))
    expect(textoDe('Karine Bedin')).toMatch(/Roney/)
  })
})

describe('Rômulo — emprestado a um caso SEM cirurgião: o procedimento diz o que ele faz lá', () => {
  // a escala daqui tem cirurgia (a da plantonista); a do Rômulo está no HRO
  const daLouise = {
    id: 'c-lou', sala: 'CC - Sala 2', ordem: 0, hora: '13:00', anestesista: 'LOUISE', anestesistaUserId: 'uid-lou',
    cirurgiao: 'IVANOR ALBA', procedimento: 'COLECISTECTOMIA', bloco: 'normal', turno: 'vespertino', statusCirurgia: 'agendada',
  }
  // o que `presencaOutros` carrega da escala do HRO (page): sala, cirurgião e procedimento
  const noHro = [{
    nome: 'ROMULO', uid: 'uid-rom', hospital: 'hro', hospitalLabel: 'HRO',
    sala: 'Sala 7', cirurgiao: '', procedimento: 'CENTRO OBSTETRICO – 04 CESAREAS',
  }]

  it('o card diz o destino E o procedimento, sem o "…" de cirurgião desconhecido', () => {
    montar(escalaCom([daLouise]), { presencaOutros: noHro })
    const t = textoDe('Rômulo Roxo')
    expect(t).toMatch(/Ajuda Sala 7\/HRO/)
    expect(t).toMatch(/04 cesareas/i)
    expect(t).not.toMatch(/…/)
  })

  it('com cirurgião no caso de lá, continua o nome do cirurgião (30/08), não o procedimento', () => {
    montar(escalaCom([daLouise]), { presencaOutros: [{ ...noHro[0], cirurgiao: 'Mauricio Fabiani' }] })
    const t = textoDe('Rômulo Roxo')
    expect(t).toMatch(/Mauricio Fabiani/)
    expect(t).not.toMatch(/04 cesareas/i)
  })
})

describe('SRPA e Consultório — cada informação uma vez só', () => {
  const srpa = {
    id: 'c-srpa', sala: 'SRPA', ordem: 0, hora: '', anestesista: 'JOAO RICARDO', anestesistaUserId: 'uid-joa',
    cirurgiao: null, procedimento: null, bloco: 'srpa', turno: 'vespertino', statusCirurgia: 'agendada',
  }
  const consultorio = {
    id: 'c-cons', sala: 'Consultório', ordem: 0, hora: '13:30', anestesista: 'RAQUEL', anestesistaUserId: 'uid-raq',
    cirurgiao: null, procedimento: 'CONSULTORIO', bloco: 'consultorio', turno: 'vespertino', statusCirurgia: 'agendada',
  }

  it('posição assistencial: "SRPA" aparece uma vez, sem linha "— —" nem sala repetida', () => {
    montar(escalaCom([srpa]))
    const t = textoDe('João Moreira')
    expect(vezes(t, 'SRPA')).toBe(1)
    expect(t).not.toMatch(/—/)
  })

  it('SRPA mais uma cirurgia de verdade: a sala da cirurgia fica, a "SRPA" da sala sai', () => {
    const cesarea = {
      id: 'c-ces', sala: 'CO - Cesárea', ordem: 0, hora: '', anestesista: 'JOAO RICARDO', anestesistaUserId: 'uid-joa',
      cirurgiao: 'SCOTTINI', procedimento: 'CESARIANA', bloco: 'normal', turno: 'vespertino', statusCirurgia: 'agendada',
    }
    montar(escalaCom([srpa, cesarea]))
    const t = textoDe('João Moreira')
    expect(vezes(t, 'SRPA')).toBe(1)
    expect(t).toMatch(/Scottini/)
    expect(t).toMatch(/CO - Cesárea/)
    expect(t).not.toMatch(/CO - Cesárea\/SRPA/)
  })

  it('consultório com hora: "Consultório" uma vez e a hora fica', () => {
    montar(escalaCom([consultorio]))
    const t = textoDe('Raquel Feliciani')
    expect(vezes(t, 'Consultório')).toBe(1)
    expect(t).toMatch(/13:30/)
  })
})

// ── CARD NOTURNO SEM "Ajuda (HRO)" (dono 16/09, 20h35, caso Matheus) ──────────
// "matheus é P3 hoje a noite, foi escalado numa sala e surgiu o badge como
// ajuda, e não há como retirar a marcação de ajuda, matheus não é ajuda!!".
// Matheus estava no rodapé da TARDE do HRO (7º) e ganhou a Artrodese das 19h30
// na Unimed: na fila da tarde da Unimed ele é extra com origem derivada HRO — e
// aí o badge "Ajuda (HRO)" é legítimo. Às 19h ele vira P3 e o card noturno
// herda a linha do dia: o badge tem de sumir, porque plantão não é ajuda.
describe('card noturno de quem estava no rodapé de outro hospital (dono 16/09)', () => {
  const artrodese = {
    id: 'c-mat', sala: 'CC - Sala 3', ordem: 0, hora: '19:30', anestesista: 'MATHEUS', anestesistaUserId: 'uid-mat',
    cirurgiao: 'CLEITON PIEKALA', procedimento: 'ARTRODESE DA COLUNA VERTEBRAL', turno: 'vespertino', statusCirurgia: 'agendada',
  }
  const daLouise = {
    id: 'c-lou', sala: 'CC - Sala 7', ordem: 0, hora: '14:00', anestesista: 'LOUISE', anestesistaUserId: 'uid-lou',
    cirurgiao: 'MAURICIO FABIANI', procedimento: 'MANGUITO', turno: 'vespertino', statusCirurgia: 'iniciada',
  }
  // o que a página cruza do HRO: Matheus no rodapé da tarde de lá (7º)
  const rodapeHro = [{ nome: 'MATHEUS', uid: null, hospital: 'hro', hospitalLabel: 'HRO', rodapeIdx: 6 }]
  const plantoes = [{ setor: 'P3', nome: 'MATHEUS CUNHA' }]
  const cardComTexto = (t) => [...document.querySelectorAll('[data-linha]')].find((el) => el.textContent.includes(t))

  afterEach(() => vi.setSystemTime(new Date('2026-09-16T15:00:00-03:00')))

  it('DE DIA (15h) a linha extra dele diz de onde veio: "Ajuda (HRO)"', () => {
    montar(escalaCom([daLouise, artrodese]), { presencaOutros: rodapeHro, plantoes })
    const card = cardComTexto('Matheus Cunha')
    expect(card).toBeTruthy()
    expect(card.textContent).toContain('Ajuda (HRO)')
  })

  it('À NOITE (20h) o card P3 dele NÃO tem "Ajuda (HRO)" — e mantém a sala e o cirurgião', () => {
    vi.setSystemTime(new Date('2026-09-16T20:35:00-03:00'))
    montar(escalaCom([daLouise, artrodese]), { presencaOutros: rodapeHro, plantoes })
    const card = cardComTexto('Matheus Cunha')
    expect(card).toBeTruthy()
    expect(card.textContent).toContain('P3')
    expect(card.textContent).not.toContain('Ajuda (HRO)')
    expect(card.textContent).not.toMatch(/Ajuda/)
    expect(card.textContent).toContain('Cleiton Piekala')
    expect(card.textContent).toContain('19:30')
    expect(card.textContent).toContain('CC - Sala 3')
  })
})
