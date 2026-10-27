/**
 * TROCA NUMA POSIÇÃO JÁ LIBERADA (dono 23/10/2026, modelo A de `.tmp/troca-posicao-ja-liberada.html`).
 *
 * HRO da manhã de 23/10: o Klisman assumiu a 12ª posição (a do Rodnei) às 09:02 e foi
 * liberado nela às 10:46. Às 10:53, na tela da Unimed, a troca Cristina ⇄ Rodnei mostrou
 * o cartão do HRO como "Posição de Rodnei · Rodnei fica / Cristina assume" — sem dizer que
 * a posição estava com outra pessoa, já liberada — e gravou "Cristina assume" por cima.
 * O cartão agora diz quem ocupa e se já saiu, a opção "fica" nomeia quem está lá, e a
 * frase do resultado aparece antes de qualquer botão e de novo no pop-up.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import TrocaSheet from '@/pages/escala-cirurgica/TrocaSheet'
import { planoExecucaoTroca } from '@/pages/escala-cirurgica/utils'

const ROSTER = [
  { uid: 'u-cristina', nome: 'CRISTINA BERTOL BARBOSA MARCON', apelidos: ['CRISTINA'] },
  { uid: 'u-rodnei', nome: 'RODNEI CABRAL LIMA', apelidos: ['RODNEI'] },
  { uid: 'u-klisman', nome: 'KLISMAN DRESCHER HILLESHEIN', apelidos: ['KLISMAN'] },
  { uid: 'u-gabriela', nome: 'GABRIELA CITRON VEDANA', apelidos: ['GABRIELA'] },
]
const APELIDO_UID = Object.fromEntries(ROSTER.flatMap((r) => r.apelidos.map((a) => [a, r.uid])))
const resolver = (n) => APELIDO_UID[String(n || '').trim().toUpperCase()] || null

const { executarSubstituicao, marcarTroca } = vi.hoisted(() => ({
  executarSubstituicao: vi.fn(async () => {}),
  marcarTroca: vi.fn(async () => {}),
}))

// rodapé do HRO da manhã de 23/10 (Rodnei é o 12º)
const HRO = ['THAYNA', 'GUILHERME DIDOMENICO', 'OSCAR', 'NATHALIA', 'PELISSARO', 'DANIELA', 'KARINE', 'ROMULO', 'PAULO', 'CURY', 'RAQUEL', 'RODNEI', 'GARIM', 'DIEGO', 'MARILIO', 'LEONARDO']
const assumida = (uid, nome, deUid, em) => ({ assumidaPor: { uid, nome, de: { uid: deUid }, tipo: 'posicoes', casoIds: [], em }, em })
const escalaHro = {
  id: 'esc-hro', hospital: 'hro',
  ordemLiberacao: { matutino: HRO },
  linhaOverrides: {
    'matutino:u-rodnei': assumida('u-klisman', 'KLISMAN DRESCHER HILLESHEIN', 'u-rodnei', '2026-10-23T12:02:07.041Z'),
    'matutino:u-klisman': assumida('u-rodnei', 'RODNEI CABRAL LIMA', 'u-klisman', '2026-10-23T12:02:07.041Z'),
  },
  liberacoes: { 'matutino:u-rodnei': { liberadoEm: '2026-10-23T13:46:40.734Z', por: 'u-thayna' } },
  casos: [],
}
const escalaUnimed = {
  id: 'esc-uni', hospital: 'unimed',
  ordemLiberacao: { matutino: ['GABRIELA', 'CRISTINA'] },
  linhaOverrides: {}, liberacoes: {}, casos: [],
}
const escalasMock = { unimed: escalaUnimed, hro: escalaHro, materno: null }

vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgica: () => ({ escalas: escalasMock }),
  useEscalaCirurgicaActions: () => ({ marcarTroca, executarSubstituicao }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ user: { uid: 'u-gabriela', displayName: 'Gabriela' } }) }))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: ROSTER, rosterByUid: new Map(ROSTER.map((r) => [r.uid, r])),
    options: ROSTER.map((r) => ({ value: r.uid, label: r.nome })), resolver, loading: false,
  }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>
const LINHA_CRISTINA = { chave: 'u-cristina', uid: 'u-cristina', anestesista: 'Cristina Marcon', nomeOriginal: 'CRISTINA' }
const abrir = (props = {}) => render(
  <TrocaSheet linha={LINHA_CRISTINA} escala={escalaUnimed} turno="matutino" onClose={vi.fn()} {...props} />,
  { wrapper: wrap },
)
const opcao = async (rx) => {
  fireEvent.click(await screen.findByRole('button', { name: rx }))
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
}
const RODNEI = /^Rodnei Cabral Lima/
beforeEach(() => vi.clearAllMocks())

describe('o plano da troca enxerga a posição como ela está', () => {
  it('posição do Rodnei no HRO: ocupada pelo Klisman e já liberada', () => {
    const a = { uid: 'u-cristina', nome: 'CRISTINA BERTOL BARBOSA MARCON', apelido: 'CRISTINA' }
    const b = { uid: 'u-rodnei', nome: 'RODNEI CABRAL LIMA', apelido: 'RODNEI' }
    const { lados } = planoExecucaoTroca({ escalas: escalasMock, resolverUid: resolver, a, b, turno: 'matutino', escalaAncora: 'esc-uni' })
    const hro = lados.find((l) => l.hospital === 'hro')
    expect(hro).toMatchObject({
      chaveSlot: 'u-rodnei', posicao: 12, liberadoEm: '2026-10-23T13:46:40.734Z',
      ocupadoPor: { uid: 'u-klisman', nome: 'KLISMAN DRESCHER HILLESHEIN' },
    })
    // o lado da Unimed não tem nada disso
    const uni = lados.find((l) => l.hospital === 'unimed')
    expect(uni.ocupadoPor).toBeUndefined()
    expect(uni.liberadoEm).toBeUndefined()
  })
})

// ⚠️ MUDOU DE LADO (dono 27/10, troca em três passos). O cartão "fica/assume" de cada
// posição saiu: a troca agora pergunta o que aconteceu. O que o modelo A de 23/10
// protegia continua protegido, por dois caminhos: (1) quem teve a posição assumida por
// outra pessoa conta como SEM escala no turno — o Rodnei não é oferecido para "trocou
// de lugar", então o Klisman não sai da vaga por engano; (2) quando a vaga ocupada entra
// mesmo na troca (reabertura de um registro), a prévia diz quem está lá e que já saiu.
describe('posição ocupada e já liberada na troca em três passos', () => {
  it('Rodnei, com a vaga do HRO ocupada pelo Klisman, conta como sem escala', async () => {
    abrir()
    await opcao(/trocou de lugar com um colega/)
    expect(screen.getByRole('button', { name: RODNEI })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    await opcao(/Um colega entra no lugar/)
    expect(screen.getByRole('button', { name: RODNEI })).not.toBeDisabled()
  })

  it('"entra no lugar": só a Unimed muda, e o HRO do Klisman fica fora da prévia e da gravação', async () => {
    abrir()
    await opcao(/Um colega entra no lugar/)
    fireEvent.click(screen.getByRole('button', { name: RODNEI }))
    fireEvent.click(screen.getByRole('button', { name: 'Ver como fica' }))
    await screen.findByText('Como a fila fica')
    expect(document.querySelector('[data-fila-previa="hro"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /entra no lugar de Cristina/ }))
    await vi.waitFor(() => expect(executarSubstituicao).toHaveBeenCalledTimes(1))
    expect(executarSubstituicao.mock.calls[0][0].lados.map((l) => l.hospital)).toEqual(['unimed'])
  })

  it('se a vaga ocupada entra na troca, a prévia diz quem está lá e que já saiu', async () => {
    abrir({ colegaInicial: 'u-rodnei', modo: 'posicao' })
    await screen.findByText('Como a fila fica')
    expect(document.querySelector('[data-fila-previa="hro"]').textContent).toMatch(/12ºCristina \S+sai Klisman/)
    expect(screen.getByText(/Klisman \S+ já saiu desta posição \(com Klisman \S+ desde 09:02 · saiu às 10:46\)\. Cristina \S+ recebe a 12ª posição já liberada e Klisman \S+ continua com a liberação/)).toBeTruthy()
    expect(executarSubstituicao).not.toHaveBeenCalled()
  })
})
