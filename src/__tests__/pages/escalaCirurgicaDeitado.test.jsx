/**
 * CELULAR DEITADO — a fila de liberação na horizontal (dono 26/08).
 *
 * Girar o aparelho PIORAVA a tela: a largura sobra (844px) e a altura cai para
 * 390px. Medido no app antes de mexer, os três seletores empilhados mais os
 * botões de ação terminavam em y=262 de 390 — 67% da tela só de controle — e a
 * primeira linha da fila ficava em y=600, 210px ABAIXO da borda: deitado não se
 * via NINGUÉM da fila sem rolar.
 *
 * O desenho foi escolhido pelo dono em protótipo, a 844×390 nos dois temas, e
 * são estes três pontos que ele aprovou e que este arquivo trava:
 *   1. os controles viram UMA linha (a barra de 42px);
 *   2. a fila em DUAS COLUNAS, cada uma um trecho CONTÍNUO (1–5 | 6–10);
 *   3. o ordinal COLADO AO NOME ("1º Leonardo"), só para quem está na ordem
 *      publicada — extra, ajuda, visitante e plantão do turno seguinte são
 *      exibidos FORA da própria posição e um número ali seria lido como
 *      posição na fila.
 *
 * ⚠️ EM PÉ NADA MUDA — é a metade mais importante daqui. O retrato é o fluxo
 * estabelecido de uma equipe em uso clínico diário (Regra #2), então cada
 * asserção de "deitado:" vem com a contraparte "o retrato continua igual".
 *
 * ⚠️ jsdom não faz layout nem avalia a media query da variante `deitado:`: o que
 * se verifica aqui é a REGRA gravada nas classes, que é quem decide a geometria
 * — mesma convenção de `liberacoesSelosPosicao.test.jsx`. A medida em pixels
 * vive nas fotos do app deitado, num browser de verdade.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'

const ROSTER = [
  { uid: 'uid-leo', nome: 'LEONARDO FERRAZZO', apelidos: ['LEONARDO'] },
  { uid: 'uid-mar', nome: 'MARILIO JOSE FLACH', apelidos: ['MARILIO'] },
  { uid: 'uid-kar', nome: 'KARINE BEDIN', apelidos: ['KARINE'] },
  { uid: 'uid-sta', nome: 'GUILHERME STAUB', apelidos: ['STAUB'] },
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
  default: { reservarAvisoTempo: vi.fn(async () => false), fetchLocaisHospital: vi.fn(async () => []) },
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const caso = (sala, ordem, anestesista, cirurgiao, hora, extra = {}) => ({
  id: `${sala}-${ordem}`, sala, ordem, hora, anestesista, cirurgiao,
  bloco: 'normal', isContinuacao: false, semAnestesista: false, ...extra,
})

// LEONARDO · MARILIO · KARINE estão na ordem publicada (rodapé). STAUB tem
// cirurgia e NÃO está no rodapé: a lib o põe no FIM da lista como ajuda — é o
// caso que separa "está na fila" de "está na posição publicada".
const escala = {
  id: 'e1', hospital: 'hro', data: '2026-07-29',
  ordemLiberacao: { matutino: ['LEONARDO', 'MARILIO', 'KARINE'] },
  ajudaExterna: {}, liberacoes: {}, linhaOverrides: {},
  casos: [
    caso('Sala 1', 0, 'LEONARDO', 'Liana W', '07:30'),
    caso('Sala 2', 0, 'MARILIO', 'Taciana A', '07:30'),
    caso('Sala 3', 0, 'KARINE', 'Farret G', '07:30'),
    caso('Sala 4', 0, 'STAUB', 'Bento R', '07:30'),
  ],
}

// ⚠️ a hora tem de ser do turno da fila (matutino): com 16:00 o caso cai no
// vespertino, `filtrarPorTurno` o descarta e o alerta simplesmente não existe —
// foi assim que a 1ª versão deste teste passou verde afirmando o contrário.
const escalaComSemAnest = {
  ...escala,
  casos: [...escala.casos, caso('Sala 9', 0, '?', 'Ana P', '07:45', { semAnestesista: true })],
}

const montar = (props = {}, e = escala) => render(
  <LiberacoesView escala={e} hospital="hro" hospitalLabel="HRO" turno="matutino"
    canEdit onToggle={() => {}} onSetOverride={() => {}} {...props} />,
  { wrapper: wrap }
)

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-07-29T10:00:00-03:00'))
})
afterAll(() => vi.useRealTimers())

const cardDe = (nome) => screen.getByLabelText(`Editar local/cirurgião de ${nome}`).closest('[data-linha]')
const linhaDoNome = (card) => card.querySelector('p.flex.items-center')
/** o número em COLUNA, à esquerda do círculo — é o do retrato */
const colunaDoNumero = (card) => card.querySelector('span.w-5')
/** o ordinal colado ao nome — é o do deitado */
const ordinalDoNome = (card) => [...linhaDoNome(card).children]
  .find((el) => el.className?.includes?.('deitado:inline'))
/** a lista da fila (o pai dos cards) */
const listaDaFila = (card) => card.parentElement

describe('fila de liberação deitada (dono 26/08)', () => {
  it('DUAS COLUNAS, cada uma um trecho contínuo — e uma coluna só em pé', () => {
    montar()
    const lista = listaDaFila(cardDe('Leonardo Ferrazzo'))
    // multi-coluna do CSS, e não grid, é o que quebra a lista em dois pedaços
    // SEGUIDOS (1–5 à esquerda, 6–10 à direita) em vez de serpentear
    expect(lista.className).toContain('deitado:columns-2')
    // toda regra de coluna é PREFIXADA: sem isso a lista viraria duas colunas
    // também no retrato, que é o que não pode acontecer
    for (const cls of lista.className.split(/\s+/).filter((c) => /columns-|break-inside/.test(c))) {
      expect(cls).toContain('deitado:')
    }
    // sala inteira não pode ser partida no pé da coluna
    expect(lista.className).toContain('break-inside-avoid')
    // ⚠️ a margem passa de `space-y` para `mb`: o `space-y` não põe margem no
    // primeiro filho, e o primeiro filho da SEGUNDA coluna é um card do MEIO da
    // lista — sem isso ele nasceria colado no topo da coluna.
    expect(lista.className).toContain('deitado:space-y-0')
    expect(lista.className).toContain('mb-2')
    // em pé continua a coluna única de sempre
    expect(lista.className).toContain('space-y-1.5')
  })

  it('INVARIANTE: os dois números NUNCA aparecem juntos — coluna em pé, ordinal deitado', () => {
    montar()
    for (const nome of ['Leonardo Ferrazzo', 'Marilio Flach']) {
      const card = cardDe(nome)
      // a coluna existe (é o retrato) e some deitado
      expect(colunaDoNumero(card).className).toContain('deitado:hidden')
      // o ordinal existe (é o deitado) e some em pé
      const ord = ordinalDoNome(card)
      expect(ord.className).toContain('hidden')
      expect(ord.className).toContain('deitado:inline')
      // e é o MESMO número dos dois lados: girar o aparelho não muda a posição
      // de ninguém — o ordinal é só exibição e não encosta em `ordem_liberacao`
      expect(ord.textContent).toBe(`${colunaDoNumero(card).textContent}º`)
    }
  })

  it('o ordinal é só de quem está NA POSIÇÃO publicada — ajuda e plantão do turno seguinte ficam sem', () => {
    montar()
    // Staub tem cirurgia e NÃO está no rodapé: entra na fila como ajuda, no FIM
    // da lista (dono 19/08). Karine FECHA o rodapé, então é o plantão do turno
    // seguinte e a lib a manda para o fim também (dono 29/07). Os dois são
    // exibidos FORA da própria posição — um ordinal ali seria lido como posição
    // na ordem de liberação, que não é o que o número diria.
    for (const nome of ['Guilherme Staub', 'Karine Bedin']) {
      expect(ordinalDoNome(cardDe(nome))).toBeUndefined()
    }
    // ⚠️ em pé os dois continuam NUMERADOS na coluna: lá o número é sequência da
    // LISTA (dono 19/08, "numerada na exibição"), não posição da ordem. É a
    // diferença de significado que justifica a divergência — e o retrato, que é
    // o fluxo em uso, não muda.
    expect(colunaDoNumero(cardDe('Guilherme Staub')).textContent).toBe('3')
    expect(colunaDoNumero(cardDe('Karine Bedin')).textContent).toBe('4')
  })

  it('as ações ocupam a metade ESQUERDA e terminam na mesma linha que o alerta', () => {
    montar({ onGarantirEscala: () => {}, onAddAjuda: () => {} }, escalaComSemAnest)
    const historico = screen.getByRole('button', { name: 'Histórico de mensagens' })
    const fileira = historico.parentElement
    // ⚠️ o lugar é FIXO (dono 27/08). Duas versões anteriores punham o botão
    // "onde sobrasse espaço" — canto de cima à esquerda, depois no fim da linha
    // do alerta — e as duas foram recusadas. Coluna 1 é a metade esquerda.
    expect(fileira.className).toContain('deitado:col-start-1')
    // com "Adicionar caso/ajuda" acima, esta é a 2ª fileira — as duas juntas dão
    // os quatro botões iguais em 2×2 do plantonista
    expect(fileira.className).toContain('deitado:row-start-2')
    // ⚠️ `h-auto` é o que faz a metade esquerda terminar na MESMA linha que o
    // alerta: o `h-9` do Button (size sm) vence o stretch da grade e, sem isto,
    // medido no app, ela parava 13px acima dele.
    expect(historico.className).toContain('deitado:h-auto')
  })

  it('sem "Adicionar caso/ajuda", a fileira de mensagens SOBE para a 1ª', () => {
    // quem não edita não tem as ações de cima — sem isto sobraria uma fileira
    // vazia sobre o Histórico, que é o único botão que resta
    montar({ canEdit: false }, escalaComSemAnest)
    const historico = screen.getByRole('button', { name: 'Histórico de mensagens' })
    expect(historico.parentElement.className).toContain('deitado:row-start-1')
  })

  it('SEM alerta na tela, as ações viram UMA fileira com um botão por coluna', () => {
    // dono 27/08: "quando não houver procedimento sem anestesista deixe os cards
    // alinhados (3 ou 4 se plantonista)". Antes a metade direita ficava vazia — e
    // é o caso da maioria dos dias, porque alerta de sem-anestesista é exceção.
    montar({ onGarantirEscala: () => {}, onAddAjuda: () => {} })
    const historico = screen.getByRole('button', { name: 'Histórico de mensagens' })
    const raiz = historico.closest('div.space-y-3')
    // três botões (Adicionar caso · Adicionar ajuda · Histórico) = três colunas
    expect(raiz.className).toContain('deitado:grid-cols-3')
    // ⚠️ os dois blocos de ação são SEPARADOS no DOM (o recado do plantonista
    // entra entre eles), então a fileira única só existe com `contents`: os
    // invólucros somem deitado e os botões viram filhos diretos da grade.
    expect(historico.parentElement.className).toContain('deitado:contents')
    expect(screen.getByRole('button', { name: 'Adicionar anestesista (ajuda)' })
      .parentElement.className).toContain('deitado:contents')
    // e a fila continua inteira, sem precisar saber quantas colunas existem
    const lista = listaDaFila(cardDe('Leonardo Ferrazzo'))
    expect(lista.className).toContain('deitado:col-span-full')
  })

  it('COM alerta, a grade volta a duas colunas — ações à esquerda, alerta à direita', () => {
    montar({ onGarantirEscala: () => {}, onAddAjuda: () => {} }, escalaComSemAnest)
    const historico = screen.getByRole('button', { name: 'Histórico de mensagens' })
    const raiz = historico.closest('div.space-y-3')
    expect(raiz.className).toContain('deitado:grid-cols-2')
    // aqui os invólucros voltam a ser fileiras da coluna 1
    expect(historico.parentElement.className).toContain('deitado:col-start-1')
    expect(historico.parentElement.className).not.toContain('deitado:contents')
  })

  it('o rótulo ENCURTA deitado, e o nome inteiro fica para o leitor de tela', () => {
    montar()
    // medido: "Histórico de mensagens" não cabe nos 177px do botão em 2×2 e saía
    // cortado no meio da palavra. Deitado vale "Histórico"; em pé, o nome inteiro.
    const historico = screen.getByRole('button', { name: 'Histórico de mensagens' })
    const curto = historico.querySelector('span.hidden')
    const longo = historico.querySelector('span.deitado\\:hidden')
    expect(curto.textContent).toBe('Histórico')
    expect(curto.className).toContain('deitado:inline')
    expect(longo.textContent).toBe('Histórico de mensagens')
    // o nome acessível não muda com a orientação — é o `aria-label`
    expect(historico.getAttribute('aria-label')).toBe('Histórico de mensagens')
  })
})
