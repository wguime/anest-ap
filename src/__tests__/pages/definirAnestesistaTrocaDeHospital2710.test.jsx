/**
 * "OS DOIS TROCARAM DE HOSPITAL?" (dono 27/10). Na manhã de 27/10 a conta UNIMED passou a
 * Sala 1 do Raul (3º da Unimed) ao Vicente (1º do HRO, plantonista) pelo definir
 * anestesista, sem mover a posição. Cada um virou "ajuda" no hospital do outro e o
 * plantonista do HRO saiu do lugar. A folha agora pergunta — mas só quando quem recebe é
 * de OUTRO hospital e quem passa fica sem nenhuma cirurgia aberta aqui. Troca de sala
 * dentro do mesmo hospital (o Humberto, no mesmo dia) não pergunta nada.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import DefinirAnestesistaSheet from '@/pages/escala-cirurgica/DefinirAnestesistaSheet'

const setAnestesistaCasos = vi.fn(async () => {})
const executarSubstituicao = vi.fn(async () => {})

const ROSTER = new Map([
  ['uid-raul', { uid: 'uid-raul', nome: 'RAUL PERIZZOLO', apelidos: ['RAUL'] }],
  ['uid-vicente', { uid: 'uid-vicente', nome: 'VICENTE ANTONIO ALVES PONS', apelidos: ['VICENTE'] }],
  ['uid-humberto', { uid: 'uid-humberto', nome: 'HUMBERTO HEPP', apelidos: ['HUMBERTO'] }],
  ['uid-oscar', { uid: 'uid-oscar', nome: 'OSCAR MORAIS', apelidos: ['OSCAR'] }],
])

const caso = (over) => ({
  id: 'u1', sala: 'CC - Sala 1', ordem: 0, hora: '07:30', turno: 'matutino', statusCirurgia: 'agendada',
  anestesista: 'RAUL', anestesistaUserId: 'uid-raul', cirurgiao: 'MAURICIO FABIANI', semAnestesista: false, ...over,
})
const unimed = {
  id: 'e-uni', hospital: 'unimed',
  ordemLiberacao: { matutino: ['OSCAR', 'TIAGO', 'RAUL', 'HUMBERTO'] },
  linhaOverrides: {}, liberacoes: {},
  casos: [caso(), caso({ id: 'u2', hora: '09:15' }), caso({ id: 'u3', hora: '11:00', cirurgiao: 'MARCO ALECIO' }),
    caso({ id: 'u4', sala: 'CC - Sala 5', anestesista: 'HUMBERTO', anestesistaUserId: 'uid-humberto', cirurgiao: 'MARCO TESSEROLI' })],
}
const hro = {
  id: 'e-hro', hospital: 'hro',
  ordemLiberacao: { matutino: ['VICENTE', 'MATHEUS (CONSULT)', 'GARIM'] },
  linhaOverrides: {}, liberacoes: {},
  casos: [caso({ id: 'h1', sala: 'Sala 5', hora: '07:00', anestesista: 'VICENTE', anestesistaUserId: 'uid-vicente', cirurgiao: '', procedimento: 'EMERGENCIA' })],
}
const escalasMock = { unimed, hro }

vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ setAnestesistaCasos, executarSubstituicao }),
  useEscalaCirurgica: () => ({ hoje: '2026-10-27', escalas: escalasMock, data: '2026-10-27', loading: false }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ user: { uid: 'uid-eu' } }) }))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    options: [...ROSTER.values()].map((r) => ({ value: r.uid, label: r.nome })),
    rosterByUid: ROSTER,
    resolver: (nome) => {
      const k = String(nome || '').replace(/\s*\(.*\)\s*$/, '').trim().toUpperCase()
      return [...ROSTER.values()].find((r) => r.apelidos.includes(k))?.uid || null
    },
    loading: false,
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>
const montar = (props = {}, escala = unimed) => render(
  <DefinirAnestesistaSheet escala={escala} sala="CC - Sala 1" turno="matutino" onClose={vi.fn()} {...props} />,
  { wrapper: wrap },
)
const escolher = (rx) => {
  fireEvent.click(screen.getByRole('button', { name: 'Escolher quem assume' }))
  fireEvent.click(screen.getByRole('option', { name: rx }))
}

beforeEach(() => vi.clearAllMocks())

describe('passar cirurgia a colega de OUTRO hospital pergunta pela troca (27/10)', () => {
  it('Raul → Vicente (1º do HRO): a folha pergunta, e "Sim" abre a troca dos dois', () => {
    const onTrocarPosicoes = vi.fn()
    montar({ onTrocarPosicoes })
    escolher(/VICENTE ANTONIO ALVES PONS/)
    expect(document.querySelector('[data-troca-de-hospital]')).toHaveTextContent(
      /fica sem cirurgia na Unimed, e .* é da escala do HRO \(1º\)\. Os dois trocaram de hospital\?/,
    )
    // a pergunta substitui o "Confirmar responsável": não há um terceiro botão ambíguo
    expect(screen.queryByRole('button', { name: 'Confirmar responsável' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Sim, trocar as posições também' }))
    expect(onTrocarPosicoes).toHaveBeenCalledWith({
      linha: expect.objectContaining({ uid: 'uid-raul', nomeOriginal: 'RAUL' }),
      colegaUid: 'uid-vicente',
    })
    expect(setAnestesistaCasos).not.toHaveBeenCalled()
  })

  it('"Não, só passar a cirurgia" faz o repasse de sempre', async () => {
    montar({ onTrocarPosicoes: vi.fn() })
    escolher(/VICENTE ANTONIO ALVES PONS/)
    fireEvent.click(screen.getByRole('button', { name: 'Não, só passar a cirurgia' }))
    await waitFor(() => expect(setAnestesistaCasos).toHaveBeenCalledTimes(1))
    expect(setAnestesistaCasos.mock.calls[0][1].sort()).toEqual(['u1', 'u2', 'u3'])
    expect(setAnestesistaCasos.mock.calls[0][2]).toMatchObject({ uid: 'uid-vicente' })
  })

  it('colega da MESMA escala (Humberto, Unimed): troca de sala, sem pergunta', () => {
    montar({ onTrocarPosicoes: vi.fn() })
    escolher(/HUMBERTO HEPP/)
    expect(document.querySelector('[data-troca-de-hospital]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Confirmar responsável' })).toBeTruthy()
  })

  it('quem passa continua com cirurgia aberta aqui: não trocou de hospital, sem pergunta', () => {
    const comOutra = { ...unimed, casos: [...unimed.casos, caso({ id: 'u9', sala: 'CC - Sala 8', hora: '10:00' })] }
    montar({ onTrocarPosicoes: vi.fn() }, comOutra)
    escolher(/VICENTE ANTONIO ALVES PONS/)
    expect(document.querySelector('[data-troca-de-hospital]')).toBeNull()
  })

  it('tela que não oferece a troca (sem onTrocarPosicoes) segue como antes', () => {
    montar()
    escolher(/VICENTE ANTONIO ALVES PONS/)
    expect(document.querySelector('[data-troca-de-hospital]')).toBeNull()
  })
})
