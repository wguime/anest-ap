/**
 * "SEM CASO AQUI" NÃO É "SEM TRABALHO" (dono 2026-08-30).
 *
 * Relato, sobre a escala da Unimed de 31/08: "veja que Oscar está como Liberado
 * na escala da Unimed, o que não é verdade, ele é ajuda no HRO e é o primeiro a
 * ser liberado". Ele estava no rodapé da Unimed sem nenhuma cirurgia lá — e a
 * cauda automática libera exatamente quem está assim. Só que a razão de não ter
 * caso aqui era estar operando no HRO.
 *
 * A conta passa a olhar as três escalas do dia. Errar para o lado de NÃO liberar
 * custa um toque; errar para o outro dá alguém como livre no meio de uma cirurgia.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'

const ROSTER = [
  { uid: 'uid-leo', nome: 'LEONARDO FERRAZZO', apelidos: ['LEONARDO'] },
  { uid: 'uid-osc', nome: 'OSCAR MORAIS', apelidos: ['OSCAR'] },
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

// OSCAR fecha o rodapé da Unimed e NÃO tem cirurgia lá — a cauda o libera.
const escala = {
  id: 'e1', hospital: 'unimed', data: '2026-08-31',
  ordemLiberacao: { matutino: ['LEONARDO', 'OSCAR'] },
  ajudaExterna: {}, liberacoes: {}, linhaOverrides: {},
  casos: [{ id: 'c1', sala: 'CC - Sala 1', ordem: 0, hora: '07:30', anestesista: 'LEONARDO', cirurgiao: 'Liana W', bloco: 'normal' }],
}

const montar = (props = {}) => render(
  <LiberacoesView escala={escala} hospital="unimed" hospitalLabel="Unimed" turno="matutino"
    canEdit onToggle={() => {}} onSetOverride={() => {}} {...props} />,
  { wrapper: wrap },
)

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-08-31T09:00:00-03:00'))
})
afterAll(() => vi.useRealTimers())

const cardDe = (nome) => screen.getByLabelText(`Editar local/cirurgião de ${nome}`).closest('[data-linha]')
const selosDe = (nome) => [...cardDe(nome).querySelectorAll('[data-slot="badge"]')].map((b) => b.textContent.trim())

describe('quem opera em outro hospital não nasce Liberado', () => {
  it('sem saber das outras escalas, a cauda libera quem não tem caso aqui', () => {
    // é o comportamento correto do dia útil e continua valendo: este caso existe
    // para provar que o teste abaixo mede a diferença, e não o nada
    montar()
    expect(selosDe('Oscar Morais')).toContain('Liberado')
  })

  it('com cirurgia no HRO no mesmo turno, ele continua na fila', () => {
    montar({ casosForaOutros: [{ nome: 'OSCAR', hospitalLabel: 'HRO', casos: 1 }] })
    expect(selosDe('Oscar Morais')).not.toContain('Liberado')
  })

  it('a cirurgia do OUTRO TURNO não segura ninguém', () => {
    // turno é filtro exato em todo o módulo — quem cruza os turnos é a conta de
    // quem monta `casosForaOutros`, e ela recorta pelo turno exibido
    montar({ casosForaOutros: [] })
    expect(selosDe('Oscar Morais')).toContain('Liberado')
  })
})
