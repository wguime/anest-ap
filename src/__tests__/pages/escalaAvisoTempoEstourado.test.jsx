/**
 * AVISO DE TEMPO ESTOURADO (dono 2026-08-24): "após terminar o tempo
 * estabelecido, quero que o usuário receba uma mensagem para atualizar o tempo
 * (caso o procedimento não tenha terminado)".
 *
 * O aviso tem DUAS metades e elas falham de jeitos diferentes:
 *   1. TELA — pílula âmbar + a frase no card. Não depende de rede nem de opt-in;
 *      é a metade que sempre funciona, e é ela que este arquivo trava primeiro.
 *   2. PUSH — sai do aparelho de quem estiver com a aba aberta. Como num turno
 *      normal há VÁRIAS telas abertas, o invariante que importa é
 *      **"N telas, uma push"**: a trava é a PK da tabela no banco, e só quem
 *      consegue inserir manda. Aqui isso se verifica pelo contrato do serviço —
 *      quem recebe `false` de `reservarAvisoTempo` NÃO pode chamar o push.
 *
 * Escrito como invariante e não como persona porque é a classe de bug que este
 * módulo repete: em 21/08 a folga do badge foi travada num selo só e o defeito
 * seguiu de pé para os outros oito.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'

const ROSTER = [
  { uid: 'uid-leo', nome: 'LEONARDO FERRAZZO', apelidos: ['LEONARDO'] },
  { uid: 'uid-mar', nome: 'MARILIO JOSE FLACH', apelidos: ['MARILIO'] },
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

const reservar = vi.fn()
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({
  default: {
    fetchLocaisHospital: vi.fn(async () => []),
    fetchAvisos: vi.fn(async () => []),
    criarAviso: vi.fn(async () => 'aviso-1'),
    confirmarAviso: vi.fn(async () => {}),
    excluirAviso: vi.fn(async () => {}),
    reservarAvisoTempo: (...a) => reservar(...a),
  },
}))

const enviarPush = vi.fn(async () => ({ enviados: 1 }))
vi.mock('@/services/pushDispatchService', () => ({
  enviarPush: (...a) => enviarPush(...a),
  enviarPushBestEffort: vi.fn(),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const caso = (sala, ordem, anestesista, cirurgiao, hora, extra = {}) => ({
  id: `${sala}-${ordem}`, sala, ordem, hora, anestesista, cirurgiao,
  bloco: 'normal', isContinuacao: false, semAnestesista: false, ...extra,
})

// relógio congelado às 10:00 → um término às 09:30 já estourou; 10:45 ainda não
const escalaBase = {
  id: '11111111-1111-1111-1111-111111111111', hospital: 'hro', data: '2026-07-29',
  ordemLiberacao: { matutino: ['LEONARDO', 'MARILIO'] },
  ajudaExterna: {}, liberacoes: {},
  linhaOverrides: { 'matutino:uid-leo': { termino: '09:30' } },
  casos: [
    caso('Sala 1', 0, 'LEONARDO', 'Liana W', '07:30'),
    caso('Sala 2', 0, 'MARILIO', 'Taciana A', '07:30'),
  ],
}

const montar = (props = {}, e = escalaBase) => render(
  <LiberacoesView escala={e} hospital="hro" hospitalLabel="HRO" turno="matutino"
    canEdit onToggle={() => {}} onSetOverride={() => {}} {...props} />,
  { wrapper: wrap }
)

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-07-29T10:00:00-03:00'))
})
afterAll(() => vi.useRealTimers())
beforeEach(() => { reservar.mockReset(); enviarPush.mockReset(); reservar.mockResolvedValue(true) })

const cardDe = (chave) => document.querySelector(`[data-linha="${chave}"]`)

describe('Tempo estourado — a metade que aparece na TELA', () => {
  it('a pílula vira âmbar e o card pede para atualizar', () => {
    montar()
    const card = cardDe('uid-leo')
    const pilula = within(card).getByTitle(/toque para atualizar o tempo/)
    // âmbar é a tinta que esta tela já usa para "passou do previsto" (o tempo da
    // cirurgia estourada e o badge Atrasada). Verde diria "está tudo correndo".
    expect(pilula.className).toContain('bg-warning')
    expect(pilula.className).not.toContain('bg-primary')
    expect(within(card).getByText(/Atualize o tempo se a cirurgia não terminou/)).toBeTruthy()
  })

  it('enquanto o tempo NÃO estourou nada disso aparece', () => {
    montar({}, { ...escalaBase, linhaOverrides: { 'matutino:uid-leo': { termino: '10:45' } } })
    const card = cardDe('uid-leo')
    const pilula = within(card).getByTitle(/toque para ajustar/)
    expect(pilula.className).toContain('bg-primary')
    expect(within(card).queryByText(/Atualize o tempo/)).toBeNull()
  })

  it('quem não informou tempo nenhum segue com o convite de preencher', () => {
    montar()
    const card = cardDe('uid-mar')
    expect(within(card).getByLabelText(/Definir tempo faltante/)).toBeTruthy()
    expect(within(card).queryByText(/Atualize o tempo/)).toBeNull()
  })
})

describe('Tempo estourado — INVARIANTE: N telas abertas, UMA push', () => {
  it('só manda a push quem GANHOU a reserva no banco', async () => {
    reservar.mockResolvedValue(true)
    montar()
    await waitFor(() => expect(enviarPush).toHaveBeenCalledTimes(1))
    expect(reservar).toHaveBeenCalledWith(escalaBase.id, 'matutino', 'uid-leo', '09:30')
    expect(enviarPush.mock.calls[0][0].userIds).toEqual(['uid-leo'])
  })

  it('quem PERDEU a corrida não manda push nenhuma — é a outra tela aberta', async () => {
    reservar.mockResolvedValue(false)
    montar()
    await waitFor(() => expect(reservar).toHaveBeenCalled())
    // dá tempo de a push sair, se fosse sair
    await new Promise((r) => setTimeout(r, 20))
    expect(enviarPush).not.toHaveBeenCalled()
  })

  it('o alvo entra na reserva: é ele que rearma o aviso quando o tempo é atualizado', async () => {
    montar({}, { ...escalaBase, linhaOverrides: { 'matutino:uid-leo': { termino: '08:15' } } })
    await waitFor(() => expect(reservar).toHaveBeenCalled())
    expect(reservar.mock.calls[0][3]).toBe('08:15')
  })
})

describe('Tempo estourado — a quem NÃO se manda push', () => {
  it('quem já foi liberado não recebe: saiu, o tempo dele não vale mais', async () => {
    montar({}, {
      ...escalaBase,
      liberacoes: { 'matutino:uid-leo': { liberadoEm: '2026-07-29T09:40:00-03:00' } },
    })
    await new Promise((r) => setTimeout(r, 20))
    expect(reservar).not.toHaveBeenCalled()
  })

  it('quem terminou todas as cirurgias não recebe (é o "caso o procedimento não tenha terminado")', async () => {
    montar({}, {
      ...escalaBase,
      casos: [
        caso('Sala 1', 0, 'LEONARDO', 'Liana W', '07:30', { statusCirurgia: 'terminada' }),
        caso('Sala 2', 0, 'MARILIO', 'Taciana A', '07:30'),
      ],
    })
    await new Promise((r) => setTimeout(r, 20))
    expect(reservar).not.toHaveBeenCalled()
  })

  it('LGPD: o texto da push não leva paciente — só o horário que estourou', async () => {
    montar()
    await waitFor(() => expect(enviarPush).toHaveBeenCalled())
    const { body, title } = enviarPush.mock.calls[0][0]
    expect(`${title} ${body}`).toContain('09:30')
    // nada da cirurgia entra: nem iniciais, nem procedimento, nem cirurgião
    expect(`${title} ${body}`).not.toMatch(/Liana|Sala 1/)
  })

  it('a escala DEMO não fala com o banco nem manda push', async () => {
    montar({}, { ...escalaBase, id: 'demo-1' })
    await new Promise((r) => setTimeout(r, 20))
    expect(reservar).not.toHaveBeenCalled()
    expect(enviarPush).not.toHaveBeenCalled()
  })
})

describe('Recado do plantonista → push (dono 24/08)', () => {
  it('a tela avisa que o recado chega no celular e que nem iniciais entram', async () => {
    // sou o 1º do rodapé = plantonista do turno; é ele, e só ele, que envia
    montar({ meuUid: 'uid-leo', meuNome: 'Leonardo Ferrazzo' })
    // o botão só existe para o plantonista do turno; a faixa explica o alcance
    // ⚠️ sem o `getBy` isto seria um teste que passa vazio: o botão só existe
    // para o plantonista do turno, e a fixture precisa identificá-lo.
    const botao = screen.getByRole('button', { name: /Mensagem para equipe/ })
    botao.click()
    await waitFor(() => expect(screen.getByText(/Chega também como notificação no celular/)).toBeTruthy())
    expect(screen.getByText(/nem iniciais/)).toBeTruthy()
  })
})
