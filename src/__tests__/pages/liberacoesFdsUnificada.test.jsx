/**
 * Fila de liberação ÚNICA do fim de semana (modo FDS, dono 15/08) — a
 * LiberacoesView opera sobre a linha pseudo-hospital 'fds' com os casos dos 3
 * hospitais mesclados (hospitalOrigem = exibição). Fixture do documento REAL de
 * 15/08/2026.
 *
 * Trava:
 *  1. a fila segue o rodapé publicado (invertido do doc) e o "próximo a ser
 *     liberado" cruza hospitais (caso do próximo pode estar no HRO);
 *  2. badge Pn (P1–P12) conforme a posição; ajuda avulsa sem posição fica sem;
 *  3. hospital prefixa o local (sala sozinha é ambígua na fila única);
 *  4. plantão físico da faixa (grade) no lugar do "Plantonista" genérico;
 *  5. liberar fora da ordem só avisa (onToggle não dispara); liberar o próximo
 *     dispara com a CHAVE ESTÁVEL;
 *  6. fase noturna FDS: 4 cards da faixa 19-07 da grade; cols Unimed/HRO fixas
 *     (nunca "próximo"); 23h zera e ficam só eles;
 *  7. dia útil intacto: sem modoFds, casosFds é ignorado.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'

const ROSTER = [
  // só o STAUB tem vínculo — exercita o caminho por uid; os demais casam por texto
  { uid: 'uid-staub', nome: 'GUSTAVO STAUB', apelidos: ['STAUB'] },
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
  default: {
    // aviso de tempo estourado (24/08): sem isto o hook rejeita solto
    reservarAvisoTempo: vi.fn(async () => false), fetchLocaisHospital: vi.fn(async () => []) },
}))
// o formulário de caso tem contexto próprio (UserProvider/roster) e teste
// dedicado — aqui só interessa que ele seja aberto com a escala certa
vi.mock('@/pages/escala-cirurgica/AddCasoSheet', () => ({
  default: ({ escala }) => <div data-testid="add-caso" data-escala={escala?.id} />,
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

// ── Documento real 15/08/2026 ───────────────────────────────────────────────
const GRADE_SAB = {
  '7-13': { unimed: 'GUILHERME DIDOMENICO', hro: 'JOAO HENRIQUE', ret1: 'CRISTINA', ret2: 'MATHEUS' },
  '13-19': { unimed: 'CRISTINA', hro: 'MATHEUS', ret1: 'GUILHERME DIDOMENICO', ret2: 'JOAO HENRIQUE' },
  '19-07': { unimed: 'JOAO HENRIQUE', hro: 'GUILHERME DIDOMENICO', ret1: 'MATHEUS', ret2: 'CRISTINA' },
}
const POSICOES_SAB = {
  P1: 'GUILHERME DIDOMENICO', P2: 'JOAO HENRIQUE', P3: 'CRISTINA', P4: 'MATHEUS',
  P5: 'GABRIELA', P6: 'ERLEI', P7: 'MARILIO', P8: 'RAFAEL',
  P9: 'ROBERTA', P10: 'STAUB', P11: 'GABRIEL', P12: 'VICENTE',
}
// rodapé = inverso da linha "1º→último a ser liberado" do doc (P4,P3,P12,P09,…)
const RODAPE_SAB_MAT = [
  'GUILHERME DIDOMENICO', 'JOAO HENRIQUE', 'MARILIO', 'RAFAEL', 'GABRIELA', 'ERLEI',
  'GABRIEL', 'STAUB', 'ROBERTA', 'VICENTE', 'CRISTINA', 'MATHEUS',
]
// tarde do documento (P3,P4,P6,P5,P9,P10,P11 + P1,P2 que pegam a noite)
const RODAPE_SAB_VESP = [
  'CRISTINA', 'MATHEUS', 'ERLEI', 'GABRIELA', 'ROBERTA', 'STAUB', 'GABRIEL',
  'GUILHERME DIDOMENICO', 'JOAO HENRIQUE',
]

const caso = (id, hospitalOrigem, sala, anestesista, extra = {}) => ({
  id, hospitalOrigem, sala, ordem: 0, hora: '07:30', anestesista, cirurgiao: 'Cirurgião X',
  turno: 'matutino', bloco: 'normal', isContinuacao: false, semAnestesista: false, ...extra,
})

const CASOS_FDS = [
  caso('u1', 'unimed', 'C.O - Sala 3', 'STAUB'),
  caso('u2', 'unimed', 'CC - Sala 2', 'GABRIELA'),
  caso('u3', 'unimed', 'CC - Sala 6', 'GUILHERME DIDOMENICO'),
  caso('h1', 'hro', 'Bloco A', 'MATHEUS'),
  caso('h2', 'hro', 'Sala 1', 'STAUB'), // STAUB nos DOIS hospitais no mesmo turno
]

const ESCALA_FDS = {
  id: 'fds-1', hospital: 'fds', data: '2026-08-15', status: 'publicada',
  ordemLiberacao: { matutino: RODAPE_SAB_MAT, vespertino: RODAPE_SAB_VESP },
  ajudaExterna: { matutino: ['THAYNA'] }, // ajuda avulsa SEM posição Pn
  liberacoes: {}, linhaOverrides: {},
  casos: [],
  fdsMeta: {
    grade: GRADE_SAB,
    posicoes: POSICOES_SAB,
    escalacao: { matutino: ['P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12'], vespertino: [] },
    ordemFonte: { matutino: 'documento' },
  },
}

const montar = (props = {}) => render(
  <LiberacoesView
    escala={ESCALA_FDS} hospital="fds" hospitalLabel="Fim de semana" turno="matutino"
    canEdit modoFds casosFds={CASOS_FDS} fdsMeta={ESCALA_FDS.fdsMeta}
    onToggle={() => {}} onSetOverride={() => {}} {...props}
  />,
  { wrapper: wrap }
)

const cardDe = (chave) => document.querySelector(`[data-linha="${chave}"]`)

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-08-15T10:00:00-03:00')) // sábado, faixa 7-13
})
afterAll(() => vi.useRealTimers())
beforeEach(() => vi.clearAllMocks())

describe('fila única — ordem do rodapé publicado, cruzando hospitais', () => {
  it('exibe as 12 posições na ordem do rodapé e o próximo é o ÚLTIMO em sala (caso no HRO)', () => {
    montar()
    const chaves = [...document.querySelectorAll('[data-linha]')]
      .map((el) => el.dataset.linha)
      .filter((c) => RODAPE_SAB_MAT.map((n) => n).includes(c) || c === 'uid-staub')
    // ordem de exibição = rodapé (STAUB vira uid pelo vínculo)
    expect(chaves).toEqual(RODAPE_SAB_MAT.map((n) => (n === 'STAUB' ? 'uid-staub' : n)))
    // MATHEUS fecha o rodapé (P4 — 1º a ser liberado); o caso dele é do HRO e
    // mesmo assim é ele o "Próximo a ser liberado" — a fila cruza hospitais
    expect(cardDe('MATHEUS').textContent).toContain('Próximo a ser liberado')
  })

  it('badge Pn conforme a posição; ajuda avulsa sem posição fica sem selo', () => {
    montar()
    expect(cardDe('MATHEUS').dataset.selo).toBe('P4')
    expect(cardDe('VICENTE').dataset.selo).toBe('P12')
    expect(cardDe('uid-staub').dataset.selo).toBe('P10')
    expect(cardDe('THAYNA')).toBeTruthy()
    expect(cardDe('THAYNA').dataset.selo).toBeUndefined()
  })

  it('hospital prefixa o local; quem opera nos dois mostra Unimed/HRO', () => {
    montar()
    expect(cardDe('uid-staub').textContent).toContain('Unimed/HRO')
    expect(cardDe('MATHEUS').textContent).toContain('HRO')
    expect(cardDe('GABRIELA').textContent).toContain('Unimed')
  })

  it('plantão físico da faixa 7-13 (grade) no lugar do "Plantonista" genérico', () => {
    montar()
    expect(cardDe('GUILHERME DIDOMENICO').textContent).toContain('Plantão Unimed')
    expect(cardDe('JOAO HENRIQUE').textContent).toContain('Plantão HRO')
    expect(screen.queryByText('Plantonista')).toBeNull()
  })

  it('badge segue o TURNO EXIBIDO, não o relógio (dono 16/08)', () => {
    // 10h da manhã, olhando a TARDE: os plantões são os da faixa 13-19
    // (Cristina/Unimed e Matheus/HRO), não os da manhã
    montar({ turno: 'vespertino' })
    expect(cardDe('CRISTINA').textContent).toContain('Plantão Unimed')
    expect(cardDe('MATHEUS').textContent).toContain('Plantão HRO')
    expect(cardDe('GUILHERME DIDOMENICO').textContent).not.toContain('Plantão')
  })

  it('liberar fora da ordem só avisa; liberar o próximo dispara com a chave estável', () => {
    const onToggle = vi.fn(async () => {})
    montar({ onToggle })
    // STAUB não é o próximo → bloqueio (toast), nada persiste
    // (com vínculo, o display vem do cadastro: "Gustavo Staub")
    fireEvent.click(screen.getByLabelText('Marcar Gustavo Staub liberado'))
    expect(onToggle).not.toHaveBeenCalled()
    // MATHEUS é o próximo → dispara com a linha de chave estável
    fireEvent.click(screen.getByLabelText('Marcar Matheus liberado'))
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onToggle.mock.calls[0][0].chave).toBe('MATHEUS')
  })

  it('sem casos importados ainda, o rodapé publicado já rende a fila (ninguém some)', () => {
    montar({ casosFds: [] })
    expect(cardDe('MATHEUS')).toBeTruthy()
    expect(cardDe('GUILHERME DIDOMENICO')).toBeTruthy()
  })

  it('Adicionar caso (urgência/encaixe) também na aba Liberações (dono 16/08)', () => {
    // sem a escala de destino (hospital selecionado), o botão não aparece
    montar()
    expect(screen.queryByRole('button', { name: /Adicionar caso/ })).toBeNull()
    // com ela, o botão entra acima do "Adicionar anestesista (ajuda)"
    montar({ escalaCasoNovo: { id: 'e-unimed', hospital: 'unimed', casos: [] } })
    expect(screen.getByRole('button', { name: /Adicionar caso \(urgência\/encaixe\)/ })).toBeTruthy()
  })

  it('sem escala publicada, as ações continuam disponíveis (caso do Materno)', async () => {
    // dono 16/08: hospital sem escala ficava sem "Adicionar caso"/"ajuda".
    // Agora a escala é criada sob demanda por onGarantirEscala.
    const onGarantirEscala = vi.fn(async () => ({ id: 'nova-1', hospital: 'materno', casos: [] }))
    render(
      <LiberacoesView
        escala={null} hospital="materno" hospitalLabel="Materno" turno="matutino"
        canEdit onGarantirEscala={onGarantirEscala} onAddAjuda={() => {}}
        onToggle={() => {}} onSetOverride={() => {}}
      />,
      { wrapper: wrap }
    )
    expect(screen.getByRole('button', { name: /Adicionar caso/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Adicionar anestesista \(ajuda\)/ })).toBeTruthy()
    expect(screen.getByText(/Sem liberações/)).toBeTruthy()
    // tocar em "Adicionar caso" cria a escala antes de abrir o formulário
    fireEvent.click(screen.getByRole('button', { name: /Adicionar caso/ }))
    await waitFor(() => expect(onGarantirEscala).toHaveBeenCalled())
    // e o formulário abre já apontando para a escala recém-criada
    await waitFor(() => expect(screen.getByTestId('add-caso').dataset.escala).toBe('nova-1'))
  })

  it('modo FDS não expõe troca nem P4-coringa no painel da linha', () => {
    montar()
    fireEvent.click(screen.getByLabelText('Editar local/cirurgião de Matheus'))
    expect(screen.queryByRole('button', { name: /Trocar com um colega/i })).toBeNull()
    expect(screen.queryByLabelText('Definir em qual hospital o P4 está hoje')).toBeNull()
  })
})

describe('turno NOTURNO do FDS — turno próprio, fila da grade 19-07 (dono 15/08 21h)', () => {
  it('a fila é SÓ os 4 da grade, na ordem da esquerda p/ a direita (sáb = P2, P1, P4, P3)', () => {
    montar({ turno: 'noturno' })
    const chaves = [...document.querySelectorAll('[data-linha]')].map((el) => el.dataset.linha)
    expect(chaves).toEqual(['noite:JOAO HENRIQUE', 'noite:GUILHERME DIDOMENICO', 'noite:MATHEUS', 'noite:CRISTINA'])
    // ordem ditada pelo dono, do ÚLTIMO ao PRIMEIRO a ser liberado
    expect(chaves.map((c) => cardDe(c).dataset.selo)).toEqual(['P2', 'P1', 'P4', 'P3'])
    // badge (não só texto) nos dois primeiros, como nos demais turnos
    expect(cardDe('noite:JOAO HENRIQUE').textContent).toContain('Plantão Unimed')
    expect(cardDe('noite:GUILHERME DIDOMENICO').textContent).toContain('Plantão HRO')
    // e o papel não repete o que o badge já diz
    expect(cardDe('noite:JOAO HENRIQUE').textContent.match(/Plantão Unimed/g)).toHaveLength(1)
    // fixos no hospital nunca viram "Próximo a ser liberado"; a retaguarda 2ª
    // chamada (col4) é a primeira a sair
    expect(cardDe('noite:JOAO HENRIQUE').textContent).not.toContain('Próximo a ser liberado')
    expect(cardDe('noite:GUILHERME DIDOMENICO').textContent).not.toContain('Próximo a ser liberado')
    expect(cardDe('noite:CRISTINA').textContent).toContain('Próximo a ser liberado')
  })

  it('o card noturno herda a cirurgia da TARDE em curso (noturno não tem caso próprio)', () => {
    // Cristina não tem caso; Matheus tem o do HRO (turno matutino no fixture) —
    // o que importa é a base ser a vespertina, sem quebrar quem não tem caso
    montar({ turno: 'noturno' })
    expect(cardDe('noite:MATHEUS')).toBeTruthy()
    expect(cardDe('noite:CRISTINA').textContent).toContain('Retaguarda 2ª chamada')
  })

  it('ordem DITADA da noite acrescenta os Pn da lista numerada no fim da fila (dono 16/08)', () => {
    // sáb à noite: P2, P1, P4, P3 (grade) + P11, P8, P7 — os acrescentados
    // liberam PRIMEIRO, então ficam embaixo
    const ordemNoite = ['JOAO HENRIQUE', 'GUILHERME DIDOMENICO', 'MATHEUS', 'CRISTINA', 'GABRIEL', 'RAFAEL', 'MARILIO']
    const fdsMeta = { ...ESCALA_FDS.fdsMeta, ordemNoite }
    montar({ turno: 'noturno', escala: { ...ESCALA_FDS, fdsMeta }, fdsMeta })
    const chaves = [...document.querySelectorAll('[data-linha]')].map((el) => el.dataset.linha)
    expect(chaves.map((c) => cardDe(c).dataset.selo)).toEqual(['P2', 'P1', 'P4', 'P3', 'P11', 'P8', 'P7'])
    // o último da fila é o primeiro a ser liberado
    expect(cardDe(chaves[chaves.length - 1]).textContent).toContain('Próximo a ser liberado')
    // quem veio da lista numerada não ganha posto de plantão
    expect(cardDe(chaves[4]).textContent).not.toContain('Plantão')
    // e os dois plantões físicos seguem fora da fila
    expect(cardDe('noite:JOAO HENRIQUE').textContent).not.toContain('Próximo a ser liberado')
  })

  it('às 20h, conferir o MATUTINO mostra a fila da manhã PURA — sem os 4 da noite por cima', () => {
    // era o defeito relatado: a fusão roubava o topo e renumerava a manhã
    vi.setSystemTime(new Date('2026-08-15T20:00:00-03:00'))
    montar({ turno: 'matutino' })
    expect(document.querySelector('[data-linha^="noite:"]')).toBeNull()
    const chaves = [...document.querySelectorAll('[data-linha]')].map((el) => el.dataset.linha)
    // rodapé publicado na ordem exata + a ajuda avulsa no fim (regra da lib)
    expect(chaves).toEqual([...RODAPE_SAB_MAT.map((n) => (n === 'STAUB' ? 'uid-staub' : n)), 'THAYNA'])
    vi.setSystemTime(new Date('2026-08-15T10:00:00-03:00'))
  })
})

describe('dia útil 100% intacto', () => {
  it('sem modoFds, casosFds é ignorado e a fase noturna do FDS não liga', () => {
    vi.setSystemTime(new Date('2026-08-15T20:00:00-03:00')) // sábado à noite…
    render(
      <LiberacoesView
        escala={{
          id: 'e-hro', hospital: 'hro', data: '2026-08-15', status: 'publicada',
          ordemLiberacao: { matutino: ['STAUB'] }, ajudaExterna: {},
          liberacoes: {}, linhaOverrides: {},
          casos: [caso('h9', undefined, 'Sala 1', 'STAUB')],
        }}
        hospital="hro" hospitalLabel="HRO" turno="matutino" canEdit
        casosFds={CASOS_FDS} // presente mas SEM modoFds → ignorado
        onToggle={() => {}} onSetOverride={() => {}}
      />,
      { wrapper: wrap }
    )
    // só o STAUB da escala do HRO — nada dos casos mesclados vazou
    expect(cardDe('uid-staub')).toBeTruthy()
    expect(cardDe('MATHEUS')).toBeNull()
    expect(cardDe('GABRIELA')).toBeNull()
    // …e sem fila única publicada o sábado segue SEM transição noturna (fase dia)
    expect(document.querySelector('[data-linha^="noite:"]')).toBeNull()
    vi.setSystemTime(new Date('2026-08-15T10:00:00-03:00'))
  })
})
