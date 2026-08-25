/**
 * Importação de FIM DE SEMANA com os mapas cirúrgicos juntos (dono 2026-08-22).
 *
 * O recorte é o real de 22–23/08/2026: a tabela de posições mais os mapas da
 * Unimed de sábado e do HRO de sábado e domingo. Antes, os quatro arquivos
 * custavam seis leituras da Vision e nove publicações, com hospital/data/período
 * trocados à mão entre elas.
 *
 * ⚠️ O fluxo de DIA ÚTIL não entra aqui e não pode mudar: as escalas de segunda
 * a sexta são postadas em turnos separados porque saem em horas diferentes.
 * Quem cobre aquele caminho é importarEscalaConferencia.test.jsx.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import ImportarEscalaFdsPage from '@/pages/escala-cirurgica/ImportarEscalaFdsPage'

const { svcMock, salvarEscalaTurno, prepararImagem } = vi.hoisted(() => ({
  svcMock: { parseEscalaImagem: vi.fn(), fetchEscala: vi.fn(async () => null) },
  salvarEscalaTurno: vi.fn(async (p) => ({ id: 'e1', ...p })),
  prepararImagem: vi.fn(async () => ({ base64: 'AAAA', mimeType: 'image/jpeg' })),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseEscalaAnestesistaService', () => ({ isPermissionError: () => false }))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ salvarEscalaTurno }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u-sec', role: 'secretaria', displayName: 'Secretária' } }),
}))
vi.mock('@/lib/imagemVision', () => ({ prepararImagemParaVision: prepararImagem }))

const ROSTER = [
  { uid: 'uid-romulo', nome: 'RÔMULO SANTOS ROXO', apelidos: ['ROMULO'] },
  { uid: 'uid-gabriel', nome: 'GABRIEL JUAN KETTENHUBER COSTA', apelidos: ['GABRIEL'] },
  { uid: 'uid-thayna', nome: 'THAYNA REGINA SANTOS', apelidos: ['THAYNA'] },
  { uid: 'uid-karine', nome: 'KARINE BEDIN', apelidos: ['KARINE'] },
  { uid: 'uid-daniela', nome: 'DANIELA KLEIN REIS', apelidos: ['DANIELA'] },
  { uid: 'uid-cristina', nome: 'CRISTINA BERTOL BARBOSA MARCON', apelidos: ['CRISTINA'] },
]
const PORNOME = new Map(ROSTER.flatMap((r) => r.apelidos.map((a) => [a, r.uid])))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: ROSTER, aliases: [], loading: false,
    rosterByUid: new Map(ROSTER.map((r) => [r.uid, r])),
    options: ROSTER.map((r) => ({ value: r.uid, label: r.nome })),
    resolver: (nome) => PORNOME.get(String(nome || '').trim().toUpperCase()) || null,
    refresh: vi.fn(), upsertAlias: vi.fn(async () => {}), removeAlias: vi.fn(),
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

// grade real de 22–23/08
const GRADE = {
  '7-13': { unimed: 'KARINE', hro: 'GABRIEL', ret1: 'ROMULO', ret2: 'DANIELA' },
  '13-19': { unimed: 'DANIELA', hro: 'ROMULO', ret1: 'KARINE', ret2: 'GABRIEL' },
  '19-07': { unimed: 'GABRIEL', hro: 'KARINE', ret1: 'DANIELA', ret2: 'CRISTINA' },
}
const diaFds = (data) => ({
  data,
  grade: GRADE,
  posicoes: { P1: 'KARINE', P2: 'GABRIEL', P3: 'ROMULO', P4: 'DANIELA' },
  escalacao: { matutino: ['KARINE', 'GABRIEL'], vespertino: ['DANIELA', 'ROMULO'] },
  ordemDoc: {
    matutino: ['P4', 'P3', 'P2', 'P1'],
    vespertino: ['P4', 'P3'],
    noturno: ['P2', 'P1'],
  },
})

// mapa do HRO de sábado: manhã com nomes, TARDE com a coluna vazia (é o real)
const MAPA_HRO_SABADO = {
  hospitalDetectado: 'hro',
  dataDetectada: '2026-08-22',
  casos: [
    { sala: 'Sala 1', ordem: 0, hora: '07:00', turno: 'matutino', pacienteIniciais: 'R.F.C.', anestesista: 'THAYNA', procedimento: 'VARIZES', cirurgiao: 'Alexandre Medeiros', convenio: 'PART' },
    { sala: 'Sala 1', ordem: 1, hora: 'AS', turno: 'matutino', pacienteIniciais: 'A.Z.P.', anestesista: '//', procedimento: 'CESARIANA', cirurgiao: 'Shayane Rebelatto', convenio: 'BRF' },
    { sala: 'Sala 4', ordem: 0, hora: '07:00', turno: 'matutino', pacienteIniciais: 'C.M.', anestesista: 'GABRIEL', procedimento: 'FRATURA DA CLAVICULA', cirurgiao: 'Plantão Orto', convenio: 'SUS' },
    { sala: 'Sala 1', ordem: 2, hora: '13:00', turno: 'vespertino', pacienteIniciais: 'A.M.B.F.', anestesista: '', procedimento: 'ARTROPLASTIA DE QUADRIL', cirurgiao: 'Rodolfo Pagani', convenio: 'BRF' },
    { sala: 'Sala 1', ordem: 3, hora: 'AS', turno: 'vespertino', pacienteIniciais: 'R.W.', anestesista: '', procedimento: 'ARTROPLASTIA DE JOELHO', cirurgiao: 'Airton Luiz Pagani', convenio: 'SC' },
    { sala: 'Sala 4', ordem: 1, hora: 'AS', turno: 'vespertino', pacienteIniciais: 'E.A.', anestesista: '', procedimento: 'FRATURA DO TORNOZELO', cirurgiao: 'Plantão Orto', convenio: 'SUS' },
  ],
  ordemLiberacao: [], ajudaExterna: [], posicoesAssistenciais: [],
}

const MAPA_UNIMED_SABADO = {
  hospitalDetectado: 'unimed',
  dataDetectada: '2026-08-22',
  casos: [
    { sala: 'C.O - SALA 3', ordem: 0, hora: '07:30', turno: 'matutino', pacienteIniciais: 'N.C.P.T.', anestesista: 'GARIM', procedimento: 'CESARIANA', cirurgiao: 'Ana Paula Romanzini', convenio: 'UNIMED CHAPECO' },
    { sala: 'CENTRO CIRÚRGICO - SALA 1', ordem: 0, hora: '13:30', turno: 'vespertino', pacienteIniciais: 'M.C.P.', anestesista: '', procedimento: 'ARTRODESE DA COLUNA', cirurgiao: 'Cleiton Piekala', convenio: 'INTERCAMBIO' },
  ],
  ordemLiberacao: [], ajudaExterna: [], posicoesAssistenciais: [],
}

const soltar = (container, resposta, nome) => {
  svcMock.parseEscalaImagem.mockResolvedValueOnce(resposta)
  const input = container.querySelector('input[type="file"]')
  fireEvent.change(input, { target: { files: [new File(['x'], nome, { type: 'image/png' })] } })
}

/**
 * A tabela de posições é conferida na vista própria — a lista só a lista.
 * Entra por "Anexar ›" e sai por "Concluir conferência".
 */
async function anexarGrade(container, dias) {
  const antes = svcMock.parseEscalaImagem.mock.calls.length
  fireEvent.click(screen.getByRole('button', { name: /Anexar/ }))
  await screen.findByText('Posições e fila', { selector: 'h1' })
  soltar(container, { dias, ignorados: [] }, 'fds.png')
  await waitFor(() => expect(svcMock.parseEscalaImagem.mock.calls.length).toBe(antes + 1))
  fireEvent.click(await screen.findByRole('button', { name: /Concluir conferência/ }))
  await screen.findByText('Fim de semana', { selector: 'h1' })
}

/** Mapas entram pelo dropzone da própria lista (vários de uma vez). */
async function anexarMapa(container, resposta, nome = 'mapa.png') {
  const antes = svcMock.parseEscalaImagem.mock.calls.length
  soltar(container, resposta, nome)
  await waitFor(() => expect(svcMock.parseEscalaImagem.mock.calls.length).toBe(antes + 1))
}

/** Abre a conferência de um mapa pela linha dele na lista. */
async function abrirMapa(rotulo) {
  const item = (await screen.findByText(rotulo)).closest('div.border-b')
  fireEvent.click(within(item).getByRole('button', { name: /Conferir/ }))
}

const abrir = async () => {
  const r = render(<ImportarEscalaFdsPage data="2026-08-22" onClose={vi.fn()} />, { wrapper: wrap })
  await screen.findByText('Fim de semana', { selector: 'h1' })
  return r
}

beforeAll(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); vi.setSystemTime(new Date('2026-08-22T10:00:00-03:00')) })
afterAll(() => { vi.useRealTimers() })
beforeEach(() => { vi.clearAllMocks(); svcMock.fetchEscala.mockResolvedValue(null) })

describe('lista de documentos — os arquivos do fim de semana num lugar só', () => {
  it('abre na lista com a tabela de posições pedindo anexo', async () => {
    await abrir()
    expect(screen.getByText('Posições e fila')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Anexar/ })).toBeInTheDocument()
    // publicar só depois da tabela: é ela que traz a fila de liberação
    expect(screen.getByRole('button', { name: /Publicar fim de semana/ })).toBeDisabled()
  })

  it('mapa lido entra na lista com hospital, dia e contagem por turno', async () => {
    const { container } = await abrir()
    await anexarMapa(container, MAPA_HRO_SABADO, 'hro-sabado.png')
    expect(await screen.findByText(/HRO · 22\/08/)).toBeInTheDocument()
    // 6 cirurgias: 3 de manhã e 3 à tarde — numa leitura só
    expect(screen.getByText('6 cirurgias — manhã 3 · tarde 3')).toBeInTheDocument()
  })

  it('mapa sem hospital reconhecido pede a confirmação em vez de escolher', async () => {
    const { container } = await abrir()
    await anexarMapa(container, { ...MAPA_HRO_SABADO, hospitalDetectado: '' })
    expect(await screen.findByText(/Falta hospital/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Publicar fim de semana/ })).toBeDisabled()
  })

  it('mapa de outro fim de semana diz a data que leu', async () => {
    const { container } = await abrir()
    await anexarMapa(container, { ...MAPA_HRO_SABADO, dataDetectada: '2026-08-15' })
    expect(await screen.findByText(/o arquivo mostra 15\/08/)).toBeInTheDocument()
  })

  it('reanexar o MESMO hospital e dia substitui, não duplica', async () => {
    const { container } = await abrir()
    await anexarMapa(container, MAPA_HRO_SABADO, 'hro-1.png')
    await screen.findByText(/HRO · 22\/08/)
    await anexarMapa(container, {
      ...MAPA_HRO_SABADO, casos: MAPA_HRO_SABADO.casos.slice(0, 3),
    }, 'hro-2.png')
    await waitFor(() => expect(screen.getAllByText(/HRO · 22\/08/)).toHaveLength(1))
    expect(screen.getByText('3 cirurgias — manhã 3 · tarde 0')).toBeInTheDocument()
  })
})

describe('publicação em lote', () => {
  it('publica as 4 filas do fim de semana MAIS um turno por mapa com casos', async () => {
    const { container } = await abrir()
    await anexarGrade(container, [diaFds('2026-08-22'), diaFds('2026-08-23')])
    await anexarMapa(container, MAPA_HRO_SABADO, 'hro.png')
    await anexarMapa(container, MAPA_UNIMED_SABADO, 'unimed.png')

    const botao = await screen.findByRole('button', { name: /Publicar fim de semana/ })
    await waitFor(() => expect(botao).not.toBeDisabled())
    fireEvent.click(botao)

    await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalledTimes(8))
    const chamadas = salvarEscalaTurno.mock.calls.map(([p]) => `${p.hospital}|${p.data}|${p.turno}|${p.casos.length}`)
    // 4 filas únicas, sem casos (a fila deriva dos casos por hospital)
    expect(chamadas.filter((c) => c.startsWith('fds|'))).toEqual([
      'fds|2026-08-22|matutino|0', 'fds|2026-08-22|vespertino|0',
      'fds|2026-08-23|matutino|0', 'fds|2026-08-23|vespertino|0',
    ])
    // e os dois mapas, cada um nos dois turnos que têm cirurgia
    expect(chamadas.filter((c) => !c.startsWith('fds|')).sort()).toEqual([
      'hro|2026-08-22|matutino|3', 'hro|2026-08-22|vespertino|3',
      'unimed|2026-08-22|matutino|1', 'unimed|2026-08-22|vespertino|1',
    ])
  })

  it('o mapa NÃO publica rodapé — a fila do fim de semana é a da linha fds', async () => {
    const { container } = await abrir()
    await anexarGrade(container, [diaFds('2026-08-22')])
    await anexarMapa(container, MAPA_HRO_SABADO, 'hro.png')
    fireEvent.click(await screen.findByRole('button', { name: /Publicar fim de semana/ }))
    await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalled())
    for (const [p] of salvarEscalaTurno.mock.calls) {
      if (p.hospital === 'hro') expect(p.ordemLiberacao).toEqual([])
    }
  })

  it('as linhas "AS" da tarde vão para a TARDE, não para o turno do anexo', async () => {
    const { container } = await abrir()
    await anexarGrade(container, [diaFds('2026-08-22')])
    await anexarMapa(container, MAPA_HRO_SABADO, 'hro.png')
    fireEvent.click(await screen.findByRole('button', { name: /Publicar fim de semana/ }))
    await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalled())
    const tarde = salvarEscalaTurno.mock.calls.map(([p]) => p)
      .find((p) => p.hospital === 'hro' && p.turno === 'vespertino')
    expect(tarde.casos.map((c) => c.pacienteIniciais).sort()).toEqual(['A.M.B.F.', 'E.A.', 'R.W.'])
    const manha = salvarEscalaTurno.mock.calls.map(([p]) => p)
      .find((p) => p.hospital === 'hro' && p.turno === 'matutino')
    expect(manha.casos.map((c) => c.pacienteIniciais)).not.toContain('R.W.')
  })

  it('a tarde NÃO herda o anestesista da manhã quando a coluna vem vazia', async () => {
    // Defeito real deste mapa: a herança de "//" é por SALA e atravessaria a
    // faixa MATUTINO/VESPERTINO. A Sala 1 tem THAYNA às 7h e a coluna da tarde
    // veio VAZIA — sem a fronteira, as 3 cirurgias da tarde sairiam no nome dela,
    // em silêncio. Aqui a grade não sugere ninguém (mapa sem tabela de posições
    // anexada não tem posto), então a tarde tem de sair SEM anestesista.
    const { container } = await abrir()
    await anexarGrade(container, [{ ...diaFds('2026-08-22'), grade: {
      ...GRADE, '13-19': { ...GRADE['13-19'], hro: '' },
    } }])
    await anexarMapa(container, MAPA_HRO_SABADO, 'hro.png')
    fireEvent.click(await screen.findByRole('button', { name: /Publicar fim de semana/ }))
    await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalled())
    const tarde = salvarEscalaTurno.mock.calls.map(([p]) => p)
      .find((p) => p.hospital === 'hro' && p.turno === 'vespertino')
    expect(tarde.casos.map((c) => c.anestesista)).toEqual(['?', '?', '?'])
    expect(tarde.casos.every((c) => c.semAnestesista === true)).toBe(true)
  })

  it('guardrail anti-perda: anexo menor que o publicado pede confirmação', async () => {
    svcMock.fetchEscala.mockImplementation(async (data, hospital) => (
      hospital === 'hro'
        ? { casos: Array.from({ length: 9 }, (_, i) => ({ id: `c${i}`, turno: 'matutino' })) }
        : null
    ))
    const { container } = await abrir()
    await anexarGrade(container, [diaFds('2026-08-22')])
    await anexarMapa(container, MAPA_HRO_SABADO, 'hro.png')
    fireEvent.click(await screen.findByRole('button', { name: /Publicar fim de semana/ }))
    expect(await screen.findByText(/A escala publicada tem mais cirurgias/)).toBeInTheDocument()
    expect(salvarEscalaTurno).not.toHaveBeenCalled()
  })
})

describe('conferência do mapa', () => {
  it('sugere pelo posto da grade só onde o mapa não trouxe nome', async () => {
    const { container } = await abrir()
    await anexarGrade(container, [diaFds('2026-08-22')])
    await anexarMapa(container, MAPA_HRO_SABADO, 'hro.png')
    await abrirMapa(/HRO · 22\/08/)

    // manhã: os nomes vêm do documento e a grade não os substitui. O cabeçalho
    // mostra o nome do CADASTRO porque o login já nasce resolvido pelo nome
    // lido (dono 25/08) — o que importa aqui é que a pessoa é a THAYNA e não o
    // Rômulo do posto, e que a linha dela não leva rótulo de sugestão.
    // ⚠️ o Select do DS não repassa `aria-label` (usa `aria-labelledby` de um
    // label que aqui não existe), então a busca é pela seção da sala.
    const secao = (await screen.findByText('Sala 1')).closest('section')
    const campo = within(secao).getByRole('combobox')
    expect(campo).toHaveTextContent('THAYNA REGINA SANTOS')
    expect(campo).not.toHaveTextContent('sem anestesista')   // a queixa de 25/08
    expect(screen.queryByText(/Sugerido pelo posto da grade/)).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: /Tarde · 3/ }))
    // tarde: a coluna veio vazia e a grade põe o Rômulo no HRO das 13–19h
    await waitFor(() => expect(screen.getAllByText(/Sugerido pelo posto da grade/).length).toBeGreaterThan(0))
    expect(screen.getAllByText('RÔMULO SANTOS ROXO').length).toBeGreaterThan(0)
  })

  it('a sugestão vai para a publicação como anestesista de verdade', async () => {
    const { container } = await abrir()
    await anexarGrade(container, [diaFds('2026-08-22')])
    await anexarMapa(container, MAPA_HRO_SABADO, 'hro.png')
    await abrirMapa(/HRO · 22\/08/)
    fireEvent.click(await screen.findByRole('tab', { name: /Tarde · 3/ }))
    await waitFor(() => expect(screen.getAllByText(/Sugerido pelo posto da grade/).length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('button', { name: /Voltar para os documentos/ }))

    fireEvent.click(await screen.findByRole('button', { name: /Publicar fim de semana/ }))
    await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalled())
    const tarde = salvarEscalaTurno.mock.calls.map(([p]) => p)
      .find((p) => p.hospital === 'hro' && p.turno === 'vespertino')
    expect(tarde.casos.every((c) => c.anestesistaUserId === 'uid-romulo')).toBe(true)
    expect(tarde.casos.every((c) => c.semAnestesista !== true)).toBe(true)
  })
})
