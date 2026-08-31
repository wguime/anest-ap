/**
 * QUEM ESTÁ DE AJUDA EM OUTRO HOSPITAL (dono 2026-08-30/31 — caso Oscar).
 *
 * Duas telas, uma pessoa:
 *
 *  · NA ESCALA DELE (Unimed, onde está no rodapé e não tem cirurgia): "deve
 *    permanecer na lista de liberações da Unimed, ser marcado como ajuda e
 *    conter no card local/cirurgia/cirurgião onde ele está". Antes ele nascia
 *    "Liberado" — a conta olhava só esta escala, e não ter caso AQUI era lido
 *    como não ter trabalho.
 *
 *  · NA ESCALA ONDE AJUDA (HRO, onde tem cirurgia e não está no rodapé): é o
 *    PRIMEIRO a ser liberado — inclusive antes do plantão do contraturno DAQUI.
 *    "Oscar sai antes de Guilherme Xavier porque Guilherme é plantão do
 *    contraturno mas não está como ajuda." Quem ajuda é de outro hospital e tem
 *    plantão e fila próprios para voltar; segurá-lo prende duas escalas.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'

const ROSTER = [
  { uid: 'uid-leo', nome: 'LEONARDO FERRAZZO', apelidos: ['LEONARDO'] },
  { uid: 'uid-osc', nome: 'OSCAR MORAIS', apelidos: ['OSCAR'] },
  { uid: 'uid-gui', nome: 'GUILHERME XAVIER', apelidos: ['GUILHERME X'] },
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
const caso = (id, sala, anestesista, cirurgiao) => ({
  id, sala, ordem: 0, hora: '07:30', anestesista, cirurgiao, bloco: 'normal',
})

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-08-31T09:00:00-03:00'))
})
afterAll(() => vi.useRealTimers())

const cardDe = (nome) => screen.getByLabelText(`Editar local/cirurgião de ${nome}`).closest('[data-linha]')
const selosDe = (nome) => [...cardDe(nome).querySelectorAll('[data-slot="badge"]')].map((b) => b.textContent.trim())
const ordemDaFila = (container) => [...container.querySelectorAll('[data-linha]')]
  .map((n) => n.querySelector('p.flex.items-center')?.textContent || '')

// ── A ESCALA DELE: Unimed, no rodapé, sem cirurgia aqui ─────────────────────
const unimed = {
  id: 'e-uni', hospital: 'unimed', data: '2026-08-31',
  ordemLiberacao: { matutino: ['LEONARDO', 'OSCAR'] },
  ajudaExterna: {}, liberacoes: {}, linhaOverrides: {},
  casos: [caso('c1', 'CC - Sala 1', 'LEONARDO', 'Liana W')],
}
// A cirurgia dele está no HRO — é o que `presencaOutros` carrega com `sala`.
const noHro = [{ nome: 'OSCAR', uid: null, hospital: 'hro', hospitalLabel: 'HRO', sala: 'IOSC', cirurgiao: 'Mauricio Fabiani' }]

describe('na escala dele: fica na fila, marcado como ajuda, com o destino no card', () => {
  const montar = (props = {}) => render(
    <LiberacoesView escala={unimed} hospital="unimed" hospitalLabel="Unimed" turno="matutino"
      canEdit onToggle={() => {}} onSetOverride={() => {}} {...props} />,
    { wrapper: wrap },
  )

  it('sem saber das outras escalas, a fila o dá como Liberado', () => {
    // comportamento correto do dia útil para quem realmente não trabalha — este
    // caso existe para provar que o teste abaixo mede a diferença, e não o nada
    montar()
    expect(selosDe('Oscar Morais')).toContain('Liberado')
  })

  it('com a cirurgia do HRO, ele continua na fila e recebe o badge de Ajuda', () => {
    montar({ presencaOutros: noHro })
    expect(selosDe('Oscar Morais')).not.toContain('Liberado')
    expect(selosDe('Oscar Morais')).toContain('Ajuda')
  })

  it('o card diz ONDE ele está: local, hospital e cirurgião', () => {
    montar({ presencaOutros: noHro })
    expect(cardDe('Oscar Morais').textContent).toMatch(/Ajuda IOSC\/HRO/)
    expect(cardDe('Oscar Morais').textContent).toMatch(/Mauricio Fabiani/)
  })

  it('quem opera nos DOIS hospitais não é ajuda de ninguém', () => {
    // recorte que faltava no cálculo revertido em 04/08: presença em duas
    // escalas com cirurgia nas duas é trabalho nas duas, não empréstimo. Quem
    // monta `presencaOutros` já não inclui essa pessoa — aqui a lista vem vazia.
    montar({ presencaOutros: [] })
    expect(selosDe('Oscar Morais')).not.toContain('Ajuda')
  })
})

// ── A ESCALA ONDE AJUDA: HRO, com cirurgia, fora do rodapé daqui ────────────
// GUILHERME X fecha o rodapé do HRO = plantão do contraturno, escalado.
const hro = {
  id: 'e-hro', hospital: 'hro', data: '2026-08-31',
  ordemLiberacao: { matutino: ['LEONARDO', 'GUILHERME X'] },
  ajudaExterna: {}, liberacoes: {}, linhaOverrides: {},
  casos: [
    caso('h1', 'Sala 1', 'LEONARDO', 'Liana W'),
    caso('h2', 'Sala 4', 'GUILHERME X', 'Taciana A'),
    caso('h3', 'IOSC', 'OSCAR', 'Mauricio Fabiani'),
  ],
}

describe('na escala onde ajuda: sai antes do plantão do contraturno', () => {
  it('a ajuda FECHA a lista — é a primeira a ir embora', () => {
    const { container } = render(
      <LiberacoesView escala={hro} hospital="hro" hospitalLabel="HRO" turno="matutino"
        canEdit onToggle={() => {}} onSetOverride={() => {}} />,
      { wrapper: wrap },
    )
    const fila = ordemDaFila(container)
    const iOscar = fila.findIndex((t) => t.includes('Oscar'))
    const iGuilherme = fila.findIndex((t) => t.includes('Guilherme'))
    expect(iOscar).toBeGreaterThan(-1)
    expect(iGuilherme).toBeGreaterThan(-1)
    // a fila é liberada de baixo para cima: quem está MAIS ABAIXO sai antes
    expect(iOscar).toBeGreaterThan(iGuilherme)
  })

  it('o plantão do contraturno segue com o selo — ele não deixou de ser plantão', () => {
    render(
      <LiberacoesView escala={hro} hospital="hro" hospitalLabel="HRO" turno="matutino"
        canEdit onToggle={() => {}} onSetOverride={() => {}} />,
      { wrapper: wrap },
    )
    expect(selosDe('Guilherme Xavier')).toContain('Plantão da tarde')
    expect(selosDe('Oscar Morais')).toContain('Ajuda')
  })
})
