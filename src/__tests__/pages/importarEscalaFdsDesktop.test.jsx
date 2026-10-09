/**
 * FIM DE SEMANA NO DESKTOP (dono 09/10/2026, modelo F): a mesma tela do dia útil, com a
 * fila única do turno — e a MESMA publicação do celular. O que trava:
 *  - o documento anexado vira a fila do turno aberto, na direção do documento;
 *  - publicar pela prévia (depois dos 10 s, que nada gravam) manda o MESMO rodapé que o
 *    fluxo do celular manda (a inversão é uma só, na publicação).
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import ImportarEscalaFdsPage from '@/pages/escala-cirurgica/ImportarEscalaFdsPage'

const { svcMock, salvarEscalaTurno, upsertAlias, prepararImagem, rosterHolder, getPlantoesMock} = vi.hoisted(() => ({
  getPlantoesMock: vi.fn(async () => []),
  rosterHolder: { lista: [] },
  svcMock: { parseEscalaImagem: vi.fn() },
  salvarEscalaTurno: vi.fn(async (p) => ({ id: 'fds1', ...p })),
  upsertAlias: vi.fn(async () => {}),
  prepararImagem: vi.fn(async () => ({ base64: 'AAAA', mimeType: 'image/jpeg', bytes: 3, largura: 1600, altura: 1200, reduzida: true })),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ salvarEscalaTurno }),
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u-sec', role: 'secretaria', displayName: 'Secretária' } }),
}))
vi.mock('@/lib/imagemVision', () => ({ prepararImagemParaVision: prepararImagem }))
vi.mock('@/services/supabaseEscalaAnestesistaService', () => ({ isPermissionError: () => false }))
vi.mock('@/services/pegaPlantaoApi', () => ({ getPlantoes: (...a) => getPlantoesMock(...a) }))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: rosterHolder.lista, aliases: [], loading: false,
    rosterByUid: new Map(rosterHolder.lista.map((r) => [r.uid, r])),
    options: rosterHolder.lista.map((r) => ({ value: r.uid, label: r.nome })),
    resolver: () => null,
    refresh: vi.fn(), upsertAlias, removeAlias: vi.fn(),
  }),
}))


vi.mock('@/design-system/hooks', async (orig) => ({ ...(await orig()), useMediaQuery: () => true }))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const RESPOSTA_FDS = {
  dias: [
    {
      data: '2026-08-15',
      plantoes: { P1: 'GUILHERME DIDOMENICO', P2: 'JOAO HENRIQUE', P3: 'CRISTINA', P4: 'MATHEUS' },
      grade: {
        '7-13': { unimed: 'GUILHERME DIDOMENICO', hro: 'JOAO HENRIQUE', ret1: 'CRISTINA', ret2: 'MATHEUS' },
        '13-19': { unimed: 'CRISTINA', hro: 'MATHEUS', ret1: 'GUILHERME DIDOMENICO', ret2: 'JOAO HENRIQUE' },
        '19-07': { unimed: 'JOAO HENRIQUE', hro: 'GUILHERME DIDOMENICO', ret1: 'MATHEUS', ret2: 'CRISTINA' },
      },
      listas: {
        matutino: [
          { n: 5, nome: 'GABRIELA' }, { n: 6, nome: 'ERLEI' }, { n: 7, nome: 'MARILIO' }, { n: 8, nome: 'RAFAEL' },
          { n: 9, nome: 'ROBERTA' }, { n: 10, nome: 'STAUB' }, { n: 11, nome: 'GABRIEL' }, { n: 12, nome: 'VICENTE' },
        ],
        vespertino: [
          { n: 6, nome: 'ERLEI' }, { n: 5, nome: 'GABRIELA' }, { n: 9, nome: 'ROBERTA' },
          { n: 10, nome: 'STAUB' }, { n: 11, nome: 'GABRIEL' },
        ],
      },
      ordemLiberacaoDoc: {
        matutino: ['P4', 'P3', 'P12', 'P09', 'P10', 'P11', 'P6', 'P5', 'P8', 'P7', 'P2', 'P1'],
        vespertino: ['P11', 'P10', 'P9', 'P5', 'P6', 'P4', 'P3'],
      },
    },
    {
      data: '2026-08-16',
      grade: {
        '7-13': { unimed: 'CRISTINA', hro: 'MATHEUS', ret1: 'JOAO HENRIQUE', ret2: 'GUILHERME DIDOMENICO' },
        '13-19': { unimed: 'GUILHERME DIDOMENICO', hro: 'JOAO HENRIQUE', ret1: 'MATHEUS', ret2: 'CRISTINA' },
        '19-07': { unimed: 'JOAO RICARDO', hro: 'MATHEUS', ret1: 'GUILHERME DIDOMENICO', ret2: 'JOAO HENRIQUE' },
      },
      listas: {
        matutino: [{ n: 8, nome: 'RAFAEL' }, { n: 7, nome: 'THAYNA' }, { n: 11, nome: 'GABRIEL' }],
        vespertino: [{ n: 7, nome: 'THAYNA' }, { n: 8, nome: 'RAFAEL' }, { n: 11, nome: 'GABRIEL' }],
      },
      ordemLiberacaoDoc: { matutino: [], vespertino: [] },
    },
  ],
  ignorados: ['PLANTÃO MATERNO: 15/08 – RENATA', 'PLANTÃO MATERNO: 16/08 – ELISETE'],
}

const RODAPE_SAB_MAT = [
  'GUILHERME DIDOMENICO', 'JOAO HENRIQUE', 'MARILIO', 'RAFAEL', 'GABRIELA', 'ERLEI',
  'GABRIEL', 'STAUB', 'ROBERTA', 'VICENTE', 'CRISTINA', 'MATHEUS',
]

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-08-14T15:00:00-03:00'))
})
afterAll(() => vi.useRealTimers())
beforeEach(() => { salvarEscalaTurno.mockClear(); svcMock.parseEscalaImagem.mockReset() })

async function anexarDocumento() {
  svcMock.parseEscalaImagem.mockResolvedValueOnce(RESPOSTA_FDS)
  const utils = render(<ImportarEscalaFdsPage data="2026-08-15" onClose={vi.fn()} />, { wrapper: wrap })
  expect(screen.getByTestId('fds-desktop')).toBeInTheDocument()
  const input = utils.container.querySelector('input[type="file"]:not([multiple])')
  fireEvent.change(input, { target: { files: [new File(['x'], 'fds.png', { type: 'image/png' })] } })
  await screen.findByText(/Fila única · Sábado manhã/)
  return utils
}

describe('fim de semana no desktop', () => {
  it('o documento vira a fila do turno aberto, na direção do documento', async () => {
    await anexarDocumento()
    const linhas = screen.getAllByTestId('fds-fila-pessoa')
    // 1º do documento na manhã de sábado é o P4 (MATHEUS na grade dos plantões)
    expect(linhas[0].textContent).toMatch(/P4/)
    expect(linhas[0].textContent).toMatch(/MATHEUS/)
    expect(linhas).toHaveLength(RESPOSTA_FDS.dias[0].ordemLiberacaoDoc.matutino.length)
  })

  it('publicar pela prévia manda o mesmo rodapé do celular — e nada antes dos 10 s', async () => {
    await anexarDocumento()
    fireEvent.click(screen.getAllByRole('button', { name: /Prévia e publicar/ })[0])
    const dialogo = await screen.findByRole('dialog', { name: /Prévia da publicação do fim de semana/ })
    fireEvent.click(within(dialogo).getByRole('button', { name: /Publicar fim de semana/ }))
    expect(salvarEscalaTurno).not.toHaveBeenCalled()
    for (let i = 0; i < 11; i += 1) await act(async () => { vi.advanceTimersByTime(1000) })
    await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalled())
    const sabMat = salvarEscalaTurno.mock.calls.map((c) => c[0]).find((p) => p.data === '2026-08-15' && p.turno === 'matutino')
    expect(sabMat.ordemLiberacao).toEqual(RODAPE_SAB_MAT)
  })
})
