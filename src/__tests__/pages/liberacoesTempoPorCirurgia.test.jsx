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
 *
 * ⚠️ 02/10 (dono: "início e fim de cada procedimento", modelo A em protótipo
 * `.tmp/inicio-termino-cirurgia.html`): a lista virou "Horário de cada cirurgia" — cada
 * cirurgia ganhou o bloco INÍCIO ao lado do TÉRMINO. As travas acima continuam, pelo
 * botão do bloco TÉRMINO (mesmo nome acessível "Término de 16:00 …"); a identidade da
 * cirurgia (cirurgião · andamento) saiu de dentro do botão e virou a linha acima dos
 * blocos, e o convite vazio é "Definir" (o rótulo TÉRMINO já está no bloco). Com UMA
 * cirurgia a lista aparece agora, só para o início (ver o describe dela).
 *
 * ⚠️ 02/10, tarde (protótipo `.tmp/horario-compacto.html`): o bloco TÉRMINO virou o
 * horário REAL (confirmado no card) e o término PREVISTO de cada cirurgia — o que estas
 * travas sempre cobriram — virou o botão "Tempo estimado" AO LADO DO NOME da cirurgia
 * (nome acessível "Tempo estimado de 16:00 …", folha "Tempo estimado · …"). A folha do
 * total chama-se "Tempo total estimado · Nome" e diz que é de TODAS as N cirurgias. O
 * painel abre no "Horário de término"; a duração é um toque na aba "Tempo faltante".
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

const abrirTempoTotal = () => fireEvent.click(screen.getByLabelText('Definir tempo faltante de Marílio Flach'))
// o botão do tempo estimado de UMA cirurgia (o nome acessível termina com o valor)
const estimado = (hora, proc) => screen.getByRole('button', { name: new RegExp(`^Tempo estimado de ${hora} ${proc}`) })
// a duração é a 2ª aba do painel (02/10): o toque vai na folha de cima
const abaDuracao = (folha = folhaDeCima()) => fireEvent.click(within(folha).getByRole('tab', { name: 'Tempo faltante' }))
// a folha que está por cima (a da cirurgia, quando aberta)
const folhaDeCima = () => { const d = screen.getAllByRole('dialog'); return d[d.length - 1] }

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-09-25T15:45:00-03:00'))
})
afterAll(() => vi.useRealTimers())
beforeEach(() => vi.clearAllMocks())

describe('"+ Tempo total" com o término de cada cirurgia (dono 25/09)', () => {
  it('2 cirurgias: a folha lista "Horário de cada cirurgia", o tempo estimado ao lado do nome', () => {
    montar()
    abrirTempoTotal()
    expect(screen.getByText('Horário de cada cirurgia')).toBeInTheDocument()
    const primeira = estimado('13:00', rot(ARTRODESE))
    const segunda = estimado('16:00', rot(OSTEO))
    // em andamento, com término: o horário e quanto falta (15:45 → 16:30)
    expect(within(primeira).getByText('16:30')).toBeInTheDocument()
    expect(within(primeira).getByText('faltam 45min')).toBeInTheDocument()
    expect(screen.getByText(/Eduardo Baldissera · em andamento/)).toBeInTheDocument()
    // agendada, sem estimativa: o convite
    expect(within(segunda).getByText('Tempo estimado')).toBeInTheDocument()
    expect(screen.getByText(/Carlos Fogaca · agendada/)).toBeInTheDocument()
  })

  it('direto ao ponto (02/10): é o tempo total estimado de TODAS as cirurgias da pessoa', () => {
    montar()
    abrirTempoTotal()
    const folha = screen.getByRole('dialog')
    expect(within(folha).getByText('Tempo total estimado · Marílio Flach')).toBeInTheDocument()
    expect(folha.textContent).toContain('Até quando Marílio termina todas as 2 cirurgias em que está escalado.')
    expect(folha.textContent).toContain('Com o tempo de cada cirurgia informado abaixo, ele vira o término da última.')
    expect(within(folha).queryByText(/nunca é a soma/)).toBeNull()
  })

  it('o painel de cima continua sendo o TOTAL: "1h" grava a pílula e fecha a folha, sem tocar em caso nenhum', async () => {
    const onSetOverride = vi.fn(async () => {})
    const onDefinirTerminoCaso = vi.fn(async () => {})
    montar({ onSetOverride, onDefinirTerminoCaso })
    abrirTempoTotal()
    abaDuracao()
    fireEvent.click(screen.getByRole('button', { name: '1h' }))
    await waitFor(() => expect(onSetOverride).toHaveBeenCalledTimes(1))
    expect(onSetOverride.mock.calls[0][1].termino).toBe('16:45')
    expect(onDefinirTerminoCaso).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByText('Horário de cada cirurgia')).toBeNull())
  })

  it('tocar numa cirurgia sobe a folha DELA; "1h" grava só no caso (com meta.minutos) e a folha do total fica aberta', async () => {
    const onSetOverride = vi.fn(async () => {})
    const onDefinirTerminoCaso = vi.fn(async () => {})
    montar({ onSetOverride, onDefinirTerminoCaso })
    abrirTempoTotal()
    fireEvent.click(estimado('16:00', rot(OSTEO)))
    const folha = folhaDeCima()
    expect(within(folha).getByText(`Tempo estimado · 16:00 ${rot(OSTEO)}`)).toBeInTheDocument()
    abaDuracao(folha)
    fireEvent.click(within(folha).getByRole('button', { name: '1h' }))
    await waitFor(() => expect(onDefinirTerminoCaso).toHaveBeenCalledTimes(1))
    const [casoId, hhmm, meta] = onDefinirTerminoCaso.mock.calls[0]
    expect(casoId).toBe('Sala 3-1')
    expect(hhmm).toMatch(/^\d{2}:\d{2}$/)
    // a DURAÇÃO viaja junto: é por ela que a página encadeia depois da anterior (14/09)
    expect(meta).toEqual({ minutos: 60 })
    expect(onSetOverride).not.toHaveBeenCalled()
    // a folha da cirurgia fechou; a do total continua, pronta para a próxima
    await waitFor(() => expect(screen.queryByText(`Tempo estimado · 16:00 ${rot(OSTEO)}`)).toBeNull())
    expect(screen.getByText('Tempo total estimado · Marílio Flach')).toBeInTheDocument()
    expect(screen.getByText('Horário de cada cirurgia')).toBeInTheDocument()
  })

  it('cirurgia que ainda não começou: a folha diz de onde a duração conta (fim da anterior)', () => {
    montar()
    abrirTempoTotal()
    fireEvent.click(estimado('16:00', rot(OSTEO)))
    expect(within(folhaDeCima()).getByText(/Ainda não começou: a duração conta a partir das 16:30, quando termina a anterior\./)).toBeInTheDocument()
  })

  it('cirurgia em andamento: conta de agora — sem a frase do encadeamento', () => {
    montar()
    abrirTempoTotal()
    fireEvent.click(estimado('13:00', rot(ARTRODESE)))
    const folha = folhaDeCima()
    expect(within(folha).getByText(/Só desta cirurgia \(Eduardo Baldissera\)\./)).toBeInTheDocument()
    expect(within(folha).queryByText(/Ainda não começou/)).toBeNull()
  })

  it('"Limpar" na folha da cirurgia apaga SÓ o término dela', async () => {
    const onSetOverride = vi.fn(async () => {})
    const onDefinirTerminoCaso = vi.fn(async () => {})
    montar({ onSetOverride, onDefinirTerminoCaso })
    abrirTempoTotal()
    fireEvent.click(estimado('13:00', rot(ARTRODESE)))
    fireEvent.click(within(folhaDeCima()).getByRole('button', { name: 'Limpar' }))
    await waitFor(() => expect(onDefinirTerminoCaso).toHaveBeenCalledWith('Sala 3-0', '', undefined))
    expect(onSetOverride).not.toHaveBeenCalled()
  })

  it('a folha lê a linha AO VIVO: o término gravado com ela aberta (outro aparelho, realtime) aparece na linha', () => {
    const { rerender } = montar()
    abrirTempoTotal()
    expect(within(estimado('16:00', rot(OSTEO))).getByText('Tempo estimado')).toBeInTheDocument()
    const depois = { ...escalaDuas, casos: escalaDuas.casos.map((c) => (c.id === 'Sala 3-1' ? { ...c, terminoPrevisto: '17:30' } : c)) }
    rerender(
      <LiberacoesView escala={depois} hospital="unimed" hospitalLabel="Unimed" turno="vespertino"
        canEdit onToggle={() => {}} onSetOverride={() => {}} />
    )
    const linha = estimado('16:00', rot(OSTEO))
    expect(within(linha).getByText('17:30')).toBeInTheDocument()
    expect(within(linha).getByText('faltam 1h45')).toBeInTheDocument()
  })
})

describe('uma cirurgia só: o tempo da folha É o término dela (espelho de 14/09)', () => {
  it('o tempo estimado dela NÃO é segunda entrada; a frase diz que é também o tempo dela', () => {
    // os blocos só viram botão com quem grava (a página passa os dois handlers)
    montar({ onDefinirInicioCaso: vi.fn(async () => {}), onDefinirTerminoRealCaso: vi.fn(async () => {}) }, escalaUma)
    abrirTempoTotal()
    // 02/10: a lista aparece com UMA cirurgia ("Horário da cirurgia") para o início e o
    // término REAIS; o tempo estimado dela é o tempo de cima, mostrado sem botão
    expect(screen.queryByText('Horário de cada cirurgia')).toBeNull()
    expect(screen.getByText('Horário da cirurgia')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(`^Início de 13:00 ${rot(ARTRODESE)}`) })).toBeInTheDocument()
    expect(screen.getByText('estimado = tempo acima')).toBeInTheDocument()
    expect(screen.getByRole('dialog').textContent).toContain('Até quando Marílio termina a cirurgia em que está escalado — é também o tempo estimado dela.')
    expect(within(screen.getByRole('dialog')).getByText(rot(ARTRODESE))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Tempo estimado de 13:00/ })).toBeNull()
  })

  it('"1h" grava o total E o término da cirurgia, com o mesmo horário (como já era)', async () => {
    const onSetOverride = vi.fn(async () => {})
    const onDefinirTerminoCaso = vi.fn(async () => {})
    montar({ onSetOverride, onDefinirTerminoCaso }, escalaUma)
    abrirTempoTotal()
    abaDuracao()
    fireEvent.click(screen.getByRole('button', { name: '1h' }))
    await waitFor(() => expect(onSetOverride).toHaveBeenCalledTimes(1))
    const termino = onSetOverride.mock.calls[0][1].termino
    await waitFor(() => expect(onDefinirTerminoCaso).toHaveBeenCalledWith('Sala 3-0', termino))
  })
})
