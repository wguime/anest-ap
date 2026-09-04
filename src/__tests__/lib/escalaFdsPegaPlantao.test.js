/**
 * A tabela de posições do FIM DE SEMANA conferida contra o Pega Plantão (dono 04/09).
 *
 * A fila do sábado e do domingo sai de UMA tabela fotografada. Se a leitura troca dois
 * nomes, a fila do fim de semana inteiro nasce errada e não havia segunda fonte. O Pega
 * Plantão é essa fonte: ele registra as posições do sábado no campo `Setor`.
 *
 * Regra do dono: de P5 em diante a ordem está correta e diferença é divergência; entre P1 e
 * P4 a ordem varia e só se confirma na conferência — as mesmas quatro pessoas em posições
 * trocadas é AVISO para conferir, não erro.
 *
 * Os registros abaixo são a resposta real do Pega Plantão para o sábado 05/09/2026.
 */
import { describe, it, expect } from 'vitest'
import {
  pnDoSetor, posicoesDoPegaPlantao, compararPosicoesFds, textoComparacaoFds, ehBlocoInicial, nomesCompativeis,
} from '../../lib/escalaFdsPegaPlantao'

const REGISTROS_05_09 = [
  { Setor: '9 - P9', ProfDePlantao: 'Rodnei Cabral Lima', Inicio: '2026-09-05T07:00:00' },
  { Setor: '8 - P8', ProfDePlantao: 'Leonardo Ferrazzo', Inicio: '2026-09-05T07:00:00' },
  { Setor: 'E10 - P10', ProfDePlantao: 'Gustavo Biesdorf', Inicio: '2026-09-05T07:00:00' },
  { Setor: '5 - P5', ProfDePlantao: 'Klisman Drescher Hilleshein', Inicio: '2026-09-05T07:00:00' },
  { Setor: '6 - P6', ProfDePlantao: 'Diego B. Rigotti', Inicio: '2026-09-05T07:00:00' },
  { Setor: '7 - P7', ProfDePlantao: 'Tiago Iop Viana', Inicio: '2026-09-05T07:00:00' },
  { Setor: '2- P2', ProfDePlantao: 'Romulo Santos Roxo', Inicio: '2026-09-05T07:00:00' },
  { Setor: '4 - P4', ProfDePlantao: 'Guilherme Xavier Di Domenico', Inicio: '2026-09-05T07:00:00' },
  { Setor: '3 - P3', ProfDePlantao: 'Erlei Perini', Inicio: '2026-09-05T07:00:00' },
  { Setor: '1 - P1', ProfDePlantao: 'Joao Henrique Salvao Vanni', Inicio: '2026-09-05T07:00:00' },
  { Setor: 'E11- P11 HC', ProfDePlantao: 'A. Danieli', Inicio: '2026-09-05T07:00:00' },
  // o P11 cobre 24h e reaparece no domingo — a mesma pessoa, outro registro
  { Setor: 'E11- P11 HC', ProfDePlantao: 'A. Danieli', Inicio: '2026-09-06T07:00:00' },
]

// na tela quem casa primeiro é o dicionário de apelidos; aqui deixamos a lib usar só o
// casamento por tokens consecutivos, que é o que precisa estar certo
const casar = undefined

describe('pnDoSetor — o Pega Plantão escreve a posição de várias formas', () => {
  it.each([
    ['1 - P1', 'P1'], ['2- P2', 'P2'], ['E10 - P10', 'P10'], ['E11- P11 HC', 'P11'],
    ['Férias', null], ['', null], [null, null],
  ])('%s → %s', (setor, esperado) => expect(pnDoSetor(setor)).toBe(esperado))
})

describe('posicoesDoPegaPlantao — o sábado é a referência', () => {
  it('lê as 11 posições do sábado e ignora o registro do domingo', () => {
    const p = posicoesDoPegaPlantao(REGISTROS_05_09, '2026-09-05')
    expect(Object.keys(p).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))))
      .toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11'])
    expect(p.P1).toBe('Joao Henrique Salvao Vanni')
    expect(p.P10).toBe('Gustavo Biesdorf')
    expect(p.P11).toBe('A. Danieli')
  })
  it('sem data pega tudo, e posição repetida fica com o primeiro registro', () => {
    const p = posicoesDoPegaPlantao(REGISTROS_05_09)
    expect(p.P11).toBe('A. Danieli')
    expect(Object.keys(p)).toHaveLength(11)
  })
})

describe('nomesCompativeis — o mesmo nome com espaços diferentes', () => {
  it.each([
    ['GUILHERME DIDOMENICO', 'Guilherme Xavier Di Domenico', true],
    ['GUILHERME MELO', 'GUILHERME M ELO', true],
    ['KLISMAN', 'Klisman Drescher Hilleshein', true],
    ['A. DANIELI', 'A. Danieli', true],
    ['TIAGO', 'Tiago Iop Viana', true],
    ['GUILHERME DIDOMENICO', 'Guilherme Souza Melo', false],
    ['THAYNA', 'Tiago Iop Viana', false],
    ['COSTA', 'Gabriel Juan Kettenhuber Costa', false],
    ['', 'Tiago Iop Viana', false],
  ])('%s × %s → %s', (a, b, esperado) => expect(nomesCompativeis(a, b)).toBe(esperado))
})

describe('compararPosicoesFds', () => {
  const pp = posicoesDoPegaPlantao(REGISTROS_05_09, '2026-09-05')
  const lidasCertas = {
    P1: 'JOAO HENRIQUE', P2: 'ROMULO', P3: 'ERLEI', P4: 'GUILHERME DIDOMENICO',
    P5: 'KLISMAN', P6: 'DIEGO', P7: 'TIAGO', P8: 'LEONARDO', P9: 'RODNEI', P10: 'GUSTAVO',
    P11: 'A. DANIELI',
  }

  it('leitura igual ao Pega Plantão não gera nada', () => {
    const c = compararPosicoesFds(lidasCertas, pp, { casar })
    expect(c.iguais).toBe(true)
    expect(textoComparacaoFds(c)).toBe('')
  })

  it('P5 em diante: nome diferente é DIVERGÊNCIA, com os dois lados', () => {
    const c = compararPosicoesFds({ ...lidasCertas, P7: 'THAYNA' }, pp, { casar })
    expect(c.iguais).toBe(false)
    expect(c.divergentes).toEqual([{ pn: 'P7', lido: 'THAYNA', esperado: 'Tiago Iop Viana' }])
    expect(textoComparacaoFds(c)).toMatch(/P7 lido THAYNA, no Pega Plantão Tiago Iop Viana/)
  })

  it('P1 a P4 trocados entre si: pede CONFIRMAÇÃO da ordem, não acusa erro', () => {
    const c = compararPosicoesFds({ ...lidasCertas, P1: 'ROMULO', P2: 'JOAO HENRIQUE' }, pp, { casar })
    expect(c.divergentes).toEqual([])
    expect(c.conferirOrdem.map((d) => d.pn)).toEqual(['P1', 'P2'])
    expect(textoComparacaoFds(c)).toMatch(/confirme a ordem entre P1 e P4/)
  })

  it('pessoa de FORA do bloco aparecendo em P1–P4 é divergência de verdade', () => {
    const c = compararPosicoesFds({ ...lidasCertas, P2: 'THAYNA' }, pp, { casar })
    expect(c.conferirOrdem).toEqual([])
    expect(c.divergentes.map((d) => d.pn)).toEqual(['P2'])
  })

  it('posição só de um lado entra como faltando ou sobrando', () => {
    const semP9 = { ...lidasCertas }; delete semP9.P9
    const c = compararPosicoesFds({ ...semP9, P12: 'CRISTINA' }, pp, { casar })
    expect(c.faltando).toEqual([{ pn: 'P9', esperado: 'Rodnei Cabral Lima' }])
    expect(c.sobrando).toEqual([{ pn: 'P12', lido: 'CRISTINA' }])
    expect(textoComparacaoFds(c)).toMatch(/sem nome na leitura: P9/)
    // posição que o Pega Plantão não cobre fica no dado, mas não vira acusação na tela:
    // ele pode não ter aquela vaga registrada (no sábado real ia até P11)
    expect(textoComparacaoFds(c)).not.toMatch(/P12/)
  })

  it('sem Pega Plantão não inventa comparação', () => {
    const c = compararPosicoesFds(lidasCertas, {}, { casar })
    expect(c.sobrando).toHaveLength(11)
    expect(textoComparacaoFds(c)).toBe('')  // nada a dizer: não há referência
    expect(compararPosicoesFds({}, {}, { casar }).iguais).toBe(true)
  })

  it('o bloco inicial é P1 a P4, e só ele', () => {
    expect(['P1', 'P2', 'P3', 'P4'].every(ehBlocoInicial)).toBe(true)
    expect(['P5', 'P10', 'P12'].some(ehBlocoInicial)).toBe(false)
  })
})
