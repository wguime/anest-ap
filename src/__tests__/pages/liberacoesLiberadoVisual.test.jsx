/**
 * VISUAL DO CARD LIBERADO (dono 31/08, três pedidos na mesma noite):
 *
 *  · "ao liberar, o nome não aparece mais riscado" — o card vermelho já diz
 *    tudo; o line-through por cima era redundância que dificultava ler o nome.
 *  · "quando o plantão da tarde/manhã não está escalado, o badge de plantão
 *    acompanha a cor vermelha do card" — a cauda sem trabalho nasce vermelha
 *    (regra 21/08) e o badge verde sólido destoava dentro dela.
 *  · "os badges P1–P4, quando liberados (card vermelho), aparecem em vermelho
 *    também" — mesmo motivo, no selo noturno.
 *
 * O badge NÃO some ao liberar (informação posicional continua verdadeira);
 * ele muda de tinta junto com o card.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'

vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: [], rosterByUid: new Map(), options: [], aliases: [], loading: false,
    resolver: () => null, upsertAlias: vi.fn(), refresh: vi.fn(), removeAlias: vi.fn(),
  }),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({
  default: { reservarAvisoTempo: vi.fn(async () => false), fetchLocaisHospital: vi.fn(async () => []) },
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>
const caso = (id, sala, anestesista) => ({
  id, sala, ordem: 0, hora: '07:30', anestesista, cirurgiao: 'Cirurgião X', bloco: 'normal',
})
const cardDe = (nome) => document.querySelector(`[data-nome="${nome}"]`)
const badgesDe = (nome) => [...cardDe(nome).querySelectorAll('[data-slot="badge"]')]
const badgeTexto = (nome, texto) => badgesDe(nome).find((b) => b.textContent.trim().startsWith(texto)) || null

afterAll(() => vi.useRealTimers())

describe('liberado — sem nome riscado; badge de plantão acompanha o vermelho', () => {
  beforeAll(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-31T09:00:00-03:00'))
  })
  // LEONARDO trabalha; MARILIO e OSCAR fecham a ordem sem cirurgia → cauda
  // vermelha automática (21/08); OSCAR, último, é o plantão do turno seguinte.
  const escala = {
    id: 'e1', hospital: 'hro', data: '2026-08-31',
    ordemLiberacao: { matutino: ['LEONARDO', 'MARILIO', 'OSCAR'] },
    ajudaExterna: {}, linhaOverrides: {},
    liberacoes: {},
    casos: [caso('c1', 'Sala 1', 'LEONARDO')],
  }
  const montar = (props = {}) => render(
    <LiberacoesView escala={escala} hospital="hro" hospitalLabel="HRO" turno="matutino"
      canEdit onToggle={() => {}} onSetOverride={() => {}} {...props} />,
    { wrapper: wrap },
  )

  it('o nome do liberado não vem riscado', () => {
    montar({ escala: { ...escala, liberacoes: { Leonardo: { liberadoEm: 'x' } } } })
    const nome = cardDe('Leonardo').querySelector('p.flex.items-center')
    expect(nome.className).not.toMatch(/line-through/)
  })

  it('na cauda vermelha, o badge "Plantão da tarde" fica vermelho', () => {
    montar()
    const badge = badgeTexto('Oscar', 'Plantão da tarde')
    expect(badge).toBeTruthy()
    expect(badge.className).toMatch(/bg-destructive/)
    expect(badge.className).not.toMatch(/bg-primary/)
  })

  it('liberado à mão, o badge de plantão continua no card — em vermelho', () => {
    montar({ escala: { ...escala, liberacoes: { Oscar: { liberadoEm: 'x' } } } })
    const badge = badgeTexto('Oscar', 'Plantão da tarde')
    expect(badge).toBeTruthy()
    expect(badge.className).toMatch(/bg-destructive/)
  })

  it('em quem trabalha (card não-vermelho), o badge segue verde', () => {
    // o mesmo rodapé, agora com cirurgia do OSCAR: sem cauda, badge de sempre
    montar({ escala: { ...escala, casos: [caso('c1', 'Sala 1', 'LEONARDO'), caso('c2', 'Sala 2', 'OSCAR')] } })
    const badge = badgeTexto('Oscar', 'Plantão da tarde')
    expect(badge).toBeTruthy()
    expect(badge.className).toMatch(/bg-primary/)
  })
})

describe('selo P1–P4 liberado (card vermelho) fica vermelho', () => {
  // quinta 20h → fase noturna: CARLA (P3) já está na lista do dia e é hoistada
  // com o selo; liberá-la pinta o card de vermelho — e o selo acompanha.
  beforeAll(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 6, 23, 20, 0, 0))
  })
  const plantoes = [
    { setor: 'P1', nome: 'Ana Paula' }, { setor: 'P2', nome: 'Bruno Costa' },
    { setor: 'P3', nome: 'Carla Dias' }, { setor: 'P4', nome: 'Davi Rocha' },
  ]
  const escala = {
    id: 'e2', hospital: 'unimed', data: '2026-07-23',
    ordemLiberacao: { vespertino: ['CARLA DIAS', 'MARILIO'] },
    ajudaExterna: {}, linhaOverrides: {},
    liberacoes: {},
    casos: [
      { id: 'c1', sala: 'S1', ordem: 0, hora: '14:00', anestesista: 'CARLA DIAS', cirurgiao: 'Cir A', turno: 'vespertino' },
      { id: 'c2', sala: 'S2', ordem: 0, hora: '14:00', anestesista: 'MARILIO', cirurgiao: 'Cir B', turno: 'vespertino' },
    ],
  }
  const montar = (liberacoes = {}) => render(
    <LiberacoesView escala={{ ...escala, liberacoes }} hospital="unimed" hospitalLabel="Unimed"
      turno="vespertino" canEdit plantoes={plantoes}
      onToggle={() => {}} onSetOverride={() => {}} />,
    { wrapper: wrap },
  )

  it('liberada, o selo P3 fica vermelho', () => {
    // a chave do card noturno é namespaced ('noite:') por desenho — a
    // liberação da noite é própria, nada do dia atravessa a virada (24/07)
    montar({ 'noite:CARLA DIAS': { liberadoEm: 'x' } })
    const selo = badgeTexto('Carla Dias', 'P3')
    expect(selo).toBeTruthy()
    expect(selo.className).toMatch(/bg-destructive/)
  })

  it('trabalhando, o selo P3 segue verde escuro', () => {
    montar()
    const selo = badgeTexto('Carla Dias', 'P3')
    expect(selo).toBeTruthy()
    expect(selo.className).toMatch(/bg-primary/)
  })
})
