/**
 * DefinirAnestesistaSheet — toggle "Assumir também a posição" (dono 30/07).
 *
 * O buraco do caso Giovana↔Maurício: definir o novo responsável trocava os CASOS
 * mas a POSIÇÃO ficava com o nome do rodapé — quem assumia virava linha extra
 * "primeira a ser liberada". O toggle escreve a assunção (assumidaPor no slot)
 * JUNTO da troca de casos, pelo caminho com compensação (executarSubstituicao).
 *
 * Invariantes:
 *  - o toggle SÓ aparece quando o responsável anterior ocupa posição no rodapé;
 *  - ligado → executarSubstituicao com 1 lado (slot + casos juntos), e
 *    setAnestesistaCasos NÃO é chamado (não pode haver caminho duplo);
 *  - desligado → comportamento clássico (só setAnestesistaCasos);
 *  - nada passa perto de ordem_liberacao.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import DefinirAnestesistaSheet from '@/pages/escala-cirurgica/DefinirAnestesistaSheet'

const setAnestesistaCasos = vi.fn(async () => {})
const executarSubstituicao = vi.fn(async () => {})

const ROSTER = new Map([
  ['uid-staub', { uid: 'uid-staub', nome: 'GUILHERME STAUB', apelidos: ['STAUB'] }],
  ['uid-cury', { uid: 'uid-cury', nome: 'GUSTAVO CURY', apelidos: ['CURY'] }],
])

vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ setAnestesistaCasos, executarSubstituicao }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'uid-eu' } }),
}))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    options: [...ROSTER.values()].map((r) => ({ value: r.uid, label: r.nome })),
    rosterByUid: ROSTER,
    resolver: (nome) => {
      const k = String(nome || '').trim().toUpperCase()
      return [...ROSTER.values()].find((r) => r.apelidos.includes(k))?.uid || null
    },
    loading: false,
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const caso = (over) => ({
  id: 'c1', sala: 'Sala 5', ordem: 0, hora: '08:00', statusCirurgia: 'agendada',
  anestesista: 'STAUB', anestesistaUserId: 'uid-staub', cirurgiao: 'ANA SOUZA', ...over,
})

const escalaComRodape = {
  id: 'e1', hospital: 'hro',
  ordemLiberacao: { matutino: ['LEONARDO', 'STAUB'] },
  linhaOverrides: {},
  casos: [caso(), caso({ id: 'c2', hora: '10:00', statusCirurgia: 'terminada' })],
}

const escolherCury = () => {
  fireEvent.click(screen.getByRole('combobox'))
  fireEvent.click(screen.getByRole('option', { name: 'GUSTAVO CURY' }))
}

beforeEach(() => vi.clearAllMocks())

describe('toggle "Assumir também a posição" no Definir anestesista', () => {
  it('aparece quando o responsável anterior ocupa posição no rodapé — e nasce desligado', async () => {
    render(<DefinirAnestesistaSheet escala={escalaComRodape} sala="Sala 5" onClose={vi.fn()} />, { wrapper: wrap })
    expect(screen.queryByRole('switch')).toBeNull() // sem escolhido, sem toggle
    escolherCury()
    const sw = await screen.findByRole('switch')
    expect(sw).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText(/Assumir também a posição de Guilherme Staub/)).toBeTruthy()
  })

  it('não aparece quando o anterior NÃO está no rodapé', () => {
    const semSlot = { ...escalaComRodape, ordemLiberacao: { matutino: ['LEONARDO', 'KARINE'] } }
    render(<DefinirAnestesistaSheet escala={semSlot} sala="Sala 5" onClose={vi.fn()} />, { wrapper: wrap })
    escolherCury()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('ligado: confirmar dispara a substituição (slot + casos JUNTOS) e não o caminho clássico', async () => {
    render(<DefinirAnestesistaSheet escala={escalaComRodape} sala="Sala 5" onClose={vi.fn()} />, { wrapper: wrap })
    escolherCury()
    fireEvent.click(await screen.findByRole('switch'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar responsável' }))
    await waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    const [plan, userInfo] = executarSubstituicao.mock.calls[0]
    expect(plan.lados).toHaveLength(1)
    expect(plan.lados[0]).toMatchObject({
      hospital: 'hro', escalaId: 'e1', chaveSlot: 'uid-staub', nomeSlot: 'STAUB',
      de: { uid: 'uid-staub' }, para: { uid: 'uid-cury', apelido: 'CURY' },
      casoIds: ['c1'], // terminada fica com quem terminou
    })
    expect(userInfo.userId).toBe('uid-eu')
    expect(setAnestesistaCasos).not.toHaveBeenCalled()
    expect(JSON.stringify(plan)).not.toContain('ordem')
  })

  it('desligado: confirmar segue o caminho clássico (só os casos)', async () => {
    render(<DefinirAnestesistaSheet escala={escalaComRodape} sala="Sala 5" onClose={vi.fn()} />, { wrapper: wrap })
    escolherCury()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar responsável' }))
    await waitFor(() => expect(setAnestesistaCasos).toHaveBeenCalledTimes(1))
    expect(executarSubstituicao).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// MODO SALA opera SÓ no turno exibido (bug 31/07): a sala existe nos dois turnos
// e o sheet consultava o dia inteiro — "Responsável atual" mostrava o dono da
// MANHÃ com o board na tarde (CC-Sala 3: header "Paulo + Guilherme", sheet
// "Aline") e o repasse alcançaria caso não-terminado do outro turno.
// ════════════════════════════════════════════════════════════════════════════
describe('modo SALA opera só no turno exibido (bug 31/07)', () => {
  const escalaDoisTurnos = {
    id: 'e1', hospital: 'unimed',
    ordemLiberacao: { matutino: ['ALINE'], vespertino: ['CURY'] },
    linhaOverrides: {},
    casos: [
      caso({ id: 'm1', hora: '07:30', anestesista: 'ALINE', anestesistaUserId: 'uid-aline' }),
      caso({ id: 'v1', hora: '13:30', anestesista: 'STAUB', anestesistaUserId: 'uid-staub' }),
    ],
  }

  it('"Responsável atual" e os ALVOS vêm do turno, não do dia inteiro', async () => {
    render(<DefinirAnestesistaSheet escala={escalaDoisTurnos} sala="Sala 5" turno="vespertino" onClose={vi.fn()} />, { wrapper: wrap })
    // tarde = Staub (o mesmo do header da Completa); antes aparecia a Aline (manhã)
    expect(screen.getByText(/Staub/)).toBeTruthy()
    expect(screen.queryByText(/Aline/)).toBeNull()
    escolherCury()
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }))
    await waitFor(() => expect(setAnestesistaCasos).toHaveBeenCalled())
    // só o caso da TARDE é repassado — o da manhã (não terminado) fica intacto
    expect(setAnestesistaCasos.mock.calls[0][1]).toEqual(['v1'])
  })

  it('sem turno (chamada legada) segue olhando o dia inteiro', () => {
    render(<DefinirAnestesistaSheet escala={escalaDoisTurnos} sala="Sala 5" onClose={vi.fn()} />, { wrapper: wrap })
    // primeiro caso do dia é da manhã — comportamento antigo preservado
    expect(screen.getByText(/Aline/)).toBeTruthy()
  })
})
