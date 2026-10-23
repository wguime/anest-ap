/**
 * FILA DE LIBERAÇÃO — fonte única da ordem exibida (dono 23/10/2026).
 *
 * Foto da Unimed às 10:39: Diego (14º do HRO) LIBERADO acima de Paulo (9º do HRO) e
 * Rodnei (12º), os dois em sala. Ele foi liberado NA VEZ: a cesárea estava no nome dele e,
 * pela regra de 27/08 ("sempre respeitando a ordem de liberação do hospital de origem"),
 * ele era o último da fila. Na folha "Antes de liberar" a cesárea foi passada ao Costa, o
 * repasse o gravou no array de ajuda e a TELA repartiu a lista por `isExtra` — a ajuda do
 * array subia acima de todos os extras e desfazia o sort da lib. A lib sozinha o deixava
 * em último.
 *
 * O invariante: a ordem entre quem veio de outro hospital é a ordem de LÁ, não importa se
 * a pessoa entrou na fila por caso aqui (extra) ou pelo array de ajuda.
 */
import { describe, it, expect } from 'vitest'
import { gerarColunaLiberacao } from '@/lib/colunaLiberacao'
import { estadoDaFila, ordenarListaExibicao } from '@/lib/filaLiberacao'

const UID = { GABRIELA: 'u-gabriela', COSTA: 'u-costa', ALEXANDRE: 'u-alexandre', MATHEUS: 'u-matheus', PAULO: 'u-paulo', RODNEI: 'u-rodnei', DIEGO: 'u-diego', LEANDRO: 'u-leandro' }
const resolverUid = (n) => UID[String(n || '').trim().toUpperCase()] || null

// rodapé do HRO da manhã de 23/10, só as posições que importam (índice 0 = plantonista)
const HRO = ['THAYNA', 'GUILHERME DIDOMENICO', 'OSCAR', 'NATHALIA', 'PELISSARO', 'DANIELA', 'KARINE', 'ROMULO', 'PAULO', 'CURY', 'RAQUEL', 'RODNEI', 'GARIM', 'DIEGO', 'MARILIO', 'LEONARDO']
const rodapeOutros = HRO.map((nome, i) => ({ nome, uid: null, hospital: 'hro', hospitalLabel: 'HRO', rodapeIdx: i }))
const UNIMED = ['GABRIELA', 'COSTA', 'ALEXANDRE', 'MATHEUS']

const caso = (id, anestesista, extra = {}) => ({
  id, anestesista, anestesistaUserId: resolverUid(anestesista), sala: `Sala ${id}`, hora: '08:00',
  statusCirurgia: 'iniciada', turno: 'matutino', origem: 'importacao', ...extra,
})
const daCasa = [caso('g', 'GABRIELA'), caso('c', 'COSTA'), caso('a', 'ALEXANDRE')]

/** Lista exibida da Unimed com cada visitante entrando por caso aqui OU pelo array. */
const filaUnimed = ({ porArray = [], comCaso = [], extras = [] } = {}) => {
  const casos = [...daCasa, ...comCaso.map((n) => caso(n.toLowerCase(), n)), ...extras]
  const { linhas } = gerarColunaLiberacao(casos, UNIMED, {
    hospital: 'Unimed', turno: 'matutino', resolverUid, ajudaExterna: porArray, rodapeOutros,
  })
  return ordenarListaExibicao(linhas)
}
const nomes = (linhas) => linhas.map((l) => String(l.nomeOriginal || l.anestesista).toUpperCase())

describe('a ordem pelo hospital de origem não depende de como a pessoa entrou na fila', () => {
  it('recorte de 23/10: Diego pelo array, Paulo e Rodnei por caso — Diego segue sendo o último', () => {
    const linhas = filaUnimed({ porArray: ['DIEGO'], comCaso: ['PAULO', 'RODNEI'] })
    // Matheus fecha o rodapé (plantão da tarde) e vai para o fim; acima dele, a ordem do HRO
    expect(nomes(linhas)).toEqual(['GABRIELA', 'COSTA', 'ALEXANDRE', 'PAULO', 'RODNEI', 'DIEGO', 'MATHEUS'])
    const fila = estadoDaFila(linhas)
    // o Matheus, sem cirurgia, nasce liberado na cauda; o próximo é o Diego
    expect(linhas[fila.idxProximo].nomeOriginal).toBe('DIEGO')
    expect(fila.bloqueioDe(linhas[fila.idxProximo], fila.idxProximo)).toBeNull()
    const iRodnei = linhas.findIndex((l) => l.nomeOriginal === 'RODNEI')
    expect(fila.bloqueioDe(linhas[iRodnei], iRodnei)).toMatchObject({ modo: 'liberar', faltam: 1 })
  })

  it('toda combinação de caso aqui × array dá a mesma ordem: Paulo, Rodnei, Diego', () => {
    const visitantes = ['PAULO', 'RODNEI', 'DIEGO']
    for (let mascara = 0; mascara < 8; mascara++) {
      const porArray = visitantes.filter((_, k) => mascara & (1 << k))
      const comCaso = visitantes.filter((_, k) => !(mascara & (1 << k)))
      const ordem = nomes(filaUnimed({ porArray, comCaso })).filter((n) => visitantes.includes(n))
      expect(ordem, `array: ${porArray.join(',') || '—'}`).toEqual(visitantes)
    }
  })

  it('ajuda sem origem conhecida continua acima do extra sem origem, e os dois acima de quem veio de outro hospital', () => {
    // LEANDRO não está em rodapé nenhum: extra "Ajuda" sem origem
    const linhas = filaUnimed({ porArray: ['DIEGO'], comCaso: ['PAULO'], extras: [caso('l', 'LEANDRO')] })
    expect(nomes(linhas)).toEqual(['GABRIELA', 'COSTA', 'ALEXANDRE', 'LEANDRO', 'PAULO', 'DIEGO', 'MATHEUS'])
    expect(linhas.map((l) => l.blocoFila)).toEqual(['rodape', 'rodape', 'rodape', 'extra', 'origem', 'origem', 'contraturno'])
  })

  it('numerada pelo dono (09/09) fica na ordem do array, acima de quem não foi numerado', () => {
    const casos = [...daCasa, caso('p', 'PAULO'), caso('r', 'RODNEI')]
    const { linhas } = gerarColunaLiberacao(casos, UNIMED, {
      hospital: 'Unimed', turno: 'matutino', resolverUid, rodapeOutros,
      ajudaExterna: ['DIEGO', 'PAULO'], ajudaOrdemInformada: true,
    })
    const lista = nomes(ordenarListaExibicao(linhas))
    expect(lista).toEqual(['GABRIELA', 'COSTA', 'ALEXANDRE', 'DIEGO', 'PAULO', 'RODNEI', 'MATHEUS'])
  })
})

describe('estadoDaFila', () => {
  const linha = (nome, extra = {}) => ({ anestesista: nome, chave: nome, noRodape: true, teveCasos: true, ...extra })

  it('só o próximo sai; os de cima recebem quantos faltam e quem é o próximo', () => {
    const linhas = [linha('A'), linha('B'), linha('C')]
    const fila = estadoDaFila(linhas)
    expect(fila.idxProximo).toBe(2)
    expect(fila.bloqueioDe(linhas[2], 2)).toBeNull()
    expect(fila.bloqueioDe(linhas[0], 0)).toEqual({ modo: 'liberar', faltam: 2, proximo: 'C', horaSaida: null })
  })

  it('quem fecha a lista sem trabalho nasce liberado e não trava ninguém', () => {
    const linhas = [linha('A'), linha('B'), linha('C', { teveCasos: false })]
    const fila = estadoDaFila(linhas)
    expect(fila.caudaLiberada(linhas[2], 2)).toBe(true)
    expect(fila.idxProximo).toBe(1)
  })

  it('ajuda trabalhando abaixo segura quem está no rodapé sem cirurgia (21/09)', () => {
    const linhas = [linha('A'), linha('B', { teveCasos: false }), linha('AJUDA', { noRodape: false, isAjuda: true })]
    const fila = estadoDaFila(linhas)
    expect(fila.caudaLiberada(linhas[1], 1)).toBe(false)
    expect(fila.idxProximo).toBe(2)
  })

  it('convocar segue a ordem: só volta o liberado mais próximo de quem está em sala (20/08)', () => {
    const marcas = { B: { liberadoEm: 'x' }, C: { liberadoEm: 'x' } }
    const linhas = [linha('A'), linha('B'), linha('C')]
    const fila = estadoDaFila(linhas, { marcaDe: (l) => marcas[l.chave] })
    expect(fila.idxConvocar).toBe(1)
    expect(fila.bloqueioDe(linhas[2], 2)).toEqual({ modo: 'convocar', proximo: 'B' })
    expect(fila.bloqueioDe(linhas[1], 1)).toBeNull()
  })

  it('hora de saída combinada: antes dela a ordem vale, a partir dela o toque passa (21/09)', () => {
    const linhas = [linha('A'), linha('LOUISE'), linha('C')]
    const horaSaidaDe = (l) => (l.chave === 'LOUISE' ? '19:00' : null)
    const antes = estadoDaFila(linhas, { horaSaidaDe, chegouHoraDe: () => false })
    expect(antes.bloqueioDe(linhas[1], 1)).toMatchObject({ modo: 'liberar', horaSaida: '19:00' })
    const depois = estadoDaFila(linhas, { horaSaidaDe, chegouHoraDe: (l) => l.chave === 'LOUISE' })
    expect(depois.bloqueioDe(linhas[1], 1)).toBeNull()
    // quem está acima continua esperando por ela
    expect(depois.bloqueioDe(linhas[0], 0)).toMatchObject({ modo: 'liberar', faltam: 2 })
  })
})
