/**
 * RECADO DO PLANTONISTA na aba Liberações (dono 2026-08-17).
 *
 * "um campo para mensagem enviada exclusivamente pelo plantonista, em destaque
 * acima dos procedimentos sem anestesista; os envolvidos confirmam e a mensagem
 * some (inclusive o plantonista)."
 *
 * O que estes testes travam:
 *  - só o PLANTONISTA do turno vê o botão de avisar (para os demais o botão não
 *    existe — não é um botão desabilitado);
 *  - o recado aparece ACIMA de "Procedimentos sem anestesista", que foi o pedido;
 *  - confirmar tira o recado da tela de QUEM confirmou, e só dele;
 *  - nada disso notifica ninguém: a escala não manda mensagem desde 30/07.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'

const { fetchAvisos, criarAviso, confirmarAviso, excluirAviso } = vi.hoisted(() => ({
  fetchAvisos: vi.fn(async () => []),
  criarAviso: vi.fn(async () => 'aviso-1'),
  confirmarAviso: vi.fn(async () => {}),
  excluirAviso: vi.fn(async () => {}),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({
  default: {
    // aviso de tempo estourado (24/08): sem isto o hook rejeita solto
    reservarAvisoTempo: vi.fn(async () => false), fetchAvisos, criarAviso, confirmarAviso, excluirAviso, fetchLocaisHospital: vi.fn(async () => []) },
}))
vi.mock('@/services/supabaseSubscriptionHelper', () => ({
  createReliableSubscription: () => ({ cleanup: () => {} }),
}))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({ options: [], rosterByUid: new Map(), resolver: () => null, loading: false }),
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const escala = {
  id: 'e1', hospital: 'unimed', data: '2026-08-14',
  ordemLiberacao: { matutino: ['LEONARDO', 'MARILIO'] },
  liberacoes: {}, linhaOverrides: {},
  casos: [
    { id: 'c1', sala: 'Sala 1', ordem: 0, hora: '07:30', anestesista: 'LEONARDO', cirurgiao: 'Liana W', turno: 'matutino' },
    { id: 'c2', sala: 'Sala 2', ordem: 0, hora: '08:00', anestesista: 'MARILIO', cirurgiao: 'Taciana A', turno: 'matutino' },
  ],
}

const montar = (props = {}) => render(
  <LiberacoesView
    escala={escala}
    hospital="unimed"
    hospitalLabel="Unimed"
    canEdit
    turno="matutino"
    onToggle={() => {}}
    onSetOverride={() => {}}
    {...props}
  />,
  { wrapper: wrap },
)

const AVISO = {
  id: 'aviso-1', texto: 'Guilherme libera Alexandre S.',
  autorUserId: 'uid-leo', autorNome: 'LEONARDO FONTES',
  criadoEm: '2026-08-14T17:20:00.000Z', confirmadoPor: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchAvisos.mockResolvedValue([])
})

describe('Quem pode avisar', () => {
  it('o plantonista do turno vê o botão "Avisar a equipe"', async () => {
    // LEONARDO é o 1º do rodapé matutino → é ele que carrega o selo Plantonista
    montar({ meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    expect(await screen.findByRole('button', { name: /Mensagem para equipe/ })).toBeTruthy()
  })

  it('quem NÃO é plantonista não vê o botão — nem desabilitado', () => {
    montar({ meuUid: 'uid-mar', meuAlias: 'MARILIO' })
    expect(screen.queryByRole('button', { name: /Mensagem para equipe/ })).toBeNull()
  })

  it('sem saber quem sou eu, ninguém avisa', () => {
    montar()
    expect(screen.queryByRole('button', { name: /Mensagem para equipe/ })).toBeNull()
  })

  it('publicar manda só o texto — autor e hora são do banco (trigger)', async () => {
    montar({ meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    fireEvent.click(await screen.findByRole('button', { name: /Mensagem para equipe/ }))
    fireEvent.change(screen.getByPlaceholderText(/Guilherme libera/), {
      target: { value: 'Leonardo libera Marilio' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar recado' }))
    await waitFor(() => expect(criarAviso).toHaveBeenCalled())
    const [escalaId, turno, texto] = criarAviso.mock.calls[0]
    expect(escalaId).toBe('e1')
    expect(turno).toBe('matutino')
    expect(texto).toBe('Leonardo libera Marilio')
  })
})

describe('O recado na tela', () => {
  it('aparece ACIMA de "Procedimentos sem anestesista" (foi o pedido)', async () => {
    fetchAvisos.mockResolvedValue([AVISO])
    const comSemAnest = {
      ...escala,
      casos: [...escala.casos, { id: 'c3', sala: 'IMAGEM', ordem: 0, hora: '09:00', anestesista: '?', semAnestesista: true, procedimento: 'Ecotransesofágico', turno: 'matutino' }],
    }
    montar({ escala: comSemAnest, meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    const recado = await screen.findByText('Guilherme libera Alexandre S.')
    const alerta = screen.getByText(/Procedimentos sem anestesista/)
    // DOCUMENT_POSITION_FOLLOWING = o alerta vem DEPOIS do recado no documento
    expect(recado.compareDocumentPosition(alerta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // LEGÍVEL (dono 11/2026, modelo 5): o título do alerta media 2,06:1 em `text-warning`
    // sobre o fundo claro da página; no laranja-escuro mede 5,70:1. O token não mudou.
    expect(alerta.className).toContain('text-category-orange-fg')
    expect(alerta.className).not.toContain('text-warning')
  })

  it('mostra quem falou e a HORA — sem contagem de leitura (dono 17/08)', async () => {
    fetchAvisos.mockResolvedValue([{ ...AVISO, confirmadoPor: ['uid-a', 'uid-b'] }])
    montar({ meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    // o nome mostrado é o do AUTOR gravado pelo banco, não o de quem está lendo
    expect(await screen.findByText(/Leonardo Fontes/)).toBeTruthy()
    // o placar saiu: quem lê não precisa saber quantos já leram
    expect(screen.queryByText(/confirmaram/)).toBeNull()
  })

  it('quem JÁ confirmou não vê mais o recado — some da tela dele, não de todos', async () => {
    fetchAvisos.mockResolvedValue([{ ...AVISO, confirmadoPor: ['uid-leo'] }])
    montar({ meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    await waitFor(() => expect(fetchAvisos).toHaveBeenCalled())
    expect(screen.queryByText('Guilherme libera Alexandre S.')).toBeNull()
  })

  it('confirmar tira o recado da tela na hora', async () => {
    fetchAvisos.mockResolvedValue([AVISO])
    montar({ meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    await screen.findByText('Guilherme libera Alexandre S.')
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }))
    await waitFor(() => expect(confirmarAviso).toHaveBeenCalledWith('aviso-1', expect.objectContaining({ userId: 'uid-leo' })))
    await waitFor(() => expect(screen.queryByText('Guilherme libera Alexandre S.')).toBeNull())
  })

  it('até TRÊS recados na tela ao mesmo tempo (dono 17/08)', async () => {
    const tres = [1, 2, 3].map((n) => ({ ...AVISO, id: `a${n}`, texto: `Recado ${n}` }))
    fetchAvisos.mockResolvedValue([...tres, { ...AVISO, id: 'a4', texto: 'Recado 4' }])
    montar({ meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    expect(await screen.findByText('Recado 1')).toBeTruthy()
    expect(screen.getByText('Recado 3')).toBeTruthy()
    // o quarto espera vaga — a fila não vira mural
    expect(screen.queryByText('Recado 4')).toBeNull()
  })

  it('com os três lugares ocupados o plantonista não manda outro; confirmar libera a vaga', async () => {
    const tres = [1, 2, 3].map((n) => ({ ...AVISO, id: `a${n}`, texto: `Recado ${n}` }))
    fetchAvisos.mockResolvedValue(tres)
    montar({ meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    await screen.findByText('Recado 1')
    expect(screen.queryByRole('button', { name: /Mensagem para equipe/ })).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: /Confirmar/ })[0])
    expect(await screen.findByRole('button', { name: /Mensagem para equipe/ })).toBeTruthy()
  })

  it('o plantonista exclui um recado; quem não é plantonista não vê a lixeira', async () => {
    fetchAvisos.mockResolvedValue([AVISO])
    const { unmount } = montar({ meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    fireEvent.click(await screen.findByRole('button', { name: /Excluir recado/ }))
    // some da tela na hora, mas o banco só apaga ao fim da janela do "Desfazer"
    // (revisão 23/09) — ou quando a tela fecha com a exclusão pendente
    await waitFor(() => expect(screen.queryByRole('button', { name: /Excluir recado/ })).toBeNull())
    expect(excluirAviso).not.toHaveBeenCalled()
    unmount()
    expect(excluirAviso).toHaveBeenCalledWith('aviso-1')
    montar({ meuUid: 'uid-mar', meuAlias: 'MARILIO' })
    await screen.findByText('Guilherme libera Alexandre S.')
    expect(screen.queryByRole('button', { name: /Excluir recado/ })).toBeNull()
  })
})

describe('Histórico e aparência do recado (dono 17/08)', () => {
  // MANDAR é do plantonista; LER é de todo mundo. Quem chega no meio do turno
  // precisa poder reler o que já passou — inclusive o que confirmou e sumiu.
  it('quem não é plantonista vê o histórico, e só ele', async () => {
    fetchAvisos.mockResolvedValue([AVISO])
    montar({ meuUid: 'uid-mar', meuAlias: 'MARILIO' })
    expect(await screen.findByRole('button', { name: /Histórico de mensagens/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Mensagem para equipe/ })).toBeNull()
  })

  it('o plantonista vê os dois botões', async () => {
    montar({ meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    expect(await screen.findByRole('button', { name: /Mensagem para equipe/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Histórico de mensagens/ })).toBeTruthy()
  })

  it('o plantonista apaga pelo HISTÓRICO — inclusive o que ele já confirmou', async () => {
    // sem isto ele perdia o recado de vista ao confirmar o próprio, e o recado
    // seguia na tela de quem não confirmou, sem ninguém poder tirá-lo
    fetchAvisos.mockResolvedValue([{ ...AVISO, confirmadoPor: ['uid-leo'] }])
    montar({ meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    // já confirmado: sumiu do topo da fila
    await waitFor(() => expect(fetchAvisos).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /Excluir recado/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Histórico de mensagens/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Excluir mensagem/ }))
    // janela do "Desfazer" (6s) — a exclusão no banco vem depois dela
    await waitFor(() => expect(excluirAviso).toHaveBeenCalledWith('aviso-1'), { timeout: 8000 })
  }, 12000)

  it('quem não é plantonista lê o histórico mas não apaga', async () => {
    fetchAvisos.mockResolvedValue([AVISO])
    montar({ meuUid: 'uid-mar', meuAlias: 'MARILIO' })
    fireEvent.click(screen.getByRole('button', { name: /Histórico de mensagens/ }))
    expect(await screen.findAllByText('Guilherme libera Alexandre S.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Excluir mensagem/ })).toBeNull()
  })

  it('o histórico traz o que já foi confirmado (e sumiu da fila)', async () => {
    // confirmado por MIM: sai da faixa, continua no histórico
    fetchAvisos.mockResolvedValue([{ ...AVISO, confirmadoPor: ['uid-mar'] }])
    montar({ meuUid: 'uid-mar', meuAlias: 'MARILIO' })
    const botao = await screen.findByRole('button', { name: /Histórico de mensagens/ })
    expect(screen.queryByText('Guilherme libera Alexandre S.')).toBeNull()
    fireEvent.click(botao)
    expect(await screen.findByText('Guilherme libera Alexandre S.')).toBeTruthy()
    expect(screen.getByText(/Leonardo Fontes/)).toBeTruthy()
  })

  it('o recado usa ROXO (dono 20/08) — nunca verde, que é plantão e cirurgia iniciada', async () => {
    // O teal original ("category-teal") lia como mais um verde na tela, ao lado do
    // verde de plantão e do verde de cirurgia iniciada — exatamente o que a faixa
    // não pode parecer. O dono pediu roxo em 20/08 olhando a tela em uso.
    fetchAvisos.mockResolvedValue([AVISO])
    montar({ meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    const faixa = (await screen.findByText('Guilherme libera Alexandre S.')).closest('div[class*="category-"]')
    expect(faixa.className).toContain('category-purple')
    expect(faixa.className).not.toContain('category-teal')
    // e nada de verde/success aqui: é o estado que a faixa NÃO representa
    expect(faixa.className).not.toMatch(/\bbg-success|\bbg-primary\b/)
  })

  it('o card do recado NÃO conta confirmações — só autor e hora', async () => {
    fetchAvisos.mockResolvedValue([{ ...AVISO, confirmadoPor: ['uid-x'] }])
    montar({ meuUid: 'uid-mar', meuAlias: 'MARILIO' })
    expect(await screen.findByText('Guilherme libera Alexandre S.')).toBeTruthy()
    // "2 de 4 confirmaram" transformava o recado num placar (dono 17/08)
    expect(screen.queryByText(/confirmaram|confirmou|de \d+/)).toBeNull()
    expect(screen.getByText(/· plantonista ·/)).toBeTruthy()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// DUAS FORMAS, e a diferença é o DIA (dono 24/08, 2ª mensagem)
//
// O cartão com rótulo e o "Confirmar leitura" de largura inteira foram
// desenhados no protótipo do FIM DE SEMANA e chegaram ao dia útil junto —
// "faça apenas o solicitado sem alterar a escala de dias úteis". O dia útil
// mantém a faixa de borda a borda de 17/08, com a pastilha de Confirmar no
// canto. Trava dos DOIS lados: é a fronteira que já foi cruzada uma vez.
// ════════════════════════════════════════════════════════════════════════════
describe('Recado — um desenho só, em toda escala', () => {
  /**
   * ⚠️ ESTE TESTE MUDOU DE LADO EM 24/08, e o porquê fica aqui em vez de sumir.
   * O cartão com rótulo e o "Confirmar leitura" de largura inteira nasceram no
   * protótipo do FIM DE SEMANA; chegaram ao dia útil junto e foram devolvidos
   * ("faça apenas o solicitado sem alterar a escala de dias úteis"), o que este
   * describe travava dos dois lados. Horas depois o dono pediu o contrário:
   * "quero que essa configuração de mensagem do plantonista seja assim nos dias
   * úteis". Então o recado passou a ter UM desenho, e a ramificação sumiu.
   *
   * O que a trava protege continua sendo o mesmo: que os dois modos não voltem a
   * divergir para o mesmo gesto.
   */
  it('DIA ÚTIL: cartão com rótulo e "Confirmar leitura" de largura inteira', async () => {
    fetchAvisos.mockResolvedValue([AVISO])
    montar({ meuUid: 'uid-mar', meuAlias: 'MARILIO' })
    await screen.findByText('Guilherme libera Alexandre S.')
    expect(screen.getByText('Recado do plantonista')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Confirmar leitura/ })).toBeTruthy()
    // a pastilha de 32px do canto saiu
    expect(screen.queryByRole('button', { name: /^Confirmar$/ })).toBeNull()
  })

  it('FILA ÚNICA: idêntico — mesmo rótulo, mesmo botão', async () => {
    fetchAvisos.mockResolvedValue([AVISO])
    montar({ meuUid: 'uid-mar', meuAlias: 'MARILIO', modoFds: true })
    await screen.findByText('Guilherme libera Alexandre S.')
    expect(screen.getByText('Recado do plantonista')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Confirmar leitura/ })).toBeTruthy()
  })
})

/**
 * AS AÇÕES NUMA FILEIRA SÓ (dono 11/2026, opção B do modelo 3).
 *
 * "Quero a letra B e em telefones pequenos ícones: histórico e mensagens."
 * Eram duas fileiras (caso · ajuda / mensagem · histórico) e, no iPhone pequeno, a 1ª
 * linha da fila nascia a 469px de 667 — cabia UMA. Numa fileira só cabem 2→3.
 *
 * ⚠️ SUBSTITUI o 2×2 do plantonista de 27/08 ("os QUATRO ficam iguais"): com as quatro
 * ações o Histórico vira botão quadrado só com o ícone, e a Mensagem perde a palavra
 * abaixo de 400px de largura. O recado, que ficava ENTRE as duas fileiras, vem logo abaixo.
 *
 * jsdom não avalia media query: o que se trava é a REGRA nas classes (a quebra é de CSS,
 * nunca de JS), o nome acessível de cada botão e o alvo de toque.
 */
describe('Ações da fila numa fileira só (dono 11/2026)', () => {
  const acoes = { onAddAjuda: () => {}, onGarantirEscala: () => {} }
  const fileira = () => document.querySelector('[data-slot="acoes-liberacoes"]')
  const nomes = () => [...fileira().querySelectorAll('button')].map((b) => b.getAttribute('aria-label'))
  const botao = (nome) => screen.getByRole('button', { name: nome })

  it('quem não é plantonista: Caso · Ajuda · Histórico, os três com palavra', () => {
    montar({ ...acoes, meuUid: 'uid-mar', meuAlias: 'MARILIO' })
    expect(nomes()).toEqual(['Adicionar caso (urgência/encaixe)', 'Adicionar anestesista (ajuda)', 'Histórico de mensagens'])
    expect(botao('Histórico de mensagens').textContent).toBe('Histórico')
    expect(botao('Histórico de mensagens').className).not.toContain('w-11')
    // em pé o rótulo é o curto; o por extenso fica para a tela deitada
    const caso = botao('Adicionar caso (urgência/encaixe)')
    expect(caso.querySelector('span.deitado\\:hidden').textContent).toBe('Caso')
    expect(caso.querySelector('span.hidden').textContent).toBe('Adicionar caso')
  })

  it('plantonista: os QUATRO na mesma fileira, na ordem caso · ajuda · mensagem · histórico', async () => {
    montar({ ...acoes, meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    await screen.findByRole('button', { name: 'Mensagem para equipe' })
    expect(nomes()).toEqual(['Adicionar caso (urgência/encaixe)', 'Adicionar anestesista (ajuda)', 'Mensagem para equipe', 'Histórico de mensagens'])
  })

  it('plantonista: o Histórico é só o ícone, com 44px de largura e o nome para o leitor de tela', async () => {
    montar({ ...acoes, meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    await screen.findByRole('button', { name: 'Mensagem para equipe' })
    const h = botao('Histórico de mensagens')
    expect(h.className).toContain('w-11')
    expect(h.className).toContain('flex-none')
    // a palavra só existe deitada (lá os quatro são colunas iguais, com rótulo)
    expect(h.querySelector('span').className).toBe('hidden deitado:inline')
    expect(h.className).toContain('deitado:w-auto')
  })

  it('plantonista: a Mensagem perde a palavra SÓ em tela estreita — e por CSS', async () => {
    montar({ ...acoes, meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    const m = await screen.findByRole('button', { name: 'Mensagem para equipe' })
    expect(m.textContent).toBe('Mensagem')
    expect(m.querySelector('span').className).toContain('[@media(max-width:399px)]:hidden')
    expect(m.className).toContain('[@media(max-width:399px)]:w-11')
    // deitado ela volta a ter palavra e largura de coluna, qualquer que seja a largura
    expect(m.querySelector('span').className).toContain('deitado:!inline')
    expect(m.className).toContain('deitado:!w-auto')
  })

  it('todo botão da fileira tem o alvo de toque estendido (36px visíveis, 46 de toque)', async () => {
    montar({ ...acoes, meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    await screen.findByRole('button', { name: 'Mensagem para equipe' })
    // -inset-y-1.5 = 46px: com -inset-y-1 o navegador mediu 42 (o `after:` não conta a borda)
    for (const b of fileira().querySelectorAll('button')) expect(b.className).toContain('after:-inset-y-1.5')
  })

  it('o recado fica LOGO ABAIXO da fileira — não mais entre duas fileiras', async () => {
    fetchAvisos.mockResolvedValue([AVISO])
    montar({ ...acoes, meuUid: 'uid-leo', meuAlias: 'LEONARDO' })
    const recado = await screen.findByText('Guilherme libera Alexandre S.')
    for (const b of fileira().querySelectorAll('button')) {
      expect(b.compareDocumentPosition(recado) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('quem só lê (sem edição) vê o Histórico sozinho, com palavra', () => {
    montar({ canEdit: false })
    expect(nomes()).toEqual(['Histórico de mensagens'])
    expect(botao('Histórico de mensagens').textContent).toBe('Histórico')
  })
})

/**
 * CARD "LIVRE" ENXUTO (dono 11/2026, opção B do modelo 3): quem não tem cirurgia não tem
 * cirurgião a mostrar nem tempo a informar — saem as reticências e o "+ Tempo total".
 */
describe('Card "Livre" enxuto (dono 11/2026)', () => {
  const livre = {
    ...escala,
    casos: [
      { ...escala.casos[0], statusCirurgia: 'terminada' },
      escala.casos[1],
    ],
  }
  it('Livre: sem reticências e sem "+ Tempo total"; quem tem cirurgia segue com o botão', () => {
    montar({ escala: livre })
    expect(screen.getByText('Livre')).toBeTruthy()
    expect(screen.queryByText('…')).toBeNull()
    const tempos = screen.getAllByLabelText(/^Informar o tempo total de /).map((b) => b.getAttribute('aria-label'))
    expect(tempos).toHaveLength(1)
    expect(tempos[0]).not.toMatch(/Leonardo/i)
  })
})
