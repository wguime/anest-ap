/**
 * FaixaUrgencias — ocupação das 2 salas de urgência do contrato do HRO + fila
 * (dono 18/08, desenho fechado em 3 rodadas de protótipo a 430px).
 *
 * Regras travadas aqui:
 *  • fora do HRO ou sem urgência nenhuma, a faixa NÃO existe — dia comum fica
 *    idêntico ao de hoje (ruído vira mobília, lição da inbox de julho);
 *  • a grade mostra os POSTOS do contrato (plantão/sobreaviso + dedicados do
 *    turno) e o EXCEDENTE é card próprio, com rótulo "Extra" — nunca um chip
 *    igual aos outros (crítica do dono na 2ª rodada);
 *  • CO é dedicado SÓ de manhã (contrato por turno);
 *  • tocar num card com caso abre o detalhe — a mesma superfície onde se marca
 *    Iniciada/Terminada;
 *  • a faixa vive FORA da BoardView: o EmptyState "nenhum caso neste turno" não
 *    pode matá-la (8 de 9 urgências de 18/08 nasceram à mão, sem escala do turno).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import FaixaUrgencias from '@/pages/escala-cirurgica/FaixaUrgencias'

const { setStatusCirurgia } = vi.hoisted(() => ({ setStatusCirurgia: vi.fn(async () => {}) }))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ setStatusCirurgia }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u-eu', role: 'anestesiologista', displayName: 'Eu' } }),
}))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({ options: [], rosterByUid: new Map(), resolver: () => null, loading: false }),
}))
// Relógio congelado às 11:00 — a suíte roda em America/Sao_Paulo.
vi.mock('@/pages/escala-cirurgica/useAgoraMinuto', () => ({ default: () => 11 * 60 }))
// O detalhe é a superfície REAL de status; aqui só interessa que ele abre com o caso certo.
vi.mock('@/pages/escala-cirurgica/CasoDetalheSheet', () => ({
  default: ({ caso }) => <div data-testid="detalhe">{caso.id}</div>,
}))

const HOJE = '2026-08-18'
const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const caso = (id, sala, extra = {}) => ({
  id, sala, ordem: 0, tipo: 'urgencia', statusCirurgia: 'agendada', statusExtra: null,
  procedimento: 'APENDICECTOMIA', convenio: 'SUS', anestesista: 'MARCELO',
  anestesistaUserId: 'u-marcelo', created_at: `${HOJE}T10:00:00`, turno: 'matutino',
  ...extra,
})
const iniciada = (id, sala, extra = {}) =>
  caso(id, sala, { statusCirurgia: 'iniciada', statusAtualizadoEm: `${HOJE}T10:20:00`, ...extra })

const escalaCom = (casos) => ({ id: 'e1', hospital: 'hro', data: HOJE, casos })

const montar = (casos, props = {}) => render(
  <FaixaUrgencias escala={escalaCom(casos)} hospital="hro" turno="matutino" hoje={HOJE} {...props} />,
  { wrapper: wrap },
)

beforeEach(() => vi.clearAllMocks())

describe('quando a faixa existe', () => {
  it('não renderiza sem urgência nenhuma — dia comum fica idêntico ao de hoje', () => {
    montar([caso('c1', 'Sala 2', { tipo: 'eletiva' })])
    expect(screen.queryByText('Urgências')).toBeNull()
  })

  it('não renderiza fora do HRO — o contrato é de um hospital só', () => {
    render(
      <FaixaUrgencias escala={{ id: 'e2', hospital: 'unimed', data: HOJE, casos: [iniciada('c1', 'Sala 2')] }}
        hospital="unimed" turno="matutino" hoje={HOJE} />,
      { wrapper: wrap },
    )
    expect(screen.queryByText('Urgências')).toBeNull()
  })

  it('aparece MESMO sem nenhum caso no turno exibido — vive fora dos EmptyStates da BoardView', () => {
    // Urgência da manhã ainda correndo, tela na tarde sem casos vespertinos:
    // a BoardView cairia em "Nenhum caso neste turno" e a faixa tem de seguir viva.
    montar([iniciada('c1', 'Sala 2', { turno: 'matutino' })], { turno: 'vespertino' })
    expect(screen.getByText('Urgências')).toBeTruthy()
  })
})

describe('postos do contrato', () => {
  it('ocupado mostra sala + anestesista; vago mostra o papel e "livre"', () => {
    montar([iniciada('c1', 'Sala 6')])
    expect(screen.getByText('Sala 6')).toBeTruthy()
    expect(screen.getByText('Marcelo')).toBeTruthy()
    expect(screen.getByText('Sobreaviso')).toBeTruthy()
    expect(screen.getByText('livre')).toBeTruthy()
    expect(screen.getByText('1 de 2 salas')).toBeTruthy()
  })

  it('de manhã Ortopedia e CO aparecem como cards dedicados, com quem cobre a sala', () => {
    montar([
      iniciada('c1', 'Sala 6'),
      caso('orto', 'Sala 4', { tipo: 'eletiva', anestesista: 'RAFAEL', anestesistaUserId: 'u-rafael' }),
      caso('co', 'Sala 7 - CO', { tipo: 'eletiva', anestesista: 'CRISTINA', anestesistaUserId: 'u-cristina' }),
    ])
    expect(screen.getByText('Orto')).toBeTruthy()
    expect(screen.getByText('CO')).toBeTruthy()
    expect(screen.getByText('Rafael')).toBeTruthy()
    expect(screen.getByText('Cristina')).toBeTruthy()
  })

  it('à tarde o CO SAI dos dedicados — não há CO no contrato vespertino', () => {
    // turno vespertino às 11h (fase 'dia') → contrato da tarde; o card CO some.
    montar(
      [iniciada('c1', 'Sala 6', { turno: 'vespertino' }),
       caso('co', 'Sala 7 - CO', { tipo: 'eletiva', turno: 'vespertino', anestesista: 'CRISTINA', anestesistaUserId: 'u-cristina' })],
      { turno: 'vespertino' },
    )
    expect(screen.getByText('Orto')).toBeTruthy()
    expect(screen.queryByText('CO')).toBeNull()
  })
})

describe('excedente — acima do contrato', () => {
  const tres = [
    iniciada('c1', 'Sala 6', { statusAtualizadoEm: `${HOJE}T09:00:00` }),
    iniciada('c2', 'Sala 2', { statusAtualizadoEm: `${HOJE}T10:00:00` }),
    iniciada('c3', 'Sala 3', { statusAtualizadoEm: `${HOJE}T10:55:00`, anestesista: 'FERNANDO', anestesistaUserId: 'u-fer' }),
  ]

  it('a 3ª sala vira card EXTRA próprio, e o cabeçalho diz "acima do contrato"', () => {
    montar(tres)
    expect(screen.getByText('acima do contrato')).toBeTruthy()
    expect(screen.getByText('Extra')).toBeTruthy()
    // o excedente é o que INICIOU por último (os 2 mais antigos ocupam o contrato)
    expect(screen.getByText(/fora do contrato/)).toBeTruthy()
    expect(screen.getByText('Fernando')).toBeTruthy()
    expect(screen.getByText('3 de 2')).toBeTruthy()
  })

  it('2 de 2 mostra o badge de cheio, sem card extra', () => {
    montar(tres.slice(0, 2))
    expect(screen.getByText('2 de 2')).toBeTruthy()
    expect(screen.queryByText('Extra')).toBeNull()
  })
})

describe('fila', () => {
  it('ordena por gravidade, mostra a espera e a não classificada pede "Classificar" no fim', () => {
    montar([
      iniciada('c0', 'Sala 6'),
      caso('f-sem', 'Sala 9', { created_at: `${HOJE}T08:50:00` }),
      caso('f-imed', 'Sala 3', { gravidade: 'imediata', procedimento: 'AVC HEMORRAGICO', created_at: `${HOJE}T10:48:00` }),
    ])
    expect(screen.getByText(/Fila — 2 aguardando/i)).toBeTruthy()
    const linhas = screen.getAllByText(/^(1|2)º$/).map((el) => el.closest('button'))
    expect(linhas[0].textContent).toContain('Imediata')
    expect(linhas[0].textContent).toContain('AVC hemorragico') // fraseClinica preserva a sigla
    expect(linhas[0].textContent).toContain('12min')
    expect(linhas[1].textContent).toContain('Classificar')
    expect(linhas[1].textContent).toContain('2h10')
  })

  it('acima de 3 na fila, esconde o resto atrás de "ver todas (N)"', () => {
    montar([
      caso('f1', 'Sala 1', { gravidade: 'urgente' }), caso('f2', 'Sala 2', { gravidade: 'urgente' }),
      caso('f3', 'Sala 3', { gravidade: 'urgente' }), caso('f4', 'Sala 9', { gravidade: 'urgente', procedimento: 'QUARTA' }),
    ])
    expect(screen.queryByText('Quarta')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /ver todas \(4\)/ }))
    expect(screen.getByText('Quarta')).toBeTruthy()
  })
})

describe('toque abre o detalhe — onde Iniciada/Terminada já são marcados', () => {
  it('card ocupado abre o detalhe do caso certo', () => {
    montar([iniciada('c1', 'Sala 6')])
    fireEvent.click(screen.getByText('Marcelo').closest('button'))
    expect(screen.getByTestId('detalhe').textContent).toBe('c1')
  })

  it('linha da fila abre o detalhe do caso certo', () => {
    montar([caso('f1', 'Sala 9', { gravidade: 'urgente' })])
    fireEvent.click(screen.getByText(/Apendicectomia/i).closest('button'))
    expect(screen.getByTestId('detalhe').textContent).toBe('f1')
  })
})

describe('qualidade do dado', () => {
  it('iniciada há mais de 4h sai da conta, vira pergunta, e "Terminada" grava direto', () => {
    montar([iniciada('c1', 'Sala 6', { statusAtualizadoEm: `${HOJE}T05:00:00` })])
    expect(screen.getByText(/ainda em andamento\?/)).toBeTruthy()
    expect(screen.getByText('0 de 2 salas')).toBeTruthy() // saiu da ocupação
    fireEvent.click(screen.getByRole('button', { name: 'Terminada' }))
    expect(setStatusCirurgia).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'e1' }),
      expect.objectContaining({ id: 'c1' }),
      'terminada',
    )
  })

  it('urgência com hora passada e ainda agendada vira aviso "pode já ter começado"', () => {
    montar([caso('c1', 'Sala 6', { hora: '10:00' })])
    expect(screen.getByText(/pode já ter começado/)).toBeTruthy()
  })
})

describe('invariantes do módulo', () => {
  it('a faixa nunca escreve ordem_liberacao — o único caminho de escrita é o status', () => {
    // Garantido por construção: o mock do context SÓ expõe setStatusCirurgia; se
    // o componente chamasse setLinhaOverride/reordenarLiberacao, quebraria aqui.
    montar([iniciada('c1', 'Sala 6', { statusAtualizadoEm: `${HOJE}T05:00:00` })])
    fireEvent.click(screen.getByRole('button', { name: 'Terminada' }))
    expect(setStatusCirurgia).toHaveBeenCalledTimes(1)
  })
})
