/**
 * TROCAR O RESPONSÁVEL NA FOLHA DO HORÁRIO (dono 29/10/2026, modelo B de
 * `.tmp/popup-horarios/trocar-responsavel.html`).
 *
 * "Adicionar a possibilidade de trocar o responsável pelo procedimento. Ao clicar para adicionar
 * o horário deve conter essa possibilidade." Com o pop-up a cada entrada, quem recebeu uma
 * cirurgia que não fez seria cobrado por ela até alguém corrigir — de dia anterior não havia troca
 * em lugar nenhum, e no turno em curso a terminada aparecia riscada com "Nada a passar".
 *
 * Travas: a folha mostra "Anestesista · <nome> · Trocar"; o toque abre "Quem responde por esta
 * cirurgia?" no modo CORREÇÃO (a terminada entra, sem "Sem anestesista", sem decisão de fila);
 * de dia anterior grava pelo id e a cirurgia sai da lista (volta se falhar); de hoje vai pelo
 * context, sem efeitos na fila no turno encerrado e com os de sempre no turno em curso;
 * "Cancelar" volta à folha do horário. E o botão da folha passou a "Confirmar horários".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import { _zerarAnteriores } from '@/pages/escala-cirurgica/pendenciasAnteriores'

const hojeLocalISO = (base) => {
  const d = base instanceof Date ? base : new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const { estado, svcMock, ROSTER } = vi.hoisted(() => ({
  estado: { ctx: null, user: null },
  svcMock: {
    fetchEscala: vi.fn(async () => null),
    fetchLocaisHospital: vi.fn(async () => []),
    fetchStatusDia: vi.fn(async () => []),
    fetchCasosDaPessoa: vi.fn(async () => []),
    updateCaso: vi.fn(async () => {}),
    updateStatusCirurgia: vi.fn(async () => {}),
    updateAnestesistaCasos: vi.fn(async () => {}),
  },
  ROSTER: new Map([
    ['u-x', { uid: 'u-x', nome: 'XAVIER SILVA', apelidos: ['X'] }],
    ['uid-cury', { uid: 'uid-cury', nome: 'GUSTAVO CURY', apelidos: ['CURY'] }],
  ]),
}))

vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgica: () => estado.ctx,
  useEscalaCirurgicaActions: () => estado.ctx,
  hojeISO: (d) => hojeLocalISO(d),
  diaOperacionalISO: (d) => hojeLocalISO(d),
  HOSPITAIS: ['unimed', 'hro', 'materno'],
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
  OBSERVACAO_MAX: 120,
}))
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ user: estado.user }) }))
vi.mock('@/hooks/usePegaPlantao', () => ({ useEscalaDia: () => ({ plantoes: [] }) }))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: [...ROSTER.values()], rosterByUid: ROSTER, aliases: [],
    options: [...ROSTER.values()].map((r) => ({ value: r.uid, label: r.nome })),
    resolver: (nome) => [...ROSTER.values()].find((r) => r.apelidos.includes(String(nome || '').trim().toUpperCase()))?.uid || null,
    loading: false, pronto: true, refresh: vi.fn(), upsertAlias: vi.fn(), removeAlias: vi.fn(),
  }),
}))
vi.mock('@/pages/escala-cirurgica/MeuPreenchimento', () => ({ default: () => null, ID_MINHAS_PENDENCIAS: 'minhas-pendencias' }))

import EscalaCirurgicaPage from '@/pages/escala-cirurgica/EscalaCirurgicaPage'
import DefinirAnestesistaSheet from '@/pages/escala-cirurgica/DefinirAnestesistaSheet'

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

// quarta-feira útil, 15h: a manhã já encerrou (13h) e as cirurgias dela sem horário estão no aviso
const HOJE = '2026-10-28'
const ONTEM = '2026-10-27'
const meu = (id, hora, procedimento, extra = {}) => ({
  id, sala: 'Sala 6', ordem: Number(hora.slice(0, 2)), turno: 'matutino', hora, procedimento, cirurgiao: 'Jonathan Caon',
  anestesista: 'X', anestesistaUserId: 'u-x', statusCirurgia: 'terminada', inicioReal: null, terminoReal: null,
  statusAtualizadoEm: `${HOJE}T12:00:00-03:00`, ...extra,
})
const escalaHro = (casos) => ({
  id: 'e-hro', hospital: 'hro', status: 'publicada', data: HOJE,
  ordemLiberacao: { matutino: ['X'], vespertino: ['OUTRO'] }, ajudaExterna: {}, liberacoes: {}, linhaOverrides: {}, casos,
})
// a cirurgia de ONTEM no nome de quem está logado, terminada e sem horário
const deOntem = () => [{
  id: 'e-old', data: ONTEM, hospital: 'hro', status: 'publicada',
  casos: [{
    id: 'old1', escalaId: 'e-old', sala: 'Sala 4', ordem: 0, turno: 'matutino', hora: '07:00', procedimento: 'FRATURA DE FÊMUR',
    anestesista: 'X', anestesistaUserId: 'u-x', statusCirurgia: 'terminada', statusAtualizadoEm: `${ONTEM}T11:00:00-03:00`,
  }],
}]
const COMPLETA = { inicioReal: '08:05', terminoReal: '10:00' }

const acoes = () => ({
  setData: vi.fn(), prefetch: vi.fn(async () => {}), toggleLiberacao: vi.fn(), toggleEscalado: vi.fn(), setLinhaOverride: vi.fn(),
  adicionarAjuda: vi.fn(), removerAjuda: vi.fn(), reordenarAjuda: vi.fn(), definirP4Hospital: vi.fn(),
  setAnestesistaCasos: vi.fn(async () => {}), marcarTroca: vi.fn(), executarSubstituicao: vi.fn(async () => {}), desfazerSubstituicao: vi.fn(),
  setStatusCirurgia: vi.fn(async () => {}), atualizarCaso: vi.fn(async () => {}),
})
const montar = (casos) => {
  estado.ctx = {
    escalas: { unimed: null, hro: escalaHro(casos), materno: null, fds: null },
    p4Hospital: null, data: HOJE, hoje: HOJE, loading: false, ...acoes(),
  }
  return render(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />, { wrapper: wrap })
}
const esperarPopup = () => screen.findByRole('dialog', { name: /^Você tem \d+ cirurgias? sem horário$/ })
const popup = () => screen.queryByRole('dialog', { name: /^Você tem \d+ cirurgias? sem horário$/ })
const folhaDoHorario = () => screen.queryByText(/^Início e término ·/)
// a folha de troca não tem nome acessível próprio: acha-se pelo título
const folhaDeTroca = () => screen.queryByText('Quem responde por esta cirurgia?')?.closest('[role="dialog"]') || null
const abrirFolhaPeloPopup = async () => {
  fireEvent.click(within(await esperarPopup()).getByRole('button', { name: 'Informar horários' }))
}
const escolherCury = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Escolher quem assume' }))
  fireEvent.click(screen.getByRole('option', { name: /GUSTAVO CURY/ }))
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(`${HOJE}T15:00:00-03:00`))
  estado.user = { uid: 'u-x', role: 'anestesiologista', displayName: 'X' }
  localStorage.clear()
  _zerarAnteriores()
  vi.clearAllMocks()
  svcMock.fetchCasosDaPessoa.mockImplementation(async () => [])
  svcMock.updateAnestesistaCasos.mockImplementation(async () => {})
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
})
afterEach(() => vi.useRealTimers())

describe('a folha do horário mostra quem está na cirurgia, com "Trocar"', () => {
  it('"Anestesista · <nome>" e o botão "Trocar" acima dos campos; o botão da folha diz "Confirmar horários"', async () => {
    montar([meu('p1', '08:00', 'RETOSSIGMOIDECTOMIA ABDOMINAL')])
    await abrirFolhaPeloPopup()
    expect(folhaDoHorario()).toBeTruthy()
    expect(screen.getByText('Anestesista')).toBeTruthy()
    expect(screen.getByText(/^Xavier/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Trocar anestesista' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirmar horários' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Confirmar os dois' })).toBeNull()
  })

  it('"Trocar" abre "Quem responde por esta cirurgia?" no lugar da folha; "Cancelar" volta a ela', async () => {
    montar([meu('p1', '08:00', 'RETOSSIGMOIDECTOMIA ABDOMINAL')])
    await abrirFolhaPeloPopup()
    fireEvent.click(screen.getByRole('button', { name: 'Trocar anestesista' }))
    expect(folhaDeTroca()).toBeTruthy()
    expect(folhaDoHorario()).toBeNull()
    // o pop-up continua embaixo: confirmada a troca, ele segue com as que faltam
    expect(popup()).toBeTruthy()
    fireEvent.click(within(folhaDeTroca()).getByRole('button', { name: 'Cancelar' }))
    expect(folhaDeTroca()).toBeNull()
    expect(folhaDoHorario()).toBeTruthy()
  })
})

describe('dia anterior: passa a quem fez e a cobrança vai junto', () => {
  it('a data no subtítulo, a terminada entra, sem "Sem anestesista"; grava pelo id e a cirurgia sai da lista', async () => {
    svcMock.fetchCasosDaPessoa.mockImplementation(async () => deOntem())
    montar([meu('p1', '08:00', 'RETOSSIGMOIDECTOMIA ABDOMINAL', COMPLETA)])
    await abrirFolhaPeloPopup()
    expect(screen.getByText(/^Início e término · 07:00/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Trocar anestesista' }))
    const troca = folhaDeTroca()
    expect(within(troca).getByText(/^Ontem · .*Matutino · HRO/)).toBeTruthy()
    // correção de quem fez, não repasse: nada de "Nada a passar" nem cirurgia riscada
    expect(within(troca).queryByText(/Nada a passar/)).toBeNull()
    expect(within(troca).getByText(/Fratura de fêmur/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Escolher quem assume' }))
    expect(screen.queryByRole('option', { name: /Sem anestesista/ })).toBeNull()
    fireEvent.click(screen.getByRole('option', { name: /GUSTAVO CURY/ }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar responsável' })) })
    expect(svcMock.updateAnestesistaCasos).toHaveBeenCalledWith(['old1'], { uid: 'uid-cury', apelido: 'CURY', dupla: false })
    // a escala de ontem não está no context: nada passa por ele
    expect(estado.ctx.setAnestesistaCasos).not.toHaveBeenCalled()
    expect(await screen.findByText('Responsável atualizado')).toBeTruthy()
    // era a única: a lista esvaziou, o pop-up fechou e a folha do horário NÃO volta
    expect(popup()).toBeNull()
    expect(folhaDoHorario()).toBeNull()
    expect(screen.queryByRole('region', { name: /sem horário$/ })).toBeNull()
  })

  it('falhou a gravação: a cirurgia volta para a lista, com o aviso', async () => {
    svcMock.fetchCasosDaPessoa.mockImplementation(async () => deOntem())
    svcMock.updateAnestesistaCasos.mockImplementation(async () => { throw new Error('sem rede') })
    montar([meu('p1', '08:00', 'RETOSSIGMOIDECTOMIA ABDOMINAL', COMPLETA)])
    await abrirFolhaPeloPopup()
    fireEvent.click(screen.getByRole('button', { name: 'Trocar anestesista' }))
    escolherCury()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar responsável' })) })
    expect(await screen.findByText('Não foi possível trocar o responsável')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Você tem 1 cirurgia sem horário' })).toBeTruthy()
  })
})

describe('hoje: pelo context, com ou sem efeitos na fila conforme o turno', () => {
  it('turno encerrado (a manhã, às 15h): só o nome — sem os efeitos do repasse', async () => {
    montar([meu('p1', '08:00', 'RETOSSIGMOIDECTOMIA ABDOMINAL'), meu('p2', '10:00', 'LAPAROTOMIA EXPLORADORA')])
    await abrirFolhaPeloPopup()
    fireEvent.click(screen.getByRole('button', { name: 'Trocar anestesista' }))
    // a terminada entra também aqui (dono 28/10, modo do turno encerrado)
    expect(within(folhaDeTroca()).queryByText(/Nada a passar/)).toBeNull()
    escolherCury()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar responsável' }))
    expect(estado.ctx.setAnestesistaCasos).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'e-hro' }), ['p1'], expect.objectContaining({ uid: 'uid-cury' }),
      expect.objectContaining({ semEfeitosNaFila: true }),
    )
    expect(svcMock.updateAnestesistaCasos).not.toHaveBeenCalled()
    expect(folhaDoHorario()).toBeNull()
  })
})

describe('a folha de troca no modo "corrigir quem fez" (turno em curso)', () => {
  const caso = (o = {}) => ({
    id: 'c1', sala: 'Sala 6', ordem: 1, hora: '07:00', turno: 'matutino', procedimento: 'RETOSSIGMOIDECTOMIA ABDOMINAL',
    cirurgiao: 'Jonathan Caon', anestesista: 'X', anestesistaUserId: 'u-x', tipo: 'eletiva',
    statusCirurgia: 'terminada', statusAtualizadoEm: `${HOJE}T09:30:00-03:00`, inicioReal: null, terminoReal: null, ...o,
  })
  const escala = (c) => ({
    id: 'e-hro', hospital: 'hro', data: HOJE, status: 'publicada', ajudaExterna: {}, liberacoes: {},
    ordemLiberacao: { matutino: ['X', 'CURY'] }, linhaOverrides: {}, casos: [c],
  })
  const folha = (props = {}) => {
    estado.ctx = { escalas: {}, hoje: HOJE, ...acoes() }
    return render(
      <DefinirAnestesistaSheet escala={escala(caso())} sala="Sala 6" casosAlvo={[caso()]} turno="matutino" onClose={vi.fn()} {...props} />,
      { wrapper: wrap },
    )
  }

  it('a terminada entra, sem "assumir a posição"; os cuidados de sempre na fila seguem (sem semEfeitosNaFila)', () => {
    folha({ corrigirQuemFez: true })
    expect(screen.queryByText(/Nada a passar/)).toBeNull()
    escolherCury()
    expect(screen.queryByRole('switch')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar responsável' }))
    expect(estado.ctx.executarSubstituicao).not.toHaveBeenCalled()
    expect(estado.ctx.setAnestesistaCasos).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'e-hro' }), ['c1'], expect.objectContaining({ uid: 'uid-cury' }),
      expect.objectContaining({ semEfeitosNaFila: false }),
    )
  })

  it('o "Trocar" da Completa continua como era: terminada fica com quem fez e há "Sem anestesista" (controle)', () => {
    folha()
    expect(screen.getByText(/Nada a passar/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Escolher quem assume' }))
    expect(screen.getByRole('option', { name: /Sem anestesista/ })).toBeTruthy()
  })
})
