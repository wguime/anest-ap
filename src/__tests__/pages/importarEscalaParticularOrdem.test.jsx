/**
 * NOME DO PARTICULAR VAI PARA O CASO CERTO (revisão 23/09).
 *
 * Depois de publicar, a tela completa o rascunho da cobrança com o nome do
 * paciente particular, casando o caso extraído com o caso salvo por `sala|ordem`.
 * O service grava `ordem: i` — o índice do caso DENTRO do turno — mas a tela
 * usava `c.ordem`, o índice que a leitura deu no lote inteiro. Quando os dois
 * divergem (Materno à tarde, linha removida na conferência), o nome ia para o
 * particular ERRADO da mesma sala: dado de paciente no caso de outro (LGPD) e
 * cobrança trocada.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import ImportarEscalaPage from '@/pages/escala-cirurgica/ImportarEscalaPage'

const { svcMock, salvarEscalaTurno, completarPacienteDoCaso, prepararImagem } = vi.hoisted(() => ({
  svcMock: {
    parseEscalaImagem: vi.fn(),
    fetchEscala: vi.fn(async () => null),
    patchLinhaOverride: vi.fn(async () => {}),
  },
  // espelha o service: a ordem salva é o índice no array do turno
  salvarEscalaTurno: vi.fn(async (p) => ({
    id: 'e-mat', ...p, casos: (p.casos || []).map((c, i) => ({ ...c, id: `c${i}`, ordem: i })),
  })),
  completarPacienteDoCaso: vi.fn(async () => {}),
  prepararImagem: vi.fn(async () => ({ base64: 'AAAA', mimeType: 'image/jpeg', bytes: 3, largura: 1600, altura: 1200, reduzida: true })),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseCirurgiasParticularesService', () => ({
  default: { reservarAvisoTempo: vi.fn(async () => false), completarPacienteDoCaso },
}))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ salvarEscalaTurno, executarSubstituicao: vi.fn() }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u-sec', role: 'secretaria', displayName: 'Secretária' } }),
}))
vi.mock('@/lib/imagemVision', () => ({ prepararImagemParaVision: prepararImagem }))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: [], aliases: [], loading: false,
    rosterByUid: new Map([['uid-dido', { uid: 'uid-dido', nome: 'GUILHERME XAVIER', apelidos: ['DIDO'] }]]),
    options: [{ value: 'uid-dido', label: 'Guilherme Xavier' }],
    resolver: (nome) => (String(nome).trim().toUpperCase() === 'DIDO' ? 'uid-dido' : null),
    refresh: vi.fn(), upsertAlias: vi.fn(async () => {}), removeAlias: vi.fn(),
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

beforeAll(() => vi.setSystemTime(new Date('2026-09-05T13:00:00Z')))
afterAll(() => vi.useRealTimers())
beforeEach(() => vi.clearAllMocks())

describe('nome do particular → cobrança', () => {
  it('casa pelo índice DO TURNO, não pela ordem que a leitura deu no lote', async () => {
    // a leitura numerou o lote inteiro: estes três casos vieram como 4, 5 e 6
    svcMock.parseEscalaImagem.mockResolvedValueOnce({
      casos: [
        { sala: 'Sala 1', hora: '08:00', procedimento: 'CESAREA', cirurgiao: 'ALBA', anestesista: 'DIDO', convenio: 'PARTICULAR', pacienteIniciais: 'A.A.', pacienteNome: 'ANA AMARAL', ordem: 4 },
        { sala: 'Sala 1', hora: '10:00', procedimento: 'CESAREA', cirurgiao: 'ALBA', anestesista: 'DIDO', convenio: 'PARTICULAR', pacienteIniciais: 'B.B.', pacienteNome: 'BIA BORGES', ordem: 5 },
        { sala: 'Sala 1', hora: '12:00', procedimento: 'CESAREA', cirurgiao: 'ALBA', anestesista: 'DIDO', convenio: 'UNIMED', pacienteIniciais: 'C.C.', ordem: 6 },
      ],
      ordemLiberacao: ['DIDO'],
      ajudaExterna: [],
    })
    const { container } = render(
      <ImportarEscalaPage hospital="materno" data="2026-09-05" turno="matutino" onClose={vi.fn()} />, { wrapper: wrap },
    )
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [new File(['x'], 'm.png', { type: 'image/png' })] },
    })
    await waitFor(() => expect(svcMock.parseEscalaImagem).toHaveBeenCalled())
    fireEvent.click(await screen.findByRole('button', { name: /Publicar/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^Publicar escala$/i }))
    await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalled())
    await waitFor(() => expect(completarPacienteDoCaso).toHaveBeenCalledTimes(2))

    const porCaso = Object.fromEntries(completarPacienteDoCaso.mock.calls.map(([id, nome]) => [id, nome]))
    // o caso salvo c0 é a Ana e o c1 é a Bia — com `c.ordem` (4, 5) nenhum casava
    // e, com a leitura começando em 1, a Ana ia para o caso da Bia
    expect(porCaso).toEqual({ c0: 'ANA AMARAL', c1: 'BIA BORGES' })
  })
})
