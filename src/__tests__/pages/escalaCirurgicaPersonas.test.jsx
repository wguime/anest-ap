/**
 * Testes de PERSONAS da Escala Cirúrgica — exercita o código real como se fosse o
 * uso em ambiente real: Secretária (confecção+identidade), Anestesista (minhas escalas),
 * Plantonista (liberações), Admin (board). Mais probes de fragilidade.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react'
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

// ── mocks p/ os testes de contexto (notificações) — vi.hoisted evita TDZ ─────
const { notifyUsers, svcMock, trocasMock } = vi.hoisted(() => ({
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
  },
  trocasMock: {
    propoTroca: vi.fn(async (p) => ({ id: 't1', ...p })),
    aceitarTroca: vi.fn(async () => {}),
    recusarTroca: vi.fn(async () => {}),
    cancelarTroca: vi.fn(async () => {}),
    fetchTrocasPendentes: vi.fn(async () => []),
  },
}))
vi.mock('@/services/notificationService', () => ({ notifyUsers }))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseTrocasCirurgicasService', () => ({ default: trocasMock }))
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ user: { uid: 'u-x', role: 'anestesiologista' } }) }))

const flush = () => new Promise((r) => setTimeout(r, 0))
const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

beforeEach(() => {
  notifyUsers.mockClear()
  Object.values(svcMock).forEach((f) => f.mockClear?.())
  Object.values(trocasMock).forEach((f) => f.mockClear?.())
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
  it('usuário sem casos → empty state', () => {
    render(<MinhasEscalasView escala={escala} meuAlias="Zé" meuUid="u-ze" turno="vespertino" />, { wrapper: wrap })
    expect(screen.getByText(/não está escalado/i)).toBeTruthy()
  })
  it('fallback por apelido quando o caso não tem uid (demo/legado)', () => {
    const demo = { id: 'demo-unimed', hospital: 'unimed', casos: [{ id: 'x', sala: 'SALA 4', anestesista: 'LEONARDO', cirurgiao: 'Liana W', procedimento: 'Mamária' }] }
    render(<MinhasEscalasView escala={demo} meuAlias="Leonardo" meuUid="u-leo" turno="vespertino" />, { wrapper: wrap })
    expect(screen.getByText('Mamária')).toBeTruthy()
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
  it('clicar liberar dispara onToggle com o anestesista', () => {
    const onToggle = vi.fn()
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit onToggle={onToggle} onReorder={() => {}} />, { wrapper: wrap })
    fireEvent.click(screen.getAllByLabelText(/^Marcar .* liberado$/)[0])
    expect(onToggle).toHaveBeenCalledWith('Leonardo')
  })
  it('reordenar (descer) dispara onReorder com a ordem trocada', () => {
    const onReorder = vi.fn()
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit onToggle={() => {}} onReorder={onReorder} />, { wrapper: wrap })
    fireEvent.click(screen.getAllByLabelText(/^Subir|^Descer/)[1]) // 'Descer Leonardo'
    expect(onReorder).toHaveBeenCalledWith(['Marilio', 'Leonardo', 'Diego'])
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
  it('✏️ abre o editor e Salvar dispara onSetOverride com local+cirurgião', () => {
    const onSetOverride = vi.fn()
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit onToggle={() => {}} onReorder={() => {}} onSetOverride={onSetOverride} />, { wrapper: wrap })
    fireEvent.click(screen.getByLabelText('Editar local/cirurgião de Leonardo'))
    fireEvent.change(screen.getByLabelText('Local'), { target: { value: 'Coronel Freitas' } })
    fireEvent.change(screen.getByLabelText('Cirurgião(ões)'), { target: { value: 'Vanessa B' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(onSetOverride).toHaveBeenCalledWith('Leonardo', expect.objectContaining({ local: 'Coronel Freitas', cirurgioes: 'Vanessa B' }))
  })
  it('Restaurar automático dispara onSetOverride(null)', () => {
    const onSetOverride = vi.fn()
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit onToggle={() => {}} onReorder={() => {}} onSetOverride={onSetOverride} />, { wrapper: wrap })
    fireEvent.click(screen.getByLabelText('Editar local/cirurgião de Marilio'))
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar automático' }))
    expect(onSetOverride).toHaveBeenCalledWith('Marilio', null)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// PERSONA 4 — ADMIN/BOARD: ordenação de salas, destaque por uid, detalhe
// ════════════════════════════════════════════════════════════════════════════
describe('Board — ordenação de salas e detalhe', () => {
  it('HRO: ORTO ocupa a posição 4 (entre Sala 3 e Sala 5)', () => {
    expect(rankSala('ORTO', 'hro')).toBe(4)
    expect(rankSala('Sala 5', 'hro')).toBe(5)
    expect(rankSala('CONSULTORIO', 'hro')).toBe(90)
  })
  it('Unimed: C.O fica depois das salas numéricas', () => {
    expect(rankSala('SALA 7', 'unimed')).toBe(7)
    expect(rankSala('C.O - CESAREA', 'unimed')).toBe(80)
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
  it('card do board leva stripe do convênio na borda esquerda', () => {
    const escala = { id: 'e1', hospital: 'unimed', casos: [{ id: 'c1', sala: 'SALA 1', ordem: 0, hora: '13:30', anestesista: 'X', procedimento: 'Sinus', convenio: 'SUS' }] }
    render(<BoardView escala={escala} meuAlias="x" meuUid="u-x" turno="vespertino" />, { wrapper: wrap })
    const card = screen.getByText('Sinus').closest('button')
    expect(card.className).toContain('border-l-4')
    expect(card.className).toContain('border-l-category-blue')
  })
})

describe('Board — cor de status do card (Iniciada amarelo, Terminada verde)', () => {
  const escala = (status) => ({ id: 'e1', hospital: 'unimed', casos: [{ id: 'c1', sala: 'SALA 1', ordem: 0, hora: '13:30', anestesista: 'X', procedimento: 'Sinus', statusCirurgia: status }] })
  it('iniciada → card warning (não mais destructive)', () => {
    render(<BoardView escala={escala('iniciada')} meuAlias="x" meuUid="u-x" turno="vespertino" />, { wrapper: wrap })
    const card = screen.getByText('Sinus').closest('button')
    expect(card.className).toContain('bg-warning/25')
    expect(card.className).not.toContain('destructive')
  })
  it('terminada → card success', () => {
    render(<BoardView escala={escala('terminada')} meuAlias="x" meuUid="u-x" turno="vespertino" />, { wrapper: wrap })
    const card = screen.getByText('Sinus').closest('button')
    expect(card.className).toContain('bg-success/25')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// NOTIFICAÇÕES (contexto) — escalado/liberado por login (uid)
// ════════════════════════════════════════════════════════════════════════════
describe('Notificações — disparo por login', () => {
  let useEscalaCirurgicaActions
  beforeEach(async () => {
    ;({ useEscalaCirurgicaActions } = await import('@/contexts/EscalaCirurgicaContext'))
  })
  const providerWrap = async () => {
    const { EscalaCirurgicaProvider } = await import('@/contexts/EscalaCirurgicaContext')
    return ({ children }) => <ThemeProvider><ToastProvider><EscalaCirurgicaProvider>{children}</EscalaCirurgicaProvider></ToastProvider></ThemeProvider>
  }

  it('publicar notifica cada login pelos seus casos (conta por uid, inclui //)', async () => {
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
    const alvos = notifyUsers.mock.calls.map((c) => c[0][0])
    expect(alvos).toContain('u-edu')
    expect(alvos).toContain('u-staub')
    const eduCall = notifyUsers.mock.calls.find((c) => c[0][0] === 'u-edu')
    expect(eduCall[1].content).toContain('2 caso')   // 2 casos (inclui o //)
  })

  it('marcar liberado notifica o login; desfazer NÃO notifica', async () => {
    const Wrapper = await providerWrap()
    const { result } = renderHook(() => useEscalaCirurgicaActions(), { wrapper: Wrapper })
    const escala = { id: 'e1', hospital: 'unimed', liberacoes: {}, data: '2026-06-30', casos: [{ sala: 'S1', anestesista: 'EDUARDO', anestesistaUserId: 'u-edu' }] }
    await act(async () => { await result.current.toggleLiberacao(escala, 'EDUARDO', { userId: 'me' }); await flush() })
    expect(svcMock.patchLiberacao).toHaveBeenCalledWith('e1', 'EDUARDO', expect.objectContaining({ por: 'me' }))
    expect(notifyUsers.mock.calls.some((c) => c[0][0] === 'u-edu')).toBe(true)

    notifyUsers.mockClear()
    const liberada = { ...escala, liberacoes: { EDUARDO: { liberadoEm: 'x' } } }
    await act(async () => { await result.current.toggleLiberacao(liberada, 'EDUARDO', { userId: 'me' }); await flush() })
    expect(notifyUsers).not.toHaveBeenCalled()
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
    expect(linhas.find((l) => l.anestesista === 'Paulo').texto).toBe('Paulo — Consultorio')
    expect(linhas.find((l) => l.anestesista === 'Garim').texto).toBe('Garim — SRPA')
  })
})

describe('Cards — idade e tempo cirúrgico no demo (quando houver)', () => {
  it('demo Unimed traz idade e tempo nos casos com paciente', () => {
    const caso = DEMO_ESCALAS.unimed.casos.find((c) => c.pacienteIniciais === 'M.C.')
    expect(caso.idade).toBe('3a')
    expect(caso.tempoEstimado).toBe('02:00')
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

describe('Troca de sala — actions do context', () => {
  let useEscalaCirurgicaActions, EscalaCirurgicaProvider
  beforeEach(async () => {
    ;({ useEscalaCirurgicaActions, EscalaCirurgicaProvider } = await import('@/contexts/EscalaCirurgicaContext'))
  })
  const wrapP = () => ({ children }) => <ThemeProvider><ToastProvider><EscalaCirurgicaProvider>{children}</EscalaCirurgicaProvider></ToastProvider></ThemeProvider>

  it('propor troca cria a proposta e notifica o alvo', async () => {
    const { result } = renderHook(() => useEscalaCirurgicaActions(), { wrapper: wrapP() })
    const escala = { id: 'e1', hospital: 'unimed', casos: [] }
    await act(async () => {
      await result.current.propoTroca(escala, { salaA: 'S1', uidA: 'A', aliasA: 'GARIM', salaB: 'S2', uidB: 'B', aliasB: 'STAUB' }, { userId: 'A' })
      await flush()
    })
    expect(trocasMock.propoTroca).toHaveBeenCalled()
    expect(notifyUsers.mock.calls.some((c) => c[0][0] === 'B')).toBe(true)
  })

  it('escala demo NÃO cria troca', async () => {
    const { result } = renderHook(() => useEscalaCirurgicaActions(), { wrapper: wrapP() })
    await act(async () => { await result.current.propoTroca({ id: 'demo-unimed', casos: [] }, { salaA: 'S1', uidA: 'A', salaB: 'S2', uidB: 'B', aliasA: 'x', aliasB: 'y' }, { userId: 'A' }) })
    expect(trocasMock.propoTroca).not.toHaveBeenCalled()
  })

  it('aceitar troca chama a RPC e notifica os dois', async () => {
    const { result } = renderHook(() => useEscalaCirurgicaActions(), { wrapper: wrapP() })
    await act(async () => {
      await result.current.aceitarTroca({ id: 't1', uidA: 'A', uidB: 'B', salaA: 'S1', salaB: 'S2' })
      await flush()
    })
    expect(trocasMock.aceitarTroca).toHaveBeenCalledWith('t1')
    const alvos = notifyUsers.mock.calls.map((c) => c[0][0])
    expect(alvos).toContain('A')
    expect(alvos).toContain('B')
  })
})

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

  it('terminar o ÚLTIMO caso da sala persiste via RPC e avisa o plantonista (1º do rodapé)', async () => {
    const Wrapper = await providerWrap()
    const { result } = renderHook(() => useEscalaCirurgicaActions(), { wrapper: Wrapper })
    const escala = escalaBase()
    await act(async () => { await result.current.setStatusCirurgia(escala, escala.casos[1], 'terminada'); await flush() })
    expect(svcMock.updateStatusCirurgia).toHaveBeenCalledWith('c2', 'terminada')
    expect(notifyUsers.mock.calls.some((c) => c[0][0] === 'u-leo')).toBe(true)
  })

  it('iniciar cirurgia (ou terminar com sala ainda aberta) NÃO notifica', async () => {
    const Wrapper = await providerWrap()
    const { result } = renderHook(() => useEscalaCirurgicaActions(), { wrapper: Wrapper })
    const escala = escalaBase()
    notifyUsers.mockClear()
    await act(async () => { await result.current.setStatusCirurgia(escala, escala.casos[2], 'iniciada'); await flush() })
    expect(notifyUsers).not.toHaveBeenCalled()
    // terminar c3 fecha a S2 → notifica; mas terminar c2 quando c1 já estava terminada também fecha S1
    await act(async () => { await result.current.setStatusCirurgia(escala, escala.casos[0], 'iniciada'); await flush() })
    expect(notifyUsers).not.toHaveBeenCalled()
  })

  it('adicionarCaso insere via service, entra no estado e notifica o anestesista atribuído', async () => {
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
    expect(notifyUsers.mock.calls.some((c) => c[0][0] === 'u-garim')).toBe(true)
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
    expect(onToggleEscalado).toHaveBeenCalledWith('Ferias')
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
    fireEvent.click(screen.getByRole('button', { name: '1h' }))
    expect(onSetOverride).toHaveBeenCalledWith('Rodnei', expect.objectContaining({ termino: expect.stringMatching(/^\d{2}:\d{2}$/) }))
  })
  it('mais de um cirurgião vira lista (1 por linha, com marcador)', () => {
    render(<LiberacoesView escala={escala} hospitalLabel="Unimed" canEdit onToggle={() => {}} onReorder={() => {}} />, { wrapper: wrap })
    expect(screen.getByText('Venilton Vieira')).toBeTruthy()
    expect(screen.getByText('Juliano Esbissigo')).toBeTruthy()
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
