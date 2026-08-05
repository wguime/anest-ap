/**
 * ExtratoFeriasPage — ordem do pipeline de dados.
 *
 * A página encadeia: extratoBase → últimos a marcar → penalidades da 7ª vaga
 * → extrato (com penalidades) → violações. Em 04/08/2026 as regras eram
 * avaliadas sobre `extratoBase`, ANTES das penalidades, e quem estourava a
 * cota só por causa da 7ª vaga não gerava alerta nenhum. Ao reordenar os
 * memos surgiu o risco oposto — usar `extrato` antes de declará-lo derruba a
 * página inteira com "Cannot access before initialization" (já aconteceu uma
 * vez nesta feature).
 *
 * Este teste renderiza a página de verdade com os serviços mockados: cobre a
 * ordem dos hooks e o TDZ, que teste de lib nenhum pega.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const DIAS = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']

vi.mock('@/services/pegaPlantaoApi', () => ({
  getFeriasDoAno: vi.fn(async () => DIAS.map((data, i) => ({
    CodigoPlantao: 100 + i, Setor: 'Férias', Inicio: `${data}T08:00:00`,
    Fim: `${data}T18:00:00`, ProfDePlantao: 'G. MELO', DataCriacao: '2026-01-10T09:00:00',
  }))),
  invalidarFeriasDoAno: vi.fn(),
}))
vi.mock('@/services/supabaseFeriasViolacoesService', () => ({
  fetchViolacoesVistas: vi.fn(async () => []),
  registrarViolacoesVistas: vi.fn(async () => {}),
  diffViolacoesNovas: vi.fn(() => []),
}))
vi.mock('@/services/supabaseFeriasMovimentacoesService', () => ({
  fetchMovimentacoes: vi.fn(async () => []),
  registrarMovimentacoes: vi.fn(async () => {}),
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'uid-1', email: 'wguime@yahoo.com.br', nome: 'Guilherme Melo' } }),
}))
vi.mock('@/contexts/MessagesContext', () => ({
  useMessages: () => ({ createSystemNotification: vi.fn(async () => {}) }),
}))
vi.mock('@/contexts/UsersManagementContext', () => ({
  useUsersManagement: () => ({ usersList: [] }),
}))
vi.mock('@/hooks/usePdfExport', () => ({
  usePdfExport: () => ({ exportPdf: vi.fn(), exporting: false }),
}))
// Abas pesadas fora do caminho deste teste
vi.mock('@/pages/ferias/MapaFeriasView', () => ({ default: () => <div /> }))
vi.mock('@/pages/ferias/MarcarFeriasView', () => ({ default: () => <div /> }))

import { ThemeProvider, ToastProvider } from '@/design-system'
import ExtratoFeriasPage from '@/pages/ferias/ExtratoFeriasPage'

const wrap = ({ children }) => (
  <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>
)

describe('ExtratoFeriasPage — pipeline', () => {
  beforeEach(() => vi.clearAllMocks())

  it('monta sem erro de inicialização e chega a exibir o extrato', async () => {
    const erros = []
    const spy = vi.spyOn(console, 'error').mockImplementation((...a) => erros.push(String(a[0])))

    render(<ExtratoFeriasPage onNavigate={() => {}} />, { wrapper: wrap })

    // Se `violacoes` referenciasse `extrato` antes da declaração, o render
    // estouraria aqui em vez de chegar ao conteúdo.
    await waitFor(() => expect(screen.getByText(/Extrato de Férias/i)).toBeInTheDocument())

    expect(erros.filter((e) => /before initialization|Rendered more hooks|order of Hooks/i.test(e))).toEqual([])
    spy.mockRestore()
  })
})
