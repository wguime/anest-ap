/**
 * MOTIVO DA SUSPENSÃO E DO ATRASO (dono 19/11/2026): suspensa exige motivo, atrasada é opcional,
 * o "quanto atrasou" é calculado (início real − hora agendada) e o motivo aparece embaixo do selo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider, ToastProvider } from '@/design-system'
import CasoDetalheSheet from '@/pages/escala-cirurgica/CasoDetalheSheet'
import { CasoCard } from '@/pages/escala-cirurgica/BoardView'
import {
  MOTIVOS_ATRASO, MOTIVOS_SUSPENSAO, MOTIVO_MAX, OUTRO, gravarStatusComMotivo, linhaDoMotivo,
  minutosDeAtraso, motivoEscolhido, motivoParaEdicao, normalizarMotivo, pareceIdentificarPaciente, podeMarcarNaoAconteceu, rotuloMinutos, terminadaSemHorario,
} from '@/lib/escalaMotivoStatus'

const { acoes } = vi.hoisted(() => ({
  acoes: {
    atualizarCaso: vi.fn(async () => {}),
    adicionarAjuda: vi.fn(async () => {}),
    removerAjuda: vi.fn(async () => {}),
    setStatusCirurgia: vi.fn(async () => {}),
    espelharTempoTotal: vi.fn(async () => {}),
  },
}))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => acoes,
  useEscalaCirurgica: () => ({ hoje: '2026-11-19', escalas: {}, data: '2026-11-19', loading: false }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ user: { uid: 'u-eu', displayName: 'Eu Mesmo' } }) }))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({ options: [], rosterByUid: new Map(), resolver: () => null, loading: false }),
}))
vi.mock('@/hooks/useRosterResidentes', () => ({ default: () => ({ residentes: [], residenteByUid: new Map(), options: [] }) }))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>
const caso = (o = {}) => ({
  id: 'c1', sala: 'CC - SALA 7', ordem: 1, hora: '13:00', turno: 'vespertino', procedimento: 'PROSTATECTOMIA',
  cirurgiao: 'Paulo Caldas', anestesista: 'GUILHERME', anestesistaUserId: 'u-eu', tipo: 'eletiva',
  statusCirurgia: 'agendada', statusExtra: null, inicioReal: null, terminoReal: null, ...o,
})
const escala = (c) => ({ id: 'e-uni', hospital: 'unimed', data: '2026-11-19', status: 'publicada', ajudaExterna: {}, ordemLiberacao: {}, linhaOverrides: {}, casos: [c] })
const detalhe = (c) => render(
  <CasoDetalheSheet escala={escala(c)} caso={c} turno="vespertino" onClose={vi.fn()} podeEditar onEditarCaso={vi.fn()} />,
  { wrapper: wrap },
)

beforeEach(() => vi.clearAllMocks())

describe('as listas (pesquisa + grupo da escala, 19/11)', () => {
  it('"Anestesista atrasado" é motivo próprio, separado de "em outra sala" (dono 19/11)', () => {
    expect(MOTIVOS_ATRASO).toContain('Anestesista atrasado')
    expect(MOTIVOS_ATRASO).toContain('Anestesista em outra sala')
    expect(MOTIVOS_ATRASO.some((m) => /anestesista atrasado.*outra sala/i.test(m))).toBe(false)
  })

  it('"Cirurgião atrasado" sozinho — "em outra sala" saiu (dono 19/11, à noite)', () => {
    expect(MOTIVOS_ATRASO).toContain('Cirurgião atrasado')
    expect(MOTIVOS_ATRASO.some((m) => /cirurgião.*outra sala/i.test(m))).toBe(false)
  })

  it('9 motivos em cada lista + "Outro" = grade de 2 colunas sem buraco', () => {
    expect(MOTIVOS_SUSPENSAO).toHaveLength(9)
    expect(MOTIVOS_ATRASO).toHaveLength(9)
    expect(MOTIVOS_SUSPENSAO).toContain('Sem horário de sala (tempo excedido)')
  })
})

describe('o texto gravado', () => {
  it('limpa espaços, corta no teto da coluna e vazio vira null', () => {
    expect(normalizarMotivo('  falta  de\n anestésico ')).toBe('falta de anestésico')
    expect(normalizarMotivo('   ')).toBeNull()
    expect(normalizarMotivo('x'.repeat(300))).toHaveLength(MOTIVO_MAX)
  })

  it('reabre o chip quando o texto é da lista; senão volta como "Outro"', () => {
    expect(motivoParaEdicao('suspensa', 'Paciente sem jejum')).toEqual({ chip: 'Paciente sem jejum', outro: '' })
    expect(motivoParaEdicao('suspensa', 'paciente febril')).toEqual({ chip: OUTRO, outro: 'paciente febril' })
    expect(motivoEscolhido({ chip: OUTRO, outro: '  ' })).toBeNull()
  })
})

describe('o "Outro" que parece identificar o paciente (revisão LGPD 19/11) — só alerta', () => {
  it('nome, tratamento + nome, prontuário e CPF alertam', () => {
    for (const t of ['Paciente Maria Souza com febre', 'pcte João sem jejum', 'Sr. Antonio', 'prontuário 1234567', 'CPF 123.456.789-00']) {
      expect(pareceIdentificarPaciente(t)).toBe(true)
    }
  })
  it('achado clínico e texto comum não', () => {
    for (const t of ['Hb 4, suspensa pela avaliação anestésica', 'paciente febril', 'Paciente veio para internar e não quis ficar', 'Dr não opera SUS', 'Hipertensão descompensada']) {
      expect(pareceIdentificarPaciente(t)).toBe(false)
    }
  })
})

describe('quanto atrasou — calculado (dono 19/11: "do início previsto até a marcação do início")', () => {
  it('início real − hora agendada', () => {
    expect(minutosDeAtraso(caso({ hora: '13:00', inicioReal: '13:40' }))).toBe(40)
    expect(minutosDeAtraso(caso({ hora: '07:30', inicioReal: '09:05' }))).toBe(95)
  })

  it('sem hora ("AS"), sem início ou adiantada: nada', () => {
    expect(minutosDeAtraso(caso({ hora: 'AS', inicioReal: '13:40' }))).toBeNull()
    expect(minutosDeAtraso(caso({ inicioReal: null }))).toBeNull()
    expect(minutosDeAtraso(caso({ hora: '13:00', inicioReal: '12:50' }))).toBeNull()
  })

  it('rótulo curto', () => {
    expect(rotuloMinutos(40)).toBe('40 min')
    expect(rotuloMinutos(60)).toBe('1h')
    expect(rotuloMinutos(95)).toBe('1h35')
  })

  it('a linha junta o quanto e o motivo; só fala do status ATUAL', () => {
    expect(linhaDoMotivo(caso({ statusExtra: 'atrasada', inicioReal: '13:40', motivoAtraso: 'Cirurgião atrasado' })))
      .toBe('Atrasou 40 min · Cirurgião atrasado')
    expect(linhaDoMotivo(caso({ statusExtra: 'suspensa', motivoAtraso: 'Material ou equipamento não pronto', motivoSuspensao: 'Paciente sem jejum' })))
      .toBe('Paciente sem jejum')
    expect(linhaDoMotivo(caso({ statusExtra: null, motivoSuspensao: 'Paciente sem jejum' }))).toBe('')
  })
})

describe('gravar: o motivo vai ANTES do status', () => {
  it('ligar grava o motivo e depois o status; desligar limpa o motivo e tira o status', async () => {
    const ordem = []
    const atualizarCaso = vi.fn(async () => { ordem.push('motivo') })
    const setStatusCirurgia = vi.fn(async () => { ordem.push('status') })
    const esc = escala(caso())
    await gravarStatusComMotivo({ escala: esc, caso: caso(), status: 'suspensa', motivo: 'Paciente sem jejum', userId: 'u', setStatusCirurgia, atualizarCaso })
    expect(ordem).toEqual(['motivo', 'status'])
    expect(atualizarCaso).toHaveBeenCalledWith(esc, 'c1', { motivoSuspensao: 'Paciente sem jejum' }, { silencioso: true })

    ordem.length = 0
    await gravarStatusComMotivo({ escala: esc, caso: caso({ statusExtra: 'atrasada', motivoAtraso: 'Urgência passou na frente' }), status: 'atrasada', ligar: false, userId: 'u', setStatusCirurgia, atualizarCaso })
    expect(ordem).toEqual(['motivo', 'status'])
    expect(atualizarCaso).toHaveBeenLastCalledWith(esc, 'c1', { motivoAtraso: null }, { silencioso: true })
  })

  it('terminada sem horário: motivo, depois Agendada, depois Suspensa (a RPC recusa extra em terminada)', async () => {
    const ordem = []
    const atualizarCaso = vi.fn(async () => { ordem.push('motivo') })
    const setStatusCirurgia = vi.fn(async (_e, _c, s) => { ordem.push(s) })
    await gravarStatusComMotivo({ escala: escala(caso()), caso: caso({ statusCirurgia: 'terminada' }), status: 'suspensa', motivo: 'Paciente sem jejum', setStatusCirurgia, atualizarCaso })
    expect(ordem).toEqual(['motivo', 'agendada', 'suspensa'])
  })

  it('já no status: só troca o motivo (a RPC é toggle — chamar de novo desmarcaria)', async () => {
    const atualizarCaso = vi.fn(async () => {})
    const setStatusCirurgia = vi.fn(async () => {})
    await gravarStatusComMotivo({ escala: escala(caso()), caso: caso({ statusExtra: 'suspensa' }), status: 'suspensa', motivo: 'Sem vaga de UTI ou leito', setStatusCirurgia, atualizarCaso })
    expect(atualizarCaso).toHaveBeenCalledTimes(1)
    expect(setStatusCirurgia).not.toHaveBeenCalled()
  })
})

describe('quem pode receber "Não aconteceu"', () => {
  it('aberta sim; terminada só sem início e sem término; já suspensa não', () => {
    expect(podeMarcarNaoAconteceu(caso())).toBe(true)
    expect(podeMarcarNaoAconteceu(caso({ statusCirurgia: 'iniciada', inicioReal: '13:10' }))).toBe(true)
    expect(terminadaSemHorario(caso({ statusCirurgia: 'terminada' }))).toBe(true)
    expect(podeMarcarNaoAconteceu(caso({ statusCirurgia: 'terminada' }))).toBe(true)
    expect(podeMarcarNaoAconteceu(caso({ statusCirurgia: 'terminada', inicioReal: '13:10' }))).toBe(false)
    expect(podeMarcarNaoAconteceu(caso({ statusCirurgia: 'terminada', terminoReal: '15:00' }))).toBe(false)
    expect(podeMarcarNaoAconteceu(caso({ statusExtra: 'suspensa' }))).toBe(false)
  })
})

describe('Andamento do detalhe (modelo B1–B3)', () => {
  it('Suspensa abre o motivo e só grava com ele', async () => {
    detalhe(caso())
    fireEvent.click(screen.getByRole('button', { name: 'Suspensa' }))
    expect(acoes.setStatusCirurgia).not.toHaveBeenCalled()
    expect(screen.getByText('Motivo da suspensão')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Marcar como suspensa' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Condição clínica do paciente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como suspensa' }))
    expect(acoes.atualizarCaso).toHaveBeenCalledWith(expect.objectContaining({ id: 'e-uni' }), 'c1', { motivoSuspensao: 'Condição clínica do paciente' }, { silencioso: true })
    await waitFor(() => expect(acoes.setStatusCirurgia).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'c1' }), 'suspensa', { userId: 'u-eu' }))
  })

  it('Atrasada marca no toque; o motivo é opcional ("Agora não")', () => {
    detalhe(caso())
    fireEvent.click(screen.getByRole('button', { name: 'Atrasada' }))
    expect(acoes.setStatusCirurgia).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'c1' }), 'atrasada', { userId: 'u-eu' })
    expect(screen.getByText('Motivo do atraso')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Anestesista atrasado' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Agora não' }))
    expect(screen.queryByText('Motivo do atraso')).toBeNull()
  })

  it('com o motivo salvo: a linha "Motivo: … · Editar", com o atraso calculado', () => {
    detalhe(caso({ statusCirurgia: 'iniciada', statusExtra: 'atrasada', inicioReal: '13:40', motivoAtraso: 'Anestesista atrasado' }))
    expect(screen.getByText('Atrasou 40 min · Anestesista atrasado')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.getByRole('button', { name: 'Anestesista atrasado' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('desmarcar Suspensa limpa o motivo junto', async () => {
    detalhe(caso({ statusExtra: 'suspensa', motivoSuspensao: 'Paciente sem jejum' }))
    fireEvent.click(screen.getByRole('button', { name: 'Suspensa' }))
    expect(acoes.atualizarCaso).toHaveBeenCalledWith(expect.anything(), 'c1', { motivoSuspensao: null }, { silencioso: true })
    await waitFor(() => expect(acoes.setStatusCirurgia).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'suspensa', { userId: 'u-eu' }))
  })
})

describe('no quadro (modelo C)', () => {
  it('o motivo aparece embaixo, junto com o selo', () => {
    render(<ThemeProvider><CasoCard caso={caso({ statusExtra: 'suspensa', motivoSuspensao: 'Sem autorização do convênio' })} onClick={() => {}} /></ThemeProvider>)
    expect(screen.getByText('Suspensa')).toBeTruthy()
    expect(screen.getByText('Sem autorização do convênio')).toBeTruthy()
  })

  it('sem o selo, o motivo antigo não aparece', () => {
    render(<ThemeProvider><CasoCard caso={caso({ statusExtra: null, motivoSuspensao: 'Sem autorização do convênio' })} onClick={() => {}} /></ThemeProvider>)
    expect(screen.queryByText('Sem autorização do convênio')).toBeNull()
  })
})
