/**
 * POP-UP DE HORÁRIOS EM ABERTO (dono 28/10/2026, `.tmp/popup-horarios/popup.html`, v2 do modelo A).
 *
 * "Sempre que o usuário tiver débitos, não importa a data. O pop-up deve aparecer todas as vezes
 * enquanto o usuário tiver débitos de horários em aberto", e abre "sempre que entrar na escala
 * cirúrgica". Débito = qualquer cirurgia da caixa "Cirurgias sem horário" (as de hoje que já
 * entraram no aviso + as de dias anteriores desde 27/10). Escolhas do dono: folha de baixo com o
 * cabeçalho vermelho "Você tem X cirurgias sem horário", "a da vez" marcada e o rodapé "Informar
 * horários · Pular · Ver a escala"; abre mesmo se a pessoa já tocou na tela.
 *
 * Travas pedidas: abre a cada entrada enquanto houver débito · não abre sem débito nem para conta
 * de hospital · fecha com um toque sem travar a tela · some quando o último débito é preenchido.
 * E as que vêm junto: voltar do segundo plano não reabre; a lista é a mesma da caixa; "Pular" e
 * "Informar horários" agem na cirurgia marcada; confirmada uma, a lista volta com a seguinte.
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

const { estado, svcMock } = vi.hoisted(() => ({
  estado: { ctx: null, user: null },
  svcMock: {
    fetchEscala: vi.fn(async () => null),
    fetchLocaisHospital: vi.fn(async () => []),
    fetchStatusDia: vi.fn(async () => []),
    fetchCasosDaPessoa: vi.fn(async () => []),
    updateCaso: vi.fn(async () => {}),
    updateStatusCirurgia: vi.fn(async () => {}),
  },
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
    roster: [], rosterByUid: new Map(), aliases: [], options: [],
    resolver: () => null, loading: false, pronto: true,
    refresh: vi.fn(), upsertAlias: vi.fn(), removeAlias: vi.fn(),
  }),
}))
// "Seu preenchimento" faz a própria ida ao banco: fora daqui
vi.mock('@/pages/escala-cirurgica/MeuPreenchimento', () => ({ default: () => null, ID_MINHAS_PENDENCIAS: 'minhas-pendencias' }))

import EscalaCirurgicaPage from '@/pages/escala-cirurgica/EscalaCirurgicaPage'

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

// quarta-feira útil, 15h: as cirurgias da manhã sem horário já entraram no aviso (fim do turno às 13h)
const HOJE = '2026-10-28'
const meu = (id, hora, procedimento, extra = {}) => ({
  id, sala: 'Sala 6', ordem: Number(hora.slice(0, 2)), turno: 'matutino', hora, procedimento, cirurgiao: 'Jonathan Caon',
  anestesista: 'X', anestesistaUserId: 'u-x', statusCirurgia: 'terminada', inicioReal: null, terminoReal: null,
  statusAtualizadoEm: `${HOJE}T12:00:00-03:00`, ...extra,
})
const escalaHro = (casos) => ({
  id: 'e-hro', hospital: 'hro', status: 'publicada', data: HOJE,
  ordemLiberacao: { matutino: ['X'], vespertino: ['OUTRO'] }, ajudaExterna: {}, liberacoes: {}, linhaOverrides: {}, casos,
})

/** O contexto de teste grava de verdade: o caso muda e a página relê no próximo render. */
const patchCaso = (id, patch) => {
  const e = estado.ctx.escalas.hro
  estado.ctx = { ...estado.ctx, escalas: { ...estado.ctx.escalas, hro: { ...e, casos: e.casos.map((c) => (c.id === id ? { ...c, ...patch } : c)) } } }
}
const acoes = () => ({
  setData: vi.fn(), prefetch: vi.fn(async () => {}), toggleLiberacao: vi.fn(), toggleEscalado: vi.fn(), setLinhaOverride: vi.fn(),
  adicionarAjuda: vi.fn(), removerAjuda: vi.fn(), reordenarAjuda: vi.fn(), definirP4Hospital: vi.fn(),
  setAnestesistaCasos: vi.fn(), marcarTroca: vi.fn(), executarSubstituicao: vi.fn(), desfazerSubstituicao: vi.fn(),
  setStatusCirurgia: vi.fn(async (_e, caso, status, extra = {}) => { patchCaso(caso.id, { statusCirurgia: status, ...extra }) }),
  atualizarCaso: vi.fn(async (_e, id, patch) => { patchCaso(id, patch) }),
})

const pagina = () => <EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />
const montar = (casos = [meu('p1', '08:00', 'RETOSSIGMOIDECTOMIA ABDOMINAL')]) => {
  estado.ctx = {
    escalas: { unimed: null, hro: escalaHro(casos), materno: null, fds: null },
    p4Hospital: null, data: HOJE, hoje: HOJE, loading: false, ...acoes(),
  }
  return render(pagina(), { wrapper: wrap })
}
const popup = () => screen.queryByRole('dialog', { name: /^Você tem \d+ cirurgias? sem horário$/ })
const esperarPopup = () => screen.findByRole('dialog', { name: /^Você tem \d+ cirurgias? sem horário$/ })
const passar = async (ms) => { await act(async () => { vi.advanceTimersByTime(ms) }) }

let visivel = 'visible'
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(`${HOJE}T15:00:00-03:00`))
  estado.user = { uid: 'u-x', role: 'anestesiologista', displayName: 'X' }
  localStorage.clear()
  _zerarAnteriores()
  svcMock.fetchCasosDaPessoa.mockReset()
  svcMock.fetchCasosDaPessoa.mockImplementation(async () => [])
  visivel = 'visible'
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visivel })
})
afterEach(() => vi.useRealTimers())

describe('abre a cada entrada enquanto houver débito', () => {
  it('abre na entrada com a cirurgia de hoje sem horário — cabeçalho, lista e rodapé do modelo escolhido', async () => {
    montar()
    const d = await esperarPopup()
    expect(d).toHaveAccessibleName('Você tem 1 cirurgia sem horário')
    expect(within(d).getByText('Ficam aqui até você preencher início e término.')).toBeTruthy()
    // na linha e no rodapé ("1 de 1 · Retossigmoidectomia abdominal")
    expect(within(d).getAllByText(/Retossigmoidectomia abdominal/)).toHaveLength(2)
    expect(within(d).getByRole('button', { name: 'Informar horários' })).toBeTruthy()
    expect(within(d).getByRole('button', { name: 'Ver a escala' })).toBeTruthy()
    // com uma só, "Pular" não teria para onde ir: não aparece (botão morto é pior que ausente)
    expect(within(d).queryByRole('button', { name: /Pular/ })).toBeNull()
  })

  it('fechou, saiu e entrou de novo: abre de novo', async () => {
    const { unmount } = montar()
    fireEvent.click(within(await esperarPopup()).getByRole('button', { name: 'Fechar' }))
    expect(popup()).toBeNull()
    unmount()
    render(pagina(), { wrapper: wrap })
    expect(await esperarPopup()).toBeTruthy()
  })

  it('só com débito de DIA ANTERIOR também abre (não importa a data)', async () => {
    svcMock.fetchCasosDaPessoa.mockImplementation(async () => [{
      id: 'e-old', data: '2026-10-27', hospital: 'hro', status: 'publicada',
      casos: [{ id: 'old1', sala: 'Sala 4', ordem: 0, turno: 'matutino', hora: '07:00', procedimento: 'FRATURA DE FÊMUR', anestesista: 'X', anestesistaUserId: 'u-x', statusCirurgia: 'terminada', statusAtualizadoEm: '2026-10-27T11:00:00-03:00' }],
    }])
    montar([meu('p1', '08:00', 'RETOSSIGMOIDECTOMIA ABDOMINAL', { inicioReal: '08:05', terminoReal: '10:00' })])
    const d = await esperarPopup()
    expect(d).toHaveAccessibleName('Você tem 1 cirurgia sem horário')
    expect(within(d).getAllByText(/Fratura de fêmur/i).length).toBeGreaterThan(0)
    expect(within(d).getByText(/^Ontem/)).toBeTruthy()
  })

  it('a lista do pop-up é a da caixa: o mesmo número nos dois', async () => {
    montar([meu('p1', '08:00', 'RETOSSIGMOIDECTOMIA ABDOMINAL'), meu('p2', '10:00', 'LAPAROTOMIA EXPLORADORA')])
    expect(await esperarPopup()).toHaveAccessibleName('Você tem 2 cirurgias sem horário')
    expect(screen.getByRole('region', { name: 'Você tem 2 cirurgias sem horário' })).toBeTruthy()
  })
})

describe('não abre sem débito nem para conta de hospital', () => {
  it('sem cirurgia sem horário: nada, nem depois da espera máxima', async () => {
    montar([meu('p1', '08:00', 'RETOSSIGMOIDECTOMIA ABDOMINAL', { inicioReal: '08:05', terminoReal: '10:00' })])
    await passar(6000)
    expect(popup()).toBeNull()
  })

  it('conta de hospital (HRO) não recebe — nem pop-up, nem caixa', async () => {
    estado.user = { uid: 'u-hro', role: 'func-hro', displayName: 'HRO' }
    montar([meu('p1', '08:00', 'RETOSSIGMOIDECTOMIA ABDOMINAL', { anestesistaUserId: 'u-hro', anestesista: 'HRO' })])
    await passar(6000)
    expect(popup()).toBeNull()
    expect(svcMock.fetchCasosDaPessoa).not.toHaveBeenCalled()
  })
})

describe('fecha com um toque e não trava a tela', () => {
  it('o X fecha; a escala segue tocável e a página não fica presa', async () => {
    montar()
    fireEvent.click(within(await esperarPopup()).getByRole('button', { name: 'Fechar' }))
    expect(popup()).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.style.overflow).not.toBe('hidden')
    fireEvent.click(screen.getByRole('tab', { name: 'Completa' }))
    expect(screen.getByRole('tab', { name: 'Completa' })).toHaveAttribute('aria-selected', 'true')
  })

  it('"Ver a escala" também fecha com um toque', async () => {
    montar()
    fireEvent.click(within(await esperarPopup()).getByRole('button', { name: 'Ver a escala' }))
    expect(popup()).toBeNull()
  })

  it('voltar ao app depois de minimizado (sem entrar de novo) NÃO reabre', async () => {
    montar()
    fireEvent.click(within(await esperarPopup()).getByRole('button', { name: 'Fechar' }))
    visivel = 'hidden'
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    await passar(3 * 60_000)
    visivel = 'visible'
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    await passar(5000)
    expect(popup()).toBeNull()
  })
})

describe('"a da vez", Pular e Informar horários', () => {
  const linhas = (d) => within(d).getAllByRole('button', { name: /^Informar o horário de/ })

  it('a 1ª nasce marcada; Pular passa a marca; Informar horários abre a folha da marcada', async () => {
    montar([meu('p1', '08:00', 'RETOSSIGMOIDECTOMIA ABDOMINAL'), meu('p2', '10:00', 'LAPAROTOMIA EXPLORADORA')])
    const d = await esperarPopup()
    expect(linhas(d)[0]).toHaveAttribute('aria-current', 'true')
    expect(within(d).getByText(/^1 de 2/)).toBeTruthy()
    fireEvent.click(within(d).getByRole('button', { name: /Pular/ }))
    expect(linhas(d)[1]).toHaveAttribute('aria-current', 'true')
    expect(linhas(d)[0]).not.toHaveAttribute('aria-current')
    expect(within(d).getByText(/^2 de 2/)).toBeTruthy()
    fireEvent.click(within(d).getByRole('button', { name: 'Informar horários' }))
    // a folha de 27/10 (só os dois campos, lado a lado), da cirurgia marcada, POR CIMA do pop-up
    expect(screen.getByText(/^Início e término · 10:00/)).toBeTruthy()
    expect(screen.getByLabelText('Horário de início')).toBeTruthy()
    expect(screen.getByLabelText('Horário de término')).toBeTruthy()
    expect(popup()).toBeTruthy()
  })

  it('confirmada uma, a lista volta com a seguinte marcada', async () => {
    const { rerender } = montar([meu('p1', '08:00', 'RETOSSIGMOIDECTOMIA ABDOMINAL'), meu('p2', '10:00', 'LAPAROTOMIA EXPLORADORA')])
    const d = await esperarPopup()
    fireEvent.click(within(d).getByRole('button', { name: 'Informar horários' }))
    fireEvent.change(screen.getByLabelText('Horário de início'), { target: { value: '0800' } })
    fireEvent.change(screen.getByLabelText('Horário de término'), { target: { value: '0930' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar horários' }))
    expect(estado.ctx.atualizarCaso).toHaveBeenCalledWith(expect.anything(), 'p1', { terminoReal: '09:30', inicioReal: '08:00' }, { silencioso: true })
    rerender(pagina())
    const depois = await esperarPopup()
    expect(depois).toHaveAccessibleName('Você tem 1 cirurgia sem horário')
    expect(linhas(depois)[0]).toHaveAttribute('aria-current', 'true')
    expect(within(depois).getAllByText(/Laparotomia exploradora/).length).toBeGreaterThan(0)
    expect(within(depois).queryByText(/Retossigmoidectomia/)).toBeNull()
  })
})

describe('some quando o último débito é preenchido', () => {
  it('preencheu a última: o pop-up some, com "Horários em dia", e a caixa também', async () => {
    const { rerender } = montar()
    fireEvent.click(within(await esperarPopup()).getByRole('button', { name: 'Informar horários' }))
    fireEvent.change(screen.getByLabelText('Horário de início'), { target: { value: '0800' } })
    fireEvent.change(screen.getByLabelText('Horário de término'), { target: { value: '0930' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar horários' }))
    rerender(pagina())
    await passar(50)
    expect(popup()).toBeNull()
    expect(screen.getByText('Horários em dia')).toBeTruthy()
    expect(screen.queryByRole('region', { name: /sem horário$/ })).toBeNull()
  })

  it('"Não aconteceu" na cirurgia ainda aberta também resolve', async () => {
    const { rerender } = montar([meu('p1', '08:00', 'RETOSSIGMOIDECTOMIA ABDOMINAL', { statusCirurgia: 'agendada', statusAtualizadoEm: null })])
    fireEvent.click(within(await esperarPopup()).getByRole('button', { name: 'Informar horários' }))
    fireEvent.click(screen.getByRole('button', { name: 'Não aconteceu (suspensa)' }))
    expect(estado.ctx.setStatusCirurgia).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'p1' }), 'suspensa', expect.anything())
    rerender(pagina())
    await passar(50)
    expect(popup()).toBeNull()
  })

  it('sem débito na entrada seguinte, não abre mais', async () => {
    const { unmount } = montar([meu('p1', '08:00', 'RETOSSIGMOIDECTOMIA ABDOMINAL', { inicioReal: '08:00', terminoReal: '09:30' })])
    await passar(6000)
    expect(popup()).toBeNull()
    unmount()
    render(pagina(), { wrapper: wrap })
    await passar(6000)
    expect(popup()).toBeNull()
  })
})
