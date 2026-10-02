/**
 * "Horário da cirurgia" — início e término de cada procedimento (dono 02/10, modelo A
 * escolhido em protótipo `.tmp/inicio-termino-cirurgia.html`): "quero que seja
 * possível adicionar o horário de início e fim de cada procedimento [...] tanto
 * clicando no card do procedimento na aba completa como na aba liberações ao clicar
 * em adicionar tempo [...] quero que essa informação ganhe destaque e que fique acima
 * dos cards de andamento".
 *
 * Travas (todas falham contra o código anterior — o cartão e o bloco INÍCIO não
 * existiam):
 *  · DETALHE DO CASO (Completa, Minhas, Urgências): o cartão vem ANTES do Andamento e
 *    o "Término desta cirurgia" saiu do Andamento; informar o início de uma cirurgia
 *    agendada a marca como iniciada; corrigir não mexe no status; horário no futuro é
 *    recusado; depois de Terminada o término é o real;
 *  · LIBERAÇÕES (folha do "+ Tempo total"): cada cirurgia tem o INÍCIO ao lado do
 *    TÉRMINO e o toque grava pelo mesmo `onDefinirInicioCaso`;
 *  · SINCRONIA: as duas telas leem o MESMO campo do caso — o horário gravado por uma
 *    (o context devolve a escala nova, como o realtime faz) aparece na outra.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import CasoDetalheSheet from '@/pages/escala-cirurgica/CasoDetalheSheet'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'
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

const ROSTER = [{ uid: 'uid-paulo', nome: 'PAULO TONINI', apelidos: ['PAULO'] }]
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: ROSTER, rosterByUid: new Map(ROSTER.map((r) => [r.uid, r])),
    options: [], aliases: [], loading: false,
    resolver: (n) => (String(n || '').trim().toUpperCase() === 'PAULO' ? 'uid-paulo' : null),
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
const base = { sala: 'CC - Sala 3', anestesista: 'PAULO', anestesistaUserId: 'uid-paulo', cirurgiao: 'Marcos Zanella', turno: 'vespertino', bloco: 'normal' }
const emCurso = { ...base, id: 'c1', ordem: 0, hora: '13:30', procedimento: COLE, statusCirurgia: 'iniciada', inicioReal: '14:05', terminoPrevisto: '16:30' }
const proxima = { ...base, id: 'c2', ordem: 1, hora: '15:30', procedimento: HERNIA }
const escalaDe = (casos) => ({
  id: 'e1', hospital: 'unimed', data: '2026-10-02',
  ordemLiberacao: { vespertino: ['PAULO'] }, ajudaExterna: {}, liberacoes: {}, linhaOverrides: {}, casos,
})

const detalhe = (caso, casos = [caso], props = {}) => {
  const esc = escalaDe(casos)
  return render(<CasoDetalheSheet escala={esc} caso={caso} turno="vespertino" onClose={vi.fn()} podeEditar {...props} />, { wrapper: wrap })
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

describe('detalhe do caso: o cartão "Horário da cirurgia" (Completa, Minhas, Urgências)', () => {
  it('fica ACIMA do Andamento, e o término saiu do Andamento', () => {
    detalhe(emCurso)
    const cartao = screen.getByRole('article', { name: 'Horário da cirurgia' })
    const andamento = screen.getByText('Andamento').closest('article')
    // DOCUMENT_POSITION_FOLLOWING: o Andamento vem DEPOIS do cartão do horário
    expect(cartao.compareDocumentPosition(andamento) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(andamento).queryByRole('button', { name: /Término desta cirurgia/ })).toBeNull()
    expect(within(cartao).getByRole('button', { name: /Término desta cirurgia/ })).toBeTruthy()
  })

  it('em andamento: início e término em destaque, com o que dá sentido a cada um', () => {
    detalhe(emCurso)
    const cartao = screen.getByRole('article', { name: 'Horário da cirurgia' })
    expect(within(cartao).getByRole('button', { name: 'Início desta cirurgia: 14:05' })).toBeTruthy()
    expect(within(cartao).getByText('agendada 13:30')).toBeTruthy()
    expect(within(cartao).getByRole('button', { name: 'Término desta cirurgia: 16:30' })).toBeTruthy()
    expect(within(cartao).getByText('faltam 45min')).toBeTruthy()
    expect(within(cartao).getByText('em sala há 1h40')).toBeTruthy()
  })

  it('agendada: os dois blocos convidam, e "Agora" no início marca Iniciada com o horário junto', async () => {
    detalhe(proxima, [emCurso, proxima])
    const cartao = screen.getByRole('article', { name: 'Horário da cirurgia' })
    expect(within(cartao).getByText('Definir início')).toBeTruthy()
    expect(within(cartao).getByText('Definir término')).toBeTruthy()
    fireEvent.click(within(cartao).getByRole('button', { name: 'Início desta cirurgia: não informado' }))
    expect(within(folhaDeCima()).getByText('Quando a cirurgia começou. Ao informar, ela passa a Iniciada.')).toBeTruthy()
    fireEvent.click(within(folhaDeCima()).getByRole('button', { name: 'Agora' }))
    await waitFor(() => expect(setStatusCirurgia).toHaveBeenCalled())
    const [, caso, status, info] = setStatusCirurgia.mock.calls[0]
    expect(caso.id).toBe('c2')
    expect(status).toBe('iniciada')
    expect(info).toEqual({ userId: 'uid-paulo', inicioReal: '15:45' })
    expect(atualizarCaso).not.toHaveBeenCalled()
  })

  it('já iniciada: corrigir o início só grava o horário (sem mexer no status, sem toast)', async () => {
    detalhe(emCurso)
    fireEvent.click(screen.getByRole('button', { name: 'Início desta cirurgia: 14:05' }))
    expect(within(folhaDeCima()).getByText('Quando a cirurgia começou.')).toBeTruthy()
    // já há valor: o painel nasce no horário (o que está salvo é uma HORA)
    digitar('inicio-hora', '1350')
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][1]).toBe('c1')
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ inicioReal: '13:50' })
    expect(atualizarCaso.mock.calls[0][3]).toEqual({ silencioso: true })
    expect(setStatusCirurgia).not.toHaveBeenCalled()
  })

  it('"há 30min" grava agora menos 30 minutos', async () => {
    detalhe(proxima, [emCurso, proxima])
    fireEvent.click(screen.getByRole('button', { name: 'Início desta cirurgia: não informado' }))
    fireEvent.click(within(folhaDeCima()).getByRole('button', { name: '30min' }))
    await waitFor(() => expect(setStatusCirurgia).toHaveBeenCalled())
    expect(setStatusCirurgia.mock.calls[0][3].inicioReal).toBe('15:15')
  })

  it('início no futuro é recusado com a frase, e nada é gravado', async () => {
    detalhe(emCurso)
    fireEvent.click(screen.getByRole('button', { name: 'Início desta cirurgia: 14:05' }))
    digitar('inicio-hora', '1700')
    expect(within(folhaDeCima()).getByRole('alert').textContent).toBe('O início não pode ser depois de agora.')
    expect(atualizarCaso).not.toHaveBeenCalled()
    expect(setStatusCirurgia).not.toHaveBeenCalled()
  })

  it('terminada: o término é o REAL, com quanto durou; corrigir grava terminoReal', async () => {
    const terminada = { ...emCurso, statusCirurgia: 'terminada', terminoPrevisto: null, terminoReal: '15:22' }
    detalhe(terminada)
    const cartao = screen.getByRole('article', { name: 'Horário da cirurgia' })
    expect(within(cartao).getByText('durou 1h17')).toBeTruthy()
    expect(within(cartao).getByText('terminou')).toBeTruthy()
    fireEvent.click(within(cartao).getByRole('button', { name: 'Término desta cirurgia: 15:22' }))
    expect(within(folhaDeCima()).getByText('Quando a cirurgia terminou.')).toBeTruthy()
    // antes do início é recusado
    digitar('termino-real-hora', '1400')
    expect(within(folhaDeCima()).getByRole('alert').textContent).toBe('O término não pode ser antes do início (14:05).')
    digitar('termino-real-hora', '1510')
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ terminoReal: '15:10' })
  })

  it('cirurgia em curso: o término continua sendo a PREVISÃO (o mesmo painel de sempre)', async () => {
    detalhe(emCurso)
    fireEvent.click(screen.getByRole('button', { name: 'Término desta cirurgia: 16:30' }))
    expect(within(folhaDeCima()).getByText(/Só desta cirurgia/)).toBeTruthy()
    // com valor gravado o painel nasce no "Horário de término"; a duração é a outra aba
    fireEvent.click(within(folhaDeCima()).getByRole('tab', { name: 'Tempo faltante' }))
    fireEvent.click(within(folhaDeCima()).getByRole('button', { name: '1h' }))
    await waitFor(() => expect(atualizarCaso).toHaveBeenCalled())
    expect(atualizarCaso.mock.calls[0][2]).toEqual({ terminoPrevisto: '16:45' })
  })

  it('quem NÃO edita a escala vê os horários, mas sem botão', () => {
    detalhe(emCurso, [emCurso], { podeEditar: false })
    const cartao = screen.getByRole('article', { name: 'Horário da cirurgia' })
    expect(within(cartao).getByText('14:05')).toBeTruthy()
    expect(within(cartao).queryByRole('button')).toBeNull()
  })
})

describe('Liberações: "+ Tempo total" com o início e o término de cada cirurgia', () => {
  const rot = (p) => nomeCurtoProcedimento(p)
  const montarFila = (casos, props = {}) => render(
    <LiberacoesView escala={escalaDe(casos)} hospital="unimed" hospitalLabel="Unimed" turno="vespertino"
      canEdit onToggle={() => {}} onSetOverride={() => {}} {...props} />,
    { wrapper: wrap },
  )
  const abrirTempoTotal = () => fireEvent.click(screen.getByLabelText('Definir tempo faltante de Paulo Tonini'))

  it('cada cirurgia mostra o INÍCIO ao lado do TÉRMINO', () => {
    montarFila([emCurso, proxima])
    abrirTempoTotal()
    expect(screen.getByText('Horário de cada cirurgia')).toBeTruthy()
    const ini1 = screen.getByRole('button', { name: `Início de 13:30 ${rot(COLE)}` })
    expect(within(ini1).getByText('14:05')).toBeTruthy()
    expect(within(ini1).getByText('há 1h40')).toBeTruthy()
    const ini2 = screen.getByRole('button', { name: `Início de 15:30 ${rot(HERNIA)}` })
    expect(within(ini2).getByText('Definir')).toBeTruthy()
  })

  it('tocar no INÍCIO sobe a folha da cirurgia; "Agora" grava pelo onDefinirInicioCaso e a folha do total fica', async () => {
    const onDefinirInicioCaso = vi.fn(async () => {})
    montarFila([emCurso, proxima], { onDefinirInicioCaso })
    abrirTempoTotal()
    fireEvent.click(screen.getByRole('button', { name: `Início de 15:30 ${rot(HERNIA)}` }))
    const folha = folhaDeCima()
    expect(within(folha).getByText(`Início · 15:30 ${rot(HERNIA)}`)).toBeTruthy()
    expect(within(folha).getByText('Quando a cirurgia começou. Ao informar, ela passa a Iniciada.')).toBeTruthy()
    fireEvent.click(within(folha).getByRole('button', { name: 'Agora' }))
    await waitFor(() => expect(onDefinirInicioCaso).toHaveBeenCalledWith('c2', '15:45'))
    await waitFor(() => expect(screen.queryByText(`Início · 15:30 ${rot(HERNIA)}`)).toBeNull())
    expect(screen.getByText('Tempo faltante de Paulo Tonini')).toBeTruthy()
  })

  it('início no futuro também é recusado aqui', () => {
    const onDefinirInicioCaso = vi.fn(async () => {})
    montarFila([emCurso, proxima], { onDefinirInicioCaso })
    abrirTempoTotal()
    fireEvent.click(screen.getByRole('button', { name: `Início de 13:30 ${rot(COLE)}` }))
    digitar('inicio-hora', '1800')
    expect(within(folhaDeCima()).getByRole('alert').textContent).toBe('O início não pode ser depois de agora.')
    expect(onDefinirInicioCaso).not.toHaveBeenCalled()
  })
})

describe('SINCRONIA: as duas telas leem o mesmo campo do caso', () => {
  it('o início gravado (escala nova vinda do context/realtime) aparece no detalhe E na folha das Liberações', () => {
    const antes = escalaDe([{ ...proxima }])
    const depois = escalaDe([{ ...proxima, statusCirurgia: 'iniciada', inicioReal: '15:10' }])

    const det = render(<CasoDetalheSheet escala={antes} caso={antes.casos[0]} turno="vespertino" onClose={vi.fn()} podeEditar />, { wrapper: wrap })
    expect(screen.getByRole('button', { name: 'Início desta cirurgia: não informado' })).toBeTruthy()
    // o detalhe deriva o caso VIVO de `escala.casos` pelo id (prop congelado não basta)
    det.rerender(<CasoDetalheSheet escala={depois} caso={antes.casos[0]} turno="vespertino" onClose={vi.fn()} podeEditar />)
    expect(screen.getByRole('button', { name: 'Início desta cirurgia: 15:10' })).toBeTruthy()
    det.unmount()

    render(<LiberacoesView escala={depois} hospital="unimed" hospitalLabel="Unimed" turno="vespertino" canEdit onToggle={() => {}} onSetOverride={() => {}} />, { wrapper: wrap })
    fireEvent.click(screen.getByLabelText('Definir tempo faltante de Paulo Tonini'))
    expect(within(screen.getByRole('button', { name: `Início de 15:30 ${nomeCurtoProcedimento(HERNIA)}` })).getByText('15:10')).toBeTruthy()
  })
})
