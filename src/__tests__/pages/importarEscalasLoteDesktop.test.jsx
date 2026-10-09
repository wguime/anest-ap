/**
 * O LOTE NO DESKTOP (dono 09/10/2026, modelos C + P): recado do WhatsApp entra APLICADO e a
 * publicação passa pela prévia com 10 s para desfazer.
 *
 * Pelo caminho real: anexar → colar o recado (o formato do WhatsApp Desktop) → prévia →
 * publicar. O que trava:
 *  - "Consultório 13h30 … @X" vira a nota (CONSULT) na posição de X no rodapé publicado;
 *  - "@Y na equipe do HRO no período vespertino" vira `naEquipe` 19:00 na linha de Y;
 *  - "Desfazer" no recado tira a marca;
 *  - nada é gravado durante a contagem, e "Desfazer" nela cancela a publicação.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import ImportarEscalasPage from '@/pages/escala-cirurgica/ImportarEscalasPage'

const { svcMock, salvarEscalaTurno } = vi.hoisted(() => ({
  svcMock: { parseEscalaImagem: vi.fn(), fetchEscala: vi.fn(async () => null), patchLinhaOverride: vi.fn(async () => {}), lerRecadoImagem: vi.fn() },
  salvarEscalaTurno: vi.fn(async (p) => ({ id: `e-${p.hospital}`, ...p, linhaOverrides: {}, casos: (p.casos || []).map((c, i) => ({ ...c, id: `c${i}`, ordem: i })) })),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseCirurgiasParticularesService', () => ({
  default: { reservarAvisoTempo: vi.fn(async () => false), completarPacienteDoCaso: vi.fn(async () => {}) },
}))
vi.mock('@/services/pegaPlantaoApi', () => ({ getFeriasDoAno: vi.fn(async () => []) }))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ salvarEscalaTurno, executarSubstituicao: vi.fn() }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u-sec', role: 'secretaria', displayName: 'Secretária' } }),
}))
vi.mock('@/lib/imagemVision', () => ({ prepararImagemParaVision: vi.fn(async () => ({ base64: 'AAAA', mimeType: 'image/png', bytes: 3 })) }))
vi.mock('@/design-system/hooks', async (orig) => ({ ...(await orig()), useMediaQuery: () => true }))
const ROSTER = [
  { uid: 'u-raul', nome: 'RAUL PERIZZOLO', apelidos: ['RAUL'] },
  { uid: 'u-mat', nome: 'MATHEUS CUNHA', apelidos: ['MATHEUS'] },
  { uid: 'u-gx', nome: 'GUILHERME XAVIER', apelidos: ['GUILHERME XAVIER'] },
]
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: ROSTER, aliases: [], loading: false,
    rosterByUid: new Map(ROSTER.map((r) => [r.uid, r])),
    options: ROSTER.map((r) => ({ value: r.uid, label: r.nome })),
    resolver: (nome) => ROSTER.find((r) => r.apelidos.includes(String(nome || '').trim().toUpperCase()))?.uid || null,
    vocabulario: [], refresh: vi.fn(), upsertAlias: vi.fn(async () => {}), removeAlias: vi.fn(),
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>
const c = (sala, hora, anestesista) => ({ sala, hora, anestesista, procedimento: `CIRURGIA ${sala}`, cirurgiao: 'Dr X', pacienteIniciais: '', bloco: 'normal' })
const HRO = {
  hospitalDetectado: 'hro',
  casos: [c('Imagem', '13:30', 'RAUL'), c('Sala 4', '13:00', 'GUILHERME XAVIER')],
  ordemLiberacao: ['RAUL', 'MATHEUS', 'GUILHERME XAVIER'],
  ajudaExterna: [],
}
const RECADO = `[09/10/2026, 11:26:03] Escalas Anest: Consultório 13h30 - 03 consultas: @Matheus Cunha
[09/10/2026, 11:26:22] Escalas Anest: @Guilherme Xavier na equipe do HRO no período vespertino`

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-10-09T14:00:00-03:00'))
})
afterAll(() => vi.useRealTimers())
beforeEach(() => {
  salvarEscalaTurno.mockClear()
  svcMock.parseEscalaImagem.mockReset()
  svcMock.parseEscalaImagem.mockResolvedValue(HRO)
})

async function montarComHro() {
  const { container } = render(<ImportarEscalasPage hospital="hro" data="2026-10-09" turno="vespertino" onClose={vi.fn()} />, { wrapper: wrap })
  expect(screen.getByTestId('lote-desktop')).toBeInTheDocument()
  const input = container.querySelector('input[type="file"][multiple]')
  fireEvent.change(input, { target: { files: [new File(['x'], 'hro.png', { type: 'image/png' })] } })
  await waitFor(() => expect(screen.getByTestId('conferencia-desktop')).toBeInTheDocument())
  return container
}
function colar(texto) {
  const evento = new Event('paste', { bubbles: true, cancelable: true })
  evento.clipboardData = { files: [], getData: (t) => (t === 'text/plain' ? texto : '') }
  act(() => { document.dispatchEvent(evento) })
}
async function publicarPelaPrevia() {
  fireEvent.click(screen.getAllByRole('button', { name: /Prévia e publicar/ })[0])
  const dialogo = await screen.findByRole('dialog', { name: /Prévia da publicação/ })
  fireEvent.click(within(dialogo).getByRole('button', { name: /^Publicar HRO/ }))
  return dialogo
}

describe('lote no desktop — recado aplicado e publicação com desfazer', () => {
  it('o recado colado vira Consultório e Equipe até 19h na publicação', async () => {
    await montarComHro()
    colar(RECADO)
    await waitFor(() => expect(document.querySelector('[data-pos="1"]').textContent).toMatch(/Consultório/))
    await waitFor(() => expect(document.querySelector('[data-pos="2"]').textContent).toMatch(/Equipe até 19h/))

    await publicarPelaPrevia()
    // durante a contagem NADA vai ao banco
    expect(salvarEscalaTurno).not.toHaveBeenCalled()
    // a contagem anda de segundo em segundo (um timer por tique)
    for (let i = 0; i < 11; i += 1) await act(async () => { vi.advanceTimersByTime(1000) })
    await waitFor(() => expect(salvarEscalaTurno).toHaveBeenCalledTimes(1))
    const payload = salvarEscalaTurno.mock.calls[0][0]
    expect(payload.ordemLiberacao).toEqual(['RAUL', 'MATHEUS (CONSULT)', 'GUILHERME XAVIER'])
    expect(payload.linhaOverrides['u-gx']).toMatchObject({ naEquipe: { ate: '19:00' } })
  })

  it('"Desfazer" no recado tira a marca', async () => {
    await montarComHro()
    colar(RECADO)
    await waitFor(() => expect(document.querySelector('[data-pos="1"]').textContent).toMatch(/Consultório/))
    fireEvent.click(screen.getAllByRole('button', { name: 'Desfazer' })[0])
    await waitFor(() => expect(document.querySelector('[data-pos="1"]').textContent).not.toMatch(/Consultório/))
  })

  it('"Desfazer" na contagem cancela a publicação', async () => {
    await montarComHro()
    const dialogo = await publicarPelaPrevia()
    fireEvent.click(within(dialogo).getByRole('button', { name: /Desfazer/ }))
    for (let i = 0; i < 12; i += 1) await act(async () => { vi.advanceTimersByTime(1000) })
    expect(salvarEscalaTurno).not.toHaveBeenCalled()
  })
})
