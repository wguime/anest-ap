/**
 * Miudezas da conferência (item L9 da auditoria de 02/09).
 *
 * São quatro coisas pequenas com dono claro, e todas falham no aparelho da
 * secretária, não no notebook:
 *
 * - O campo de HORA abre o teclado alfabético no iPhone. Digitar "07:30" num
 *   teclado de letras é lento e erra; e hora inválida BLOQUEIA a publicação
 *   (`validarHorarioImportacao`), então o custo do erro não é cosmético.
 * - O campo de INICIAIS abre em minúscula e não tem teto. O CHECK do banco
 *   recusa mais de 12 caracteres — foi um valor fora de forma nessa coluna que
 *   derrubou a publicação da Unimed inteira em 02/09.
 * - O selo de "tudo respondido" era o caractere ✓, que não obedece
 *   `currentColor` nem o traço do design system.
 * - Os chips do placar têm 34px de altura visual e a diretriz de toque é 44px.
 *   A área de toque é esticada por pseudo-elemento em vez de o chip crescer:
 *   crescer empurraria a lista para baixo numa barra sticky, e quantos itens
 *   cabem sem rolar é justamente o que o dono mede.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import ImportarEscalaPage from '@/pages/escala-cirurgica/ImportarEscalaPage'
import { INICIAIS_MAX } from '@/lib/escalaCirurgicaPaciente'

const { svcMock, prepararImagem } = vi.hoisted(() => ({
  svcMock: {
    parseEscalaImagem: vi.fn(),
    fetchEscala: vi.fn(async () => null),
    updateAnestesistaCasos: vi.fn(async () => {}),
  },
  prepararImagem: vi.fn(async () => ({
    base64: 'AAAA', mimeType: 'image/jpeg', bytes: 3, largura: 1280, altura: 815, reduzida: true,
  })),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseCirurgiasParticularesService', () => ({
  default: { reservarAvisoTempo: vi.fn(async () => false), completarPacienteDoCaso: vi.fn(async () => {}) },
}))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({ salvarEscala: vi.fn(async () => ({ id: 'e1' })) }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u-sec', role: 'secretaria', displayName: 'Secretária' } }),
}))
vi.mock('@/lib/imagemVision', () => ({ prepararImagemParaVision: prepararImagem }))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: [], aliases: [], loading: false, rosterByUid: new Map(), options: [],
    resolver: () => null, vocabulario: [],
    refresh: vi.fn(), upsertAlias: vi.fn(), removeAlias: vi.fn(),
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const CASOS = [
  { sala: 'Sala 1', hora: '07:30', pacienteIniciais: 'M.S.', procedimento: 'COLECISTECTOMIA', cirurgiao: 'Dr. A', anestesista: 'ANA', bloco: 'normal', ordem: 0 },
  { sala: 'Sala 1', hora: '09:00', pacienteIniciais: 'J.P.', procedimento: 'HERNIA', cirurgiao: 'Dr. B', anestesista: 'ANA', bloco: 'normal', ordem: 1 },
]

async function abrirConferencia() {
  svcMock.parseEscalaImagem.mockResolvedValueOnce({
    casos: CASOS, ordemLiberacao: ['ANA', 'BETO'], ajudaExterna: [],
  })
  const { container } = render(
    <ImportarEscalaPage hospital="hro" data="2026-07-28" onClose={vi.fn()} />, { wrapper: wrap },
  )
  const input = container.querySelector('input[type="file"]')
  fireEvent.change(input, { target: { files: [new File(['x'], 'e.png', { type: 'image/png' })] } })
  await waitFor(() => expect(svcMock.parseEscalaImagem).toHaveBeenCalled())
  return container
}

/** Abre todos os blocos: os campos do caso só existem com o bloco expandido. */
async function abrirBlocos(container) {
  const cabecalhos = [...container.querySelectorAll('button[aria-expanded="false"]')]
    .filter((b) => !b.closest('li') && /\d+ caso/.test(b.textContent))
  for (const b of cabecalhos) fireEvent.click(b)
  await waitFor(() => expect(container.querySelector('input[placeholder="Hora"]')).toBeTruthy())
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-07-28T10:00:00-03:00'))
})
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

describe('campos do caso no aparelho da secretária (L9)', () => {
  it('o campo de HORA pede teclado numérico', async () => {
    const container = await abrirConferencia()
    await abrirBlocos(container)
    const hora = container.querySelector('input[placeholder="Hora"]')
    expect(hora).toBeTruthy()
    expect(hora.getAttribute('inputmode')).toBe('numeric')
  })

  it('o campo de INICIAIS abre em maiúscula e respeita o teto do CHECK do banco', async () => {
    const container = await abrirConferencia()
    await abrirBlocos(container)
    const iniciais = container.querySelector('input[placeholder="Paciente (iniciais)"]')
    expect(iniciais).toBeTruthy()
    expect(iniciais.getAttribute('autocapitalize')).toBe('characters')
    // 12 é o limite do CHECK `paciente_iniciais` — o mesmo que derrubou a
    // publicação da Unimed em 02/09
    expect(Number(iniciais.getAttribute('maxlength'))).toBe(INICIAIS_MAX)
    expect(iniciais.getAttribute('spellcheck')).toBe('false')
  })

  it('o teto de 12 não corta iniciais legítimas — as maiores do corpus cabem', () => {
    // "A.B.C.D." tem 8 e "M.C.G.S." tem 8; o teto só barra o que já é nome
    for (const v of ['M.S.', 'M.C.S.', 'A.B.C.D.']) expect(v.length).toBeLessThanOrEqual(INICIAIS_MAX)
    // a redução no blur em si tem trava própria em escalaCirurgicaPaciente.test.js
  })
})

describe('placar da conferência (L9)', () => {
  it('não usa caractere de marca de seleção — o selo é ícone do design system', async () => {
    const container = await abrirConferencia()
    const barra = container.querySelector('nav')
    expect(barra).toBeTruthy()
    expect(barra.textContent).not.toContain('✓')
    expect(barra.textContent).not.toContain('⛔')
  })

  it('os chips têm área de toque estendida sem crescer a barra sticky', async () => {
    const container = await abrirConferencia()
    const chip = [...container.querySelectorAll('nav button')]
      .find((b) => /Ordem e decisões/.test(b.textContent))
    expect(chip).toBeTruthy()
    // a altura VISUAL não muda (a barra sticky não pode comer a lista)…
    expect(chip.className).toContain('min-h-[34px]')
    // …e a área de toque cresce por pseudo-elemento: 34 + 5 + 5 = 44px
    expect(chip.className).toContain("after:-inset-y-[5px]")
    expect(chip.className).toContain('relative')
  })
})
