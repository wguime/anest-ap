/**
 * ANTES DE LIBERAR (dono 14/10/2026) — modelo A de `.tmp/liberar-com-cirurgia-aberta.html`,
 * SEM a saída "Liberar sem horário": "não deve ser possível liberar sem preenchimento das
 * informações". Quem tem cirurgia aberta ou sem início/término no turno só é liberado
 * depois de preencher os horários ou passar a cirurgia aberta a um colega.
 *
 * E a medida C, na mesma conversa: "não seja possível colocar apenas terminado, deve
 * obrigatoriamente colocar o início da cirurgia" — o término de uma cirurgia sem início
 * pede os DOIS.
 *
 * Origem: 14/10, Unimed manhã — Gustavo cedeu a posição ao Rômulo e a dupla terminada
 * dele o trouxe de volta à fila como "Ajuda · Livre · Próximo" (fix fe00274e). Medido de
 * 06 a 13/10: 54% das liberações de quem operou deixaram cirurgia sem horário.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'
import CasoDetalheSheet from '@/pages/escala-cirurgica/CasoDetalheSheet'
import { nomeCurtoProcedimento } from '@/lib/escalaProcedimentoCurto'

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

const COLE = 'COLECISTECTOMIA VIDEOLAPAROSCOPICA'
const HERNIA = 'HERNIORRAFIA INGUINAL'
const rot = (p) => nomeCurtoProcedimento(p)
const base = { sala: 'CC - Sala 3', anestesista: 'PAULO', anestesistaUserId: 'uid-paulo', cirurgiao: 'Marcos Zanella', turno: 'vespertino', bloco: 'normal' }
// a cirurgia da ANA (1ª do rodapé) — fica na fila e é por ela que o Paulo é o próximo
const daAna = { ...base, id: 'a1', ordem: 0, sala: 'CC - Sala 1', hora: '13:00', procedimento: HERNIA, anestesista: 'ANA', anestesistaUserId: 'uid-ana', statusCirurgia: 'iniciada', inicioReal: '13:10' }
const emCurso = { ...base, id: 'c1', ordem: 1, hora: '13:30', procedimento: COLE, statusCirurgia: 'iniciada', inicioReal: '14:05' }
const semInicio = { ...base, id: 'c0', ordem: 0, hora: '13:00', procedimento: HERNIA, statusCirurgia: 'terminada', terminoReal: '13:50' }
const completa = { ...semInicio, inicioReal: '13:05' }
const escalaDe = (casos) => ({
  id: 'e1', hospital: 'unimed', data: '2026-10-02', status: 'publicada',
  ordemLiberacao: { vespertino: ['ANA', 'PAULO'] }, ajudaExterna: {}, liberacoes: {}, linhaOverrides: {}, casos,
})

const montarFila = (casos, props = {}) => {
  const onToggle = vi.fn(async () => {})
  const onDefinirTerminoRealCaso = vi.fn(async () => {})
  const onDefinirInicioCaso = vi.fn(async () => {})
  const onDefinirCasos = vi.fn(async () => {})
  const onSuspenderCaso = vi.fn(async () => {})
  const todas = { onToggle, onDefinirTerminoRealCaso, onDefinirInicioCaso, onDefinirCasos, onSuspenderCaso, ...props }
  const ui = (cs) => (
    <LiberacoesView escala={escalaDe(cs)} hospital="unimed" hospitalLabel="Unimed" turno="vespertino"
      canEdit onSetOverride={() => {}} {...todas} />
  )
  const r = render(ui(casos), { wrapper: wrap })
  return { ...todas, rerender: (cs) => r.rerender(ui(cs)) }
}
const tocarLiberar = () => fireEvent.click(screen.getByRole('button', { name: 'Marcar Paulo Tonini liberado' }))
const folhaAntesOuNada = () => screen.queryAllByRole('dialog').find((d) => d.textContent.includes('Antes de liberar')) || null
const folhaAntes = () => {
  const f = folhaAntesOuNada()
  if (!f) throw new Error('folha "Antes de liberar" não abriu')
  return f
}
const folhaDeCima = () => { const d = screen.getAllByRole('dialog'); return d[d.length - 1] }
const digitar = (slot, valor) => {
  const campo = document.querySelector(`[data-slot="${slot}"] input`) || document.querySelector(`[data-slot="${slot}"]`)
  fireEvent.change(campo, { target: { value: valor } })
}

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-10-02T15:45:00-03:00'))
})
afterAll(() => vi.useRealTimers())
beforeEach(() => vi.clearAllMocks())

describe('o toque em liberar é segurado quando falta horário', () => {
  it('cirurgia aberta + terminada sem início: abre a folha, NÃO libera, e o botão fica apagado', () => {
    const { onToggle } = montarFila([daAna, semInicio, emCurso])
    tocarLiberar()
    expect(onToggle).not.toHaveBeenCalled()
    const folha = folhaAntes()
    expect(folha.textContent).toContain('2 cirurgias estão sem horário. Preencha aqui ou passe a que está aberta para quem vai assumir.')
    const botao = within(folha).getByRole('button', { name: 'Preencha 2 cirurgias para liberar' })
    expect(botao.disabled).toBe(true)
    // sem saída: não existe "liberar sem horário" (dono 14/10)
    expect(within(folha).queryByRole('button', { name: /sem horário/i })).toBeNull()
    // a aberta pode passar a um colega; a terminada, não
    expect(within(folha).getAllByRole('button', { name: /Passar para outro anestesista/ })).toHaveLength(1)
  })

  it('preenchidos os horários (realtime), a folha acende e "Salvar e liberar" libera pelo caminho normal', async () => {
    const { onToggle, rerender } = montarFila([daAna, semInicio, emCurso])
    tocarLiberar()
    rerender([daAna, completa, { ...emCurso, statusCirurgia: 'terminada', terminoReal: '15:40' }])
    const folha = folhaAntes()
    expect(folha.textContent).toContain('Tudo preenchido. Confira e libere.')
    fireEvent.click(within(folha).getByRole('button', { name: 'Salvar e liberar Paulo' }))
    await waitFor(() => expect(onToggle).toHaveBeenCalledTimes(1))
    expect(onToggle.mock.calls[0][0].anestesista).toBe('Paulo Tonini')
  })

  it('cirurgia passada a outro anestesista sai da conta e aparece como "Passada para"', () => {
    const { rerender } = montarFila([daAna, emCurso])
    tocarLiberar()
    rerender([daAna, { ...emCurso, anestesista: 'ANA', anestesistaUserId: 'uid-ana' }])
    const folha = folhaAntes()
    expect(folha.textContent).toContain('Passada para Ana')
    expect(within(folha).getByRole('button', { name: 'Salvar e liberar Paulo' }).disabled).toBe(false)
  })

  it('nada pendente: libera direto, como sempre', async () => {
    const { onToggle } = montarFila([daAna, completa])
    tocarLiberar()
    await waitFor(() => expect(onToggle).toHaveBeenCalledTimes(1))
    expect(folhaAntesOuNada()).toBeNull()
  })

  it('a cirurgia que SEGUE com outra pessoa não trava: "passa para a tarde" e a dupla aberta', async () => {
    const passa = { ...emCurso, statusExtra: 'passa_tarde' }
    const dupla = { ...emCurso, id: 'c9', ordem: 2, anestesista: 'PAULO + ANA', anestesistaUserId: null }
    const { onToggle } = montarFila([daAna, passa, dupla])
    tocarLiberar()
    await waitFor(() => expect(onToggle).toHaveBeenCalledTimes(1))
  })

  it('quem não edita a escala não vê folha (o toque segue a regra de sempre)', async () => {
    const { onToggle } = montarFila([daAna, emCurso], { canEdit: false })
    const botao = screen.queryByRole('button', { name: 'Marcar Paulo Tonini liberado' })
    if (botao) fireEvent.click(botao)
    expect(folhaAntesOuNada()).toBeNull()
    expect(onToggle.mock.calls.length).toBeLessThanOrEqual(1)
  })
})

describe('as saídas da folha', () => {
  it('"Passar para outro anestesista" é BOTÃO e abre os colegas da fila: um toque escolhe e grava', async () => {
    const { onDefinirCasos } = montarFila([daAna, emCurso])
    tocarLiberar()
    fireEvent.click(within(folhaAntes()).getByRole('button', { name: /Passar para outro anestesista/ }))
    const folha = folhaDeCima()
    expect(within(folha).getByText('Quem assume a cirurgia?')).toBeTruthy()
    const colegas = within(folha).getByRole('radiogroup', { name: 'Colegas da fila' })
    // a própria pessoa que sai nunca aparece; a Ana (em sala) aparece com onde está
    expect(within(colegas).queryByText('Paulo Tonini')).toBeNull()
    const ana = within(colegas).getByRole('radio', { name: /Ana Lima/ })
    expect(ana.textContent).toContain('CC - Sala 1')
    expect(within(folha).getByRole('button', { name: 'Escolha quem assume' }).disabled).toBe(true)
    fireEvent.click(ana)
    fireEvent.click(within(folha).getByRole('button', { name: 'Passar para Ana' }))
    await waitFor(() => expect(onDefinirCasos).toHaveBeenCalled())
    expect(onDefinirCasos.mock.calls[0][0]).toEqual(['c1'])
    expect(onDefinirCasos.mock.calls[0][1]).toMatchObject({ uid: 'uid-ana' })
  })

  it('agendada que não aconteceu: "Não aconteceu (suspensa)" grava a suspensão', () => {
    const agendada = { ...emCurso, statusCirurgia: 'agendada', inicioReal: null, hora: '15:00' }
    const { onSuspenderCaso } = montarFila([daAna, agendada])
    tocarLiberar()
    fireEvent.click(within(folhaAntes()).getByRole('button', { name: 'Não aconteceu (suspensa)' }))
    expect(onSuspenderCaso).toHaveBeenCalledWith('c1')
  })

  it('TÉRMINO de uma cirurgia sem início pede os DOIS e grava o início junto', async () => {
    const { onDefinirTerminoRealCaso } = montarFila([daAna, { ...semInicio, terminoReal: null, statusCirurgia: 'iniciada' }])
    tocarLiberar()
    fireEvent.click(within(folhaAntes()).getByRole('button', { name: `Término de 13:00 ${rot(HERNIA)}: não informado` }))
    const conf = folhaDeCima()
    expect(within(conf).getByText(`Início e término · 13:00 ${rot(HERNIA)}`)).toBeTruthy()
    const botao = within(conf).getByRole('button', { name: 'Confirmar os dois' })
    expect(botao.disabled).toBe(true)
    // atalho da hora agendada
    fireEvent.click(within(conf).getByRole('button', { name: '13:00 agendada' }))
    fireEvent.click(botao)
    await waitFor(() => expect(onDefinirTerminoRealCaso).toHaveBeenCalledWith('c0', '15:45', { inicioReal: '13:00' }))
  })

  it('início no futuro é recusado com a frase de sempre, e nada é gravado', () => {
    const { onDefinirTerminoRealCaso } = montarFila([daAna, { ...semInicio, terminoReal: null, statusCirurgia: 'iniciada' }])
    tocarLiberar()
    fireEvent.click(within(folhaAntes()).getByRole('button', { name: `Término de 13:00 ${rot(HERNIA)}: não informado` }))
    digitar('inicio-hora', '1600')
    digitar('termino-real-hora', '1530')
    fireEvent.click(within(folhaDeCima()).getByRole('button', { name: 'Confirmar os dois' }))
    expect(within(folhaDeCima()).getByRole('alert').textContent).toBe('O início não pode ser depois de agora.')
    expect(onDefinirTerminoRealCaso).not.toHaveBeenCalled()
  })
})

describe('medida C no detalhe do caso: não existe "só terminada" sem início', () => {
  const detalhe = (caso) => render(
    <CasoDetalheSheet escala={escalaDe([caso])} caso={caso} turno="vespertino" onClose={vi.fn()} podeEditar onEditarCaso={vi.fn()} />,
    { wrapper: wrap },
  )

  it('agendada → "Terminada" abre "Início e término"; confirmar grava os dois no status', async () => {
    const agendada = { ...emCurso, statusCirurgia: 'agendada', inicioReal: null }
    detalhe(agendada)
    fireEvent.click(screen.getByRole('button', { name: 'Terminada' }))
    const folha = folhaDeCima()
    expect(within(folha).getByText('Início e término da cirurgia')).toBeTruthy()
    expect(within(folha).queryByRole('button', { name: /^Confirmar término às/ })).toBeNull()
    digitar('inicio-hora', '1400')
    fireEvent.click(within(folha).getByRole('button', { name: 'Confirmar os dois' }))
    await waitFor(() => expect(setStatusCirurgia).toHaveBeenCalled())
    expect(setStatusCirurgia.mock.calls[0].slice(2)).toEqual(['terminada', { userId: 'uid-paulo', terminoReal: '15:45', inicioReal: '14:00' }])
  })

  it('terminada sem início: o bloco TÉRMINO também pede os dois (correção grava pelo caso)', async () => {
    detalhe(semInicio)
    fireEvent.click(screen.getByRole('button', { name: 'Término desta cirurgia: 13:50' }))
    const folha = folhaDeCima()
    digitar('inicio-hora', '1305')
    fireEvent.click(within(folha).getByRole('button', { name: 'Confirmar os dois' }))
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0].slice(1, 3)).toEqual(['c0', { terminoReal: '13:50', inicioReal: '13:05' }])
  })

  it('o início de uma TERMINADA não tem "Limpar horário"', () => {
    detalhe(completa)
    fireEvent.click(screen.getByRole('button', { name: 'Início desta cirurgia: 13:05' }))
    expect(within(folhaDeCima()).queryByRole('button', { name: 'Limpar horário' })).toBeNull()
  })
})
