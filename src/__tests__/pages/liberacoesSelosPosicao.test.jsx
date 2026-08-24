/**
 * POSIÇÃO DOS SELOS no card da fila (Liberações) — dono 24/08: "alguns badges
 * estão aparecendo muito próximos".
 *
 * Medido no app com dados de produção a 375px antes de mexer:
 *  · o selo "Plantão da tarde" terminava a 0px do "+ Tempo total" logo abaixo —
 *    encostado. Acontece em METADE da fila, porque quando as infos da esquerda
 *    são curtas (linha liberada, linha sem cirurgião) a coluna da direita é o
 *    elemento mais alto do card e começa colada no fim da 1ª linha;
 *  · com nome longo + 3 selos, o último parava a 1px da borda ARREDONDADA do
 *    card e o nome era esmagado a "Le…".
 *
 * A folga da coluna já existia desde 21/08, mas SÓ para o badge roxo
 * ("Passa para tarde"), que foi o selo daquele relato — os outros oito selos da
 * 1ª linha ficaram de fora e o defeito seguiu de pé. É por isso que o teste
 * abaixo é escrito como INVARIANTE ("havendo selo, há folga"), e não como o
 * caso de um selo: a mesma regressão já voltou uma vez por ter sido travada
 * estreita demais.
 *
 * ⚠️ jsdom não faz layout: aqui se verifica a REGRA gravada nas classes (é ela
 * que decide a geometria). A medida em pixels vive no e2e
 * `escala-cirurgica-acoes-layout.spec.ts`, que roda num browser de verdade.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'

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
  default: {
    // aviso de tempo estourado (24/08): sem isto o hook rejeita solto
    reservarAvisoTempo: vi.fn(async () => false), fetchLocaisHospital: vi.fn(async () => []) },
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const caso = (sala, ordem, anestesista, cirurgiao, hora, extra = {}) => ({
  id: `${sala}-${ordem}`, sala, ordem, hora, anestesista, cirurgiao,
  bloco: 'normal', isContinuacao: false, semAnestesista: false, ...extra,
})

// LEONARDO abre o rodapé (= Plantonista, selo) · MARILIO no meio, sem selo
// nenhum · KARINE fecha o rodapé (= plantão do turno seguinte, selo).
const escala = {
  id: 'e1', hospital: 'hro', data: '2026-07-29',
  ordemLiberacao: { matutino: ['LEONARDO', 'MARILIO', 'KARINE'] },
  ajudaExterna: {}, liberacoes: {}, linhaOverrides: {},
  casos: [
    caso('Sala 1', 0, 'LEONARDO', 'Liana W', '07:30'),
    caso('Sala 2', 0, 'MARILIO', 'Taciana A', '07:30'),
    caso('Sala 3', 0, 'KARINE', 'Farret G', '07:30'),
  ],
}

const montar = (props = {}, e = escala) => render(
  <LiberacoesView escala={e} hospital="hro" hospitalLabel="HRO" turno="matutino"
    canEdit onToggle={() => {}} onSetOverride={() => {}} {...props} />,
  { wrapper: wrap }
)

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-07-29T10:00:00-03:00'))
})
afterAll(() => vi.useRealTimers())

const cardDe = (nome) => screen.getByLabelText(`Editar local/cirurgião de ${nome}`).closest('[data-linha]')
/** 1ª linha do card: selo do plantão noturno + nome + selos de estado. */
const linhaDoNome = (card) => card.querySelector('p.flex.items-center')
/** coluna da direita: cronômetro em cima, "Editar" no canto inferior. */
const colunaDireita = (card) => card.querySelector('div.flex.shrink-0.flex-col.items-end')
const selosDe = (card) => [...linhaDoNome(card).querySelectorAll('[data-slot="badge"]')]
  .map((b) => b.textContent.trim())

describe('Selos da 1ª linha × coluna do cronômetro (dono 24/08)', () => {
  it('INVARIANTE: havendo QUALQUER selo ao lado do nome, a coluna da direita desce', () => {
    montar()
    for (const nome of ['Leonardo Ferrazzo', 'Marilio Flach', 'Karine Bedin']) {
      const card = cardDe(nome)
      const temSelo = selosDe(card).length > 0
      const desce = colunaDireita(card).className.includes('mt-2')
      expect(`${nome}: selo=${temSelo} folga=${desce}`).toBe(`${nome}: selo=${temSelo} folga=${temSelo}`)
    }
  })

  it('o recorte real: o plantonista e o plantão do turno seguinte têm selo; o do meio não', () => {
    montar()
    // se estes deixarem de ter selo, o invariante acima passaria vazio e não
    // provaria nada — é este caso que garante que ele está exercitando algo
    expect(selosDe(cardDe('Leonardo Ferrazzo'))).toContain('Plantonista')
    expect(selosDe(cardDe('Karine Bedin'))).toContain('Plantão da tarde')
    expect(selosDe(cardDe('Marilio Flach'))).toEqual([])
  })

  it('a linha do nome tem piso de margem à direita — selo não encosta na borda do card', () => {
    montar()
    // `shrink-0` nos selos + `truncate` só no nome = com 3 selos o último ia até
    // a borda arredondada. O `pr` é o que garante a folga quando a linha estoura.
    for (const nome of ['Leonardo Ferrazzo', 'Marilio Flach', 'Karine Bedin']) {
      expect(linhaDoNome(cardDe(nome)).className).toContain('pr-1.5')
    }
  })

  it('o nome cede antes do selo: continua sendo o único elástico da linha', () => {
    montar()
    const card = cardDe('Leonardo Ferrazzo')
    const nome = [...linhaDoNome(card).children].find((el) => el.tagName === 'SPAN' && !el.dataset.slot)
    expect(nome.className).toContain('truncate')
    expect(nome.className).toContain('min-w-0')
    // todo selo é rígido — sem isto o badge encolheria e o texto dele quebraria
    for (const selo of linhaDoNome(card).querySelectorAll('[data-slot="badge"]')) {
      expect(selo.className).toContain('shrink-0')
    }
  })
})

describe('"Passa para tarde" — o selo que fica SEMPRE em cima do cronômetro', () => {
  const escalaPassaTarde = {
    ...escala,
    casos: [
      caso('Sala 1', 0, 'LEONARDO', 'Liana W', '07:30', { turno: 'matutino', statusExtra: 'passa_tarde', anestesistaUserId: 'uid-leo' }),
      caso('Sala 2', 0, 'MARILIO', 'Taciana A', '07:30'),
      caso('Sala 3', 0, 'KARINE', 'Farret G', '07:30'),
    ],
  }

  it('vai para o canto direito e fecha os 10px da coluna de baixo', () => {
    montar({}, escalaPassaTarde)
    const card = cardDe('Leonardo Ferrazzo')
    const selo = [...linhaDoNome(card).querySelectorAll('[data-slot="badge"]')]
      .find((b) => /Passa para/.test(b.textContent))
    expect(selo).toBeTruthy()
    // ml-auto = canto superior direito (dono 20/08); o mr fecha a diferença
    // entre o pr da linha e o pr-2.5 da coluna — 2px de desencontro entre dois
    // pills empilhados se enxergam.
    expect(selo.className).toContain('ml-auto')
    expect(selo.className).toContain('mr-1')
    expect(colunaDireita(card).className).toContain('pr-2.5')
    expect(colunaDireita(card).className).toContain('mt-2')
  })
})
