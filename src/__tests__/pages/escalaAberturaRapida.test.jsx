/**
 * Abertura rápida da Escala Cirúrgica (dono 15/10/2026: "ao abrir as escalas
 * cirúrgicas está muito lento").
 *
 * Medido em produção (CPU de celular intermediário): tocar no card da Home dava
 * ~0,3–0,5 s de tela vazia com spinner, a escala aparecia, e ~0,5–1 s depois a
 * barra "Hoje | Amanhã" entrava e empurrava tudo para baixo. Por trás:
 *  - a página carregava ~1,15 MB de JavaScript, ~70% só das telas de
 *    importação (planilha `xlsx`, escala numérica inteira, conferência);
 *  - para saber se oferecia "Amanhã", a tela fazia 9 leituras completas
 *    (3 hospitais × cabeçalho + casos + histórico) e, quando estava publicada,
 *    o prefetch refazia as mesmas 9.
 *
 * Trava:
 *  1. as telas de importação não voltam a ser import estático da página;
 *  2. o atalho "Amanhã" nasce no 1º render quando a data já é sabida (sem pulo);
 *  3. a pergunta "amanhã está publicada?" é UMA leitura leve, e o prefetch só
 *     roda quando está publicada;
 *  4. a resposta fica guardada por data (só um booleano — nada de escala/paciente).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { ThemeProvider, ToastProvider } from '@/design-system'
import {
  algumaPublicada,
  amanhaPublicadaGuardada,
  guardarAmanhaPublicada,
  _esquecerAmanhaPublicada,
} from '@/pages/escala-cirurgica/amanhaPublicada'

const hojeLocalISO = (base) => {
  const d = base instanceof Date ? base : new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const { estado, svcMock } = vi.hoisted(() => ({
  estado: { ctx: null, user: null },
  svcMock: {
    fetchEscala: vi.fn(async () => null),
    fetchStatusDia: vi.fn(async () => []),
    fetchLocaisHospital: vi.fn(async () => []),
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
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: estado.user }),
}))
vi.mock('@/hooks/usePegaPlantao', () => ({ useEscalaDia: () => ({ plantoes: [] }) }))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: [], rosterByUid: new Map(), aliases: [], options: [],
    resolver: () => null, loading: false, pronto: true,
    refresh: vi.fn(), upsertAlias: vi.fn(), removeAlias: vi.fn(),
  }),
}))

import EscalaCirurgicaPage, { REABRIR_EM_MINHAS_MS } from '@/pages/escala-cirurgica/EscalaCirurgicaPage'

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const acoes = () => ({
  setData: vi.fn(), toggleLiberacao: vi.fn(), toggleEscalado: vi.fn(), setLinhaOverride: vi.fn(),
  adicionarAjuda: vi.fn(), removerAjuda: vi.fn(), reordenarAjuda: vi.fn(), definirP4Hospital: vi.fn(),
  setAnestesistaCasos: vi.fn(), marcarTroca: vi.fn(), executarSubstituicao: vi.fn(), desfazerSubstituicao: vi.fn(),
  prefetch: vi.fn(async () => {}),
})

// quarta-feira útil, 10h — amanhã (quinta) é dia útil: alvos = 3 hospitais
const AGORA = new Date('2026-10-14T10:00:00-03:00')
const HOJE = '2026-10-14'
const AMANHA = '2026-10-15'

const montar = () => {
  estado.ctx = {
    escalas: { unimed: null, hro: null, materno: null, fds: null },
    p4Hospital: null, data: HOJE, hoje: HOJE, loading: false, ...acoes(),
  }
  return render(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />, { wrapper: wrap })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(AGORA)
  estado.user = { uid: 'u-x', role: 'anestesiologista', displayName: 'X' }
  localStorage.clear()
  _esquecerAmanhaPublicada()
  svcMock.fetchEscala.mockClear()
  svcMock.fetchStatusDia.mockReset()
  svcMock.fetchStatusDia.mockImplementation(async () => [])
})
afterEach(() => vi.useRealTimers())

describe('abertura rápida da Escala Cirúrgica (15/10/2026)', () => {
  it('as telas de importação não são import estático da página (xlsx + escala numérica fora da abertura)', () => {
    const fonte = readFileSync(resolve(__dirname, '../../pages/escala-cirurgica/EscalaCirurgicaPage.jsx'), 'utf8')
    expect(fonte).not.toMatch(/^import\s+ImportarEscalasPage\b/m)
    expect(fonte).not.toMatch(/^import\s+ImportarEscalaFdsPage\b/m)
    expect(fonte).toMatch(/lazy\(\(\) => import\('\.\/ImportarEscalasPage'\)\)/)
    expect(fonte).toMatch(/lazy\(\(\) => import\('\.\/ImportarEscalaFdsPage'\)\)/)
  })

  it('"Amanhã" já sabido nasce no PRIMEIRO render — a barra não pula quando a rede responde', () => {
    guardarAmanhaPublicada(AMANHA, true)
    // a rede ainda não respondeu (promessa pendente)
    svcMock.fetchStatusDia.mockImplementation(() => new Promise(() => {}))

    montar()

    expect(screen.getByRole('tab', { name: 'Amanhã' })).toBeTruthy()
  })

  it('pergunta "amanhã está publicada?" com UMA leitura leve; publicada → prefetch uma vez', async () => {
    svcMock.fetchStatusDia.mockImplementation(async () => [
      { hospital: 'unimed', status: 'publicada' },
      { hospital: 'hro', status: 'rascunho' },
    ])

    montar()

    expect(await screen.findByRole('tab', { name: 'Amanhã' })).toBeTruthy()
    expect(svcMock.fetchStatusDia).toHaveBeenCalledTimes(1)
    expect(svcMock.fetchStatusDia).toHaveBeenCalledWith(AMANHA)
    // nenhuma leitura completa só para decidir o atalho
    expect(svcMock.fetchEscala).not.toHaveBeenCalled()
    expect(estado.ctx.prefetch).toHaveBeenCalledTimes(1)
    expect(estado.ctx.prefetch).toHaveBeenCalledWith(AMANHA)
    // e a próxima abertura já sabe
    expect(amanhaPublicadaGuardada(AMANHA)).toBe(true)
  })

  it('não publicada: sem atalho, sem prefetch, e o guardado passa a dizer "não"', async () => {
    guardarAmanhaPublicada(AMANHA, true) // ontem estava (republicada/apagada depois)
    svcMock.fetchStatusDia.mockImplementation(async () => [{ hospital: 'unimed', status: 'rascunho' }])

    montar()

    await waitFor(() => expect(screen.queryByRole('tab', { name: 'Amanhã' })).toBeNull())
    expect(estado.ctx.prefetch).not.toHaveBeenCalled()
    expect(amanhaPublicadaGuardada(AMANHA)).toBe(false)
  })

  it('rede falhou: fica o que se sabia (não some o atalho de quem já o tinha)', async () => {
    guardarAmanhaPublicada(AMANHA, true)
    svcMock.fetchStatusDia.mockImplementation(async () => { throw new Error('Failed to fetch') })

    montar()
    await act(async () => { await Promise.resolve() })

    expect(screen.getByRole('tab', { name: 'Amanhã' })).toBeTruthy()
  })
})

describe('amanhaPublicada — o que vai para o disco', () => {
  beforeEach(() => {
    localStorage.clear()
    _esquecerAmanhaPublicada()
  })

  it('sobrevive a uma nova sessão (vem do disco quando a memória está vazia)', () => {
    guardarAmanhaPublicada('2026-10-15', true)
    _esquecerAmanhaPublicada()
    expect(amanhaPublicadaGuardada('2026-10-15')).toBe(true)
    expect(amanhaPublicadaGuardada('2026-10-16')).toBe(false)
  })

  it('guarda só um booleano por data, e só as últimas datas', () => {
    for (const d of ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15']) {
      guardarAmanhaPublicada(d, true)
    }
    const bruto = JSON.parse(localStorage.getItem('anest-escala-amanha-publicada-v1'))
    expect(Object.keys(bruto)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'])
    expect(Object.values(bruto).every((v) => v === true)).toBe(true)
  })

  it('publicada = alguma linha dos hospitais-alvo com status publicada', () => {
    const alvos = ['unimed', 'hro', 'materno']
    expect(algumaPublicada([{ hospital: 'hro', status: 'publicada' }], alvos)).toBe(true)
    expect(algumaPublicada([{ hospital: 'hro', status: 'rascunho' }], alvos)).toBe(false)
    // linha 'fds' só conta quando o dia tem fila única (o chamador inclui no alvo)
    expect(algumaPublicada([{ hospital: 'fds', status: 'publicada' }], alvos)).toBe(false)
    expect(algumaPublicada([{ hospital: 'fds', status: 'publicada' }], [...alvos, 'fds'])).toBe(true)
    expect(algumaPublicada(null, alvos)).toBe(false)
  })
})

// App aberto direto em /escala-cirurgica (toque no push do plantonista / tempo
// estourado): o main.jsx espera o chunk da escala antes do 1º render — sem isso
// o Suspense mostrava o spinner e o React 19 o segurava por ≥300 ms.
describe('prepararPaginaInicial (abertura direto na escala)', () => {
  it('na URL da escala, pré-carrega a página', async () => {
    const { prepararPaginaInicial } = await import('@/navigation/paginaInicial')
    const escala = { preload: vi.fn(() => Promise.resolve('ok')) }
    await expect(prepararPaginaInicial('/escala-cirurgica', { escala })).resolves.toBe('ok')
    expect(escala.preload).toHaveBeenCalledTimes(1)
  })

  it('em qualquer outra URL resolve na hora, sem carregar a escala', async () => {
    const { prepararPaginaInicial } = await import('@/navigation/paginaInicial')
    const escala = { preload: vi.fn(() => Promise.resolve()) }
    for (const url of ['/', '/gestao', '/escalas', '/escala-numerica']) {
      await prepararPaginaInicial(url, { escala })
    }
    expect(escala.preload).not.toHaveBeenCalled()
  })
})

// Aberta logo depois do app, a escala de HOJE disputava o banco com as leituras de
// AMANHÃ (status + prefetch) — a pergunta sobre amanhã agora espera a de hoje chegar.
describe('amanhã espera a escala de hoje (15/10/2026)', () => {
  it('com a escala de hoje carregando, nada de amanhã é pedido; chegou, pergunta uma vez', async () => {
    estado.ctx = {
      escalas: { unimed: null, hro: null, materno: null, fds: null },
      p4Hospital: null, data: HOJE, hoje: HOJE, loading: true, ...acoes(),
    }
    const { rerender } = render(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />, { wrapper: wrap })
    await act(async () => { await Promise.resolve() })
    expect(svcMock.fetchStatusDia).not.toHaveBeenCalled()

    estado.ctx = { ...estado.ctx, loading: false }
    rerender(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />)
    await waitFor(() => expect(svcMock.fetchStatusDia).toHaveBeenCalledTimes(1))

    // uma recarga depois (loading oscila) não pergunta de novo pela mesma data
    estado.ctx = { ...estado.ctx, loading: true }
    rerender(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />)
    estado.ctx = { ...estado.ctx, loading: false }
    rerender(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />)
    await act(async () => { await Promise.resolve() })
    expect(svcMock.fetchStatusDia).toHaveBeenCalledTimes(1)
  })
})

// Dono 15/10/2026: "quero que o usuário ao abrir escala sempre abra na aba minhas".
// A tela já nascia na Minhas; o que escapava era o app voltando do segundo plano com
// a escala aberta noutra aba. Voltar depois de REABRIR_EM_MINHAS_MS = abrir de novo.
describe('sempre abre na aba Minhas (15/10/2026)', () => {
  const abaSelecionada = () => ['Minhas', 'Completa', 'Liberações']
    .find((n) => screen.queryByRole('tab', { name: n })?.getAttribute('aria-selected') === 'true') || null
  const visibilidade = (v) => {
    Object.defineProperty(document, 'visibilityState', { value: v, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  }
  afterEach(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  it('abre na Minhas', () => {
    montar()
    expect(abaSelecionada()).toBe('Minhas')
  })

  it('voltou ao app depois de 2 min ou mais com a escala noutra aba → Minhas', async () => {
    montar()
    fireEvent.click(screen.getByRole('tab', { name: 'Completa' }))
    expect(abaSelecionada()).toBe('Completa')

    await act(async () => { visibilidade('hidden') })
    vi.setSystemTime(new Date(AGORA.getTime() + REABRIR_EM_MINHAS_MS + 1000))
    await act(async () => { visibilidade('visible') })

    expect(abaSelecionada()).toBe('Minhas')
  })

  it('troca rápida de app (ler o recado) mantém a aba de quem opera a fila', async () => {
    montar()
    fireEvent.click(screen.getByRole('tab', { name: 'Liberações' }))
    expect(abaSelecionada()).toBe('Liberações')

    await act(async () => { visibilidade('hidden') })
    vi.setSystemTime(new Date(AGORA.getTime() + 30_000))
    await act(async () => { visibilidade('visible') })

    expect(abaSelecionada()).toBe('Liberações')
  })

  it('conta de hospital (sem aba Minhas) continua nas Liberações depois da pausa do tablet', async () => {
    estado.user = { uid: 'u-hro', role: 'func-hro', displayName: 'HRO' }
    montar()
    expect(screen.queryByRole('tab', { name: 'Minhas' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Liberações' }))
    expect(abaSelecionada()).toBe('Liberações')

    await act(async () => { visibilidade('hidden') })
    vi.setSystemTime(new Date(AGORA.getTime() + REABRIR_EM_MINHAS_MS + 60_000))
    await act(async () => { visibilidade('visible') })

    expect(abaSelecionada()).toBe('Liberações')
  })
})
