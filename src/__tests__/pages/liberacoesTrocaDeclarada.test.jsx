/**
 * TROCA DECLARADA na aba Liberações (dono 30/07 — desenho declarar → executar).
 *
 * NÃO é a troca antiga (removida 2×): par declarado + badge nos DOIS lados +
 * execução de um toque (swap simultâneo). Estes testes travam:
 *  1. o badge "Troca" aparece nos dois lados do par (inclusive o lado que só
 *     existe aqui como ajuda — o cruzamento entre hospitais usa o mesmo matching);
 *  2. declarar/executar/desfazer saem do painel ✏️ com os callbacks certos —
 *     e NADA escreve ordem de liberação nem troca dono de caso por fora;
 *  3. slot ASSUMIDO: quem assumiu aparece na posição do colega (sem linha extra),
 *     com a nota "Assumiu a posição de", e o aviso de liberar na ordem nomeia
 *     quem ASSUMIU, não o nome do rodapé.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'

const ROSTER = [
  { uid: 'uid-leo', nome: 'LEONARDO FERRAZZO', apelidos: ['LEONARDO'] },
  { uid: 'uid-mar', nome: 'MARILIO JOSE FLACH', apelidos: ['MARILIO'] },
  { uid: 'uid-kar', nome: 'KARINE BEDIN', apelidos: ['KARINE'] },
  { uid: 'uid-cury', nome: 'MARCOS TADEU CURY', apelidos: ['CURY'] },
  { uid: 'uid-paulo', nome: 'PAULO TONINI', apelidos: ['PAULO'] },
]
const APELIDO_UID = Object.fromEntries(ROSTER.flatMap((r) => r.apelidos.map((a) => [a, r.uid])))

vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: ROSTER,
    rosterByUid: new Map(ROSTER.map((r) => [r.uid, r])),
    options: ROSTER.map((r) => ({ value: r.uid, label: r.nome })),
    aliases: [], loading: false,
    resolver: (nome) => APELIDO_UID[String(nome || '').trim().toUpperCase()] || null,
    upsertAlias: vi.fn(), refresh: vi.fn(), removeAlias: vi.fn(),
  }),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({
  default: { fetchLocaisHospital: vi.fn(async () => []) },
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const caso = (sala, ordem, anestesista, cirurgiao, hora, extra = {}) => ({
  id: `${sala}-${ordem}`, sala, ordem, hora, anestesista, cirurgiao,
  bloco: 'normal', isContinuacao: false, semAnestesista: false, ...extra,
})

const escalaBase = {
  id: 'e1', hospital: 'hro', data: '2026-07-29',
  ordemLiberacao: { matutino: ['LEONARDO', 'MARILIO', 'KARINE'] },
  ajudaExterna: { matutino: [] },
  liberacoes: {}, linhaOverrides: {},
  casos: [
    caso('Sala 1', 0, 'LEONARDO', 'Liana W', '07:30'),
    caso('Sala 2', 0, 'MARILIO', 'Taciana A', '07:30'),
    caso('Sala 3', 0, 'KARINE', 'Farret G', '07:30'),
  ],
}

// par declarado na linha do Marilio (aqui) com o Cury (Unimed)
const PAR = {
  hospital: 'hro', hospitalLabel: 'HRO', escalaId: 'e1', chave: 'uid-mar',
  a: { uid: 'uid-mar', nome: 'MARILIO JOSE FLACH', apelido: 'MARILIO' },
  b: { uid: 'uid-cury', nome: 'MARCOS TADEU CURY', apelido: 'CURY' },
  aHospitalLabel: 'HRO', bHospitalLabel: 'Unimed',
}

const abrirEditor = (nome) => fireEvent.click(screen.getByLabelText(`Editar local/cirurgião de ${nome}`))

const montar = (props = {}, escala = escalaBase) => render(
  <LiberacoesView escala={escala} hospital="hro" hospitalLabel="HRO" turno="matutino"
    canEdit onToggle={() => {}} onSetOverride={() => {}} {...props} />,
  { wrapper: wrap }
)

// Relógio congelado (bomba conhecida: fixture de turno + relógio real = quebra
// às 23h/na tarde). 10h = fase diurna, matutino.
beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-07-29T10:00:00-03:00'))
})
afterAll(() => vi.useRealTimers())

beforeEach(() => vi.clearAllMocks())

describe('Badge "Troca" nos dois lados do par', () => {
  it('o lado declarado carrega o badge e diz com quem e onde', () => {
    montar({ paresTroca: [PAR] })
    const card = document.querySelector('[data-linha="uid-mar"]')
    expect(within(card).getByText('Troca')).toBeTruthy()
    expect(within(card).getByText(/Trocado com Marcos Cury \(Unimed\)/)).toBeTruthy()
  })

  it('o OUTRO lado do par também carrega o badge quando aparece nesta lista', () => {
    // Cury entra aqui como ajuda — o matching é o mesmo do cruzamento entre hospitais
    const escala = {
      ...escalaBase,
      ajudaExterna: { matutino: ['CURY'] },
      casos: [...escalaBase.casos, caso('IOSC', 0, 'CURY', 'Tirapelle', '07:30')],
    }
    montar({ paresTroca: [PAR] }, escala)
    const cardCury = document.querySelector('[data-linha="uid-cury"]')
    expect(within(cardCury).getByText('Troca')).toBeTruthy()
    expect(within(cardCury).getByText(/Trocado com Marilio Flach \(HRO\)/)).toBeTruthy()
    // e o lado declarado segue com o dele
    expect(within(document.querySelector('[data-linha="uid-mar"]')).getByText('Troca')).toBeTruthy()
  })

  it('sem par declarado, nenhum badge Troca aparece', () => {
    montar()
    expect(screen.queryByText(/^Troca( declarada)?$/)).toBeNull()
  })

  it('par HISTÓRICO (rastro de swap executado) não vira badge nem oferece ação (defeito D1)', () => {
    // troca desfeita/consumida ressuscitava pelo histórico: badge voltava e o
    // painel oferecia "Executar troca" de novo, sem saída na UI
    montar({ paresTroca: [{ ...PAR, historica: true }] })
    expect(screen.queryByText('Troca')).toBeNull()
    fireEvent.click(screen.getByLabelText('Editar local/cirurgião de Marilio Flach'))
    expect(screen.queryByText(/Executar agora/)).toBeNull()
    expect(screen.queryByText(/Desfazer troca/)).toBeNull()
  })

  it('linha-espelho `chave#casos` não oferece troca (defeito D7 — gravaria em chave órfã)', () => {
    // republicação conflituosa: slot do Marilio assumido pela Karine, e os casos
    // do Marilio re-importados no nome dele → linha extra `uid-mar#casos`
    const escala = {
      ...escalaBase,
      linhaOverrides: { 'matutino:uid-mar': { assumidaPor: { uid: 'uid-kar', nome: 'KARINE BEDIN' } } },
    }
    montar({}, escala)
    // a linha-espelho do Marilio existe (os casos não somem em silêncio)…
    fireEvent.click(screen.getByLabelText('Editar local/cirurgião de Marilio Flach'))
    // …mas o bloco de troca fica de fora: trocaCom em `uid-mar#casos` seria órfão
    expect(screen.queryByText(/Trocar com um colega/)).toBeNull()
  })
})

// A FILA SEGUE SEMPRE A ORDEM DO RODAPÉ (dono 11/08, reforçando 27/07).
// Liberado ficava afundado no fim da lista e isso passava a impressão de que o
// rodapé tinha sido publicado fora de ordem — foi a leitura de 11/08, quando o
// João Ricardo (11º) apareceu em 13º por ter nascido liberado sem cirurgia.
describe('Ordem da fila = ordem do rodapé', () => {
  it('quem já foi liberado mantém a própria posição', () => {
    const escala = {
      ...escalaBase,
      liberacoes: { 'matutino:uid-mar': { liberadoEm: '2026-07-29T11:00:00Z' } },
    }
    montar({}, escala)
    const chaves = [...document.querySelectorAll('[data-linha]')].map((el) => el.getAttribute('data-linha'))
    expect(chaves).toEqual(['uid-leo', 'uid-mar', 'uid-kar'])
  })

  it('quem nasce liberado por estar sem cirurgia também fica na posição dele', () => {
    // Karine no rodapé sem nenhum caso: nasce liberada e continua em 3º
    const escala = {
      ...escalaBase,
      casos: [
        caso('Sala 1', 0, 'LEONARDO', 'Liana W', '07:30'),
        caso('Sala 2', 0, 'MARILIO', 'Taciana A', '07:30'),
      ],
    }
    montar({}, escala)
    const chaves = [...document.querySelectorAll('[data-linha]')].map((el) => el.getAttribute('data-linha'))
    expect(chaves).toEqual(['uid-leo', 'uid-mar', 'uid-kar'])
  })
})

describe('Painel ✏️ — declarar, executar e desfazer a troca', () => {
  it('declarar sai pelo FLUXO ÚNICO: o botão abre o TrocaSheet com a linha de origem', async () => {
    // dono 07/08 ("as trocas num só local"): a view não declara mais inline —
    // delega ao TrocaSheet, que infere o tipo e grava tipo/motivo. O fluxo
    // completo de declaração tem teste próprio (trocaSheet.test.jsx).
    const onAbrirTroca = vi.fn()
    montar({ onAbrirTroca })
    abrirEditor('Karine Bedin')
    fireEvent.click(screen.getByRole('button', { name: /^Troca com um colega/ }))
    await waitFor(() => expect(onAbrirTroca).toHaveBeenCalled())
    expect(onAbrirTroca.mock.calls[0][0].chave).toBe('uid-kar')
  })

  it('linha com troca declarada: painel oferece executar (um toque) e desfazer', async () => {
    const onExecutarTroca = vi.fn(async () => {})
    const onSetOverride = vi.fn(async () => {})
    const onReorder = vi.fn()
    const onReordenarAjuda = vi.fn()
    montar({ paresTroca: [PAR], onExecutarTroca, onSetOverride, onReorder, onReordenarAjuda })
    abrirEditor('Marilio Flach')
    fireEvent.click(screen.getByRole('button', { name: /^Troca/ }))
    fireEvent.click(screen.getByRole('button', { name: /Executar agora — Marcos Cury assume aqui/ }))
    // POP-UP ANTES DE CONCLUIR (dono 18/08): nenhum caminho executa o swap sem
    // mostrar antes o que muda na fila
    expect(screen.getByText('Trocar as posições?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar troca' }))
    await waitFor(() => expect(onExecutarTroca).toHaveBeenCalledWith(PAR))
    // executar NÃO passa por override/ordem — o plano vai pelo caminho próprio
    expect(onSetOverride).not.toHaveBeenCalled()
    expect(onReorder).not.toHaveBeenCalled()
    expect(onReordenarAjuda).not.toHaveBeenCalled()
  })

  it('desfazer a declaração chama onMarcarTroca(linha, null)', async () => {
    const onMarcarTroca = vi.fn(async () => {})
    montar({ paresTroca: [PAR], onMarcarTroca })
    abrirEditor('Marilio Flach')
    fireEvent.click(screen.getByRole('button', { name: /^Troca/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer troca' }))
    await waitFor(() => expect(onMarcarTroca).toHaveBeenCalled())
    expect(onMarcarTroca.mock.calls[0][1]).toBeNull()
  })

  it('REGISTRO (escala já publicada trocada) não oferece executar — só remover o registro', async () => {
    // dono 10/08 (Rafael⇄Garim): os dois já estão no hospital certo. "Executar"
    // aqui moveria os dois e desfaria a troca real.
    const onExecutarTroca = vi.fn(async () => {})
    const onMarcarTroca = vi.fn(async () => {})
    montar({ paresTroca: [{ ...PAR, apenasRegistro: true }], onExecutarTroca, onMarcarTroca })
    abrirEditor('Marilio Flach')
    fireEvent.click(screen.getByRole('button', { name: /^Troca/ }))
    expect(screen.queryByText(/Executar agora/)).toBeNull()
    expect(screen.getByText(/já saiu com os dois no lugar certo/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remover registro da troca' }))
    await waitFor(() => expect(onMarcarTroca).toHaveBeenCalled())
    expect(onMarcarTroca.mock.calls[0][1]).toBeNull()
    expect(onExecutarTroca).not.toHaveBeenCalled()
  })

  // ⚠️ A DECLARAÇÃO MORA EM UMA LINHA SÓ — a de quem declarou — e o badge sai
  // nos DOIS lados (dono 18/08: "ao registrar troca e após desfazer a troca ela
  // está persistindo"). Desfazer pela linha do COLEGA mandava a limpeza para a
  // chave DELE, que nunca teve trocaCom: o toast dizia "Troca desfeita" e os dois
  // cards continuavam com o badge. Quem sabe onde ela mora é o PAR.
  it('desfazer pelo lado do COLEGA mira a escala/chave de quem declarou', async () => {
    const onMarcarTroca = vi.fn(async () => {})
    // Cury entra aqui como ajuda: o badge dele vem do par declarado no Marilio
    const escala = {
      ...escalaBase,
      ajudaExterna: { matutino: ['CURY'] },
      linhaOverrides: { 'matutino:uid-mar': { trocaCom: { uid: 'uid-cury', nome: 'MARCOS TADEU CURY', apenasRegistro: true } } },
      casos: [...escalaBase.casos, caso('IOSC', 0, 'CURY', 'Tirapelle', '07:30')],
    }
    montar({ paresTroca: [{ ...PAR, apenasRegistro: true }], onMarcarTroca }, escala)
    abrirEditor('Marcos Cury')
    fireEvent.click(screen.getByRole('button', { name: /^Troca/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Remover registro da troca' }))
    await waitFor(() => expect(onMarcarTroca).toHaveBeenCalled())
    const [, colega, par] = onMarcarTroca.mock.calls[0]
    expect(colega).toBeNull()
    // o 3º argumento é o endereço da declaração — sem ele a page limparia uid-cury
    expect(par).toMatchObject({ escalaId: 'e1', chave: 'uid-mar' })
  })

  // ⚠️ REGISTRO ERA BECO SEM SAÍDA (dono 18/08: "a Daniela assumiu o plantão mas
  // ficou apenas o badge de troca"): com a troca registrada, o painel ✏️ perdia a
  // entrada do TrocaSheet e sobrava só "Remover" — não havia caminho nenhum para
  // a posição mudar de dono.
  it('REGISTRO oferece "Trocar de posição na escala" (reabre o sheet no modo posição)', () => {
    const onAbrirTroca = vi.fn()
    montar({ paresTroca: [{ ...PAR, apenasRegistro: true }], onAbrirTroca })
    abrirEditor('Marilio Flach')
    fireEvent.click(screen.getByRole('button', { name: /^Troca/ }))
    fireEvent.click(screen.getByRole('button', { name: /Trocar de posição na escala/ }))
    expect(onAbrirTroca).toHaveBeenCalled()
    const [linha, colegaUid, modo] = onAbrirTroca.mock.calls[0]
    expect(linha.chave).toBe('uid-mar')
    expect(colegaUid).toBe('uid-cury') // o par já é conhecido
    expect(modo).toBe('posicao')
  })

  // ⚠️ OPÇÃO PRÓPRIA (dono 18/08): "trocas entre hospitais como já é feito
  // normalmente, quero apenas uma nova opção para trocar de posição na escala".
  // A troca de sempre continua na linha de cima, intacta.
  it('linha sem troca tem as DUAS opções — a de sempre e a de posição', () => {
    const onAbrirTroca = vi.fn()
    montar({ onAbrirTroca })
    abrirEditor('Karine Bedin')
    fireEvent.click(screen.getByRole('button', { name: /^Troca com um colega/ }))
    expect(onAbrirTroca.mock.calls[0][2]).toBeUndefined() // modo registro (o de sempre)

    abrirEditor('Karine Bedin')
    fireEvent.click(screen.getByRole('button', { name: /^Trocar de posição na escala/ }))
    expect(onAbrirTroca.mock.calls[1][2]).toBe('posicao')
    expect(onAbrirTroca.mock.calls[1][0].chave).toBe('uid-kar')
  })
})

describe('Slot assumido (troca executada)', () => {
  // pós-execução: assumidaPor no slot do Marilio; os casos dele já são do Cury
  const escalaAssumida = {
    ...escalaBase,
    linhaOverrides: { 'matutino:uid-mar': { assumidaPor: { uid: 'uid-cury', nome: 'MARCOS TADEU CURY' } } },
    casos: [
      caso('Sala 1', 0, 'LEONARDO', 'Liana W', '07:30'),
      caso('Sala 2', 0, 'CURY', 'Taciana A', '07:30', { anestesistaUserId: 'uid-cury' }),
      caso('Sala 3', 0, 'KARINE', 'Farret G', '07:30'),
    ],
  }

  it('quem assumiu ocupa a POSIÇÃO do colega — sem linha extra, com badge Troca', () => {
    montar({ paresTroca: [] }, escalaAssumida)
    const chaves = [...document.querySelectorAll('[data-linha]')].map((el) => el.getAttribute('data-linha'))
    expect(chaves).toEqual(['uid-leo', 'uid-mar', 'uid-kar']) // chave do SLOT não muda
    const slot = document.querySelector('[data-linha="uid-mar"]')
    expect(within(slot).getByText('Marcos Cury')).toBeTruthy()
    expect(within(slot).getByText(/Assumiu a posição de Marilio Flach/)).toBeTruthy()
    // badge enxuto (dono 09/08): "Troca", não "Troca executada"
    expect(within(slot).getByText('Troca')).toBeTruthy()
    expect(within(slot).getByText('Taciana A')).toBeTruthy() // os casos vieram junto
  })

  it('mantém a informação da troca mesmo depois de liberar o slot original', () => {
    const escalaLiberada = {
      ...escalaAssumida,
      liberacoes: { 'matutino:uid-mar': { liberadoEm: '2026-07-29T12:00:00Z' } },
      linhaOverrides: { 'matutino:uid-mar': { assumidaPor: { uid: 'uid-cury', nome: 'MARCOS TADEU CURY' } } },
    }
    montar({ paresTroca: [] }, escalaLiberada)
    const slot = document.querySelector('[data-linha="uid-mar"]')
    expect(within(slot).getByText('Marcos Cury')).toBeTruthy()
    expect(within(slot).getByText('Troca')).toBeTruthy()
    expect(within(slot).getByText(/Assumiu a posição de Marilio Flach/)).toBeTruthy()
  })

  it('o aviso "libere na ordem" nomeia quem ASSUMIU, não o nome do rodapé', async () => {
    // Karine (último da fila) liberada → o próximo é o slot assumido (Cury)
    montar({}, { ...escalaAssumida, liberacoes: { 'uid-kar': { liberadoEm: 'x' } } })
    fireEvent.click(screen.getByLabelText('Marcar Leonardo Ferrazzo liberado'))
    await waitFor(() => expect(screen.getByText(/Libere Marcos Cury primeiro/)).toBeTruthy())
  })

  it('painel do slot assumido oferece "Desfazer troca"', async () => {
    const onDesfazerSubstituicao = vi.fn(async () => {})
    montar({ onDesfazerSubstituicao }, escalaAssumida)
    abrirEditor('Marcos Cury')
    fireEvent.click(screen.getByRole('button', { name: /^Troca/ }))
    fireEvent.click(screen.getByRole('button', { name: /Desfazer troca/ }))
    await waitFor(() => expect(onDesfazerSubstituicao).toHaveBeenCalled())
    const linha = onDesfazerSubstituicao.mock.calls[0][0]
    expect(linha.chave).toBe('uid-mar')
    expect(linha.uid).toBe('uid-cury')
    expect(linha.assumida?.deNome).toBe('Marilio Flach')
  })
})
