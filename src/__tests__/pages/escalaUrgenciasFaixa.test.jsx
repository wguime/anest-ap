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
 *  • desde 11/11/2026 a caixa tem DUAS linhas (papel + quem, ou "livre") e as urgências que
 *    aguardam saíram de dentro da faixa para o bloco "Urgências aguardando", logo abaixo;
 *  • a faixa vive FORA da BoardView: o EmptyState "nenhum caso neste turno" não
 *    pode matá-la (8 de 9 urgências de 18/08 nasceram à mão, sem escala do turno).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import FaixaUrgencias from '@/pages/escala-cirurgica/FaixaUrgencias'

const { setStatusCirurgia, definirSalasUrgencia } = vi.hoisted(() => ({ setStatusCirurgia: vi.fn(async () => {}), definirSalasUrgencia: vi.fn(async () => {}) }))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ setStatusCirurgia, definirSalasUrgencia }),
  // o hook das urgências lê `hoje` do context (fonte única desde 21/08)
  useEscalaCirurgica: () => ({ hoje: HOJE, escalas: {}, data: HOJE, loading: false }),
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
// O detalhe é a superfície REAL de status; aqui interessa que ele abre com o caso
// certo E com o caminho de DEFINIR ANESTESISTA — sem essas duas props o detalhe
// esconde o botão da linha "Anestesista", e a urgência aberta pela faixa costuma
// ser justamente a que nasce sem anestesista (as cesarianas do CO).
vi.mock('@/pages/escala-cirurgica/CasoDetalheSheet', () => ({
  default: ({ caso, podeDefinirAnestesista, onDefinirAnestesista }) => (
    <div data-testid="detalhe" data-definivel={String(!!onDefinirAnestesista && !!podeDefinirAnestesista?.())}>
      {caso.id}
    </div>
  ),
}))
vi.mock('@/pages/escala-cirurgica/DefinirAnestesistaSheet', () => ({
  default: ({ sala, casosAlvo }) => (
    <div data-testid="definir">{sala}|{(casosAlvo || []).map((c) => c.id).join(',')}</div>
  ),
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
// RELÓGIO FIXO (14/10): os testes do término confirmam "agora" contra um início das
// 05:00 — com o relógio real, depois das ~17h a duração passava do teto e o
// "Confirmar" era recusado (passava ao meio-dia, falhava à noite). Dia SEGUINTE ao
// da escala, como no relógio real: o dia operacional da escala já passou.
const relogioMeioDia = () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-08-19T12:00:00-03:00'))
}
afterEach(() => vi.useRealTimers())

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

  it('acompanha o recuo da página no toque deitado — não passa da tela no Android (06/10)', () => {
    // a página usa `faixa:px-3`; com -mx-4 fixo a faixa passava 4px da tela deitado, e o
    // Chrome do Android alarga a página até caber — as folhas `fixed bottom-0` saem da vista
    montar([caso('c1', 'Sala 2', { tipo: 'eletiva' })])
    const faixa = screen.getByRole('region', { name: 'Urgências do HRO' })
    expect(faixa.className).toMatch(/(^|\s)faixa:-mx-3(\s|$)/)
    expect(faixa.className).toMatch(/(^|\s)faixa:px-3(\s|$)/)
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

// ⚠️ OS CARDS DA FAIXA MUDARAM DE LADO (dono 11/11/2026, opção B de `.tmp/analise-escala-2026-11/
// modelos-6/1-faixa-urgencias.html`, com o ajuste dele: "na linha de baixo deixe apenas o nome do
// anestesista, retire o ocupada e a sala"). De 09/09 a 10/11 o card tinha TRÊS linhas — papel,
// quem, onde e quanto pesa ("Sala 6 · 40min", "Sala 7 - CO · 2 cir.") — e os testes abaixo
// travavam a 3ª. Agora são DUAS: o papel em cima e, embaixo, só QUEM está, ou "livre". No HRO a
// primeira cirurgia só aparecia no meio da tela. A REGRA de qual urgência ocupa qual vaga não
// mudou — as pastilhas e as contagens seguem iguais.
describe('postos do contrato', () => {
  const cardDe = (papel) => screen.getByText(papel).closest('button, div')

  it('ocupado mostra papel + QUEM, sem sala nem tempo; vago mostra o papel e "livre"', () => {
    montar([iniciada('c1', 'Sala 6')])
    expect(cardDe('Plantão').textContent).toBe('PlantãoMarcelo')
    expect(cardDe('Sobreaviso').textContent).toBe('Sobreavisolivre')
    expect(screen.queryByText('Sala 6 · 40min')).toBeNull()
    expect(document.querySelector('[aria-label="Urgências do HRO"]').textContent).not.toMatch(/Sala 6|40min/)
    // caixa mais baixa: 44 px (era 48+)
    expect(cardDe('Plantão').className).toContain('min-h-[44px]')
  })

  it('o cabeçalho diz em que LINHA do contrato estamos, e não duas contagens', () => {
    // A queixa de 09/09 era o cabeçalho: "0 de 2 salas" ao lado de "2 livres",
    // com duas salas cheias logo abaixo. Agora o texto é o turno do contrato —
    // é o RELÓGIO que decide a capacidade — e a contagem é uma só, nas vagas.
    montar([iniciada('c1', 'Sala 6')])
    expect(screen.getByText('Manhã · contrato de 2')).toBeTruthy()
    expect(screen.queryByText('1 de 2 salas')).toBeNull()
    expect(screen.queryByText('1 livre')).toBeNull()
    expect(screen.getByLabelText('1 de 2 vagas de urgência ocupadas')).toBeTruthy()
  })

  it('de manhã Ortopedia e CO aparecem como cards dedicados, com quem cobre a sala', () => {
    montar([
      iniciada('c1', 'Sala 6'),
      caso('orto', 'Sala 4', { tipo: 'eletiva', anestesista: 'RAFAEL', anestesistaUserId: 'u-rafael' }),
      caso('co', 'Sala 7 - CO', { tipo: 'eletiva', anestesista: 'CRISTINA', anestesistaUserId: 'u-cristina' }),
    ])
    // papel POR EXTENSO como título (dono 09/09): "CO" no canto direito era
    // lido como estado, do lado de "livre", e não como quem cobre a sala.
    expect(screen.getByText('Ortopedia')).toBeTruthy()
    expect(screen.getByText('Centro obstétrico')).toBeTruthy()
    // só o nome de quem o mapa pôs ali — sem sala, sem contagem (dono 11/11/2026)
    expect(cardDe('Ortopedia').textContent).toBe('OrtopediaRafael')
    expect(cardDe('Centro obstétrico').textContent).toBe('Centro obstétricoCristina')
    expect(screen.queryByText('Sala 4 · 1 cir.')).toBeNull()
  })

  it('dedicado sem ninguém no mapa diz "livre" (era "sem anestesista" + a sala)', () => {
    montar([iniciada('c1', 'Sala 6')])
    expect(cardDe('Ortopedia').textContent).toBe('Ortopedialivre')
    expect(cardDe('Centro obstétrico').textContent).toBe('Centro obstétricolivre')
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
    expect(screen.getByText('Ortopedia')).toBeTruthy()
    expect(screen.queryByText('Centro obstétrico')).toBeNull() // não é mais card de dedicado
    // a sala do CO ocupa uma vaga do contrato — a caixa diz só quem está (11/11)
    expect(screen.queryByText('Sala 7 - CO')).toBeNull()
    expect(screen.getByText('Cristina').closest('button').textContent).toMatch(/^(Plantão|Sobreaviso)Cristina$/)
    expect(screen.getByLabelText('2 de 2 vagas de urgência ocupadas')).toBeTruthy()
  })

  it('sala com várias cirurgias é UM card, com a contagem à direita', () => {
    // "Gabriel ficou com 2 cards de CO — que fique um único card com várias
    // cirurgias obstétricas (dia todo)".
    montar(
      [caso('co1', 'Sala 7 - CO', { tipo: 'eletiva', procedimento: 'DIA TODO', turno: 'vespertino', anestesista: 'GABRIEL', anestesistaUserId: 'u-gabriel' }),
       caso('co2', 'Sala 7 - CO', { gravidade: 'urgente', procedimento: 'Cesarianas', turno: 'vespertino', anestesista: 'GABRIEL', anestesistaUserId: 'u-gabriel' })],
      { turno: 'vespertino' },
    )
    // um card só, com o nome de quem está (a contagem "2 cir." saiu da caixa em 11/11)
    expect(screen.getAllByText('Gabriel')).toHaveLength(1)
    expect(screen.queryByText(/cir\./)).toBeNull()
    expect(screen.getByLabelText('1 de 2 vagas de urgência ocupadas')).toBeTruthy()
    // a cesárea seguinte é trabalho DESTA sala: não vira "urgência aguardando"
    expect(document.querySelector('[data-urgencias-aguardando]')).toBeNull()
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
    // o rótulo do excedente é o TÍTULO do card, na mesma posição do papel dos
    // outros — "Extra" no canto de cima e "fora do contrato" no de baixo eram
    // duas metades da mesma frase em lugares diferentes.
    expect(screen.getByText('Extra — fora do contrato')).toBeTruthy()
    // o excedente é quem INICIOU por último (os 2 mais antigos ocupam o contrato)
    expect(screen.getByText('Fernando')).toBeTruthy()
    // a vaga acima do contrato acende uma pastilha a mais
    expect(screen.getByLabelText('3 de 2 vagas de urgência ocupadas')).toBeTruthy()
  })

  it('2 de 2 acende as duas vagas, sem card extra', () => {
    montar(tres.slice(0, 2))
    expect(screen.getByLabelText('2 de 2 vagas de urgência ocupadas')).toBeTruthy()
    expect(screen.queryByText(/^Extra/)).toBeNull()
    expect(screen.queryByText('acima do contrato')).toBeNull()
  })
})

// ⚠️ MUDOU DE LADO (dono 11/11/2026, opção A de `modelos-6/2-urgencias-aguardando.html`): a
// "Fila — N aguardando" de DENTRO da faixa (uma linha com posição, selo, procedimento e espera,
// teto de 3 + "ver todas") virou o bloco "Urgências aguardando", logo ABAIXO da faixa — o mesmo
// bloco, com o mesmo nome e desenho, que abre a aba Liberações. Cada linha diz também a sala (ou
// "Sala a definir") e quem faz (ou "sem anestesista", com "Definir"). A ORDEM continua sendo a
// da lib (gravidade → chegada) e a lista é a mesma `estado.fila`.
describe('urgências aguardando — o bloco abaixo da faixa (dono 11/11/2026)', () => {
  const bloco = () => document.querySelector('[data-urgencias-aguardando]')
  const linhas = () => [...bloco().querySelectorAll(':scope > div > div')].map((l) => l.textContent)

  it('ordena por gravidade; cada linha diz selo · procedimento · sala · quem · há quanto tempo', () => {
    // 2 vagas ocupadas (as duas iniciadas) ⇒ as duas agendadas aguardam
    montar([
      iniciada('c0', 'Sala 6'),
      iniciada('c0b', 'Sala 1'),
      caso('f-sem', 'Sala 9', { created_at: `${HOJE}T08:50:00` }),
      caso('f-imed', 'Sala 3', { gravidade: 'imediata', procedimento: 'AVC HEMORRAGICO', created_at: `${HOJE}T10:48:00` }),
    ])
    expect(screen.queryByText(/Fila — /)).toBeNull()
    expect(bloco().textContent).toContain('Urgências aguardando (2)')
    const [primeira, segunda] = linhas()
    expect(primeira).toBe('ImediataAVC hemorragicoSala 3 · Marcelo · lançada há 12min') // fraseClinica preserva a sigla
    expect(segunda).toBe('ClassificarApendicectomiaSala 9 · Marcelo · lançada há 2h10')
    // fora da faixa: o bloco vem DEPOIS dela
    expect(bloco().closest('[aria-label="Urgências do HRO"]')).toBeNull()
  })

  it('lista TODAS as que aguardam — o teto de 3 com "ver todas (N)" saiu', () => {
    montar([
      iniciada('v1', 'Sala 5'), iniciada('v2', 'Sala 6'),
      caso('f1', 'Sala 1', { gravidade: 'urgente' }), caso('f2', 'Sala 2', { gravidade: 'urgente' }),
      caso('f3', 'Sala 3', { gravidade: 'urgente' }), caso('f4', 'Sala 9', { gravidade: 'urgente', procedimento: 'QUARTA' }),
    ])
    expect(linhas()).toHaveLength(4)
    expect(screen.getByText('Quarta')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /ver todas/ })).toBeNull()
  })

  it('sem sala: "Sala a definir"; sem anestesista: diz e oferece "Definir" (alvo de 44 px)', () => {
    montar([
      iniciada('v1', 'Sala 5'), iniciada('v2', 'Sala 6'),
      caso('orfa', '', { gravidade: 'imediata', anestesista: '?', anestesistaUserId: null, semAnestesista: true }),
    ])
    expect(linhas()[0]).toBe('ImediataApendicectomiaSala a definir · sem anestesista · lançada há 1h00Definir')
    const definir = screen.getByRole('button', { name: /^Definir anestesista de / })
    expect(definir.className).toContain('min-h-[44px]')
    expect(definir.className).toContain('min-w-[44px]')
    // "Definir" abre a folha de quem responde, com ESTA cirurgia como alvo
    fireEvent.click(definir)
    expect(screen.getByTestId('definir').textContent).toBe('|orfa')
  })

  it('com anestesista não há "Definir"; sem urgência aguardando o bloco não existe', () => {
    const { unmount } = montar([iniciada('v1', 'Sala 5'), iniciada('v2', 'Sala 6'), caso('f1', 'Sala 9', { gravidade: 'urgente' })])
    expect(screen.queryByRole('button', { name: /^Definir anestesista de / })).toBeNull()
    unmount()
    montar([iniciada('c1', 'Sala 6')])
    expect(bloco()).toBeNull()
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

  // DONO 21/08: "ao clicar no card das urgências deve ser possível adicionar o
  // anestesista". A faixa abria o detalhe SEM `podeDefinirAnestesista`/
  // `onDefinirAnestesista` — o quadro e a aba Minhas passavam, a faixa não — e o
  // detalhe esconde o botão da linha "Anestesista" quando elas faltam. Era o único
  // caminho para a urgência que nasce sem anestesista, que é o caso comum aqui.
  it('o detalhe aberto pela faixa permite DEFINIR o anestesista', () => {
    montar([caso('sem', 'Sala 9', { anestesista: '?', anestesistaUserId: null, semAnestesista: true })])
    // a caixa diz "sem anestesista" (a sala saiu dela em 11/11)
    fireEvent.click(screen.getByText('sem anestesista').closest('button'))
    expect(screen.getByTestId('detalhe').textContent).toBe('sem')
    expect(screen.getByTestId('detalhe').dataset.definivel).toBe('true')
  })
})

describe('qualidade do dado', () => {
  it('iniciada há mais de 4h sai da conta, vira pergunta, e "Terminada" CONFIRMA o horário antes de gravar', () => {
    relogioMeioDia() // o término proposto é "agora": às 19h, 05:00 → agora passava do teto de duração
    montar([iniciada('c1', 'Sala 6', { statusAtualizadoEm: `${HOJE}T05:00:00`, inicioReal: '05:00' })])
    expect(screen.getByText(/ainda em andamento\?/)).toBeTruthy()
    expect(screen.getByLabelText('0 de 2 vagas de urgência ocupadas')).toBeTruthy() // saiu da ocupação
    fireEvent.click(screen.getByRole('button', { name: 'Terminada' }))
    // 02/10 (dono, tarde): o toque abre o card "Término da cirurgia" — nada é gravado
    // até confirmar (é aqui, na cirurgia esquecida, que a hora do toque mais erra)
    expect(setStatusCirurgia).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar término às \d{2}:\d{2}$/ }))
    // o 4º argumento é quem tocou — o carimbo otimista precisa dele para o
    // detalhe dizer "por Fulano" já no ato (dono 21/08) — e o horário confirmado
    expect(setStatusCirurgia).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'e1' }),
      expect.objectContaining({ id: 'c1' }),
      'terminada',
      expect.objectContaining({ userId: 'u-eu', terminoReal: expect.stringMatching(/^\d{2}:\d{2}$/) }),
    )
  })

  it('urgência com hora passada e ainda agendada vira aviso "pode já ter começado"', () => {
    montar([caso('c1', 'Sala 6', { hora: '10:00' })])
    expect(screen.getByText(/pode já ter começado/)).toBeTruthy()
  })
})

describe('invariantes do módulo', () => {
  it('a faixa nunca escreve ordem_liberacao — o único caminho de escrita é o status', () => {
    relogioMeioDia() // o término proposto é "agora": às 19h, 05:00 → agora passava do teto de duração
    // Garantido por construção: o mock do context SÓ expõe setStatusCirurgia; se
    // o componente chamasse setLinhaOverride/reordenarLiberacao, quebraria aqui.
    montar([iniciada('c1', 'Sala 6', { statusAtualizadoEm: `${HOJE}T05:00:00`, inicioReal: '05:00' })])
    fireEvent.click(screen.getByRole('button', { name: 'Terminada' }))
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar término às/ }))
    expect(setStatusCirurgia).toHaveBeenCalledTimes(1)
  })

  it('sem início gravado, "Terminada" exige o início junto (dono 14/10) — não há "só o término"', () => {
    relogioMeioDia() // o término proposto é "agora": às 19h, 05:00 → agora passava do teto de duração
    montar([iniciada('c1', 'Sala 6', { statusAtualizadoEm: `${HOJE}T05:00:00` })])
    fireEvent.click(screen.getByRole('button', { name: 'Terminada' }))
    expect(screen.queryByRole('button', { name: /^Confirmar término às/ })).toBeNull()
    const confirmar = screen.getByRole('button', { name: 'Confirmar horários' })
    expect(confirmar.disabled).toBe(true) // o início começa vazio
    fireEvent.change(document.querySelector('[data-slot="inicio-hora"] input') || document.querySelector('[data-slot="inicio-hora"]'), { target: { value: '0510' } })
    expect(confirmar.disabled).toBe(false)
    fireEvent.click(confirmar)
    expect(setStatusCirurgia).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'e1' }),
      expect.objectContaining({ id: 'c1' }),
      'terminada',
      expect.objectContaining({ inicioReal: '05:10', terminoReal: expect.stringMatching(/^\d{2}:\d{2}$/) }),
    )
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
    // o card da ortopedia passa a dizer quem cobre a Sala 3 (a sala em si saiu da caixa em 11/11)
    const orto = screen.getByText('Ortopedia').closest('button, div')
    expect(orto.textContent).toBe('OrtopediaRafael')
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
    expect(screen.getByLabelText('1 de 2 vagas de urgência ocupadas')).toBeTruthy() // ocupou o plantonista
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
    expect(screen.getByLabelText('1 de 2 vagas de urgência ocupadas')).toBeTruthy()
    // a vaga do plantão passa a mostrar quem está na sala marcada (só o nome, 11/11)
    expect(screen.getByText('Plantão').closest('button').textContent).toBe('PlantãoMarcelo')
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
    expect(screen.getByLabelText('1 de 2 vagas de urgência ocupadas')).toBeTruthy()
    // um card só, com o nome (a contagem "2 cir." saiu da caixa em 11/11)
    expect(screen.getAllByText('Gabriel')).toHaveLength(1)
    expect(document.querySelector('[data-urgencias-aguardando]')).toBeNull()
  })
})
