/**
 * "+ Tempo total" com o término de CADA cirurgia (dono 25/09, modelo A escolhido em
 * protótipo `.tmp/tempo-total-com-cirurgias.html`): "ao clicar em '+ tempo total'
 * quero que também seja possível inserir os tempos individuais de cada cirurgia em
 * que o anestesista está designado".
 *
 * Travas:
 *  1. com 2+ cirurgias a folha do total ganha "Término de cada cirurgia", uma linha
 *     por cirurgia aberta, e o que já existia acima continua gravando o TOTAL;
 *  2. tocar numa cirurgia sobe a folha DELA por cima; o atalho grava SÓ no caso
 *     (pelo mesmo `onDefinirTerminoCaso` do espelho, com `meta.minutos` para o
 *     encadeamento) e a folha do total fica aberta;
 *  3. numa cirurgia que ainda não começou a folha diz de onde a duração conta —
 *     pela mesma função que grava (`inicioDaDuracao`);
 *  4. com UMA cirurgia não há lista: o tempo da folha É o término dela;
 *  5. a frase "nunca é a soma delas" saiu (errada desde 14/09);
 *  6. a folha lê a linha AO VIVO: término gravado por outro aparelho aparece nela.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'
import { inicioDaDuracao } from '@/pages/escala-cirurgica/utils'
import { nomeCurtoProcedimento } from '@/lib/escalaProcedimentoCurto'

const ROSTER = [
  { uid: 'uid-leo', nome: 'LEONARDO FERRAZZO', apelidos: ['LEONARDO'] },
  { uid: 'uid-mar', nome: 'MARILIO JOSE FLACH', apelidos: ['MARILIO'] },
  { uid: 'uid-kar', nome: 'KARINE BEDIN', apelidos: ['KARINE'] },
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

const caso = (sala, ordem, anestesista, cirurgiao, hora, extra = {}) => ({
  id: `${sala}-${ordem}`, sala, ordem, hora, anestesista, cirurgiao, turno: 'vespertino',
  bloco: 'normal', isContinuacao: false, semAnestesista: false, ...extra,
})

const ARTRODESE = 'ARTRODESE DE COLUNA'
const OSTEO = 'OSTEOSSINTESE'
const rot = (p) => nomeCurtoProcedimento(p)

// O card real do Klisman (25/09): Sala 3, 13:00 Artrodese em andamento com término
// 16:30 e 16:00 Osteossíntese ainda por começar. Relógio parado às 15:45.
const escalaDuas = {
  id: 'e1', hospital: 'unimed', data: '2026-09-25',
  ordemLiberacao: { vespertino: ['LEONARDO', 'MARILIO', 'KARINE'] },
  ajudaExterna: {}, liberacoes: {}, linhaOverrides: {},
  casos: [
    caso('Sala 1', 0, 'LEONARDO', 'Liana W', '13:00'),
    caso('Sala 3', 0, 'MARILIO', 'Eduardo Baldissera', '13:00', { procedimento: ARTRODESE, statusCirurgia: 'iniciada', terminoPrevisto: '16:30' }),
    caso('Sala 3', 1, 'MARILIO', 'Carlos Fogaca', '16:00', { procedimento: OSTEO }),
    caso('Sala 5', 0, 'KARINE', 'Farret G', '13:30'),
  ],
}
const escalaUma = { ...escalaDuas, casos: escalaDuas.casos.filter((c) => c.id !== 'Sala 3-1') }

const montar = (props = {}, escala = escalaDuas) => render(
  <LiberacoesView escala={escala} hospital="unimed" hospitalLabel="Unimed" turno="vespertino"
    canEdit onToggle={() => {}} onSetOverride={() => {}}
    // a página resolve a escala dona e chama a MESMA função que grava
    inicioDuracaoCaso={(id, agoraMin) => inicioDaDuracao(escala, escala.casos.find((c) => c.id === id), agoraMin)}
    {...props} />,
  { wrapper: wrap }
)

const abrirTempoTotal = () => fireEvent.click(screen.getByLabelText('Definir tempo faltante de Marilio Flach'))
// a folha que está por cima (a da cirurgia, quando aberta)
const folhaDeCima = () => { const d = screen.getAllByRole('dialog'); return d[d.length - 1] }

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-09-25T15:45:00-03:00'))
})
afterAll(() => vi.useRealTimers())
beforeEach(() => vi.clearAllMocks())

describe('"+ Tempo total" com o término de cada cirurgia (dono 25/09)', () => {
  it('2 cirurgias: a folha lista "Término de cada cirurgia", uma linha por cirurgia, com o término ou "Definir término"', () => {
    montar()
    abrirTempoTotal()
    expect(screen.getByText('Término de cada cirurgia')).toBeInTheDocument()
    const primeira = screen.getByRole('button', { name: `Término de 13:00 ${rot(ARTRODESE)}` })
    const segunda = screen.getByRole('button', { name: `Término de 16:00 ${rot(OSTEO)}` })
    // em andamento, com término: o horário e quanto falta (15:45 → 16:30)
    expect(within(primeira).getByText('16:30')).toBeInTheDocument()
    expect(within(primeira).getByText('faltam 45min')).toBeInTheDocument()
    expect(within(primeira).getByText(/em andamento/)).toBeInTheDocument()
    // agendada, sem término: o convite
    expect(within(segunda).getByText('Definir término')).toBeInTheDocument()
    expect(within(segunda).getByText(/Carlos Fogaca · agendada/)).toBeInTheDocument()
  })

  it('a frase "nunca é a soma delas" saiu: com 2+ a folha diz que, informadas todas, vira o término da última', () => {
    montar()
    abrirTempoTotal()
    expect(screen.queryByText(/nunca é a soma/)).toBeNull()
    expect(screen.getByText('Quando essa pessoa fica livre. Com o término das 2 cirurgias informado, vira o término da última.')).toBeInTheDocument()
  })

  it('o painel de cima continua sendo o TOTAL: "1h" grava a pílula e fecha a folha, sem tocar em caso nenhum', async () => {
    const onSetOverride = vi.fn(async () => {})
    const onDefinirTerminoCaso = vi.fn(async () => {})
    montar({ onSetOverride, onDefinirTerminoCaso })
    abrirTempoTotal()
    fireEvent.click(screen.getByRole('button', { name: '1h' }))
    await waitFor(() => expect(onSetOverride).toHaveBeenCalledTimes(1))
    expect(onSetOverride.mock.calls[0][1].termino).toBe('16:45')
    expect(onDefinirTerminoCaso).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByText('Término de cada cirurgia')).toBeNull())
  })

  it('tocar numa cirurgia sobe a folha DELA; "1h" grava só no caso (com meta.minutos) e a folha do total fica aberta', async () => {
    const onSetOverride = vi.fn(async () => {})
    const onDefinirTerminoCaso = vi.fn(async () => {})
    montar({ onSetOverride, onDefinirTerminoCaso })
    abrirTempoTotal()
    fireEvent.click(screen.getByRole('button', { name: `Término de 16:00 ${rot(OSTEO)}` }))
    const folha = folhaDeCima()
    expect(within(folha).getByText(`Término · 16:00 ${rot(OSTEO)}`)).toBeInTheDocument()
    fireEvent.click(within(folha).getByRole('button', { name: '1h' }))
    await waitFor(() => expect(onDefinirTerminoCaso).toHaveBeenCalledTimes(1))
    const [casoId, hhmm, meta] = onDefinirTerminoCaso.mock.calls[0]
    expect(casoId).toBe('Sala 3-1')
    expect(hhmm).toMatch(/^\d{2}:\d{2}$/)
    // a DURAÇÃO viaja junto: é por ela que a página encadeia depois da anterior (14/09)
    expect(meta).toEqual({ minutos: 60 })
    expect(onSetOverride).not.toHaveBeenCalled()
    // a folha da cirurgia fechou; a do total continua, pronta para a próxima
    await waitFor(() => expect(screen.queryByText(`Término · 16:00 ${rot(OSTEO)}`)).toBeNull())
    expect(screen.getByText('Tempo faltante de Marilio Flach')).toBeInTheDocument()
    expect(screen.getByText('Término de cada cirurgia')).toBeInTheDocument()
  })

  it('cirurgia que ainda não começou: a folha diz de onde a duração conta (fim da anterior)', () => {
    montar()
    abrirTempoTotal()
    fireEvent.click(screen.getByRole('button', { name: `Término de 16:00 ${rot(OSTEO)}` }))
    expect(within(folhaDeCima()).getByText(/Ainda não começou: a duração conta a partir das 16:30, quando termina a anterior\./)).toBeInTheDocument()
  })

  it('cirurgia em andamento: conta de agora — sem a frase do encadeamento', () => {
    montar()
    abrirTempoTotal()
    fireEvent.click(screen.getByRole('button', { name: `Término de 13:00 ${rot(ARTRODESE)}` }))
    const folha = folhaDeCima()
    expect(within(folha).getByText(/Só desta cirurgia \(Eduardo Baldissera\)\./)).toBeInTheDocument()
    expect(within(folha).queryByText(/Ainda não começou/)).toBeNull()
  })

  it('"Limpar" na folha da cirurgia apaga SÓ o término dela', async () => {
    const onSetOverride = vi.fn(async () => {})
    const onDefinirTerminoCaso = vi.fn(async () => {})
    montar({ onSetOverride, onDefinirTerminoCaso })
    abrirTempoTotal()
    fireEvent.click(screen.getByRole('button', { name: `Término de 13:00 ${rot(ARTRODESE)}` }))
    fireEvent.click(within(folhaDeCima()).getByRole('button', { name: 'Limpar' }))
    await waitFor(() => expect(onDefinirTerminoCaso).toHaveBeenCalledWith('Sala 3-0', '', undefined))
    expect(onSetOverride).not.toHaveBeenCalled()
  })

  it('a folha lê a linha AO VIVO: o término gravado com ela aberta (outro aparelho, realtime) aparece na linha', () => {
    const { rerender } = montar()
    abrirTempoTotal()
    expect(within(screen.getByRole('button', { name: `Término de 16:00 ${rot(OSTEO)}` })).getByText('Definir término')).toBeInTheDocument()
    const depois = { ...escalaDuas, casos: escalaDuas.casos.map((c) => (c.id === 'Sala 3-1' ? { ...c, terminoPrevisto: '17:30' } : c)) }
    rerender(
      <LiberacoesView escala={depois} hospital="unimed" hospitalLabel="Unimed" turno="vespertino"
        canEdit onToggle={() => {}} onSetOverride={() => {}} />
    )
    const linha = screen.getByRole('button', { name: `Término de 16:00 ${rot(OSTEO)}` })
    expect(within(linha).getByText('17:30')).toBeInTheDocument()
    expect(within(linha).getByText('faltam 1h45')).toBeInTheDocument()
  })
})

describe('uma cirurgia só: o tempo da folha É o término dela (espelho de 14/09)', () => {
  it('sem lista; a frase diz que é também o término da cirurgia, e a cirurgia aparece só como informação', () => {
    montar({}, escalaUma)
    abrirTempoTotal()
    expect(screen.queryByText('Término de cada cirurgia')).toBeNull()
    expect(screen.getByText('Quando essa pessoa fica livre — é também o término da cirurgia dela.')).toBeInTheDocument()
    // a cirurgia de que se trata, como texto (não é botão: não há segunda entrada)
    expect(within(screen.getByRole('dialog')).getByText(rot(ARTRODESE))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: new RegExp(`^Término de 13:00`) })).toBeNull()
  })

  it('"1h" grava o total E o término da cirurgia, com o mesmo horário (como já era)', async () => {
    const onSetOverride = vi.fn(async () => {})
    const onDefinirTerminoCaso = vi.fn(async () => {})
    montar({ onSetOverride, onDefinirTerminoCaso }, escalaUma)
    abrirTempoTotal()
    fireEvent.click(screen.getByRole('button', { name: '1h' }))
    await waitFor(() => expect(onSetOverride).toHaveBeenCalledTimes(1))
    const termino = onSetOverride.mock.calls[0][1].termino
    await waitFor(() => expect(onDefinirTerminoCaso).toHaveBeenCalledWith('Sala 3-0', termino))
  })
})
