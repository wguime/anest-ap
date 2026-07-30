/**
 * Painel da linha (✏️) na aba Liberações — o que sobrou depois que a TROCA saiu
 * do app (dono 29/07: "retire a funcionalidade de troca, apenas deixe um campo em
 * aberto para observação").
 *
 * Estes testes travam quatro coisas que custaram bug ou viraram decisão:
 *  1. nenhum caminho da aba altera a ORDEM DE LIBERAÇÃO ou o dono de um caso;
 *  2. a observação da linha é escrita, exibida no card e limpa;
 *  3. a Ajuda é marcável/desmarcável à mão, sem furar a ordem do array;
 *  4. o tempo de UMA cirurgia e o total da PESSOA convivem no card sem se
 *     confundirem (pesos visuais diferentes, valores independentes).
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

// rodapé de 3 nomes + 1 ajuda (fora do rodapé) + 1 extra (caso sem posição)
const escalaBase = {
  id: 'e1', hospital: 'hro', data: '2026-07-29',
  ordemLiberacao: { matutino: ['LEONARDO', 'MARILIO', 'KARINE'] },
  ajudaExterna: { matutino: ['CURY'] },
  liberacoes: {}, linhaOverrides: {},
  casos: [
    caso('Sala 1', 0, 'LEONARDO', 'Liana W', '07:30'),
    caso('Sala 2', 0, 'MARILIO', 'Taciana A', '07:30'),
    caso('Sala 3', 0, 'KARINE', 'Farret G', '07:30'),
    caso('IOSC', 0, 'CURY', 'Tirapelle', '07:30'),
    caso('Exames', 0, 'PAULO', 'Willian', '08:00'),
  ],
}

const abrirEditor = (nome) => fireEvent.click(screen.getByLabelText(`Editar local/cirurgião de ${nome}`))

const montar = (props = {}, escala = escalaBase) => render(
  <LiberacoesView escala={escala} hospital="hro" hospitalLabel="HRO" turno="matutino"
    canEdit onToggle={() => {}} onSetOverride={() => {}} {...props} />,
  { wrapper: wrap }
)

// RELÓGIO CONGELADO (achado 29/07 à noite): o fixture usa a data de HOJE e a
// LiberacoesView deriva a fase da liberação do relógio real — às 23h a lista do
// dia ZERA por regra (fase 'zerada', só os P1–P4 ficam). Sem congelar, este
// arquivo inteiro passa de dia e falha depois das 23h, com render vazio e 14
// falhas que parecem bug de código. 10h = fase diurna, que é o que estes testes
// exercitam.
beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-07-29T10:00:00-03:00'))
})
afterAll(() => vi.useRealTimers())

beforeEach(() => vi.clearAllMocks())

describe('Troca REMOVIDA — a aba não mexe mais na ordem nem no dono do caso (dono 29/07)', () => {
  it('o painel da linha não tem mais "Quem está nesta posição" nem substituir', () => {
    montar()
    abrirEditor('Marilio Flach')
    expect(screen.queryByText('Quem está nesta posição')).toBeNull()
    expect(screen.queryByRole('button', { name: /Substituir/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Confirmar troca/i })).toBeNull()
  })

  it('salvar o painel inteiro só grava o override da linha — nada de ordem/casos', async () => {
    const onSetOverride = vi.fn(async () => {})
    const onDefinirCasos = vi.fn(async () => {})
    montar({ onSetOverride, onDefinirCasos })
    abrirEditor('Marilio Flach')
    fireEvent.change(screen.getByPlaceholderText(/trocou com o Cury/), { target: { value: 'foi para o HRO' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(onSetOverride).toHaveBeenCalled())
    // o único efeito é o override da própria linha
    expect(onSetOverride.mock.calls[0][1]).toMatchObject({ observacao: 'foi para o HRO' })
    expect(onDefinirCasos).not.toHaveBeenCalled()
  })

  it('a view nem aceita mais um callback de reordenar (a prop saiu)', () => {
    // Se alguém reintroduzir a chamada, este spy passa a receber algo e o teste cai.
    const onReorder = vi.fn()
    const onSubstituir = vi.fn()
    montar({ onReorder, onSubstituir })
    abrirEditor('Marilio Flach')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(onReorder).not.toHaveBeenCalled()
    expect(onSubstituir).not.toHaveBeenCalled()
  })
})

describe('Observação da linha (dono 29/07)', () => {
  it('aparece no card da fila e avisa que não é lugar de dado de paciente', () => {
    montar({}, { ...escalaBase, linhaOverrides: { 'uid-mar': { observacao: 'trocou com o Cury no HRO' } } })
    expect(screen.getByText('trocou com o Cury no HRO')).toBeTruthy()
    abrirEditor('Marilio Flach')
    expect(screen.getByText(/Não escreva nome de paciente/)).toBeTruthy()
  })

  it('abre o painel já preenchida e limpa quando esvaziada', async () => {
    const onSetOverride = vi.fn(async () => {})
    montar({ onSetOverride }, { ...escalaBase, linhaOverrides: { 'uid-mar': { observacao: 'sai mais cedo' } } })
    abrirEditor('Marilio Flach')
    const campo = screen.getByPlaceholderText(/trocou com o Cury/)
    expect(campo.value).toBe('sai mais cedo')
    fireEvent.change(campo, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(onSetOverride).toHaveBeenCalled())
    expect(onSetOverride.mock.calls[0][1].observacao).toBe('')
  })

  // Escalas antigas ainda têm a nota `troca`. Ela vira texto de observação — é o
  // mesmo recado — em vez de sumir ou quebrar o card.
  it('nota `troca` de escala antiga é exibida como observação', () => {
    montar({}, {
      ...escalaBase,
      linhaOverrides: { 'uid-mar': { troca: { com: 'KARINE', hospital: 'unimed', em: 'x' } } },
    })
    expect(screen.getByText('Troca com Karine · Unimed')).toBeTruthy()
    expect(screen.queryByText('Troca')).toBeNull() // o BADGE saiu; sobrou o texto
  })

  it('definir o tempo da pessoa NÃO apaga a observação já salva', async () => {
    const onSetOverride = vi.fn(async () => {})
    montar({ onSetOverride }, { ...escalaBase, linhaOverrides: { 'uid-mar': { observacao: 'no consultório' } } })
    fireEvent.click(screen.getByLabelText('Definir tempo faltante de Marilio Flach'))
    // os atalhos de duração saíram (dono 29/07): o Select de tempo faltante ocupou o lugar
    fireEvent.click(screen.getAllByRole('combobox').find((c) => /Falta/i.test(c.textContent)))
    fireEvent.click(screen.getByRole('option', { name: '1h' }))
    await waitFor(() => expect(onSetOverride).toHaveBeenCalled())
    expect(onSetOverride.mock.calls[0][1].observacao).toBe('no consultório')
  })
})

describe('Ajuda marcada à mão (dono 29/07)', () => {
  it('linha comum oferece marcar; a ajuda entra no FIM do array (sai primeiro)', async () => {
    const onAddAjuda = vi.fn(async () => {})
    montar({ onAddAjuda })
    abrirEditor('Marilio Flach')
    fireEvent.click(screen.getByRole('button', { name: /Marcar como ajuda de outro hospital/ }))
    await waitFor(() => expect(onAddAjuda).toHaveBeenCalledWith('MARILIO'))
  })

  it('quem JÁ é ajuda oferece desmarcar, removendo a entrada exata do rodapé', async () => {
    const onRemoveAjuda = vi.fn(async () => {})
    montar({ onRemoveAjuda })
    abrirEditor('Marcos Cury')
    fireEvent.click(screen.getByRole('button', { name: /Não é ajuda de outro hospital/ }))
    // 'CURY' é como está escrito em ajudaExterna — não o nome exibido "Marcos Cury"
    await waitFor(() => expect(onRemoveAjuda).toHaveBeenCalledWith('CURY'))
  })
})

describe('Tempo da CIRURGIA × tempo da PESSOA no card da fila (dono 29/07)', () => {
  // 08:00 na escala; o relógio do teste é o real, então o valor exibido depende da
  // hora de execução. O que se verifica aqui é a ESTRUTURA: dois números distintos,
  // um por cirurgia (junto do cirurgião) e um da pessoa (pílula à direita).
  const comTempos = {
    ...escalaBase,
    casos: [
      caso('Sala 1', 0, 'LEONARDO', 'Liana W', '07:30', { terminoPrevisto: '23:30' }),
      caso('Sala 2', 0, 'MARILIO', 'Taciana A', '07:30'),
    ],
    linhaOverrides: { 'uid-leo': { termino: '23:45' } },
  }

  it('cirurgia AGENDADA mostra a HORA, não contagem — e o total da pessoa é outro elemento', () => {
    montar({}, comTempos)
    const cardLeo = document.querySelector('[data-linha="uid-leo"]')
    expect(cardLeo).toBeTruthy()
    // o chip nasce colado no cirurgião a que pertence
    const linhaCirurgiao = within(cardLeo).getByText('Liana W').closest('p')
    // agendada => hora prevista. Contagem regressiva é EXCLUSIVA da cirurgia em
    // andamento (pesquisa 29/07): com no máximo uma contagem por pessoa, nenhum
    // número pode ser lido como o total dela.
    expect(linhaCirurgiao.textContent).toContain('23:30')
    expect(linhaCirurgiao.textContent).not.toMatch(/~\d/)
    // e o total da pessoa é outro elemento, com seu próprio rótulo acessível
    expect(within(cardLeo).getByTitle(/toque para ajustar/)).toBeTruthy()
  })

  it('cirurgia INICIADA é a única que conta o tempo regressivo', () => {
    montar({}, {
      ...comTempos,
      casos: [
        caso('Sala 1', 0, 'LEONARDO', 'Liana W', '07:30', { terminoPrevisto: '23:30', statusCirurgia: 'iniciada' }),
        caso('Sala 2', 0, 'MARILIO', 'Taciana A', '07:30'),
      ],
    })
    const cardLeo = document.querySelector('[data-linha="uid-leo"]')
    const linhaCirurgiao = within(cardLeo).getByText('Liana W').closest('p')
    expect(linhaCirurgiao.textContent).toMatch(/~\d/)
    // e vem marcada como em andamento, que é o que autoriza a contagem
    expect(within(cardLeo).getByTitle('Cirurgia em andamento')).toBeTruthy()
  })

  it('sem término informado no caso, nenhum chip é inventado', () => {
    montar({}, comTempos)
    const cardMarilio = document.querySelector('[data-linha="uid-mar"]')
    const linhaCirurgiao = within(cardMarilio).getByText('Taciana A').closest('p')
    expect(linhaCirurgiao.textContent).toBe('Taciana A')
    // e a linha continua oferecendo informar o tempo DA PESSOA
    expect(within(cardMarilio).getByLabelText(/Definir tempo faltante/)).toBeTruthy()
  })
})

describe('Painel da linha — ponte com a aba Completa (dono 29/07)', () => {
  it('lista os casos da pessoa dentro do painel', () => {
    montar()
    abrirEditor('Marilio Flach')
    expect(screen.getByText('Casos no turno')).toBeTruthy()
    expect(screen.getByText('1 em aberto')).toBeTruthy()
    // o cirurgião dele aparece 2× (linha da fila + card do caso no painel);
    // o de outro anestesista segue só na linha dele, fora do painel
    expect(screen.getAllByText('Taciana A').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Liana W')).toHaveLength(1)
  })

  it('mostra o valor automático de local e cirurgião ao lado do ajuste', () => {
    montar()
    abrirEditor('Marilio Flach')
    expect(screen.getAllByText(/Automático \(dos casos\)/).length).toBe(2)
  })
})

/**
 * ORDEM MANUAL DENTRO DO BLOCO DE AJUDA (decisão do dono 30/07).
 *
 * O rodapé segue IMUTÁVEL: reescrevê-lo corrompeu a escala em 22/07 e as setas
 * saíram da tela para todos em 27/07. O que volta é escopado — só o subconjunto
 * AZUL se move, e a ordem é persistida no próprio array `ajuda_externa[turno]`,
 * que é campo separado de `ordem_liberacao`.
 */
describe('Reordenar o bloco de ajuda (dono 30/07)', () => {
  const comAjudas = {
    ...escalaBase,
    ajudaExterna: { matutino: ['CURY', 'PAULO'] },
    casos: [
      caso('Sala 1', 0, 'LEONARDO', 'Liana W', '07:30'),
      caso('Sala 2', 0, 'MARILIO', 'Taciana A', '07:30'),
      caso('IOSC', 0, 'CURY', 'Tirapelle', '07:30'),
      caso('Exames', 0, 'PAULO', 'Willian', '08:00'),
    ],
  }

  it('as setas aparecem SÓ nas linhas de ajuda', () => {
    montar({}, comAjudas)
    // ajuda tem seta; quem está no rodapé principal, não
    expect(screen.getByLabelText(/Subir Marcos Cury na ordem das ajudas/)).toBeTruthy()
    expect(screen.queryByLabelText(/Subir Leonardo Ferrazzo na ordem das ajudas/)).toBeNull()
    expect(screen.queryByLabelText(/Subir Marilio Flach/)).toBeNull()
  })

  it('descer o 1º da ajuda grava o array reordenado — e NADA de ordem_liberacao', () => {
    const onReordenarAjuda = vi.fn()
    const onReorder = vi.fn()
    montar({ onReordenarAjuda, onReorder }, comAjudas)
    fireEvent.click(screen.getByLabelText(/Descer Marcos Cury na ordem das ajudas/))
    // índices do ARRAY ajuda_externa, não da lista exibida
    expect(onReordenarAjuda).toHaveBeenCalledWith(0, 1)
    // a ordem do rodapé continua intocável
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('as pontas do bloco desabilitam a seta que sairia dele', () => {
    montar({}, comAjudas)
    expect(screen.getByLabelText(/Subir Marcos Cury na ordem das ajudas/)).toBeDisabled()
    expect(screen.getByLabelText(/Descer Paulo Tonini na ordem das ajudas/)).toBeDisabled()
  })
})

/**
 * BADGE DO CONTRATURNO É PARA TODOS (dono 30/07).
 *
 * "Aprenda para as próximas para que todos os plantões do contraturno tenham esse
 * badge." Não é caso especial do Fernando: quem fecha o rodapé recebe o selo,
 * SEMPRE — inclusive quando também é ajuda, e aí carrega os dois.
 */
describe('Badge de plantão do contraturno — regra geral', () => {
  const cenario = (ajuda) => ({
    ...escalaBase,
    ordemLiberacao: { matutino: ['LEONARDO', 'MARILIO', 'KARINE'] },
    ajudaExterna: { matutino: ajuda },
    casos: [
      caso('Sala 1', 0, 'LEONARDO', 'Liana W', '07:30'),
      caso('Sala 2', 0, 'MARILIO', 'Taciana A', '07:30'),
      caso('Sala 3', 0, 'KARINE', 'Farret G', '07:30'),
    ],
  })

  it('quem fecha o rodapé recebe o badge', () => {
    montar({}, cenario([]))
    expect(screen.getByText('Plantão da tarde')).toBeTruthy()
  })

  it('quem fecha o rodapé E é ajuda recebe os DOIS badges', () => {
    // é o estado do Fernando no HRO de 30/07
    montar({}, cenario(['KARINE']))
    const card = document.querySelector('[data-linha="uid-kar"]')
    expect(card).toBeTruthy()
    expect(within(card).getByText('Plantão da tarde')).toBeTruthy()
    expect(within(card).getByText('Ajuda')).toBeTruthy()
  })

  it('e o badge não vaza para quem não fecha o rodapé', () => {
    montar({}, cenario([]))
    expect(screen.getAllByText('Plantão da tarde')).toHaveLength(1)
  })
})
