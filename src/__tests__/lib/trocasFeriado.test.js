/**
 * Trocas de feriado — a parte pura (dono 03/09: dois escopos, com aceite).
 *
 * Os valores vêm da edição vigente (FERIADOS 2026): GIOVANA (08) abre a fila de 07/09 e
 * MARILIO (36) abre a de 12/10. Como nos outros testes deste módulo, eles travam a EDIÇÃO
 * vigente junto com a regra — edição nova, valores novos.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  mesmaEntrada, identificarNaLegenda, filaImpressa, feriadosDaPessoa,
  aplicarTrocasNaFila, filasDoFeriado, validarPedido, resumirTroca,
} from '../../lib/trocasFeriado'

const dados = JSON.parse(readFileSync(resolve(__dirname, '../../data/escalaNumerica.json'), 'utf8'))

const GIOVANA = { numero: '08', nome: 'GIOVANA' }
const MARILIO = { numero: '36', nome: 'MARILIO' }
const nomes = (fila) => fila.map((p) => p.nome)

const trocaDeData = (extra = {}) => ({
  status: 'aceita', escopo: 'data',
  feriadoData: '2026-09-07', feriadoDesejado: '2026-10-12',
  solicitanteNumero: '08', solicitanteNome: 'GIOVANA',
  destinatarioNumero: '36', destinatarioNome: 'MARILIO',
  ...extra,
})

describe('identidade — o número da legenda sozinho não basta', () => {
  it('reconhece a pessoa pelo nome completo do cadastro', () => {
    expect(identificarNaLegenda(dados, 'Giovana Gomes Noll')).toEqual(GIOVANA)
    expect(identificarNaLegenda(dados, 'Marilio Jose Flach')).toEqual(MARILIO)
    expect(identificarNaLegenda(dados, 'Fulano De Tal')).toBeNull()
  })

  /**
   * O bug que este bloco tranca: em 03/09 `identificarNaLegenda` devolvia STAUB (13) para
   * quem digitasse "GUILHERME", porque o nome sozinho casa com TRÊS pessoas e as chaves
   * "10".."44" do JSON vêm ANTES de "01".."09" (as numéricas são reordenadas pelo motor).
   * Identidade errada aqui deixa alguém pedir troca do feriado de outro.
   */
  it('os três Guilhermes são distinguidos pelo nome completo', () => {
    expect(identificarNaLegenda(dados, 'Guilherme Melo')).toEqual({ numero: '04', nome: 'MELO' })
    expect(identificarNaLegenda(dados, 'Guilherme Jonck Staub')).toEqual({ numero: '13', nome: 'STAUB' })
    expect(identificarNaLegenda(dados, 'Guilherme Xavier Didomenico')).toEqual({ numero: '41', nome: 'GUILHERME D' })
  })

  it('primeiro nome ambíguo NÃO identifica ninguém — na dúvida, não adivinha', () => {
    expect(identificarNaLegenda(dados, 'GUILHERME')).toBeNull()
    expect(identificarNaLegenda(dados, 'ALEXANDRE')).toBeNull()
  })

  it('entrada compartilhada: HUMBERTO e ROBERTA dividem o 05 e NÃO são a mesma pessoa', () => {
    const humberto = identificarNaLegenda(dados, 'Humberto Hepp')
    const roberta = identificarNaLegenda(dados, 'Roberta Marina Grando')
    expect(humberto).toEqual({ numero: '05', nome: 'HUMBERTO' })
    expect(roberta).toEqual({ numero: '05', nome: 'ROBERTA' })
    // o número é o mesmo; a pessoa não
    expect(mesmaEntrada(humberto, roberta)).toBe(false)
  })

  it('quando a fila imprime o PAR, cada um dos dois se reconhece nele', () => {
    expect(mesmaEntrada({ numero: '07', nome: 'ROSE' }, { numero: '07', nome: 'ROSE / ALINE' })).toBe(true)
    expect(mesmaEntrada({ numero: '07', nome: 'ALINE' }, { numero: '07', nome: 'ROSE / ALINE' })).toBe(true)
  })
})

describe('em que feriados a pessoa está', () => {
  it('lista os feriados da pessoa com a posição de cada um', () => {
    expect(feriadosDaPessoa(dados, GIOVANA).map((f) => `${f.data} ${f.posicao}`))
      .toEqual(['2026-02-17 19', '2026-05-01 13', '2026-06-04 7', '2026-09-07 1', '2026-11-02 15'])
  })

  it('`aPartirDe` corta o que já passou — ninguém troca feriado vencido', () => {
    expect(feriadosDaPessoa(dados, GIOVANA, { aPartirDe: '2026-09-03' }).map((f) => f.data))
      .toEqual(['2026-09-07', '2026-11-02'])
  })
})

describe('troca de FERIADO (escopo data) — as duas filas mudam', () => {
  it('GIOVANA e MARILIO trocam 07/09 por 12/10, cada um na posição do outro', () => {
    const t = trocaDeData()
    expect(nomes(filaImpressa(dados, '2026-09-07'))[0]).toBe('GIOVANA')
    expect(nomes(filaImpressa(dados, '2026-10-12'))[0]).toBe('MARILIO')

    const set = filasDoFeriado(dados, '2026-09-07', [t])
    const out = filasDoFeriado(dados, '2026-10-12', [t])
    expect(set.matutino[0]).toMatchObject({ posicao: 1, numero: '36', nome: 'MARILIO', trocado: true })
    expect(out.matutino[0]).toMatchObject({ posicao: 1, numero: '08', nome: 'GIOVANA', trocado: true })
    // ninguém mais se mexe
    expect(nomes(set.matutino).slice(1)).toEqual(nomes(filaImpressa(dados, '2026-09-07')).slice(1))
  })

  it('a tarde continua sendo a manhã invertida DEPOIS da troca', () => {
    const { matutino, vespertino } = filasDoFeriado(dados, '2026-09-07', [trocaDeData()])
    expect(nomes(vespertino)).toEqual([...nomes(matutino)].reverse())
    expect(vespertino.at(-1)).toMatchObject({ nome: 'MARILIO', posicao: 20 })
  })

  it('feriado que não participa da troca fica intacto', () => {
    const t = trocaDeData()
    expect(nomes(filasDoFeriado(dados, '2026-11-02', [t]).matutino))
      .toEqual(nomes(filaImpressa(dados, '2026-11-02')))
  })
})

describe('troca de POSIÇÃO (escopo posicao) — mesmo feriado, lugares trocados', () => {
  it('os dois trocam de lugar e o resto da fila não anda', () => {
    const fila = filaImpressa(dados, '2026-09-07')
    const primeiro = fila[0].nome
    const terceiro = fila[2].nome
    const t = {
      status: 'aceita', escopo: 'posicao', feriadoData: '2026-09-07', feriadoDesejado: null,
      solicitanteNumero: fila[0].numero, solicitanteNome: primeiro,
      destinatarioNumero: fila[2].numero, destinatarioNome: terceiro,
    }
    const r = filasDoFeriado(dados, '2026-09-07', [t]).matutino
    expect(r[0]).toMatchObject({ nome: terceiro, posicao: 1, trocado: true })
    expect(r[2]).toMatchObject({ nome: primeiro, posicao: 3, trocado: true })
    expect(r[1].nome).toBe(fila[1].nome)
    expect(r).toHaveLength(20)
  })
})

describe('só troca ACEITA muda a fila', () => {
  it.each(['pendente', 'rejeitada', 'cancelada'])('status %s não mexe em nada', (status) => {
    const r = filasDoFeriado(dados, '2026-09-07', [trocaDeData({ status })]).matutino
    expect(nomes(r)).toEqual(nomes(filaImpressa(dados, '2026-09-07')))
    expect(r.some((p) => p.trocado)).toBe(false)
  })

  it('troca cuja pessoa não está mais na fila é ignorada, sem quebrar', () => {
    const t = trocaDeData({ solicitanteNumero: '99', solicitanteNome: 'NINGUEM' })
    expect(() => aplicarTrocasNaFila(filaImpressa(dados, '2026-09-07'), '2026-09-07', [t])).not.toThrow()
    expect(nomes(filasDoFeriado(dados, '2026-09-07', [t]).matutino))
      .toEqual(nomes(filaImpressa(dados, '2026-09-07')))
  })

  it('duas trocas aceitas no mesmo feriado se acumulam', () => {
    const fila = filaImpressa(dados, '2026-09-07')
    const t1 = trocaDeData()
    const t2 = {
      status: 'aceita', escopo: 'posicao', feriadoData: '2026-09-07',
      solicitanteNumero: fila[1].numero, solicitanteNome: fila[1].nome,
      destinatarioNumero: fila[2].numero, destinatarioNome: fila[2].nome,
    }
    const r = filasDoFeriado(dados, '2026-09-07', [t1, t2]).matutino
    expect(r[0].nome).toBe('MARILIO')
    expect(r[1].nome).toBe(fila[2].nome)
    expect(r[2].nome).toBe(fila[1].nome)
  })
})

describe('validarPedido — o que o formulário não deixa pedir', () => {
  const base = { escopo: 'data', solicitante: GIOVANA, destinatario: MARILIO, feriadoData: '2026-09-07', feriadoDesejado: '2026-10-12' }

  it('pedido bem formado passa', () => {
    expect(validarPedido(dados, base)).toBeNull()
  })

  it.each([
    ['sem solicitante identificado', { solicitante: null }, /não foi identificado/i],
    ['sem escopo', { escopo: null }, /tipo de troca/i],
    ['sem o próprio feriado', { feriadoData: '' }, /seu feriado/i],
    ['sem colega', { destinatario: null }, /colega/i],
    ['trocando consigo mesmo', { destinatario: GIOVANA }, /com você mesmo/i],
    ['feriado em que não está escalado', { feriadoData: '2026-08-25' }, /não está escalado neste feriado/i],
    ['sem o feriado do colega', { feriadoDesejado: '' }, /feriado do colega/i],
    ['mesmo feriado nos dois lados', { feriadoDesejado: '2026-09-07' }, /troca de posição/i],
    ['colega não está no feriado escolhido', { feriadoDesejado: '2026-11-02' }, /colega não está escalado/i],
  ])('recusa: %s', (_, patch, mensagem) => {
    expect(validarPedido(dados, { ...base, ...patch })).toMatch(mensagem)
  })

  it('recusa quando o solicitante JÁ está no feriado do colega — trocar traria duplicidade', () => {
    // CORPUS CHRISTI (04/06) tem GIOVANA e também GUSTAVO
    const fila = filaImpressa(dados, '2026-06-04')
    const outro = fila.find((p) => !mesmaEntrada(p, GIOVANA))
    expect(validarPedido(dados, {
      escopo: 'data', solicitante: GIOVANA, destinatario: outro,
      feriadoData: '2026-09-07', feriadoDesejado: '2026-06-04',
    })).toMatch(/já está escalado no feriado do colega/i)
  })

  it('troca de posição exige os dois no MESMO feriado', () => {
    expect(validarPedido(dados, { escopo: 'posicao', solicitante: GIOVANA, destinatario: MARILIO, feriadoData: '2026-09-07' }))
      .toMatch(/colega não está escalado neste feriado/i)
    const vizinho = filaImpressa(dados, '2026-09-07')[1]
    expect(validarPedido(dados, { escopo: 'posicao', solicitante: GIOVANA, destinatario: vizinho, feriadoData: '2026-09-07' }))
      .toBeNull()
  })
})

describe('resumirTroca — a frase que o card e a notificação usam', () => {
  it('descreve a troca de feriado com as duas datas', () => {
    expect(resumirTroca(trocaDeData())).toBe('GIOVANA (07/09) troca de feriado com MARILIO (12/10)')
  })
  it('descreve a troca de posição com uma data só', () => {
    expect(resumirTroca({ escopo: 'posicao', feriadoData: '2026-09-07', solicitanteNome: 'GIOVANA', destinatarioNome: 'EDUARDO' }))
      .toBe('GIOVANA e EDUARDO trocam de posição no feriado de 07/09')
  })
})
