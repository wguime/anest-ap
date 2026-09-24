/**
 * A TELA DO FIM DE SEMANA CONFERE O QUE A SKILL CONFERE (dono 23/09: "igualar a
 * tela à skill"). A skill `publicar-fds` barrava nome de mapa que casa com duas
 * pessoas e caso inválido, e completava o nome do particular na cobrança; a tela
 * publicava sem nada disso.
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import ImportarEscalaFdsPage from '@/pages/escala-cirurgica/ImportarEscalaFdsPage'

const { svcMock, salvarEscalaTurno, prepararImagem, completarPacienteDoCaso } = vi.hoisted(() => ({
  svcMock: { parseEscalaImagem: vi.fn(), fetchEscala: vi.fn(async () => null) },
  // espelha o service: ordem salva = índice no turno; id por posição
  salvarEscalaTurno: vi.fn(async (p) => ({ id: 'e1', ...p, casos: (p.casos || []).map((c, i) => ({ ...c, id: `${p.hospital}-${p.turno}-${i}`, ordem: i, turno: p.turno, origem: 'importacao' })) })),
  completarPacienteDoCaso: vi.fn(async () => {}),
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
vi.mock('@/services/supabaseCirurgiasParticularesService', () => ({ default: { completarPacienteDoCaso, reservarAvisoTempo: vi.fn(async () => false) } }))


// dois GABRIEL no cadastro e nenhum apelido "GABRIEL" no dicionário: ambíguo
const ROSTER = [
  { uid: 'uid-romulo', nome: 'RÔMULO SANTOS ROXO', apelidos: ['ROMULO'] },
  { uid: 'uid-gabriel-c', nome: 'GABRIEL JUAN KETTENHUBER COSTA', apelidos: ['G. COSTA'] },
  { uid: 'uid-gabriel-s', nome: 'GABRIEL SOUZA LIMA', apelidos: ['G. SOUZA'] },
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

const GRADE = {
  '7-13': { unimed: 'KARINE', hro: 'CRISTINA', ret1: 'ROMULO', ret2: 'DANIELA' },
  '13-19': { unimed: 'DANIELA', hro: 'ROMULO', ret1: 'KARINE', ret2: 'CRISTINA' },
  '19-07': { unimed: 'CRISTINA', hro: 'KARINE', ret1: 'DANIELA', ret2: 'ROMULO' },
}
const diaFds = (data) => ({
  data, grade: GRADE,
  posicoes: { P1: 'KARINE', P2: 'CRISTINA', P3: 'ROMULO', P4: 'DANIELA' },
  escalacao: { matutino: ['KARINE', 'CRISTINA'], vespertino: ['DANIELA', 'ROMULO'] },
  ordemDoc: { matutino: ['P4', 'P3', 'P2', 'P1'], vespertino: ['P4', 'P3'], noturno: ['P2', 'P1'] },
})
const mapaHro = (casos) => ({
  hospitalDetectado: 'hro', dataDetectada: '2026-08-22', casos,
  ordemLiberacao: [], ajudaExterna: [], posicoesAssistenciais: [],
})

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

const abrir = async () => {
  const r = render(<ImportarEscalaFdsPage data="2026-08-22" onClose={vi.fn()} />, { wrapper: wrap })
  await screen.findByText('Fim de semana', { selector: 'h1' })
  return r
}

beforeAll(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); vi.setSystemTime(new Date('2026-08-22T10:00:00-03:00')) })
afterAll(() => { vi.useRealTimers() })
beforeEach(() => { vi.clearAllMocks(); svcMock.fetchEscala.mockResolvedValue(null) })

describe('mapas conferem o que a skill confere', () => {
  it('nome do mapa que casa com duas pessoas BARRA a publicação até escolher o login', async () => {
    const { container } = await abrir()
    await anexarGrade(container, [diaFds('2026-08-22'), diaFds('2026-08-23')])
    await anexarMapa(container, mapaHro([
      { sala: 'Sala 4', ordem: 0, hora: '07:00', turno: 'matutino', pacienteIniciais: 'C.M.', anestesista: 'GABRIEL', procedimento: 'FRATURA', cirurgiao: 'Plantão Orto', convenio: 'SUS' },
    ]), 'hro.png')
    expect(await screen.findByText(/"GABRIEL" pode ser mais de uma pessoa/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Publicar fim de semana/ })).toBeDisabled()
  })

  it('o nome do particular vai para a cobrança do caso certo', async () => {
    const { container } = await abrir()
    await anexarGrade(container, [diaFds('2026-08-22'), diaFds('2026-08-23')])
    await anexarMapa(container, mapaHro([
      { sala: 'Sala 1', ordem: 7, hora: '07:00', turno: 'matutino', pacienteIniciais: 'R.F.', pacienteNome: 'RITA FARIAS', anestesista: 'KARINE', procedimento: 'VARIZES', cirurgiao: 'Alexandre Medeiros', convenio: 'PART' },
      { sala: 'Sala 1', ordem: 8, hora: '09:00', turno: 'matutino', pacienteIniciais: 'A.Z.', anestesista: 'KARINE', procedimento: 'HERNIA', cirurgiao: 'Alexandre Medeiros', convenio: 'SUS' },
      { sala: 'Sala 1', ordem: 9, hora: '10:30', turno: 'matutino', pacienteIniciais: 'B.C.', pacienteNome: 'BEATRIZ CUNHA', anestesista: 'KARINE', procedimento: 'VARIZES', cirurgiao: 'Alexandre Medeiros', convenio: 'PARTICULAR' },
    ]), 'hro.png')
    const botao = await screen.findByRole('button', { name: /Publicar fim de semana/ })
    await waitFor(() => expect(botao).not.toBeDisabled())
    fireEvent.click(botao)
    await waitFor(() => expect(completarPacienteDoCaso).toHaveBeenCalledTimes(2))
    const porCaso = Object.fromEntries(completarPacienteDoCaso.mock.calls.map(([id, nome]) => [id, nome]))
    // a leitura numerou 7, 8, 9; o salvo é 0, 1, 2 dentro do turno
    expect(porCaso).toEqual({ 'hro-matutino-0': 'RITA FARIAS', 'hro-matutino-2': 'BEATRIZ CUNHA' })
  })
})
