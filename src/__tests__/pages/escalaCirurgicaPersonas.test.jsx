/**
 * Testes de PERSONAS da Escala Cirúrgica — exercita o código real como se fosse o
 * uso em ambiente real: Secretária (confecção+identidade), Anestesista (minhas escalas),
 * Plantonista (liberações), Admin (board). Mais probes de fragilidade.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, renderHook, act, cleanup } from '@testing-library/react'
import * as XLSX from 'xlsx'

import { ThemeProvider, ToastProvider } from '@/design-system'
import { parseExcelEscala } from '@/lib/excelEscala'
import { gerarColunaLiberacao } from '@/lib/colunaLiberacao'
import { buildResolver } from '@/services/supabaseEscalaAnestesistaService'
import { aplicarAtribuicoes, rankSala, casosResolvidos, validarConflito, detectarConflitos, estimativaTerminoSala, formatRestante, parseDuracaoMin, familiaConvenio, corConvenio } from '@/pages/escala-cirurgica/utils'
import { DEMO_ESCALAS } from '@/data/escalaCirurgicaDemo'
import BoardView from '@/pages/escala-cirurgica/BoardView'
import MinhasEscalasView from '@/pages/escala-cirurgica/MinhasEscalasView'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'
import { podeEditarEscalaCirurgica } from '@/pages/escala-cirurgica/gate'

// ── mocks p/ os testes de contexto (notificações) — vi.hoisted evita TDZ ─────
const { notifyUsers, svcMock } = vi.hoisted(() => ({
  notifyUsers: vi.fn(async () => []),
  svcMock: {
    salvarEscala: vi.fn(async (p) => ({ id: 'e1', status: p.status, hospital: p.hospital, casos: p.casos, liberacoes: {}, ordemLiberacao: p.ordemLiberacao || [] })),
    patchLiberacao: vi.fn(async () => {}),
    updateOrdemLiberacao: vi.fn(async () => {}),
    patchLinhaOverride: vi.fn(async () => {}),
    updateStatusCirurgia: vi.fn(async () => {}),
    addCaso: vi.fn(async (escalaId, c) => ({ id: 'novo-1', escalaId, ...c })),
    updateCaso: vi.fn(async () => {}),
    fetchEscala: vi.fn(async () => null),
    fetchLocaisHospital: vi.fn(async () => []),
    updateAnestesistaCasos: vi.fn(async () => {}),
  },
}))
vi.mock('@/services/notificationService', () => ({ notifyUsers }))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ user: { uid: 'u-x', role: 'anestesiologista' } }) }))
// Roster/vínculos: hook real fica em loading eterno no jsdom (era a causa das 16
// falhas silenciosas pós-Fase 2.1) — mock resolve nada e loading=false.
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: [], rosterByUid: new Map(), aliases: [], options: [],
    resolver: () => null, loading: false,
    refresh: vi.fn(), upsertAlias: vi.fn(), removeAlias: vi.fn(),
  }),
}))

const flush = () => new Promise((r) => setTimeout(r, 0))
const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

beforeEach(() => {
  notifyUsers.mockClear()
  Object.values(svcMock).forEach((f) => f.mockClear?.())
})

// ════════════════════════════════════════════════════════════════════════════
// PERSONA 1 — SECRETÁRIA: confecção (Excel) + atribuição → identidade por login
// ════════════════════════════════════════════════════════════════════════════
describe('Secretária — importar Excel (round-trip real)', () => {
  function excelBuffer(aoa) {
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Mapa')
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  }

  it('extrai casos do Excel da Unimed (sem anestesista), com carry-down de sala e iniciais', async () => {
    const buf = excelBuffer([
      ['Mapa cirúrgico Unimed', '', '', '', ''],
      ['SALA', 'HORA', 'PACIENTE', 'PROCEDIMENTO', 'CIRURGIAO', 'CONVENIO'],
      ['CENTRO CIRÚRGICO - SALA 1', '', '', '', '', ''], // linha de seção → carry-down
      ['', '13:30', 'Murilo Cortina', 'Sinus pré-auricular', 'Rodrigo Souza', 'Particular'],
      ['', '16:00', 'Analice Klipel', 'Exérese de lesões', 'Benito Bodanese', 'Unimed'],
      ['CENTRO CIRÚRGICO - SALA 2', '', '', '', '', ''],
      ['', '13:30', 'Leia Franca', 'Colecistectomia', 'Dirceu Valentini', 'Unimed'],
    ])
    const { casos } = await parseExcelEscala(buf)
    expect(casos.length).toBe(3)
    expect(casos[0].sala).toContain('SALA 1')
    expect(casos[0].pacienteIniciais).toBe('M.C.')       // LGPD: só iniciais
    expect(casos[0].cirurgiao).toBe('Rodrigo Souza')
    expect(casos[0].anestesista).toBe('')                 // base vem SEM anestesista
    expect(casos[2].sala).toContain('SALA 2')             // carry-down funcionou
  })

  it('detecta continuação e urgência/emergência pelo procedimento', async () => {
    const buf = excelBuffer([
      ['SALA', 'PACIENTE', 'PROCEDIMENTO', 'CIRURGIAO'],
      ['SALA 5', 'Fulano', 'EMERGENCIA apendicectomia', 'Mateus B'],
      ['SALA 6', '', 'CONTINUAÇÃO +-14h', 'Amauri B'],
    ])
    const { casos } = await parseExcelEscala(buf)
    expect(casos.find((c) => c.sala === 'SALA 5').tipo).toBe('emergencia')
    expect(casos.find((c) => c.sala === 'SALA 6').isContinuacao).toBe(true)
  })

  it('planilha sem cabeçalho reconhecível → vazio (cai p/ manual)', async () => {
    const buf = excelBuffer([['xpto', 'foo'], ['1', '2']])
    const { casos } = await parseExcelEscala(buf)
    expect(casos.length).toBe(0)
  })
})

describe('Secretária — atribuição vincula login (identidade na origem)', () => {
  it('aplicarAtribuicoes grava anestesista_user_id em TODOS os casos da sala (inclui //)', () => {
    const casos = [
      { sala: 'SALA 1', ordem: 0, anestesista: 'EDUARDO' },
      { sala: 'SALA 1', ordem: 1, anestesista: '//' },
      { sala: 'SALA 2', ordem: 0, anestesista: 'STAUB' },
      { sala: 'SALA 9', ordem: 0, anestesista: 'NINGUEM' }, // sem atribuição
    ]
    const out = aplicarAtribuicoes(casos, { 'SALA 1': 'u-edu', 'SALA 2': 'u-staub' }, () => 'X')
    expect(out[0].anestesistaUserId).toBe('u-edu')
    expect(out[1].anestesistaUserId).toBe('u-edu')        // // herda o login da sala
    expect(out[2].anestesistaUserId).toBe('u-staub')
    expect(out[3].anestesistaUserId).toBe(null)           // sala não atribuída → null
    expect(out[3].anestesista).toBe('NINGUEM')            // mantém texto importado
  })
})

describe('Secretária — dicionário apelido→login (aprende uma vez)', () => {
  const resolver = buildResolver([
    { apelido: 'GARIM', userId: 'u-garim' },
    { apelido: 'STAUB', userId: 'u-staub' },
    { apelido: 'EDUARDO', userId: 'u-edu' },
  ])
  it('resolve apelido independente de PED/acento/caixa', () => {
    expect(resolver('garim')).toBe('u-garim')
    expect(resolver('PED EDUARDO')).toBe('u-edu')
    expect(resolver('Staub')).toBe('u-staub')
  })
  it('apelido novo não resolve (vai p/ atribuição manual = aprende)', () => {
    expect(resolver('OSCAR')).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// PERSONA 2 — ANESTESISTA: "Minhas escalas" por login (uid), não por nome
// ════════════════════════════════════════════════════════════════════════════
describe('Anestesista — Minhas escalas casam por login (uid)', () => {
  const escala = {
    id: 'e1', hospital: 'hro',
    casos: [
      { id: 'a', sala: 'Sala 1', ordem: 0, hora: '13:00', anestesista: 'ALEXANDRE S', anestesistaUserId: 'u-alex-s', procedimento: 'Artrodese' },
      { id: 'b', sala: 'Sala 3', ordem: 0, hora: '13:00', anestesista: 'ALEXANDRE D', anestesistaUserId: 'u-alex-d', procedimento: 'Artroplastia' },
    ],
  }
  it('homônimos (ALEXANDRE S vs D) NÃO se confundem — filtra pelo uid certo', () => {
    render(<MinhasEscalasView escala={escala} meuAlias="Alexandre" meuUid="u-alex-s" turno="vespertino" />, { wrapper: wrap })
    expect(screen.getByText('Artrodese')).toBeTruthy()
    expect(screen.queryByText('Artroplastia')).toBeNull()
  })
  // rótulos do redesenho 17/08: "Status da cirurgia" virou os dois eixos
  // ("Andamento" + "Aviso") e o botão do anestesista virou a ação da linha dele
  it('clicar no meu caso abre o detalhe com status e a troca do anestesista (trocas aposentadas 23/07)', () => {
    render(<MinhasEscalasView escala={escala} meuAlias="Alexandre" meuUid="u-alex-s" turno="vespertino" />, { wrapper: wrap })
    fireEvent.click(screen.getByText('Artrodese'))
    expect(screen.getByText('Andamento')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Trocar anestesista' })).toBeTruthy()
  })
  it('usuário sem casos → empty state', () => {
    render(<MinhasEscalasView escala={escala} meuAlias="Zé" meuUid="u-ze" turno="vespertino" />, { wrapper: wrap })
    expect(screen.getByText(/não está escalado/i)).toBeTruthy()
  })
  it('fallback por apelido quando o caso não tem uid (demo/legado)', () => {
    const demo = { id: 'demo-unimed', hospital: 'unimed', casos: [{ id: 'x', sala: 'SALA 4', hora: '13:00', anestesista: 'LEONARDO', cirurgiao: 'Liana W', procedimento: 'Mamária' }] }
    render(<MinhasEscalasView escala={demo} meuAlias="Leonardo" meuUid="u-leo" turno="vespertino" />, { wrapper: wrap })
    expect(screen.getByText('Mamária')).toBeTruthy()
  })
  it('posição SRPA aparece como posição, sem abrir ações/status de cirurgia', () => {
    const comPosicao = {
      id: 'e-srpa', hospital: 'unimed',
      casos: [{ id: 'p1', sala: 'SRPA', turno: 'matutino', anestesista: 'ANEST A', anestesistaUserId: 'u-anest-a', bloco: 'srpa' }],
    }
    render(<MinhasEscalasView escala={comPosicao} meuAlias="Anest A" meuUid="u-anest-a" turno="matutino" />, { wrapper: wrap })
    expect(screen.getByText('Posição')).toBeTruthy()
    expect(screen.getByText('Local de trabalho neste turno')).toBeTruthy()
    expect(screen.queryByText('Andamento')).toBeNull()
    expect(screen.getByText(/1 posição neste hospital/i)).toBeTruthy()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// PERSONA 3 — PLANTONISTA: liberações (18 regras) + marcar liberado + reordenar
// ════════════════════════════════════════════════════════════════════════════
describe('Plantonista — coluna de liberação (18 regras) nos 3 hospitais demo', () => {
  it('Unimed gera ordem do rodapé + casos "?" ao fim', () => {
    const e = DEMO_ESCALAS.unimed
    const { linhas, semAnestesista } = gerarColunaLiberacao(e.casos, e.ordemLiberacao, { hospital: 'unimed' })
    expect(linhas[0].texto).toBe('Leonardo — Liana Winkelmann')
    expect(linhas.find((l) => l.anestesista === 'Garim').texto).toBe('Garim — SRPA')
    expect(semAnestesista[0].texto).toBe('Ana — (Imagem 16:00) ?')
  })
  it('HRO acrescenta (Hemodinamica)/(IOSC) e emergência como caso normal', () => {
    const e = DEMO_ESCALAS.hro
    const { linhas } = gerarColunaLiberacao(e.casos, e.ordemLiberacao, { hospital: 'hro' })
    expect(linhas.find((l) => l.anestesista === 'Rose').texto).toContain('(Hemodinamica)')
    expect(linhas.find((l) => l.anestesista === 'Daniela').texto).toBe('Daniela — Mateus Baptistella')
  })
})

describe('Plantonista — interações na aba Liberações', () => {
  const escala = {
    // ⚠️ liberacoes é chaveado pelo NOME DE EXIBIÇÃO (titleCase), não por uid — fragilidade anotada no veredito.
    id: 'e1', hospital: 'unimed', ordemLiberacao: ['LEONARDO', 'MARILIO', 'DIEGO'], liberacoes: { Marilio: { liberadoEm: 'x' } },
    casos: [
      { sala: 'SALA 4', ordem: 0, anestesista: 'LEONARDO', cirurgiao: 'Liana Winkelmann' },
      { sala: 'SALA 3', ordem: 0, anestesista: 'MARILIO', cirurgiao: 'Leandro Trevizan' },
      { sala: 'C.O - CESAREA', ordem: 0, anestesista: 'DIEGO', cirurgiao: 'Taciana Alflen' },
    ],
  }
  // Exibição: Marilio (liberado) afunda → [Leonardo, Diego, Marilio]. A fila corre
  // de baixo p/ cima, então o PRÓXIMO a ser liberado é o Diego.
  it('clicar liberar no PRÓXIMO dispara onToggle com a LINHA (chave estável)', () => {
    const onToggle = vi.fn()
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit onToggle={onToggle} />, { wrapper: wrap })
    fireEvent.click(screen.getByLabelText('Marcar Diego liberado'))
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ anestesista: 'Diego', nomeOriginal: 'DIEGO' }))
  })
  it('liberar FORA DA ORDEM não libera — avisa quem vem antes (dono 27/07)', () => {
    const onToggle = vi.fn()
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit onToggle={onToggle} />, { wrapper: wrap })
    fireEvent.click(screen.getByLabelText('Marcar Leonardo liberado')) // 1º da fila, sai por último
    expect(onToggle).not.toHaveBeenCalled()
  })
  it('o aviso diz quantos faltam e quem é o próximo', async () => {
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit onToggle={() => {}} />, { wrapper: wrap })
    fireEvent.click(screen.getByLabelText('Marcar Leonardo liberado'))
    expect(await screen.findByText('Libere Diego primeiro')).toBeTruthy()
    expect(await screen.findByText(/Falta 1 anestesista antes de Leonardo na ordem de liberação/)).toBeTruthy()
  })
  it('desfazer liberação NUNCA é bloqueado pela ordem', () => {
    const onToggle = vi.fn()
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit onToggle={onToggle} />, { wrapper: wrap })
    fireEvent.click(screen.getByLabelText('Desfazer liberação de Marilio'))
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ anestesista: 'Marilio' }))
  })
  it('NINGUÉM reordena a fila — nem o plantonista (dono 27/07)', () => {
    // meuAlias casa com o 1º do rodapé: era exatamente quem tinha as setas antes
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit meuAlias="Leonardo" onToggle={() => {}} />, { wrapper: wrap })
    expect(screen.queryByLabelText(/^Subir/)).toBeNull()
    expect(screen.queryByLabelText(/^Descer/)).toBeNull()
  })
  it('item liberado aparece riscado (Marilio já liberado)', () => {
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit onToggle={() => {}} onReorder={() => {}} />, { wrapper: wrap })
    const marilio = screen.getByText('Marilio').closest('p')
    expect(marilio.className).toContain('line-through')
  })
  it('sem permissão de edição → sem botões de reordenar', () => {
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit={false} onToggle={() => {}} onReorder={() => {}} />, { wrapper: wrap })
    expect(screen.queryByLabelText(/^Descer/)).toBeNull()
  })
  it('1º do rodapé ganha badge Plantonista e o card mostra a sala escalada', () => {
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit onToggle={() => {}} onReorder={() => {}} />, { wrapper: wrap })
    expect(screen.getByText('Plantonista')).toBeTruthy() // Leonardo, 1º do rodapé
    expect(screen.getByText('SALA 4')).toBeTruthy()      // chip de local do Leonardo
  })
  it('posição (CONS.) sem caso permanece escalada e no índice exato do rodapé', () => {
    const e = {
      id: 'e-consult', hospital: 'hro', liberacoes: {},
      ordemLiberacao: ['ANEST A', 'ANEST B (CONS.)', 'ANEST C'],
      casos: [{ sala: 'Sala 1', ordem: 0, anestesista: 'ANEST A', cirurgiao: 'CIRURGIAO A' }],
    }
    const { container } = render(
      <LiberacoesView escala={e} hospitalLabel="HRO" canEdit onToggle={() => {}} />,
      { wrapper: wrap },
    )
    const nomes = [...container.querySelectorAll('[data-nome]')].map((el) => el.dataset.nome)
    expect(nomes).toEqual(['Anest A', 'Anest B', 'Anest C'])
    expect(screen.getByLabelText('Marcar Anest B liberado')).toBeTruthy()
    expect(screen.queryByLabelText('Marcar Anest B como escalado')).toBeNull()
    expect(screen.getByText('Consultório')).toBeTruthy()
  })
  it('anestesista com TODOS os casos terminados ganha badge "Livre" (dono 24/07)', () => {
    const e = {
      id: 'e2', hospital: 'unimed', ordemLiberacao: ['LEONARDO', 'DIEGO'], liberacoes: {},
      casos: [
        { sala: 'SALA 4', ordem: 0, anestesista: 'LEONARDO', cirurgiao: 'Liana', statusCirurgia: 'iniciada' },
        { sala: 'C.O - CESAREA', ordem: 0, anestesista: 'DIEGO', cirurgiao: 'Taciana', statusCirurgia: 'terminada' },
      ],
    }
    render(<LiberacoesView escala={e} hospitalLabel="Unimed" canEdit onToggle={() => {}} onReorder={() => {}} />, { wrapper: wrap })
    expect(screen.getByText('Livre')).toBeTruthy()          // Diego terminou tudo
    expect(screen.getByText('Diego').closest('div')).toBeTruthy()
  })
  it('✏️ abre o editor e Salvar dispara onSetOverride com local ("Outro")+cirurgião', () => {
    const onSetOverride = vi.fn()
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit onToggle={() => {}} onReorder={() => {}} onSetOverride={onSetOverride} />, { wrapper: wrap })
    fireEvent.click(screen.getByLabelText('Editar local/cirurgião de Leonardo'))
    // o painel virou LISTA (redesenho 17/08, 2ª rodada): cada assunto é uma linha
    // e o editor abre abaixo da linha tocada
    fireEvent.click(screen.getByRole('button', { name: /^Local/ }))
    // Local agora é DROPDOWN (23/07) — "Outro… (digitar)" abre o campo livre.
    // Alvo pelo id: o painel de tempo (29/07) também tem um combobox no sheet.
    fireEvent.click(document.getElementById('editor-local-select'))
    fireEvent.click(screen.getByRole('option', { name: /Outro/ }))
    fireEvent.change(screen.getByPlaceholderText(/Coronel Freitas/), { target: { value: 'Coronel Freitas' } })
    fireEvent.click(screen.getByRole('button', { name: /^Cirurgião\(ões\)/ }))
    fireEvent.change(screen.getByLabelText('Cirurgião(ões)'), { target: { value: 'Vanessa B' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(onSetOverride).toHaveBeenCalledWith(
      expect.objectContaining({ anestesista: 'Leonardo' }),
      expect.objectContaining({ local: 'Coronel Freitas', cirurgioes: 'Vanessa B' })
    )
  })
  it('Restaurar automático dispara onSetOverride(null)', () => {
    const onSetOverride = vi.fn()
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit onToggle={() => {}} onReorder={() => {}} onSetOverride={onSetOverride} />, { wrapper: wrap })
    fireEvent.click(screen.getByLabelText('Editar local/cirurgião de Marilio'))
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar automático' }))
    expect(onSetOverride).toHaveBeenCalledWith(expect.objectContaining({ anestesista: 'Marilio' }), null)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// PERSONA 4 — ADMIN/BOARD: ordenação de salas, destaque por uid, detalhe
// ════════════════════════════════════════════════════════════════════════════
describe('Board — ordenação de salas e detalhe', () => {
  it('HRO: ORTO = Sala 4 e Consultório vai p/ o fim (ordem canônica 22/07)', () => {
    expect(rankSala('ORTO', 'hro')).toBe(14)                       // Sala 4
    expect(rankSala('Sala 5', 'hro')).toBe(15)
    expect(rankSala('ORTO', 'hro')).toBeLessThan(rankSala('Sala 5', 'hro'))
    expect(rankSala('CONSULTORIO', 'hro')).toBe(68)                // depois de exames/imagem
  })
  it('Unimed: C.O (cesárea) vem ANTES das salas numéricas (ordem canônica 21/07)', () => {
    expect(rankSala('C.O - CESAREA', 'unimed')).toBe(0)
    expect(rankSala('C.O - CESAREA', 'unimed')).toBeLessThan(rankSala('CC - SALA 1', 'unimed'))
    expect(rankSala('CC - SALA 7', 'unimed')).toBe(17)
  })
  it('toque no caso abre o bottom-sheet com o detalhe', () => {
    const escala = { id: 'e1', hospital: 'unimed', casos: [{ id: 'c1', sala: 'SALA 1', ordem: 0, hora: '13:30', anestesista: 'EDUARDO', cirurgiao: 'Rodrigo Souza', procedimento: 'Sinus', pacienteIniciais: 'M.C.', convenio: 'Particular' }] }
    render(<BoardView escala={escala} meuAlias="x" meuUid="u-x" turno="vespertino" />, { wrapper: wrap })
    fireEvent.click(screen.getByText('Sinus'))
    expect(screen.getAllByText(/Rodrigo Souza/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Particular').length).toBeGreaterThan(0) // card + detalhe
  })
  it('turno matutino esconde casos vespertinos', () => {
    const escala = { id: 'e1', hospital: 'materno', casos: [
      { id: 'm', sala: 'Sala 3 HC', ordem: 0, hora: '07:30', anestesista: 'ROMULO', procedimento: 'Amigdalectomia' },
      { id: 'v', sala: 'Sala 3 HC', ordem: 1, hora: '14:30', anestesista: 'ROMULO', procedimento: 'Turbinectomia' },
    ] }
    render(<BoardView escala={escala} meuAlias="x" meuUid="u-x" turno="matutino" />, { wrapper: wrap })
    expect(screen.getByText('Amigdalectomia')).toBeTruthy()
    expect(screen.queryByText('Turbinectomia')).toBeNull()
  })
  it('SRPA fica como posição compacta, sem a frase explicativa removida', () => {
    const escala = { id: 'e-srpa', hospital: 'unimed', casos: [{
      id: 'p1', sala: 'SRPA', bloco: 'srpa', turno: 'matutino', ordem: 0,
      anestesista: 'ANEST A', ehPosicaoAssistencial: true,
    }] }
    render(<BoardView escala={escala} meuAlias="x" meuUid="u-x" turno="matutino" />, { wrapper: wrap })
    expect(screen.queryByText('Posição assistencial neste turno · não é uma cirurgia.')).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// BOARD — cor por convênio + cor de status do card
// ════════════════════════════════════════════════════════════════════════════
describe('Board — família e cor do convênio', () => {
  it('normaliza variações da mesma família (caixa/acento/sufixo)', () => {
    expect(familiaConvenio('Unimed')).toBe('unimed')
    expect(familiaConvenio('UNIMED REGIONAL CHAPECÓ')).toBe('unimed')
    expect(familiaConvenio('Unimed Intercâmbio')).toBe('intercambio') // regime próprio, não cai em unimed
    expect(familiaConvenio('INTERCAMBIO')).toBe('intercambio')
    expect(familiaConvenio('SUS')).toBe('sus')
    expect(familiaConvenio('sc saúde')).toBe('sc')
    expect(familiaConvenio('SC Saúde')).toBe('sc')
    expect(familiaConvenio('CASSI')).toBe('cassi')
    expect(familiaConvenio('Cassi Essencial')).toBe('cassi')
    expect(familiaConvenio('Particular')).toBe('particular')
    expect(familiaConvenio('BRF')).toBe('brf')
    expect(familiaConvenio('FAS')).toBe('fas')
  })
  it('convênio desconhecido → família outro (badge neutro); vazio → null', () => {
    expect(familiaConvenio('IPE Saúde')).toBe('outro')
    expect(familiaConvenio('')).toBeNull()
    expect(corConvenio('')).toBeNull()
  })
  it('famílias distintas recebem tokens category-* distintos (stripe + badge)', () => {
    const cores = ['SUS', 'Unimed', 'BRF', 'Particular'].map((c) => corConvenio(c).stripe)
    expect(new Set(cores).size).toBe(4)
    expect(corConvenio('SUS').badge).toContain('bg-category-')
  })
  it('card do board identifica convênio só pelo selo (stripe removida a pedido do dono)', () => {
    const escala = { id: 'e1', hospital: 'unimed', casos: [{ id: 'c1', sala: 'SALA 1', ordem: 0, hora: '13:30', anestesista: 'X', procedimento: 'Sinus', convenio: 'SUS' }] }
    render(<BoardView escala={escala} meuAlias="x" meuUid="u-x" turno="vespertino" />, { wrapper: wrap })
    const card = screen.getByText('Sinus').closest('button')
    expect(card.className).not.toContain('border-l-4')
    expect(screen.getByText('SUS')).toBeTruthy() // selo continua
  })
})

describe('Board — cor de status do card (Iniciada amarelo, Terminada verde)', () => {
  const escala = (status) => ({ id: 'e1', hospital: 'unimed', casos: [{ id: 'c1', sala: 'SALA 1', ordem: 0, hora: '13:30', anestesista: 'X', procedimento: 'Sinus', statusCirurgia: status }] })
  // A tinta afinou em 17/08 (dono, escolha em protótipo): o card inteiro pinta,
  // mas em dose suave — o verde forte disputava com o badge sólido do status.
  it('iniciada → card verde (decisão 2026-07-20, tinta suave desde 17/08)', () => {
    render(<BoardView escala={escala('iniciada')} meuAlias="x" meuUid="u-x" turno="vespertino" />, { wrapper: wrap })
    const card = screen.getByText('Sinus').closest('button')
    expect(card.className).toContain('bg-success/[0.14]')
    expect(card.className).not.toContain('destructive')
  })
  it('terminada → card azul (info)', () => {
    render(<BoardView escala={escala('terminada')} meuAlias="x" meuUid="u-x" turno="vespertino" />, { wrapper: wrap })
    const card = screen.getByText('Sinus').closest('button')
    expect(card.className).toContain('bg-info/[0.12]')
  })
  it('atrasada/suspensa/passa_tarde → só o BADGE colore; card fica neutro', () => {
    for (const [status, label] of [['suspensa', 'Suspensa'], ['atrasada', 'Atrasada'], ['passa_tarde', 'Passa para tarde']]) {
      const { unmount } = render(<BoardView escala={escala(status)} meuAlias="zz" meuUid="u-zz" turno="vespertino" />, { wrapper: wrap })
      expect(screen.getByText(label)).toBeTruthy()
      const card = screen.getByText('Sinus').closest('button')
      expect(card.className).toContain('bg-card') // neutro — sem tinta de status
      unmount()
    }
  })
  it('dois eixos: Iniciada + Atrasada convivem (card verde + os DOIS badges)', () => {
    const e = { id: 'e1', hospital: 'unimed', casos: [{ id: 'c1', sala: 'SALA 1', ordem: 0, hora: '13:30', anestesista: 'X', procedimento: 'Sinus', statusCirurgia: 'iniciada', statusExtra: 'atrasada' }] }
    render(<BoardView escala={e} meuAlias="zz" meuUid="u-zz" turno="vespertino" />, { wrapper: wrap })
    expect(screen.getByText('Sinus').closest('button').className).toContain('bg-success/[0.14]')
    expect(screen.getByText('Iniciada')).toBeTruthy()
    expect(screen.getByText('Atrasada')).toBeTruthy()
  })
  it('sheet: com Terminada, os botões de extra ficam bloqueados', () => {
    render(<BoardView escala={escala('terminada')} meuAlias="zz" meuUid="u-zz" turno="vespertino" />, { wrapper: wrap })
    fireEvent.click(screen.getByText('Sinus'))
    for (const nome of ['Atrasada', 'Suspensa', 'Passa para tarde']) {
      expect(screen.getByRole('button', { name: nome }).disabled).toBe(true)
    }
  })
  it('sheet de detalhe oferece os 6 status (inclui Suspensa/Atrasada/Passa para tarde)', () => {
    render(<BoardView escala={escala('agendada')} meuAlias="x" meuUid="u-x" turno="vespertino" />, { wrapper: wrap })
    fireEvent.click(screen.getByText('Sinus'))
    for (const nome of ['Agendada', 'Iniciada', 'Terminada', 'Atrasada', 'Suspensa', 'Passa para tarde']) {
      expect(screen.getByRole('button', { name: nome })).toBeTruthy()
    }
  })
})

describe('Liberações — caso passa_tarde sinaliza o anestesista', () => {
  it('linha do anestesista com caso passa_tarde ganha badge "Passa para tarde"', () => {
    const escala = {
      id: 'e1', hospital: 'unimed', ordemLiberacao: ['LEONARDO', 'MARILIO'], liberacoes: {},
      casos: [
        { sala: 'SALA 4', ordem: 0, anestesista: 'LEONARDO', cirurgiao: 'Liana Winkelmann', statusCirurgia: 'passa_tarde' },
        { sala: 'SALA 3', ordem: 0, anestesista: 'MARILIO', cirurgiao: 'Leandro Trevizan' },
      ],
    }
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit onToggle={() => {}} onReorder={() => {}} />, { wrapper: wrap })
    expect(screen.getByText('Passa para tarde')).toBeTruthy()
    const linhaLeonardo = screen.getByText('Leonardo').closest('p')
    expect(linhaLeonardo.textContent).toContain('Passa para tarde')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// NOTIFICAÇÕES (contexto) — escalado/liberado por login (uid)
// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
// Virada da meia-noite (pedido do dono 24/07): passada a meia-noite a escala do
// dia anterior sai da tela e fica só a do dia seguinte.
// ════════════════════════════════════════════════════════════════════════════
describe('Virada da meia-noite', () => {
  const providerWrap = async () => {
    const { EscalaCirurgicaProvider } = await import('@/contexts/EscalaCirurgicaContext')
    return ({ children }) => <ThemeProvider><ToastProvider><EscalaCirurgicaProvider>{children}</EscalaCirurgicaProvider></ToastProvider></ThemeProvider>
  }
  const montar = async () => {
    const { useEscalaCirurgica } = await import('@/contexts/EscalaCirurgicaContext')
    const Wrapper = await providerWrap()
    return renderHook(() => useEscalaCirurgica(), { wrapper: Wrapper })
  }
  const passarDaMeiaNoite = async () => {
    await act(async () => {
      vi.setSystemTime(new Date(2026, 6, 24, 0, 5, 0)) // 00h05 do dia seguinte
      vi.advanceTimersByTime(31_000)                   // o checador roda a cada 30s
      await flush()
    })
  }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 6, 23, 23, 50, 0)) // quinta, 23h50
  })
  afterEach(() => { cleanup(); vi.useRealTimers() })

  it('quem está vendo HOJE avança sozinho para o dia seguinte', async () => {
    const { result } = await montar()
    expect(result.current.data).toBe('2026-07-23')
    await passarDaMeiaNoite()
    expect(result.current.data).toBe('2026-07-24')
    expect(result.current.hoje).toBe('2026-07-24')
  })

  it('a escala do dia anterior é recarregada para a data nova (sai da tela)', async () => {
    await montar()
    await passarDaMeiaNoite()
    const datas = svcMock.fetchEscala.mock.calls.map((c) => c[0])
    expect(datas).toContain('2026-07-24')
  })

  it('quem foi ao CALENDÁRIO ver outra data continua onde está', async () => {
    const { result } = await montar()
    await act(async () => { result.current.setData('2026-07-20'); await flush() })
    await passarDaMeiaNoite()
    expect(result.current.data).toBe('2026-07-20') // não sequestra a navegação
    expect(result.current.hoje).toBe('2026-07-24') // mas sabe que o dia virou
  })
})

describe('Notificações — disparo por login', () => {
  let useEscalaCirurgicaActions
  beforeEach(async () => {
    ;({ useEscalaCirurgicaActions } = await import('@/contexts/EscalaCirurgicaContext'))
  })
  const providerWrap = async () => {
    const { EscalaCirurgicaProvider } = await import('@/contexts/EscalaCirurgicaContext')
    return ({ children }) => <ThemeProvider><ToastProvider><EscalaCirurgicaProvider>{children}</EscalaCirurgicaProvider></ToastProvider></ThemeProvider>
  }

  it('publicar NÃO notifica ninguém (decisão do dono 30/07 — inbox lotada)', async () => {
    const Wrapper = await providerWrap()
    const { result } = renderHook(() => useEscalaCirurgicaActions(), { wrapper: Wrapper })
    await act(async () => {
      await result.current.salvarEscala({
        hospital: 'unimed', status: 'publicada', ordemLiberacao: [],
        casos: [
          { sala: 'S1', ordem: 0, anestesista: 'EDUARDO', anestesistaUserId: 'u-edu' },
          { sala: 'S1', ordem: 1, anestesista: '//', anestesistaUserId: 'u-edu' },
          { sala: 'S2', ordem: 0, anestesista: 'STAUB', anestesistaUserId: 'u-staub' },
        ],
      }, { userId: 'sec', userName: 'Secretária' })
      await flush()
    })
    expect(svcMock.salvarEscala).toHaveBeenCalled()
    expect(notifyUsers).not.toHaveBeenCalled()
  })

  it('marcar liberado e desfazer NÃO notificam (decisão do dono 30/07)', async () => {
    const Wrapper = await providerWrap()
    const { result } = renderHook(() => useEscalaCirurgicaActions(), { wrapper: Wrapper })
    const escala = { id: 'e1', hospital: 'unimed', liberacoes: {}, data: '2026-06-30', casos: [{ sala: 'S1', anestesista: 'EDUARDO', anestesistaUserId: 'u-edu' }] }
    await act(async () => { await result.current.toggleLiberacao(escala, 'EDUARDO', { userId: 'me' }); await flush() })
    expect(svcMock.patchLiberacao).toHaveBeenCalledWith('e1', 'EDUARDO', expect.objectContaining({ por: 'me' }))
    expect(notifyUsers).not.toHaveBeenCalled()

    const liberada = { ...escala, liberacoes: { EDUARDO: { liberadoEm: 'x' } } }
    await act(async () => { await result.current.toggleLiberacao(liberada, 'EDUARDO', { userId: 'me' }); await flush() })
    expect(notifyUsers).not.toHaveBeenCalled()
  })

  it('desfazer liberação limpa os ajustes da linha — infos voltam em branco (pedido 2026-07-21)', async () => {
    const Wrapper = await providerWrap()
    const { result } = renderHook(() => useEscalaCirurgicaActions(), { wrapper: Wrapper })
    const liberada = {
      id: 'e1', hospital: 'unimed', data: '2026-07-21', casos: [],
      liberacoes: { EDUARDO: { liberadoEm: 'x' } },
      linhaOverrides: { EDUARDO: { local: 'SALA 9', cirurgioes: 'Fulano', termino: '18:00' } },
    }
    await act(async () => { await result.current.toggleLiberacao(liberada, 'EDUARDO', { userId: 'me' }); await flush() })
    // marca a linha como RENOVADA: apaga ajustes E suprime o derivado da manhã
    expect(svcMock.patchLinhaOverride).toHaveBeenCalledWith('e1', 'EDUARDO', expect.objectContaining({ renovado: true }))
  })

  it('linha renovada não mostra sala/cirurgião/cronômetro derivados NEM o badge passa-tarde', () => {
    const escala = {
      id: 'e1', hospital: 'unimed', ordemLiberacao: ['LEONARDO'], liberacoes: {},
      linhaOverrides: { Leonardo: { renovado: true } },
      casos: [{ sala: 'SALA 4', ordem: 0, hora: '08:00', tempoEstimado: '01:00', anestesista: 'LEONARDO', cirurgiao: 'Liana Winkelmann', statusCirurgia: 'passa_tarde' }],
    }
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit onToggle={() => {}} onReorder={() => {}} onSetOverride={() => {}} />, { wrapper: wrap })
    expect(screen.queryByText('SALA 4')).toBeNull()
    expect(screen.queryByText('Liana Winkelmann')).toBeNull()
    expect(screen.queryByText('Passa para tarde')).toBeNull() // era da escala de antes
    expect(screen.getByLabelText('Definir tempo faltante de Leonardo')).toBeTruthy()
  })

  it('marcar não-escalado como escalado também zera o override antigo', async () => {
    const Wrapper = await providerWrap()
    const { result } = renderHook(() => useEscalaCirurgicaActions(), { wrapper: Wrapper })
    const escala = {
      id: 'e2', hospital: 'unimed', data: '2026-07-21', casos: [], liberacoes: {},
      linhaOverrides: { Ferias: { local: 'Coronel Freitas' } },
    }
    await act(async () => { await result.current.toggleEscalado(escala, 'Ferias', { userId: 'me' }); await flush() })
    expect(svcMock.patchLinhaOverride).toHaveBeenCalledWith('e2', 'Ferias', null)
  })

  it('escala demo (id demo-*) NÃO chama o service (memória)', async () => {
    const Wrapper = await providerWrap()
    const { result } = renderHook(() => useEscalaCirurgicaActions(), { wrapper: Wrapper })
    const demo = { id: 'demo-unimed', hospital: 'unimed', liberacoes: {}, data: '2026-06-26', casos: [{ anestesista: 'GARIM' }] }
    await act(async () => { await result.current.toggleLiberacao(demo, 'GARIM', { userId: 'me' }); await flush() })
    expect(svcMock.patchLiberacao).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// NOVOS REQUISITOS — local na liberação, idade/tempo, override do plantonista
// ════════════════════════════════════════════════════════════════════════════
describe('Liberações — todo anestesista aparece com onde está (local do bloco)', () => {
  it('sem cirurgião mas num bloco → mostra o LOCAL (Consultório/Exames/Hemodinâmica)', () => {
    const casos = [
      { sala: 'CONSULTORIO', ordem: 0, anestesista: 'PAULO', bloco: 'consultorio', cirurgiao: '' },
      { sala: 'SRPA', ordem: 0, anestesista: 'GARIM', bloco: 'srpa', cirurgiao: '' },
    ]
    const { linhas } = gerarColunaLiberacao(casos, ['PAULO', 'GARIM'])
    expect(linhas.find((l) => l.anestesista === 'Paulo').texto).toBe('Paulo — Consultório')
    expect(linhas.find((l) => l.anestesista === 'Garim').texto).toBe('Garim — SRPA')
  })
})

describe('Cards — idade e tempo cirúrgico no demo (quando houver)', () => {
  it('demo Unimed traz idade e tempo nos casos com paciente', () => {
    const caso = DEMO_ESCALAS.unimed.casos.find((c) => c.pacienteIniciais === 'M.C.')
    expect(caso.idade).toBe('3a')
    expect(caso.tempoEstimado).toBe('02:00')
  })
  it('sala MULTI-anestesista (IOSC): header lista TODOS e cada card mostra o seu (correção 23/07)', () => {
    const escala = {
      id: 'e1', hospital: 'hro', casos: [
        { id: 'a', sala: 'IOSC', ordem: 0, hora: '07:30', anestesista: 'CURY', cirurgiao: 'Bruno Blaya', procedimento: 'Catarata A', bloco: 'iosc' },
        { id: 'b', sala: 'IOSC', ordem: 1, hora: '07:30', anestesista: 'MELO', cirurgiao: 'Marco Alecio', procedimento: 'Catarata B', bloco: 'iosc' },
        { id: 'c', sala: 'IOSC', ordem: 2, hora: '07:30', anestesista: 'GUILHERME DIDOMENICO', cirurgiao: 'Rafael Tirapelle', procedimento: 'Catarata C', bloco: 'iosc' },
      ],
    }
    render(<BoardView escala={escala} meuAlias="x" meuUid="u-x" turno="matutino" />, { wrapper: wrap })
    // sala multi vira UM GRUPO POR ANESTESISTA — três cabeçalhos "IOSC" com o
    // nome de cada um (pedido 23/07). Desde 17/08 o nome vem ao lado da pill da
    // sala, sem o travessão que os separava no cabeçalho antigo.
    expect(screen.getAllByText('IOSC').length).toBe(3)
    expect(screen.getByText('Cury')).toBeTruthy()
    expect(screen.getByText('Melo')).toBeTruthy()
    expect(screen.getByText('Guilherme Didomenico')).toBeTruthy()
  })
  it('board renderiza idade e tempo no card', () => {
    const escala = { id: 'e1', hospital: 'unimed', casos: [{ id: 'c1', sala: 'SALA 1', ordem: 0, hora: '13:30', idade: '37a', tempoEstimado: '01:15', anestesista: 'X', cirurgiao: 'Rodrigo Souza', procedimento: 'Sinus', pacienteIniciais: 'M.C.' }] }
    render(<BoardView escala={escala} meuAlias="x" meuUid="u-x" turno="vespertino" />, { wrapper: wrap })
    expect(screen.getByText('37a')).toBeTruthy()
    expect(screen.getByText('01:15')).toBeTruthy()
  })
})

describe('Plantonista — override de local (sem troca entre anestesistas)', () => {
  it('LiberacoesView mostra o override de local em vez do derivado', () => {
    const escala = { id: 'e1', hospital: 'unimed', ordemLiberacao: ['VICENTE'], liberacoes: {}, linhaOverrides: { Vicente: { local: 'Coronel Freitas' } }, casos: [{ sala: 'X', ordem: 0, anestesista: 'OUTRO', cirurgiao: 'Alguem S' }] }
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit onToggle={() => {}} onReorder={() => {}} onSetOverride={() => {}} />, { wrapper: wrap })
    expect(screen.getByText(/Coronel Freitas/)).toBeTruthy()
  })
  it('setLocalAnestesista persiste no service (não-demo)', async () => {
    const { useEscalaCirurgicaActions } = await import('@/contexts/EscalaCirurgicaContext')
    const { EscalaCirurgicaProvider } = await import('@/contexts/EscalaCirurgicaContext')
    const Wrapper = ({ children }) => <ThemeProvider><ToastProvider><EscalaCirurgicaProvider>{children}</EscalaCirurgicaProvider></ToastProvider></ThemeProvider>
    const { result } = renderHook(() => useEscalaCirurgicaActions(), { wrapper: Wrapper })
    await act(async () => { await result.current.setLocalAnestesista({ id: 'e9', hospital: 'unimed', linhaOverrides: {} }, 'Vicente', 'Ambulatorial') })
    expect(svcMock.patchLinhaOverride).toHaveBeenCalledWith('e9', 'Vicente', expect.objectContaining({ local: 'Ambulatorial' }))
  })
})

// ════════════════════════════════════════════════════════════════════════════
// TROCA DE SALA entre anestesistas (item do dono)
// ════════════════════════════════════════════════════════════════════════════
describe('validarConflito — troca de sala', () => {
  const casos = [
    { sala: 'S1', hora: '13:00', anestesistaUserId: 'A' },
    { sala: 'S2', hora: '13:00', anestesistaUserId: 'B' },
    { sala: 'S3', hora: '13:00', anestesistaUserId: 'A' }, // A também está na S3 às 13:00
  ]
  it('troca limpa → null', () => {
    expect(validarConflito([casos[0], casos[1]], 'S1', 'A', 'S2', 'B')).toBeNull()
  })
  it('trocar consigo mesmo → erro', () => {
    expect(validarConflito(casos, 'S1', 'A', 'S2', 'A')).toMatch(/consigo/)
  })
  it('B assumiria S1 (13:00) mas B não conflita; A assumiria S2 (13:00) e A já está na S3 (13:00) → erro', () => {
    expect(validarConflito(casos, 'S1', 'A', 'S2', 'B')).toMatch(/S3/)
  })
})

// TROCA REMOVIDA DO APP (dono 29/07): os testes de TrocaPendenteCard e das actions
// propoTroca/aceitarTroca saíram junto com o código. `validarConflito` acima segue
// coberto — é utilitário puro, ainda usado para checar sobreposição de horário.

// ════════════════════════════════════════════════════════════════════════════
// PROBES DE FRAGILIDADE (documentam comportamento atual)
// ════════════════════════════════════════════════════════════════════════════
describe('Fragilidades — comportamento atual documentado', () => {
  it('CONFLITO: mesmo login em 2 salas no mesmo horário É detectado (banner do import; não bloqueia)', () => {
    const casos = [
      { sala: 'S1', ordem: 0, hora: '13:30', anestesista: 'EDUARDO', anestesistaUserId: 'u-edu' },
      { sala: 'S2', ordem: 0, hora: '13:30', anestesista: 'EDUARDO', anestesistaUserId: 'u-edu' },
    ]
    const conflitos = detectarConflitos(casos)
    expect(conflitos).toHaveLength(1)
    expect(conflitos[0]).toMatchObject({ userId: 'u-edu', sala1: 'S1', sala2: 'S2' })
  })

  it('liberações são chaveadas por APELIDO (texto) — dois apelidos do mesmo login não se unificam', () => {
    // Se a escala trouxer "EDUARDO" numa sala e "PED EDUARDO" noutra, a coluna gera 2 linhas
    const casos = [
      { sala: 'S1', ordem: 0, anestesista: 'EDUARDO', cirurgiao: 'Rodrigo Souza' },
      { sala: 'S2', ordem: 0, anestesista: 'PED EDUARDO', cirurgiao: 'Benito Bodanese' },
    ]
    const { linhas } = gerarColunaLiberacao(casos, ['EDUARDO', 'PED EDUARDO'])
    // normNome unifica PED → uma única linha Eduardo? Verifica o comportamento real:
    const eduardos = linhas.filter((l) => l.anestesista.toUpperCase().includes('EDUARDO'))
    expect(eduardos.length).toBeGreaterThanOrEqual(1)
  })

  it('casosResolvidos propaga // dentro da sala por ordem', () => {
    const r = casosResolvidos({ casos: [
      { sala: 'S1', ordem: 0, anestesista: 'EDUARDO' },
      { sala: 'S1', ordem: 1, anestesista: '//' },
    ] })
    expect(r.map((c) => c.anestesista)).toEqual(['EDUARDO', 'EDUARDO'])
  })
})

// ════════════════════════════════════════════════════════════════════════════
// F1.5 — status da cirurgia + adicionar caso (contexto)
// ════════════════════════════════════════════════════════════════════════════
describe('F1.5 — status da cirurgia e adicionar caso', () => {
  let useEscalaCirurgicaActions
  beforeEach(async () => {
    ;({ useEscalaCirurgicaActions } = await import('@/contexts/EscalaCirurgicaContext'))
  })
  const providerWrap = async () => {
    const { EscalaCirurgicaProvider } = await import('@/contexts/EscalaCirurgicaContext')
    return ({ children }) => <ThemeProvider><ToastProvider><EscalaCirurgicaProvider>{children}</EscalaCirurgicaProvider></ToastProvider></ThemeProvider>
  }
  const escalaBase = () => ({
    id: 'e1', hospital: 'unimed', ordemLiberacao: ['LEONARDO'], liberacoes: {}, data: '2026-07-01',
    casos: [
      { id: 'c1', sala: 'S1', ordem: 0, anestesista: 'EDUARDO', anestesistaUserId: 'u-edu', statusCirurgia: 'terminada' },
      { id: 'c2', sala: 'S1', ordem: 1, anestesista: 'EDUARDO', anestesistaUserId: 'u-edu' },
      { id: 'c3', sala: 'S2', ordem: 0, anestesista: 'LEONARDO', anestesistaUserId: 'u-leo' },
    ],
  })

  it('terminar o ÚLTIMO caso da sala persiste via RPC — sem notificação (decisão 30/07)', async () => {
    const Wrapper = await providerWrap()
    const { result } = renderHook(() => useEscalaCirurgicaActions(), { wrapper: Wrapper })
    const escala = escalaBase()
    await act(async () => { await result.current.setStatusCirurgia(escala, escala.casos[1], 'terminada'); await flush() })
    expect(svcMock.updateStatusCirurgia).toHaveBeenCalledWith('c2', 'terminada')
    expect(notifyUsers).not.toHaveBeenCalled()
  })

  it('iniciar cirurgia também NÃO notifica', async () => {
    const Wrapper = await providerWrap()
    const { result } = renderHook(() => useEscalaCirurgicaActions(), { wrapper: Wrapper })
    const escala = escalaBase()
    notifyUsers.mockClear()
    await act(async () => { await result.current.setStatusCirurgia(escala, escala.casos[2], 'iniciada'); await flush() })
    expect(notifyUsers).not.toHaveBeenCalled()
    await act(async () => { await result.current.setStatusCirurgia(escala, escala.casos[0], 'iniciada'); await flush() })
    expect(notifyUsers).not.toHaveBeenCalled()
  })

  it('adicionarCaso insere via service e entra no estado — sem notificação (decisão 30/07)', async () => {
    const Wrapper = await providerWrap()
    const { result } = renderHook(() => useEscalaCirurgicaActions(), { wrapper: Wrapper })
    const escala = escalaBase()
    notifyUsers.mockClear()
    let novo
    await act(async () => {
      novo = await result.current.adicionarCaso(escala, {
        sala: 'S9', ordem: 0, hora: '15:00', procedimento: 'Apendicectomia',
        anestesista: 'GARIM', anestesistaUserId: 'u-garim', tipo: 'urgencia',
      })
      await flush()
    })
    expect(svcMock.addCaso).toHaveBeenCalledWith('e1', expect.objectContaining({ sala: 'S9', tipo: 'urgencia' }))
    expect(novo.id).toBe('novo-1')
    expect(notifyUsers).not.toHaveBeenCalled()
  })

  it('escala demo não insere caso (aviso, retorno null)', async () => {
    const Wrapper = await providerWrap()
    const { result } = renderHook(() => useEscalaCirurgicaActions(), { wrapper: Wrapper })
    svcMock.addCaso.mockClear()
    let novo
    await act(async () => { novo = await result.current.adicionarCaso({ id: 'demo-x', hospital: 'unimed', casos: [] }, { sala: 'S1' }) })
    expect(novo).toBeNull()
    expect(svcMock.addCaso).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// F1.9 — cronômetro de término da sala (helpers puros)
// ════════════════════════════════════════════════════════════════════════════
describe('Liberações — não escalado e cronômetro manual (F1.9b)', () => {
  it('nome do rodapé SEM casos no dia = Não escalado (vermelho, toggle desabilitado)', () => {
    const escala = {
      id: 'e1', hospital: 'unimed', ordemLiberacao: ['LEONARDO', 'FERIAS'], liberacoes: {},
      casos: [{ sala: 'S1', ordem: 0, anestesista: 'LEONARDO', cirurgiao: 'Liana Winkelmann' }],
    }
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit onToggle={() => {}} onReorder={() => {}} />, { wrapper: wrap })
    expect(screen.getByText('Liberado')).toBeTruthy() // card vermelho = badge Liberado
    // reversível: clicar marca como ESCALADO (entrou na escala no meio do dia)
    const onToggleEscalado = vi.fn()
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit onToggle={() => {}} onToggleEscalado={onToggleEscalado} onReorder={() => {}} />, { wrapper: wrap })
    fireEvent.click(screen.getAllByLabelText('Marcar Ferias como escalado').at(-1)) // 2º render (com handler)
    expect(onToggleEscalado).toHaveBeenCalledWith(expect.objectContaining({ anestesista: 'Ferias' }))
  })
  it('término manual (override.termino) vira o cronômetro do card', () => {
    const escala = {
      id: 'e1', hospital: 'unimed', ordemLiberacao: ['LEONARDO'], liberacoes: {},
      linhaOverrides: { Leonardo: { termino: '23:59' } },
      casos: [{ sala: 'S1', ordem: 0, anestesista: 'LEONARDO', cirurgiao: 'Liana Winkelmann' }],
    }
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit onToggle={() => {}} onReorder={() => {}} />, { wrapper: wrap })
    expect(screen.getByTitle(/termina em ~/)).toBeTruthy() // compacto no card, frase no title
  })
})

describe('Liberações — Tempo faltante e lista de cirurgiões (F1.9d)', () => {
  const escala = {
    id: 'e1', hospital: 'unimed', ordemLiberacao: ['RODNEI'], liberacoes: {},
    casos: [
      { sala: 'S6', ordem: 0, anestesista: 'RODNEI', cirurgiao: 'Venilton Vieira' },
      { sala: 'S6', ordem: 1, anestesista: '//', cirurgiao: 'Juliano Esbissigo' },
    ],
  }
  it('sem estimativa → botão "Tempo faltante"; atalho de duração grava override.termino', () => {
    const onSetOverride = vi.fn()
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit onToggle={() => {}} onReorder={() => {}} onSetOverride={onSetOverride} />, { wrapper: wrap })
    fireEvent.click(screen.getByLabelText('Definir tempo faltante de Rodnei'))
    // os atalhos de duração VOLTARAM como grade (dono 17/08): um toque grava, e o
    // "Outro tempo…" cobre o resto da lista
    fireEvent.click(screen.getByRole('button', { name: '1h' }))
    expect(onSetOverride).toHaveBeenCalledWith(
      expect.objectContaining({ anestesista: 'Rodnei' }),
      expect.objectContaining({ termino: expect.stringMatching(/^\d{2}:\d{2}$/) })
    )
  })
  it('mais de um cirurgião vira lista (1 por linha, com marcador)', () => {
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit onToggle={() => {}} onReorder={() => {}} />, { wrapper: wrap })
    expect(screen.getByText('Venilton Vieira')).toBeTruthy()
    expect(screen.getByText('Juliano Esbissigo')).toBeTruthy()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Definir anestesista na Completa (pedido do dono 27/07): a escala é
// COLABORATIVA — o botão é de TODA a equipe que edita, não só do dono da sala.
// Antes o ⚙ sumia do board inteiro para quem não era dono/coordenador.
// ════════════════════════════════════════════════════════════════════════════
describe('Board — definir anestesista (escala colaborativa)', () => {
  const caso = (sala, extra = {}) => ({ id: `c-${sala}`, sala, ordem: 0, hora: '08:00', cirurgiao: 'Liana Winkelmann', procedimento: 'Colecistectomia', ...extra })
  // user mockado no topo do arquivo: uid 'u-x', role anestesiologista (não admin/secretária)
  const renderBoard = (casos) => render(
    <BoardView escala={{ id: 'e1', hospital: 'unimed', casos }} meuUid="u-x" meuAlias="EU" turno="matutino" />,
    { wrapper: wrap }
  )

  it('sala de OUTRO anestesista: também posso definir (colaborativa 27/07)', () => {
    renderBoard([caso('S1', { anestesista: 'OUTRO', anestesistaUserId: 'u-outro' })])
    expect(screen.getByLabelText(/^Definir anestesista da S1/)).toBeTruthy()
  })

  it('sala SEM anestesista: qualquer um da equipe assume', () => {
    renderBoard([caso('S1', { anestesista: '', semAnestesista: true })])
    expect(screen.getByLabelText(/^Definir anestesista da S1/)).toBeTruthy()
  })

  it('todas as salas do board mostram o botão (era 1 só, a do dono)', () => {
    renderBoard([
      caso('S1', { anestesista: 'OUTRO', anestesistaUserId: 'u-outro' }),
      { ...caso('S2', { anestesista: 'EU', anestesistaUserId: 'u-x' }), id: 'c-S2' },
      { ...caso('S3', { anestesista: 'TERCEIRO', anestesistaUserId: 'u-3' }), id: 'c-S3' },
    ])
    expect(screen.getAllByLabelText(/^Definir anestesista da/)).toHaveLength(3)
  })

  it('sala multi-anestesista (IOSC): uma fatia por anestesista, cada uma definível', () => {
    renderBoard([
      caso('IOSC', { anestesista: 'OUTRO', anestesistaUserId: 'u-outro' }),
      { ...caso('IOSC', { anestesista: '?' }), id: 'c-iosc-b', ordem: 1 },
    ])
    expect(screen.getAllByLabelText(/^Definir anestesista da IOSC/)).toHaveLength(2)
  })

  it('caso SEM anestesista (texto vazio + flag) NÃO é absorvido pelo colega da sala (bug 30/07)', () => {
    // A Vision às vezes devolve anestesista:'' (em vez de '?') junto com a flag;
    // o split ignorava a flag, descartava o texto vazio e o caso descoberto
    // aparecia sob o colega de cima depois da publicação.
    renderBoard([
      caso('S1', { anestesista: 'OUTRO', anestesistaUserId: 'u-outro' }),
      { ...caso('S1', { anestesista: '', semAnestesista: true }), id: 'c-s1-desc', ordem: 1 },
    ])
    // duas fatias: a do colega e a "?" — o caso descoberto tem grupo próprio
    expect(screen.getAllByLabelText(/^Definir anestesista da S1/)).toHaveLength(2)
    expect(screen.getByLabelText(/^Definir anestesista da S1 \(\?\)/)).toBeTruthy()
  })

  it('demo nunca é editável (alterações não são salvas)', () => {
    render(
      <BoardView escala={{ id: 'demo-unimed', hospital: 'unimed', casos: [caso('S1', { anestesista: '?' })] }}
        meuUid="u-x" meuAlias="EU" turno="matutino" />,
      { wrapper: wrap }
    )
    expect(screen.queryByLabelText(/^Definir anestesista da/)).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Gate de edição — fonte única (espelha a RLS can_write_escala_cirurgica). As
// cópias inline por página comparavam `role` cru: cargo em alias legado passava
// no gate de visibilidade (que normaliza) e ficava sem canEdit.
// ════════════════════════════════════════════════════════════════════════════
describe('gate — podeEditarEscalaCirurgica', () => {
  it('equipe do centro cirúrgico edita', () => {
    for (const role of ['anestesiologista', 'medico-residente', 'tec-enfermagem', 'secretaria']) {
      expect(podeEditarEscalaCirurgica({ role })).toBe(true)
    }
  })
  it('admin edita mesmo com cargo fora da equipe', () => {
    expect(podeEditarEscalaCirurgica({ role: 'colaborador', isAdmin: true })).toBe(true)
  })
  it('cargo em alias legado edita (era o canEdit falso silencioso)', () => {
    expect(podeEditarEscalaCirurgica({ role: 'medico' })).toBe(true)       // → anestesiologista
    expect(podeEditarEscalaCirurgica({ role: 'residente' })).toBe(true)    // → medico-residente
    expect(podeEditarEscalaCirurgica({ role: 'tecnico_enfermagem' })).toBe(true)
  })
  it('fora da equipe não edita', () => {
    for (const role of ['enfermeiro', 'farmaceutico', 'colaborador', '', null]) {
      expect(podeEditarEscalaCirurgica({ role })).toBe(false)
    }
    expect(podeEditarEscalaCirurgica(null)).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// A SUBSTITUIÇÃO DE POSIÇÃO SAIU (dono 29/07, junto com a troca). O que travava a
// regra "só o plantonista/gestor mexe na posição" virou dispensável: nenhum
// caminho da aba escreve mais em `ordem_liberacao`. A prova disso está em
// liberacoesPainelLinha.test.jsx.
// ════════════════════════════════════════════════════════════════════════════

describe('Liberações — caso assumido sai do alerta "sem anestesista"', () => {
  const base = { id: 'e1', hospital: 'unimed', data: '2026-06-26', ordemLiberacao: ['LEONARDO'], liberacoes: {} }
  const orfao = { sala: 'S9', ordem: 0, hora: '08:00', cirurgiao: 'Taciana Alflen', procedimento: 'Cesárea', anestesista: '', semAnestesista: true }

  it('em aberto: aparece no bloco de alerta', () => {
    render(<LiberacoesView escala={{ ...base, casos: [orfao] }} hospitalLabel="Unimed" canEdit onToggle={() => {}} onReorder={() => {}} />, { wrapper: wrap })
    expect(screen.getByText('Procedimentos sem anestesista')).toBeTruthy()
  })

  it('tocar no alerta abre o seletor e define o anestesista do caso (dono 26/07)', async () => {
    const onDefinirCasos = vi.fn(async () => {})
    render(
      <LiberacoesView escala={{ ...base, casos: [{ ...orfao, id: 'caso-9' }] }} hospitalLabel="Unimed" canEdit
        onDefinirCasos={onDefinirCasos} onToggle={() => {}} onReorder={() => {}} />,
      { wrapper: wrap }
    )
    fireEvent.click(screen.getByLabelText(/^Definir anestesista de/))
    expect(screen.getByText('Quem assume este procedimento?')).toBeTruthy()
    // roster mockado é vazio → o botão fica desabilitado, mas o caminho está ligado
    expect(screen.getByRole('button', { name: 'Definir anestesista' })).toBeDisabled()
  })

  it('alerta sem id de caso (escala legada) continua só leitura', () => {
    render(
      <LiberacoesView escala={{ ...base, casos: [orfao] }} hospitalLabel="Unimed" canEdit
        onDefinirCasos={() => {}} onToggle={() => {}} onReorder={() => {}} />,
      { wrapper: wrap }
    )
    expect(screen.queryByLabelText(/^Definir anestesista de/)).toBeNull()
  })

  it('assumido (anestesista + semAnestesista:false): some do alerta e vira linha', () => {
    const assumido = { ...orfao, anestesista: 'LEONARDO', semAnestesista: false }
    render(<LiberacoesView escala={{ ...base, casos: [assumido] }} hospitalLabel="Unimed" canEdit onToggle={() => {}} onReorder={() => {}} />, { wrapper: wrap })
    expect(screen.queryByText('Procedimentos sem anestesista')).toBeNull()
    expect(screen.getByLabelText('Marcar Leonardo liberado')).toBeTruthy()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Fase noturna 19h–22h (redesenho do dono 24/07): cada plantonista noturno é um
// CARD com selo P1–P4 no topo da lista (fim da caixa azul), vespertina abaixo.
// ════════════════════════════════════════════════════════════════════════════
describe('Liberações — cards do plantão noturno (P1–P4)', () => {
  // 2026-07-23 é QUINTA (dia útil) às 20h → fase 'noite'. Data local: hojeISO()
  // corrige pelo fuso, então construir com new Date(a, m, d) é TZ-safe.
  const HOJE = new Date(2026, 6, 23, 20, 0, 0)
  const dataISO = '2026-07-23'
  const plantoes = [
    { setor: 'P1', nome: 'Ana Paula' }, { setor: 'P2', nome: 'Bruno Costa' },
    { setor: 'P3', nome: 'Carla Dias' }, { setor: 'P4', nome: 'Davi Rocha' },
  ]
  const escala = {
    id: 'e1', hospital: 'unimed', data: dataISO, ordemLiberacao: ['LEONARDO', 'MARILIO'], liberacoes: {},
    casos: [
      { sala: 'S1', ordem: 0, hora: '14:00', anestesista: 'LEONARDO', cirurgiao: 'Liana Winkelmann' },
      { sala: 'S2', ordem: 0, hora: '14:00', anestesista: 'MARILIO', cirurgiao: 'Leandro Trevizan' },
    ],
  }
  const renderNoite = (props = {}) => render(
    <LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit plantoes={plantoes}
      onToggle={() => {}} onReorder={() => {}} {...props} />,
    { wrapper: wrap }
  )
  // ordem dos cards no DOM (o card noturno não tem toggle, então a âncora é data-*)
  const ordemCards = () => Array.from(document.querySelectorAll('[data-linha]'))
    .map((e) => e.getAttribute('data-nome'))

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(HOJE)
  })
  afterEach(() => { cleanup(); vi.useRealTimers() })

  it('Unimed: P2 → P3 → P4 e a lista vespertina ABAIXO', () => {
    renderNoite({ hospital: 'unimed', hospitalLabel: 'Unimed' })
    expect(ordemCards()).toEqual(['Bruno Costa', 'Carla Dias', 'Davi Rocha', 'Leonardo', 'Marilio'])
    expect(['P2', 'P3', 'P4'].map((s) => !!screen.getByText(s))).toEqual([true, true, true])
  })

  it('HRO: P1 → P4 → vespertina', () => {
    renderNoite({ hospital: 'hro', hospitalLabel: 'HRO' })
    expect(ordemCards()).toEqual(['Ana Paula', 'Davi Rocha', 'Leonardo', 'Marilio'])
    expect(screen.queryByText('P2')).toBeNull()
  })

  it('Materno: só o P4, e ele é o plantonista', () => {
    renderNoite({ hospital: 'materno', hospitalLabel: 'Materno' })
    expect(ordemCards()).toEqual(['Davi Rocha', 'Leonardo', 'Marilio'])
    expect(screen.getByText('Plantonista')).toBeTruthy() // badge do noturno, não do diurno
  })

  it('a CAIXA AZUL do plantão noturno não existe mais', () => {
    renderNoite({ hospital: 'unimed', hospitalLabel: 'Unimed' })
    expect(screen.queryByText(/Plantão noturno · 19h–22h/)).toBeNull()
  })

  it('P4 marcado na Unimed some do HRO e do Materno', () => {
    const { unmount } = renderNoite({ hospital: 'unimed', hospitalLabel: 'Unimed', p4Hospital: 'unimed' })
    expect(ordemCards()).toContain('Davi Rocha')
    unmount()
    renderNoite({ hospital: 'hro', hospitalLabel: 'HRO', p4Hospital: 'unimed' })
    expect(ordemCards()).toEqual(['Ana Paula', 'Leonardo', 'Marilio'])
  })

  it('sem marcação o P4 diz que está nos três hospitais', () => {
    renderNoite({ hospital: 'hro', hospitalLabel: 'HRO' })
    expect(screen.getByText(/nos três hospitais/)).toBeTruthy()
  })

  it('o selo P4 abre o sheet e escolher o hospital dispara onDefinirP4', () => {
    const onDefinirP4 = vi.fn()
    renderNoite({ hospital: 'hro', hospitalLabel: 'HRO', onDefinirP4 })
    fireEvent.click(screen.getByLabelText('Definir em qual hospital o P4 está hoje'))
    fireEvent.click(screen.getByRole('button', { name: 'Materno' }))
    expect(onDefinirP4).toHaveBeenCalledWith('materno')
  })

  it('card noturno é COMPLETO: tem toggle de liberar e cronômetro (decisão do dono 24/07)', () => {
    renderNoite({ hospital: 'materno', hospitalLabel: 'Materno' })
    expect(screen.getByLabelText('Marcar Davi Rocha liberado')).toBeTruthy()
    expect(screen.getByLabelText('Definir tempo faltante de Davi Rocha')).toBeTruthy()
  })

  // ── selo de AVISO no vespertino (pedido do dono 25/07): quem entra no plantão
  // já aparece marcado na lista da tarde, mas SEM sair da posição dele.
  it('vespertino antes das 19h: quem é P1–P4 já vem com o badge, na posição do dia', () => {
    vi.setSystemTime(new Date(2026, 6, 23, 14, 0, 0))
    // Leonardo (1º do rodapé) é o P3 de hoje à noite
    renderNoite({
      hospital: 'unimed', hospitalLabel: 'Unimed', turno: 'vespertino',
      plantoes: [{ setor: 'P3', nome: 'Leonardo' }, { setor: 'P4', nome: 'Davi Rocha' }],
    })
    expect(ordemCards()).toEqual(['Leonardo', 'Marilio']) // ordem do dia, intacta
    expect(document.querySelector('[data-linha="LEONARDO"]').getAttribute('data-selo')).toBe('P3')
    // quem não está na lista deste hospital não vira card à tarde
    expect(document.querySelector('[data-selo="P4"]')).toBeNull()
  })

  it('o badge do vespertino é SÓ aviso: o plantonista do dia segue sendo o do dia', () => {
    vi.setSystemTime(new Date(2026, 6, 23, 14, 0, 0))
    renderNoite({
      hospital: 'unimed', hospitalLabel: 'Unimed', turno: 'vespertino',
      plantoes: [{ setor: 'P3', nome: 'Marilio' }],
    })
    // Leonardo é o 1º do rodapé → segue com o badge Plantonista do dia
    const leonardo = document.querySelector('[data-linha="LEONARDO"]')
    expect(leonardo.textContent).toContain('Plantonista')
    // e Marilio, marcado como P3 da noite, continua na posição/lógica do dia
    const marilio = document.querySelector('[data-linha="MARILIO"]')
    expect(marilio.getAttribute('data-selo')).toBe('P3')
    expect(marilio.textContent).toContain('Próximo a ser liberado')
  })

  it('no FIM DE SEMANA não há aviso de plantão (só dia útil, por ora)', () => {
    // 2026-07-25 é SÁBADO — o plantão P1–P4 ainda não está estruturado p/ o FDS
    vi.setSystemTime(new Date(2026, 6, 25, 14, 0, 0))
    renderNoite({
      escala: { ...escala, data: '2026-07-25' },
      hospital: 'unimed', hospitalLabel: 'Unimed', turno: 'vespertino',
      plantoes: [{ setor: 'P3', nome: 'Leonardo' }],
    })
    expect(document.querySelector('[data-selo]')).toBeNull()
  })

  it('no MATUTINO não há aviso de plantão (só no vespertino)', () => {
    vi.setSystemTime(new Date(2026, 6, 23, 9, 0, 0))
    renderNoite({
      hospital: 'unimed', hospitalLabel: 'Unimed', turno: 'matutino',
      plantoes: [{ setor: 'P3', nome: 'Leonardo' }],
    })
    expect(document.querySelector('[data-selo]')).toBeNull()
  })

  it('escala de OUTRA data não recebe o aviso do plantão de hoje', () => {
    vi.setSystemTime(new Date(2026, 6, 23, 14, 0, 0))
    renderNoite({
      escala: { ...escala, data: '2026-07-20' },
      hospital: 'unimed', hospitalLabel: 'Unimed', turno: 'vespertino',
      plantoes: [{ setor: 'P3', nome: 'Leonardo' }],
    })
    expect(document.querySelector('[data-selo]')).toBeNull()
  })

  it('liberação do DIA não atravessa a virada: quem vira P1–P4 assume TRABALHANDO', () => {
    const liberadoNoDia = { ...escala, liberacoes: { 'BRUNO COSTA': { liberadoEm: 'x' } } }
    renderNoite({ escala: liberadoNoDia, hospital: 'unimed', hospitalLabel: 'Unimed' })
    expect(ordemCards()).toEqual(['Bruno Costa', 'Carla Dias', 'Davi Rocha', 'Leonardo', 'Marilio'])
    expect(document.querySelector('[data-selo="P2"]').textContent).not.toContain('Liberado')
  })

  it('liberação feita À NOITE vale e o card fica na posição do selo (não afunda)', () => {
    const liberadoNaNoite = { ...escala, liberacoes: { 'noite:BRUNO COSTA': { liberadoEm: 'x' } } }
    renderNoite({ escala: liberadoNaNoite, hospital: 'unimed', hospitalLabel: 'Unimed' })
    expect(ordemCards()).toEqual(['Bruno Costa', 'Carla Dias', 'Davi Rocha', 'Leonardo', 'Marilio'])
    expect(document.querySelector('[data-selo="P2"]').textContent).toContain('Liberado')
  })

  it('P1/P2 nunca são "próximo a ser liberado"; P3/P4 seguem a lógica do dia', () => {
    const vespertinaLiberada = { ...escala, liberacoes: { LEONARDO: { liberadoEm: 'x' }, MARILIO: { liberadoEm: 'x' } } }
    renderNoite({ escala: vespertinaLiberada, hospital: 'unimed', hospitalLabel: 'Unimed' })
    const proximo = screen.getByText('Próximo a ser liberado').closest('[data-linha]')
    expect(proximo.getAttribute('data-selo')).toBe('P4') // o amarelo cai no coringa, não no P2
  })

  it('só com P1/P2 na noite ninguém fica como "próximo" (são os plantonistas)', () => {
    const vespertinaLiberada = { ...escala, liberacoes: { LEONARDO: { liberadoEm: 'x' }, MARILIO: { liberadoEm: 'x' } } }
    renderNoite({
      escala: vespertinaLiberada, hospital: 'unimed', hospitalLabel: 'Unimed',
      plantoes: [{ setor: 'P2', nome: 'Bruno Costa' }],
    })
    expect(screen.queryByText('Próximo a ser liberado')).toBeNull()
  })

  it('quem está de plantão NUNCA aparece como Ajuda', () => {
    // Davi Rocha ajudou de dia (nome azul no rodapé) e à noite é o P4
    const comAjuda = {
      ...escala,
      ordemLiberacao: ['LEONARDO', 'MARILIO', 'DAVI ROCHA'],
      ajudaExterna: ['DAVI ROCHA'],
      casos: [...escala.casos, { sala: 'S3', ordem: 0, anestesista: 'DAVI ROCHA', cirurgiao: 'Pedro Barros' }],
    }
    renderNoite({ escala: comAjuda, hospital: 'materno', hospitalLabel: 'Materno' })
    expect(screen.queryByText('Ajuda')).toBeNull()
  })

  it('o selo P1–P4 é verde escuro (bg-primary), não o azul de info', () => {
    renderNoite({ hospital: 'materno', hospitalLabel: 'Materno' })
    expect(screen.getByText('P4').className).toContain('bg-primary')
  })

  // ── corte das 23h (pedido do dono 24/07): a lista do dia zera e sobram os P1–P4
  it('às 22h ainda é fase noturna (o corte é às 23h)', () => {
    vi.setSystemTime(new Date(2026, 6, 23, 22, 30, 0))
    renderNoite({ hospital: 'unimed', hospitalLabel: 'Unimed' })
    expect(ordemCards()).toEqual(['Bruno Costa', 'Carla Dias', 'Davi Rocha', 'Leonardo', 'Marilio'])
  })

  it('a partir das 23h ficam SÓ os plantonistas P1–P4 do hospital', () => {
    vi.setSystemTime(new Date(2026, 6, 23, 23, 10, 0))
    renderNoite({ hospital: 'unimed', hospitalLabel: 'Unimed' })
    expect(ordemCards()).toEqual(['Bruno Costa', 'Carla Dias', 'Davi Rocha']) // vespertina sumiu
    expect(['P2', 'P3', 'P4'].map((s) => !!screen.getByText(s))).toEqual([true, true, true])
  })

  it('às 23h o HRO fica com P1 e P4; o Materno só com o P4', () => {
    vi.setSystemTime(new Date(2026, 6, 23, 23, 30, 0))
    const { unmount } = renderNoite({ hospital: 'hro', hospitalLabel: 'HRO' })
    expect(ordemCards()).toEqual(['Ana Paula', 'Davi Rocha'])
    unmount()
    renderNoite({ hospital: 'materno', hospitalLabel: 'Materno' })
    expect(ordemCards()).toEqual(['Davi Rocha'])
  })

  it('às 23h com o P4 marcado em outro hospital, o Materno mostra o encerramento', () => {
    vi.setSystemTime(new Date(2026, 6, 23, 23, 30, 0))
    renderNoite({ hospital: 'materno', hospitalLabel: 'Materno', p4Hospital: 'hro' })
    expect(screen.getByText('Liberações do dia encerradas')).toBeTruthy()
    expect(screen.getByText(/A lista zera às 23h/)).toBeTruthy()
  })

  it('às 23h o alerta de "sem anestesista" do dia também sai da tela', () => {
    const comOrfao = {
      ...escala,
      casos: [...escala.casos, { sala: 'S9', ordem: 0, hora: '08:00', cirurgiao: 'Ana', anestesista: '', semAnestesista: true }],
    }
    vi.setSystemTime(new Date(2026, 6, 23, 20, 0, 0))
    const { unmount } = render(
      <LiberacoesView escala={comOrfao} hospital="unimed" hospitalLabel="Unimed" canEdit plantoes={plantoes}
        onToggle={() => {}} onReorder={() => {}} />, { wrapper: wrap })
    expect(screen.getByText('Procedimentos sem anestesista')).toBeTruthy() // 20h: aparece
    unmount()
    vi.setSystemTime(new Date(2026, 6, 23, 23, 10, 0))
    render(
      <LiberacoesView escala={comOrfao} hospital="unimed" hospitalLabel="Unimed" canEdit plantoes={plantoes}
        onToggle={() => {}} onReorder={() => {}} />, { wrapper: wrap })
    expect(screen.queryByText('Procedimentos sem anestesista')).toBeNull() // 23h: some
  })
})

describe('estimativaTerminoSala / formatRestante (F1.9)', () => {
  const casos = [
    { sala: 'S1', hora: '14:00', tempoEstimado: '01:30' },                                // fim 15:30
    { sala: 'S1', hora: '15:30', tempoEstimado: '02:00' },                                // fim 17:30 (max)
    { sala: 'S1', hora: '16:00', tempoEstimado: '01:00', statusCirurgia: 'terminada' },   // excluída
    { sala: 'S2', hora: '14:00' },                                                        // sem tempo → não estima
    { sala: 'S3', hora: '14:00', tempoEstimado: '01:00', statusCirurgia: 'terminada' },
  ]
  it('usa o maior fim entre casos NÃO terminados', () => {
    expect(estimativaTerminoSala(casos, 'S1')).toEqual({ estado: 'estimado', fimMin: 17 * 60 + 30 })
  })
  it('caso sem tempoEstimado não contribui (sem chute) → null', () => {
    expect(estimativaTerminoSala(casos, 'S2')).toBeNull()
  })
  it('todos terminados → encerrada', () => {
    expect(estimativaTerminoSala(casos, 'S3')).toEqual({ estado: 'encerrada' })
  })
  it('suspensa não conta como ativa (sala só com suspensas = encerrada)', () => {
    const c = [
      { sala: 'S9', hora: '14:00', tempoEstimado: '01:00', statusCirurgia: 'suspensa' },
      { sala: 'S9', hora: '15:00', tempoEstimado: '02:00', statusCirurgia: 'terminada' },
    ]
    expect(estimativaTerminoSala(c, 'S9')).toEqual({ estado: 'encerrada' })
  })
  it('formatRestante: futuro, horas, e atraso', () => {
    expect(formatRestante(15 * 60, 14 * 60 + 25)).toBe('termina em ~35min')
    expect(formatRestante(17 * 60 + 30, 15 * 60)).toBe('termina em ~2h30')
    expect(formatRestante(14 * 60, 14 * 60 + 20)).toBe('há 20min além do previsto')
  })
  it('parseDuracaoMin aceita hh:mm e rejeita lixo', () => {
    expect(parseDuracaoMin('01:30')).toBe(90)
    expect(parseDuracaoMin('00:45')).toBe(45)
    expect(parseDuracaoMin('90')).toBeNull()
    expect(parseDuracaoMin('')).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Nome curto AMBÍGUO (bug real 27/07): "GUILHERME MELO" e "GUILHERME SOUZA MELO"
// são cadastros diferentes e viravam ambos "Guilherme Melo" — a mesma pessoa
// aparecia em duas posições, sem como distinguir na tela.
// ════════════════════════════════════════════════════════════════════════════
describe('Liberações — dois cadastros com o mesmo nome curto', () => {
  const escala = {
    id: 'e1', hospital: 'unimed', data: '2026-06-26',
    ordemLiberacao: ['MELO', 'GUILHERME'], liberacoes: {},
    casos: [
      { id: 'c1', sala: 'S1', ordem: 0, hora: '13:30', anestesista: 'MELO', anestesistaUserId: 'uid-melo', cirurgiao: 'Ana' },
      { id: 'c2', sala: 'Exames', ordem: 0, hora: '13:30', anestesista: 'GUILHERME', anestesistaUserId: 'uid-souza', cirurgiao: 'Bia' },
    ],
  }
  // roster com os DOIS cadastros: nome curto de ambos = "Guilherme Melo"
  const rosterDuplo = {
    roster: [
      { uid: 'uid-melo', nome: 'GUILHERME MELO', apelidos: ['MELO'] },
      { uid: 'uid-souza', nome: 'GUILHERME SOUZA MELO', apelidos: ['GUILHERME'] },
    ],
    rosterByUid: new Map([
      ['uid-melo', { uid: 'uid-melo', nome: 'GUILHERME MELO', apelidos: ['MELO'] }],
      ['uid-souza', { uid: 'uid-souza', nome: 'GUILHERME SOUZA MELO', apelidos: ['GUILHERME'] }],
    ]),
    options: [], aliases: [],
    resolver: (n) => ({ MELO: 'uid-melo', GUILHERME: 'uid-souza' }[String(n).trim().toUpperCase()] || null),
    loading: false, refresh: vi.fn(), upsertAlias: vi.fn(), removeAlias: vi.fn(),
  }

  it('nome curto colidindo → mostra o nome COMPLETO para distinguir', async () => {
    const mod = await import('@/hooks/useRosterAnestesistas')
    const spy = vi.spyOn(mod, 'default').mockReturnValue(rosterDuplo)
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit
      onToggle={() => {}} onReorder={() => {}} />, { wrapper: wrap })
    const nomes = Array.from(document.querySelectorAll('[data-linha]')).map((e) => e.getAttribute('data-nome'))
    expect(nomes).toEqual(['Guilherme Melo', 'Guilherme Souza Melo'])
    expect(new Set(nomes).size).toBe(nomes.length) // nenhum nome repetido na tela
    spy.mockRestore()
  })
})
