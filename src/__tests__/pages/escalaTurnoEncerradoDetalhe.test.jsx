/**
 * A CIRURGIA DE UM TURNO QUE JÁ PASSOU — "horário e quem fez" (dono 28/10/2026, modelo A+ de
 * `.tmp/popup-horarios/turnos.html`, Tela 2).
 *
 * O turno que já passou fica aberto para quem esqueceu corrigir o horário. No detalhe dele:
 * os blocos de início/término, "Não aconteceu" na cirurgia ainda aberta e o "Trocar" do
 * anestesista — a saída da cirurgia que ficou no nome errado, que o pop-up cobraria a cada
 * entrada. Andamento vira leitura; "Editar", o tempo estimado e a ajuda somem (são do turno em
 * curso). Na folha de troca, nada mexe na fila daquele turno: sem "assumir também a posição" e
 * sem os efeitos do repasse.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import CasoDetalheSheet from '@/pages/escala-cirurgica/CasoDetalheSheet'
import DefinirAnestesistaSheet from '@/pages/escala-cirurgica/DefinirAnestesistaSheet'

const { acoes } = vi.hoisted(() => ({
  acoes: {
    atualizarCaso: vi.fn(async () => {}),
    adicionarAjuda: vi.fn(async () => {}),
    removerAjuda: vi.fn(async () => {}),
    setStatusCirurgia: vi.fn(async () => {}),
    setLinhaOverride: vi.fn(async () => {}),
    setAnestesistaCasos: vi.fn(async () => {}),
    executarSubstituicao: vi.fn(async () => {}),
  },
}))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => acoes,
  useEscalaCirurgica: () => ({ hoje: '2026-10-28', escalas: {}, data: '2026-10-28', loading: false }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ user: { uid: 'u-eu', displayName: 'Eu Mesmo' } }) }))
const ROSTER = new Map([
  ['uid-raul', { uid: 'uid-raul', nome: 'RAUL PERIZZOLO', apelidos: ['RAUL'] }],
  ['uid-cury', { uid: 'uid-cury', nome: 'GUSTAVO CURY', apelidos: ['CURY'] }],
])
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    options: [...ROSTER.values()].map((r) => ({ value: r.uid, label: r.nome })),
    rosterByUid: ROSTER,
    resolver: (nome) => [...ROSTER.values()].find((r) => r.apelidos.includes(String(nome || '').trim().toUpperCase()))?.uid || null,
    loading: false,
  }),
}))
vi.mock('@/hooks/useRosterResidentes', () => ({ default: () => ({ residentes: [], residenteByUid: new Map(), options: [] }) }))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const caso = (o = {}) => ({
  id: 'c1', sala: 'Sala 6', ordem: 1, hora: 'AS', turno: 'matutino', procedimento: 'RETOSSIGMOIDECTOMIA ABDOMINAL',
  cirurgiao: 'Jonathan Caon', anestesista: 'RAUL', anestesistaUserId: 'uid-raul', tipo: 'eletiva',
  statusCirurgia: 'terminada', statusAtualizadoEm: '2026-10-28T12:58:00-03:00', statusAtualizadoPor: 'uid-raul',
  inicioReal: null, terminoReal: null, ...o,
})
const escala = (c) => ({
  id: 'e-hro', hospital: 'hro', data: '2026-10-28', status: 'publicada', ajudaExterna: {},
  ordemLiberacao: { matutino: ['VICENTE', 'RAUL'] }, linhaOverrides: {}, casos: [c],
})
const AVISO = 'Manhã encerrada às 13h'

const detalhe = (c = caso(), props = {}) => {
  const esc = escala(c)
  return render(
    <CasoDetalheSheet
      escala={esc} caso={c} turno="matutino" onClose={vi.fn()} podeEditar
      podeDefinirAnestesista={() => true} onDefinirAnestesista={vi.fn()} onEditarCaso={vi.fn()}
      {...props}
    />,
    { wrapper: wrap },
  )
}

beforeEach(() => vi.clearAllMocks())

describe('detalhe no turno encerrado: só horário e quem fez', () => {
  it('diz que o turno encerrou e o que se corrige; some "Editar", o tempo estimado e a ajuda', () => {
    detalhe(caso({ statusCirurgia: 'iniciada', inicioReal: '09:10' }), { encerrado: AVISO })
    expect(screen.getByText(`${AVISO}: aqui se corrigem o horário e quem fez.`)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Editar dados da cirurgia' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Tempo estimado/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /ajuda de outro hospital/i })).toBeNull()
  })

  it('Andamento vira leitura: nada de Agendada/Iniciada/Terminada nem dos avisos', () => {
    detalhe(caso(), { encerrado: AVISO })
    for (const nome of ['Agendada', 'Iniciada', 'Terminada', 'Atrasada', 'Suspensa']) {
      expect(screen.queryByRole('button', { name: nome })).toBeNull()
    }
    expect(screen.getByText(/^Terminada/, { selector: '[data-andamento-leitura] p' })).toBeTruthy()
  })

  it('os blocos de início e término seguem tocáveis — é o conserto do horário', () => {
    detalhe(caso(), { encerrado: AVISO })
    fireEvent.click(screen.getByRole('button', { name: /^Término desta cirurgia/ }))
    // terminada sem início: a folha dos dois horários (dono 14/10 — término exige início)
    expect(screen.getByText('Início e término da cirurgia')).toBeTruthy()
  })

  it('"Trocar" o anestesista continua — a saída da cirurgia no nome errado', () => {
    detalhe(caso(), { encerrado: AVISO })
    expect(screen.getByRole('button', { name: 'Trocar anestesista' })).toBeTruthy()
  })

  it('"Não aconteceu" só na cirurgia ainda aberta, e marca Suspensa', () => {
    const { unmount } = detalhe(caso(), { encerrado: AVISO })
    expect(screen.queryByRole('button', { name: 'Não aconteceu (suspensa)' })).toBeNull() // terminada
    unmount()
    const aberta = caso({ statusCirurgia: 'agendada', statusAtualizadoEm: null })
    detalhe(aberta, { encerrado: AVISO })
    fireEvent.click(screen.getByRole('button', { name: 'Não aconteceu (suspensa)' }))
    expect(acoes.setStatusCirurgia).toHaveBeenCalledWith(expect.objectContaining({ id: 'e-hro' }), expect.objectContaining({ id: 'c1' }), 'suspensa', { userId: 'u-eu' })
  })

  it('fora do turno encerrado o detalhe é o de sempre (controle)', () => {
    detalhe(caso({ statusCirurgia: 'iniciada', inicioReal: '09:10' }))
    expect(screen.queryByText(/aqui se corrigem o horário e quem fez/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Editar dados da cirurgia' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Terminada' })).toBeTruthy()
  })
})

describe('trocar quem fez num turno encerrado não mexe na fila', () => {
  const escolherCury = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Escolher quem assume' }))
    fireEvent.click(screen.getByRole('option', { name: /GUSTAVO CURY/ }))
  }
  const folha = (props = {}) => render(
    <DefinirAnestesistaSheet escala={escala(caso())} sala="Sala 6" casosAlvo={[caso()]} turno="matutino" onClose={vi.fn()} {...props} />,
    { wrapper: wrap },
  )

  it('sem "Assumir também a posição"; passa só a cirurgia, sem os efeitos do repasse', () => {
    folha({ encerrado: true })
    escolherCury()
    expect(screen.queryByRole('switch')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Confirmar responsável/i }))
    expect(acoes.executarSubstituicao).not.toHaveBeenCalled()
    expect(acoes.setAnestesistaCasos).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'e-hro' }), ['c1'], expect.objectContaining({ uid: 'uid-cury' }),
      expect.objectContaining({ semEfeitosNaFila: true }),
    )
  })

  it('no turno em curso o "Assumir também a posição" segue lá (controle)', () => {
    folha()
    escolherCury()
    expect(screen.getByRole('switch')).toBeTruthy()
  })
})
