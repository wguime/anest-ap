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
    {...props} />,
  { wrapper: wrap }
)

const abrirTempoTotal = () => fireEvent.click(screen.getByLabelText('Informar o tempo total de Marílio Flach'))
// o botão do tempo estimado de UMA cirurgia (o nome acessível termina com o valor)
const estimado = (hora, proc) => screen.getByRole('button', { name: new RegExp(`^Tempo estimado de ${hora} ${proc}`) })
// a folha que está por cima (a da cirurgia, quando aberta)
const folhaDeCima = () => { const d = screen.getAllByRole('dialog'); return d[d.length - 1] }

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-09-25T15:45:00-03:00'))
})
afterAll(() => vi.useRealTimers())
beforeEach(() => vi.clearAllMocks())

// ⚠️ 27/10 (dono, Modelo 2 da 4ª rodada de `.tmp/horarios-auditoria/`): a folha virou "Tempo
// total · Nome" com dois blocos — "Previsão de saída" (o total, sem alternador) e "O que já
// aconteceu" (horário real); o estimado de cada cirurgia é um link leve ao lado do nome. Na
// cirurgia que ainda não começou o estimado é DURAÇÃO (conta do início) — o encadeamento no
// término da anterior (14/09, trava 3 acima) MUDOU DE LADO.
// ⚠️ 10/11/2026 (dono: "Sim, aprovo" o modelo A de `.tmp/analise-escala-2026-11/modelos-2/`):
// a folha chama-se "Tempo total de {Nome}", o campo é "{Nome} fica até" (era "Previsão de
// saída") e embaixo vem "Cirurgias de {Nome} · horários de cada uma", cada uma com o nome no
// título e as TRÊS casas — Início · Tempo estimado · Término (era "O que já aconteceu", dois
// blocos e o link "estimar"). Os testes abaixo mudaram de palavras; o que cada toque grava
// é o mesmo.
describe('"+ Tempo total" com o horário de cada cirurgia (dono 25/09; Modelo 2 em 27/10; modelo A em 10/11)', () => {
  it('2 cirurgias: cada uma com o nome no título e as três casas; o tempo estimado é a do meio', () => {
    const onAbrirCaso = vi.fn()
    montar({ onAbrirCaso })
    abrirTempoTotal()
    expect(screen.getByText('Marílio fica até')).toBeInTheDocument()
    expect(screen.queryByText('Previsão de saída')).toBeNull()
    expect(screen.queryByText('O que já aconteceu')).toBeNull()
    expect(screen.getByText('Cirurgias de Marílio')).toBeInTheDocument()
    const blocos = [...document.querySelectorAll('[data-cirurgia-tempos]')]
    expect(blocos).toHaveLength(2)
    expect(blocos[0].textContent).toContain(`13:00 · ${rot(ARTRODESE)}`)
    expect([...blocos[0].querySelectorAll('[data-casa]')].map((n) => n.getAttribute('data-casa'))).toEqual(['Início', 'Tempo estimado', 'Término'])
    // em andamento, com estimado: o horário e quanto falta, na casa do tempo estimado
    expect(estimado('13:00', rot(ARTRODESE)).textContent).toBe('Tempo estimado16:30faltam 45min')
    // agendada, sem estimativa: traço e "ainda não informado" (era o link "estimar")
    expect(estimado('16:00', rot(OSTEO)).textContent).toBe('Tempo estimado—ainda não informado')
    // "abrir" leva à cirurgia na Completa
    fireEvent.click(screen.getByRole('button', { name: `Abrir a cirurgia 16:00 ${rot(OSTEO)}` }))
    expect(onAbrirCaso).toHaveBeenCalledWith('Sala 3-1')
  })

  it('título numa linha e a frase sem gênero: é o total de TODAS as cirurgias da pessoa', () => {
    montar()
    abrirTempoTotal()
    const folha = screen.getByRole('dialog')
    expect(within(folha).getByText('Tempo total de Marílio Flach')).toBeInTheDocument()
    expect(folha.textContent).toContain('Até quando Marílio fica no turno, contando as 2 cirurgias. Informado à mão: não é a soma delas.')
    expect(folha.textContent).not.toMatch(/escalad[oa]/)
    expect(within(folha).queryByText(/nunca é a soma/)).toBeNull()
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
    await waitFor(() => expect(screen.queryByText('Cirurgias de Marílio')).toBeNull())
  })

  it('na cirurgia EM ANDAMENTO, "1h" grava só no caso (com meta.minutos) e a folha do total fica aberta', async () => {
    const onSetOverride = vi.fn(async () => {})
    const onDefinirTerminoCaso = vi.fn(async () => {})
    montar({ onSetOverride, onDefinirTerminoCaso })
    abrirTempoTotal()
    fireEvent.click(estimado('13:00', rot(ARTRODESE)))
    const folha = folhaDeCima()
    expect(within(folha).getByText(`Tempo estimado · 13:00 ${rot(ARTRODESE)}`)).toBeInTheDocument()
    expect(within(folha).getByText(/Só desta cirurgia \(Eduardo Baldissera\)\./)).toBeInTheDocument()
    fireEvent.click(within(folha).getByRole('button', { name: '1h' }))
    await waitFor(() => expect(onDefinirTerminoCaso).toHaveBeenCalledTimes(1))
    const [casoId, hhmm, meta] = onDefinirTerminoCaso.mock.calls[0]
    expect(casoId).toBe('Sala 3-0')
    expect(hhmm).toMatch(/^\d{2}:\d{2}$/)
    expect(meta).toEqual({ minutos: 60 })
    expect(onSetOverride).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByText(`Tempo estimado · 13:00 ${rot(ARTRODESE)}`)).toBeNull())
    expect(screen.getByText('Tempo total de Marílio Flach')).toBeInTheDocument()
  })

  it('na que ainda NÃO começou: só durações, "conta do início", e grava a DURAÇÃO (27/10)', async () => {
    const onDefinirDuracaoCaso = vi.fn(async () => {})
    const onDefinirTerminoCaso = vi.fn(async () => {})
    montar({ onDefinirDuracaoCaso, onDefinirTerminoCaso })
    abrirTempoTotal()
    fireEvent.click(estimado('16:00', rot(OSTEO)))
    const folha = folhaDeCima()
    expect(within(folha).getByText(/a duração começa a contar quando ela for marcada Iniciada/)).toBeInTheDocument()
    expect(within(folha).queryByText(/quando termina a anterior/)).toBeNull()
    expect(folha.querySelector('[data-slot="termino-hora"]')).toBeNull()
    fireEvent.click(within(folha).getByRole('button', { name: '1h' }))
    await waitFor(() => expect(onDefinirDuracaoCaso).toHaveBeenCalledWith('Sala 3-1', 60))
    expect(onDefinirTerminoCaso).not.toHaveBeenCalled()
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

  it('a folha lê a linha AO VIVO: a duração gravada com ela aberta (outro aparelho, realtime) aparece na linha', () => {
    const { rerender } = montar()
    abrirTempoTotal()
    expect(estimado('16:00', rot(OSTEO)).textContent).toBe('Tempo estimado—ainda não informado')
    const depois = { ...escalaDuas, casos: escalaDuas.casos.map((c) => (c.id === 'Sala 3-1' ? { ...c, duracaoEstimadaMin: 90 } : c)) }
    rerender(
      <LiberacoesView escala={depois} hospital="unimed" hospitalLabel="Unimed" turno="vespertino"
        canEdit onToggle={() => {}} onSetOverride={() => {}} />
    )
    const linha = estimado('16:00', rot(OSTEO))
    // 10/11 (modelo A): "1h30 · duração prevista" na casa; na fila, "Tempo estimado 1h30 · não começou"
    expect(linha.textContent).toBe('Tempo estimado1h30duração prevista')
    expect(document.body.textContent).toContain('Tempo estimado 1h30· não começou')
  })
})

describe('uma cirurgia só, em andamento: o tempo da folha É o término dela (espelho de 14/09)', () => {
  // ⚠️ FIXTURE CORRIGIDA em 10/11/2026: este teste montava a cirurgia com estimado 16:30 e a
  // pílula VAZIA e exigia "estimado = tempo acima" — a frase mentia (acima não havia nada)
  // e era exatamente o estado que o dono apontou: "os tempos devem conversar entre si e
  // NÃO produzir tempos distintos". Agora o total é o espelho (16:30), como o app grava.
  // ↳ 10/11 à noite (modelo A aprovado): a frase "estimado = tempo acima" SAIU — a cirurgia
  // mostra as três casas como qualquer outra, e a do tempo estimado traz o mesmo horário do
  // total. Um toque nela abre a folha do tempo estimado (que grava no caso e espelha no total).
  it('a cirurgia única mostra as três casas; o tempo estimado dela é o mesmo horário do total', () => {
    // os blocos só viram botão com quem grava (a página passa os dois handlers)
    montar({ onDefinirInicioCaso: vi.fn(async () => {}), onDefinirTerminoRealCaso: vi.fn(async () => {}) },
      { ...escalaUma, linhaOverrides: { 'vespertino:MARILIO': { termino: '16:30' } } })
    fireEvent.click(screen.getByRole('button', { name: /45min/ }))
    expect(screen.getByText('Cirurgias de Marílio')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(`^Início de 13:00 ${rot(ARTRODESE)}`) })).toBeInTheDocument()
    expect(screen.queryByText('estimado = tempo acima')).toBeNull()
    expect(screen.getByRole('dialog').textContent).toContain('Até quando Marílio fica — é também o tempo estimado da cirurgia.')
    expect(estimado('13:00', rot(ARTRODESE)).textContent).toBe('Tempo estimado16:30faltam 45min')
  })

  it('estimado DIFERENTE do total (dado antigo): a casa mostra o estimado DELA, sem frase que os iguale', () => {
    montar({ onDefinirInicioCaso: vi.fn(async () => {}), onDefinirTerminoRealCaso: vi.fn(async () => {}) }, escalaUma)
    abrirTempoTotal()
    expect(screen.queryByText('estimado = tempo acima')).toBeNull()
    expect(estimado('13:00', rot(ARTRODESE))).toHaveTextContent('16:30')
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

  it('a única cirurgia AGENDADA não recebe o total como término: ela guarda duração (27/10)', async () => {
    const onSetOverride = vi.fn(async () => {})
    const onDefinirTerminoCaso = vi.fn(async () => {})
    const soAgendada = { ...escalaDuas, casos: escalaDuas.casos.filter((c) => c.id !== 'Sala 3-0') }
    montar({ onSetOverride, onDefinirTerminoCaso }, soAgendada)
    abrirTempoTotal()
    fireEvent.click(screen.getAllByRole('button', { name: '1h' })[0])
    await waitFor(() => expect(onSetOverride).toHaveBeenCalledTimes(1))
    expect(onDefinirTerminoCaso).not.toHaveBeenCalled()
  })
})
