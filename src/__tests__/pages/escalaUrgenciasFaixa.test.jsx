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

const { setStatusCirurgia, definirSalasUrgencia } = vi.hoisted(() => ({ setStatusCirurgia: vi.fn(async () => {}), definirSalasUrgencia: vi.fn(async () => {}) }))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ setStatusCirurgia, definirSalasUrgencia }),
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
// O formulário real tem suíte própria; aqui interessa que abre com o posto certo.
vi.mock('@/pages/escala-cirurgica/AddCasoSheet', () => ({
  default: ({ postoInicial, salaInicial }) => (
    <div data-testid="add-caso">{postoInicial}|{salaInicial || ''}</div>
  ),
}))

const HOJE = '2026-08-18'
const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

// ⚠️ o anestesista PADRÃO é por caso (`u-${id}`): desde 20/08 duas cirurgias da
// MESMA pessoa são uma vaga só, então fixture com um anestesista para todos
// mediria o dedup, não o cenário. Quem quer testar o dedup passa o uid igual.
const caso = (id, sala, extra = {}) => ({
  id, sala, ordem: 0, tipo: 'urgencia', statusCirurgia: 'agendada', statusExtra: null,
  procedimento: 'APENDICECTOMIA', convenio: 'SUS', anestesista: 'MARCELO',
  anestesistaUserId: `u-${id}`, created_at: `${HOJE}T10:00:00`, turno: 'matutino',
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
  it('escala publicada SEM urgência mostra os postos livres e os dedicados (dono 19/08)', () => {
    // 19/08: o dono publicou a manhã do HRO (28 casos, zero urgências) e a faixa
    // não apareceu — mas é exatamente na publicação que se confere/configura as
    // salas do contrato. Escala com casos ⇒ faixa visível.
    montar([
      caso('c1', 'Sala 2', { tipo: 'eletiva' }),
      caso('orto', 'Sala 4', { tipo: 'eletiva', anestesista: 'RAFAEL', anestesistaUserId: 'u-rafael' }),
    ])
    expect(screen.getByText('Urgências')).toBeTruthy()
    expect(screen.getByText('Plantão')).toBeTruthy()   // posto livre tracejado
    expect(screen.getByText('Sobreaviso')).toBeTruthy()
    expect(screen.getByText('Rafael')).toBeTruthy()    // dedicado informa quem cobre
    expect(screen.getByRole('button', { name: 'Configurar salas do contrato' })).toBeTruthy()
  })

  it('sem caso NENHUM no dia, a faixa some', () => {
    montar([])
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

  it('à tarde o CO SAI dos dedicados e passa a OCUPAR uma vaga (dono 20/08)', () => {
    // turno vespertino às 11h (fase 'dia') → contrato da tarde; o card de dedicado
    // do CO some e a sala aparece como posto ocupado, com quem cobre. Era a queixa
    // literal: "adicionei cesarianas como urgência e o card continua em branco".
    montar(
      [iniciada('c1', 'Sala 6', { turno: 'vespertino' }),
       caso('co', 'Sala 7 - CO', { tipo: 'eletiva', turno: 'vespertino', anestesista: 'CRISTINA', anestesistaUserId: 'u-cristina' })],
      { turno: 'vespertino' },
    )
    expect(screen.getByText('Orto')).toBeTruthy()
    expect(screen.queryByText('CO')).toBeNull() // não é mais card de dedicado
    expect(screen.getByText('Sala 7 - CO')).toBeTruthy()
    expect(screen.getByText('Cristina')).toBeTruthy()
    expect(screen.getByText('2 de 2')).toBeTruthy()
  })

  it('sala com várias cirurgias é UM card, com a contagem à direita', () => {
    // "Gabriel ficou com 2 cards de CO — que fique um único card com várias
    // cirurgias obstétricas (dia todo)".
    montar(
      [caso('co1', 'Sala 7 - CO', { tipo: 'eletiva', procedimento: 'DIA TODO', turno: 'vespertino', anestesista: 'GABRIEL', anestesistaUserId: 'u-gabriel' }),
       caso('co2', 'Sala 7 - CO', { gravidade: 'urgente', procedimento: 'Cesarianas', turno: 'vespertino', anestesista: 'GABRIEL', anestesistaUserId: 'u-gabriel' })],
      { turno: 'vespertino' },
    )
    expect(screen.getAllByText('Sala 7 - CO')).toHaveLength(1)
    expect(screen.getByText('2 cir.')).toBeTruthy() // abreviado p/ o nome caber em 196px
    expect(screen.getByText('1 de 2 salas')).toBeTruthy()
    expect(screen.queryByText(/Fila —/)).toBeNull() // a cesárea seguinte é trabalho DESTA sala
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
    // o excedente é quem INICIOU por último (os 2 mais antigos ocupam o contrato)
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
    // 2 vagas ocupadas (a iniciada + a 1ª agendada, que ENTRA na vaga livre desde
    // 20/08) ⇒ as duas seguintes formam a fila.
    montar([
      iniciada('c0', 'Sala 6'),
      iniciada('c0b', 'Sala 1'),
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
    // as 2 primeiras ocupam as vagas do contrato; as 4 seguintes fazem a fila
    montar([
      iniciada('v1', 'Sala 5'), iniciada('v2', 'Sala 6'),
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
    montar([iniciada('v1', 'Sala 5'), iniciada('v2', 'Sala 6'), caso('f1', 'Sala 9', { gravidade: 'urgente' })])
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

/**
 * SALAS CONFIGURÁVEIS (dono 18/08, 2ª decisão): "as salas do CO e ortopedia
 * podem mudar" — o ⚙ da faixa abre o sheet que marca onde cada papel está
 * NESTE dia/turno. Config vive em urgencias_meta (sobrevive à republicação).
 */
describe('salas configuráveis por dia/turno', () => {
  it('a config do dia muda o card dedicado: ortopedia marcada na Sala 3', () => {
    render(
      <FaixaUrgencias
        escala={{
          ...escalaCom([
            iniciada('c1', 'Sala 6'),
            caso('e3', 'Sala 3', { tipo: 'eletiva', anestesista: 'RAFAEL', anestesistaUserId: 'u-rafael' }),
          ]),
          urgenciasMeta: { matutino: { orto: 'Sala 3' } },
        }}
        hospital="hro" turno="matutino" hoje={HOJE}
      />,
      { wrapper: wrap },
    )
    // o card da ortopedia agora aponta a Sala 3 e quem a cobre
    const orto = screen.getByText('Orto').closest('div')
    expect(orto.textContent).toContain('Sala 3')
    expect(orto.textContent).toContain('Rafael')
  })

  it('urgência na Sala 4 vira comum quando a ortopedia foi marcada noutra sala', () => {
    render(
      <FaixaUrgencias
        escala={{
          ...escalaCom([iniciada('c1', 'Sala 4')]),
          urgenciasMeta: { matutino: { orto: 'Sala 3' } },
        }}
        hospital="hro" turno="matutino" hoje={HOJE}
      />,
      { wrapper: wrap },
    )
    expect(screen.getByText('1 de 2 salas')).toBeTruthy() // ocupou o plantonista
  })

  it('marcar o plantão numa sala coloca a sala na CONTAGEM (dono 20/08)', () => {
    // "se salas de urgência não tiverem sido identificadas, que haja como marcar
    // sala para que entre na contagem" — até 19/08 marcar não mudava o número.
    render(
      <FaixaUrgencias
        escala={{
          ...escalaCom([caso('e1', 'Sala 6', { tipo: 'eletiva' })]),
          urgenciasMeta: { matutino: { plantao: 'Sala 6' } },
        }}
        hospital="hro" turno="matutino" hoje={HOJE} />,
      { wrapper: wrap },
    )
    expect(screen.getByText('1 de 2 salas')).toBeTruthy()
    expect(screen.getByText('Sala 6')).toBeTruthy()
    expect(screen.getByText('Marcelo')).toBeTruthy()
  })

  it('o ⚙ abre o sheet e salvar chama a action com o payload do turno', async () => {
    montar([iniciada('c1', 'Sala 6')])
    fireEvent.click(screen.getByRole('button', { name: 'Configurar salas do contrato' }))
    expect(screen.getByText(/Salas do contrato — manhã/)).toBeTruthy()

    // BOTTOM sheet com altura solta — a API do DS ignora props erradas em
    // silêncio (`position` no raiz) e o sheet abria como painel LATERAL com o
    // título fora do lugar (bug do dono 18/08 15h). O side vira classe.
    const painel = document.querySelector('[data-slot="sheet-content"]')
    expect(painel.className).toContain('bottom-0')
    expect(painel.className).toContain('!h-auto')

    // marca a ortopedia na Sala 3 (Select do DS: combobox → option)
    const combos = screen.getAllByRole('combobox')
    fireEvent.click(combos[2]) // Plantão, Sobreaviso, Ortopedia, CO
    fireEvent.click(screen.getByRole('option', { name: 'Sala 3' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await vi.waitFor(() => expect(definirSalasUrgencia).toHaveBeenCalled())
    const [escalaArg, turnoArg, cfgArg] = definirSalasUrgencia.mock.calls[0]
    expect(escalaArg.id).toBe('e1')
    expect(turnoArg).toBe('matutino')
    expect(cfgArg).toEqual({ orto: 'Sala 3' })
  })

  it('tudo em Automático salva null — o jsonb não guarda ruído', async () => {
    montar([iniciada('c1', 'Sala 6')])
    fireEvent.click(screen.getByRole('button', { name: 'Configurar salas do contrato' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await vi.waitFor(() => expect(definirSalasUrgencia).toHaveBeenCalled())
    expect(definirSalasUrgencia.mock.calls[0][2]).toBeNull()
  })
})


/**
 * ATALHO DOS POSTOS (dono 19/08): tocar num posto SEM caso abre o "Adicionar
 * caso" já apontando o posto (e a sala, no dedicado). Ocupado segue no detalhe.
 */
describe('toque nos postos vazios abre o Adicionar caso', () => {
  it('posto livre abre o formulário apontando o posto', () => {
    montar([caso('c1', 'Sala 2', { tipo: 'eletiva' })]) // escala sem urgência: 2 livres
    fireEvent.click(screen.getByText('Plantão').closest('button'))
    expect(screen.getByTestId('add-caso').textContent).toBe('plantao|')
  })

  it('dedicado sem urgência abre já com o posto E a sala dele', () => {
    montar([caso('e1', 'Sala 4', { tipo: 'eletiva', anestesista: 'RAFAEL', anestesistaUserId: 'u-rafael' })])
    fireEvent.click(screen.getByText('Rafael').closest('button'))
    expect(screen.getByTestId('add-caso').textContent).toBe('orto|Sala 4')
  })

  it('posto ocupado continua abrindo o DETALHE do caso, não o formulário', () => {
    montar([iniciada('c1', 'Sala 6')])
    fireEvent.click(screen.getByText('Marcelo').closest('button'))
    expect(screen.getByTestId('detalhe').textContent).toBe('c1')
    expect(screen.queryByTestId('add-caso')).toBeNull()
  })
})

/**
 * UMA PESSOA, UMA VAGA (dono 20/08): "a vaga é gasta por cirurgia" — mas ninguém
 * opera dois pacientes ao mesmo tempo, então as cirurgias do MESMO anestesista
 * são um card só, com a contagem. É o CO com cesáreas o dia todo.
 */
describe('cirurgias do mesmo anestesista', () => {
  it('duas cirurgias do mesmo anestesista ocupam UMA vaga e mostram a contagem', () => {
    montar([
      caso('a', 'Sala 7 - CO', { anestesistaUserId: 'u-gab', anestesista: 'GABRIEL', tipo: 'eletiva', turno: 'vespertino' }),
      caso('b', 'Sala 7 - CO', { anestesistaUserId: 'u-gab', anestesista: 'GABRIEL', turno: 'vespertino' }),
    ], { turno: 'vespertino' })
    expect(screen.getByText('1 de 2 salas')).toBeTruthy()
    expect(screen.getByText('2 cir.')).toBeTruthy()
    expect(screen.queryByText(/Fila —/)).toBeNull()
  })
})
