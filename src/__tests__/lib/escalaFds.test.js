/**
 * escalaFds — modo fim de semana da Escala Cirúrgica (fila de liberação ÚNICA).
 * Fixtures do documento REAL de 15–16/08/2026 ("ESCALA DE FINAL DE SEMANA").
 *
 * Regras travadas (dono 15/08):
 * - documento escreve "primeiro→último a ser LIBERADO"; o rodapé do app é o
 *   inverso — a inversão acontece UMA vez, na fronteira (rodapeDeOrdemDoc);
 * - Pn→pessoa normalmente vale o FDS inteiro (dom 7º=THAYNA foi troca pessoal);
 * - fase noturna FDS: só os 4 plantões da faixa 19-07 (cols 1–2 fixas,
 *   cols 3–4 ordem de chamada);
 * - badge Pn em cada linha da fila conforme a posição na escala.
 */
import { describe, it, expect } from 'vitest'
import {
  FDS_HOSPITAL,
  ehDataFilaUnica,
  ehFeriado,
  ehFimDeSemana,
  sabadoDoFimDeSemana,
  faixaFdsAtual,
  normalizarPn,
  marcarSelosFds,
  plantonistasFaixaFds,
  linhasNoturnasFds,
  resolverNomeEstrito,
  sugerirRodapeFds,
  rodapeDeOrdemDoc,
  ordensDocumentoFeriado,
  normalizarParseFds,
} from '../../lib/escalaFds'
import { gerarColunaLiberacao } from '../../lib/colunaLiberacao'

// ── Fixtures do documento real 15–16/08/2026 ────────────────────────────────
const GRADE_SAB = {
  '7-13': { unimed: 'GUILHERME DIDOMENICO', hro: 'JOAO HENRIQUE', ret1: 'CRISTINA', ret2: 'MATHEUS' },
  '13-19': { unimed: 'CRISTINA', hro: 'MATHEUS', ret1: 'GUILHERME DIDOMENICO', ret2: 'JOAO HENRIQUE' },
  '19-07': { unimed: 'JOAO HENRIQUE', hro: 'GUILHERME DIDOMENICO', ret1: 'MATHEUS', ret2: 'CRISTINA' },
}
const POSICOES_SAB = {
  P1: 'GUILHERME DIDOMENICO', P2: 'JOAO HENRIQUE', P3: 'CRISTINA', P4: 'MATHEUS',
  P5: 'GABRIELA', P6: 'ERLEI', P7: 'MARILIO', P8: 'RAFAEL',
  P9: 'ROBERTA', P10: 'STAUB', P11: 'GABRIEL', P12: 'VICENTE',
}
const ESCALACAO_SAB = {
  matutino: ['P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12'],
  vespertino: ['P6', 'P5', 'P9', 'P10', 'P11'],
}
const ORDEM_DOC_SAB_MAT = ['P4', 'P3', 'P12', 'P09', 'P10', 'P11', 'P6', 'P5', 'P8', 'P7', 'P2', 'P1']
const ORDEM_DOC_SAB_VESP = ['P11', 'P10', 'P9', 'P5', 'P6', 'P4', 'P3']

const LISTA_FERIADO_25_08 = [
  'FERNANDA', 'DANIELA', 'GABRIELA', 'OSCAR', 'ADRIANO', 'GIOVANA', 'MARILIO', 'VICENTE',
  'TIAGO', 'JOAO RICARDO', 'RAUL', 'NATHALIA', 'GUILHERME MELO', 'ROSE', 'GABRIEL',
  'GARIM', 'CURY', 'KLISMAN', 'KARINE', 'ALEXANDRE S', 'ALEXANDRE D', 'GUILHERME DIDOMENICO',
]

const GRADE_DOM = {
  '7-13': { unimed: 'CRISTINA', hro: 'MATHEUS', ret1: 'JOAO HENRIQUE', ret2: 'GUILHERME DIDOMENICO' },
  '13-19': { unimed: 'GUILHERME DIDOMENICO', hro: 'JOAO HENRIQUE', ret1: 'MATHEUS', ret2: 'CRISTINA' },
  '19-07': { unimed: 'JOAO RICARDO', hro: 'MATHEUS', ret1: 'GUILHERME DIDOMENICO', ret2: 'JOAO HENRIQUE' },
}

describe('ehFimDeSemana', () => {
  it('sábado e domingo são FDS; seg–sex não; feriado de semana segue dia útil', () => {
    expect(ehFimDeSemana('2026-08-15')).toBe(true)  // sábado
    expect(ehFimDeSemana('2026-08-16')).toBe(true)  // domingo
    expect(ehFimDeSemana('2026-08-14')).toBe(false) // sexta
    expect(ehFimDeSemana('2026-08-17')).toBe(false) // segunda
    expect(ehFimDeSemana('2026-09-07')).toBe(false) // Independência (segunda) — regra de dia útil
  })
  it('sem data → false (nunca liga o modo FDS por engano)', () => {
    expect(ehFimDeSemana('')).toBe(false)
    expect(ehFimDeSemana(null)).toBe(false)
  })
  it('constante do pseudo-hospital', () => {
    expect(FDS_HOSPITAL).toBe('fds')
  })
})

describe('feriado como data de fila única (sem mudar ehDiaUtil)', () => {
  it('reconhece 25/08/2026 pela MESMA lista do plantão 24h (FERIADOS_2026)', () => {
    expect(ehFeriado('2026-08-25')).toBe(true)
    expect(ehDataFilaUnica('2026-08-25')).toBe(true)
    expect(ehFimDeSemana('2026-08-25')).toBe(false)
  })

  it('cobre os feriados que a lista de FÉRIAS deixa de fora (fim de ano e 15/11)', () => {
    // `FERIADOS_UTEIS` (feriasFeriados.js) exclui de propósito 24/12, 25/12,
    // 31/12 e 01/01 — lá o fim de ano é RECESSO. No hospital esses dias rodam
    // escala de feriado, então a fila única precisa alcançá-los.
    for (const iso of ['2026-11-15', '2026-12-24', '2026-12-25', '2026-12-31', '2027-01-01']) {
      expect(ehFeriado(iso)).toBe(true)
      expect(ehDataFilaUnica(iso)).toBe(true)
    }
    expect(ehFeriado('2026-08-26')).toBe(false) // quarta comum
    expect(ehFeriado('')).toBe(false)
  })

  /**
   * SENTIDO DA FILA — o defeito de 24/08 (dono: "entregou a ordem de liberação
   * invertida"). A folha do feriado JÁ vem na direção do rodapé: os 13
   * primeiros nomes são exatamente os 13 com cirurgia de manhã nos mapas, e os
   * 9 últimos não têm nenhuma — quem não tem cirurgia é quem sai primeiro.
   */
  it('lista real de 22 nomes: a manhã sai na ordem da folha e a tarde, de trás para frente', () => {
    const ordemDoc = ordensDocumentoFeriado(LISTA_FERIADO_25_08)
    // convenção do DOCUMENTO (1º→último a ser liberado): a manhã entra invertida
    expect(ordemDoc.matutino).toEqual([...LISTA_FERIADO_25_08].reverse())
    expect(ordemDoc.vespertino).toEqual(LISTA_FERIADO_25_08)

    const manha = rodapeDeOrdemDoc(ordemDoc.matutino).rodape
    const tarde = rodapeDeOrdemDoc(ordemDoc.vespertino).rodape
    expect(manha).toHaveLength(22)
    expect(tarde).toHaveLength(22)
    // RODAPÉ: 1ª posição = ÚLTIMA a sair; o último card é o próximo a ser liberado.
    expect(manha).toEqual(LISTA_FERIADO_25_08)
    expect(manha[0]).toBe('FERNANDA')
    expect(manha.at(-1)).toBe('GUILHERME DIDOMENICO')   // 1º liberado de manhã
    expect(tarde).toEqual([...LISTA_FERIADO_25_08].reverse())
    expect(tarde[0]).toBe('GUILHERME DIDOMENICO')
    expect(tarde.at(-1)).toBe('FERNANDA')               // 1ª liberada à tarde
  })

  it('o rodapé publicado é a ordem que a FILA mostra — quem sai primeiro fica no fim', () => {
    // Invariante em cima de gerarColunaLiberacao, que é o que a aba Liberações
    // consome: sem isto, uma inversão futura passa nos testes de string.
    const ordemDoc = ordensDocumentoFeriado(LISTA_FERIADO_25_08)
    const casos = LISTA_FERIADO_25_08.map((nome, i) => ({
      id: `c${i}`, sala: `Sala ${i + 1}`, anestesista: nome, cirurgiao: 'DR. X', status: 'agendada',
    }))
    for (const [turno, primeiroLiberado, ultimoLiberado] of [
      ['matutino', 'GUILHERME DIDOMENICO', 'FERNANDA'],
      ['vespertino', 'FERNANDA', 'GUILHERME DIDOMENICO'],
    ]) {
      const { rodape } = rodapeDeOrdemDoc(ordemDoc[turno])
      const { linhas } = gerarColunaLiberacao(casos, rodape)
      expect(linhas).toHaveLength(22)
      // a fila sai de BAIXO p/ cima: o último da lista é o próximo a ser liberado
      expect(linhas.at(-1).anestesista.toUpperCase()).toBe(primeiroLiberado)
      expect(linhas[0].anestesista.toUpperCase()).toBe(ultimoLiberado)
    }
  })
})

describe('sabadoDoFimDeSemana', () => {
  it('sábado → ele mesmo; domingo → a véspera; dia útil → o PRÓXIMO sábado', () => {
    expect(sabadoDoFimDeSemana('2026-08-15')).toBe('2026-08-15') // sábado
    expect(sabadoDoFimDeSemana('2026-08-16')).toBe('2026-08-15') // domingo → véspera
    expect(sabadoDoFimDeSemana('2026-08-14')).toBe('2026-08-15') // sexta → amanhã
    expect(sabadoDoFimDeSemana('2026-08-17')).toBe('2026-08-22') // segunda → próximo
    expect(sabadoDoFimDeSemana(null)).toBe(null)
  })
})

describe('faixaFdsAtual', () => {
  it('limites exatos das 3 faixas (6:59/7:00/12:59/13:00/18:59/19:00)', () => {
    expect(faixaFdsAtual(6 * 60 + 59)).toBe('19-07')  // madrugada = faixa da véspera
    expect(faixaFdsAtual(7 * 60)).toBe('7-13')
    expect(faixaFdsAtual(12 * 60 + 59)).toBe('7-13')
    expect(faixaFdsAtual(13 * 60)).toBe('13-19')
    expect(faixaFdsAtual(18 * 60 + 59)).toBe('13-19')
    expect(faixaFdsAtual(19 * 60)).toBe('19-07')
    expect(faixaFdsAtual(23 * 60 + 59)).toBe('19-07')
    expect(faixaFdsAtual(0)).toBe('19-07')
  })
  it('minuto inválido → null', () => {
    expect(faixaFdsAtual(NaN)).toBe(null)
    expect(faixaFdsAtual(undefined)).toBe(null)
  })
})

describe('normalizarPn', () => {
  it('aceita zero à esquerda e caixa baixa; sem teto em P11 (o doc tem P12)', () => {
    expect(normalizarPn('P09')).toBe('P9')
    expect(normalizarPn('p4')).toBe('P4')
    expect(normalizarPn('P12')).toBe('P12')
    expect(normalizarPn(' P10 ')).toBe('P10')
  })
  it('nome não é código', () => {
    expect(normalizarPn('CRISTINA')).toBe(null)
    expect(normalizarPn('')).toBe(null)
  })
})

describe('rodapeDeOrdemDoc — fronteira documento→rodapé (inversão única)', () => {
  it('sábado matutino: rodapé abre com P1,P2 (fisicamente de plantão 7-13) e fecha com P4 (sai 1º)', () => {
    const { rodape, semDono } = rodapeDeOrdemDoc(ORDEM_DOC_SAB_MAT, POSICOES_SAB)
    expect(semDono).toEqual([])
    expect(rodape).toEqual([
      'GUILHERME DIDOMENICO', 'JOAO HENRIQUE', // P1, P2 — saem por último
      'MARILIO', 'RAFAEL', 'GABRIELA', 'ERLEI', 'GABRIEL', 'STAUB', 'ROBERTA', 'VICENTE',
      'CRISTINA', 'MATHEUS', // P3, P4 — retaguarda da manhã, saem primeiro
    ])
  })
  it('sábado vespertino: rodapé abre com P3,P4 (Unimed/HRO das 13-19)', () => {
    const { rodape, semDono } = rodapeDeOrdemDoc(ORDEM_DOC_SAB_VESP, POSICOES_SAB)
    expect(semDono).toEqual([])
    expect(rodape).toEqual(['CRISTINA', 'MATHEUS', 'ERLEI', 'GABRIELA', 'ROBERTA', 'STAUB', 'GABRIEL'])
  })
  it('Pn sem dono no mapeamento vai para semDono (a conferência bloqueia — nunca chutar)', () => {
    const { rodape, semDono } = rodapeDeOrdemDoc(['P4', 'P9', 'P3'], { P3: 'CRISTINA', P4: 'MATHEUS' })
    expect(semDono).toEqual(['P9'])
    expect(rodape).toEqual(['CRISTINA', 'MATHEUS'])
  })
  it('nome escrito por extenso no doc passa como está', () => {
    const { rodape } = rodapeDeOrdemDoc(['GABRIELA', 'P3'], { P3: 'CRISTINA' })
    expect(rodape).toEqual(['CRISTINA', 'GABRIELA'])
  })
})

describe('sugerirRodapeFds — turno sem linha explícita (domingo)', () => {
  const doming = { grade: GRADE_DOM, posicoes: { ...POSICOES_SAB, P7: 'THAYNA' }, escalacao: { matutino: ['P8', 'P7', 'P11'], vespertino: ['P7', 'P8', 'P11'] } }
  it('manhã: col1, col2 → P8, P7, P11 → col3, col4 (já na convenção do rodapé)', () => {
    expect(sugerirRodapeFds(doming, 'matutino')).toEqual([
      'CRISTINA', 'MATHEUS', 'RAFAEL', 'THAYNA', 'GABRIEL', 'JOAO HENRIQUE', 'GUILHERME DIDOMENICO',
    ])
  })
  it('tarde: P7 e P8 invertem, demais regras mantidas', () => {
    expect(sugerirRodapeFds(doming, 'vespertino')).toEqual([
      'GUILHERME DIDOMENICO', 'JOAO HENRIQUE', 'THAYNA', 'RAFAEL', 'GABRIEL', 'MATHEUS', 'CRISTINA',
    ])
  })
  it('dedupe: pessoa repetida entre grade e lista entra uma vez (1ª ocorrência)', () => {
    const comRepetida = {
      grade: GRADE_DOM,
      posicoes: { P8: 'CRISTINA' }, // hipoteticamente a mesma da col1
      escalacao: { matutino: ['P8'] },
    }
    expect(sugerirRodapeFds(comRepetida, 'matutino')).toEqual([
      'CRISTINA', 'MATHEUS', 'JOAO HENRIQUE', 'GUILHERME DIDOMENICO',
    ])
  })
  it('noite SEM data cai nos 4 da grade (não dá para saber se é sáb ou dom)', () => {
    // dom 19-07: JOAO RICARDO (Unimed), MATHEUS (HRO), GD (ret1), JH (ret2)
    // = P3(vaga), P4, P1, P2. ⚠️ este teste MUDOU DE ASSUNTO em 29/08: era a
    // regra ("noite = só a grade") e virou o FALLBACK. A fila da noite é maior
    // que a grade desde 16/08 e agora nasce completa — mas só quando a data
    // diz o dia da semana. Sem ela, o comportamento antigo é o seguro.
    expect(sugerirRodapeFds(doming, 'noturno')).toEqual([
      'JOAO RICARDO', 'MATHEUS', 'GUILHERME DIDOMENICO', 'JOAO HENRIQUE',
    ])
  })
  it('turno desconhecido → []', () => {
    expect(sugerirRodapeFds(doming, 'xpto')).toEqual([])
  })
})

/**
 * A fila da NOITE é maior que a grade (dono 16/08, reafirmado em 29/08 quando
 * as duas noites saíram só com os quatro da faixa 19-07: "não saíram todos os
 * usuários de plantão na ordem estabelecida — faltam P5, P6, P7 e P8").
 *
 * A prova de que a regra está certa é histórica, não inventada aqui: as duas
 * filas esperadas abaixo são LITERALMENTE os valores que a migration
 * 20260816120000 gravou à mão depois de o dono ditá-los — se a sugestão
 * automática reproduz aquele fim de semana, ela reproduz a regra.
 */
describe('sugerirRodapeFds — a fila da noite completa (P\'s da lista numerada)', () => {
  const sabado = { data: '2026-08-15', grade: GRADE_SAB, posicoes: POSICOES_SAB, escalacao: ESCALACAO_SAB }
  const domingo = {
    data: '2026-08-16', grade: GRADE_DOM, posicoes: POSICOES_SAB,
    escalacao: { matutino: ['P8', 'P7', 'P11'], vespertino: ['P7', 'P8', 'P11'] },
  }

  it('sábado: grade 19-07 (P2,P1,P4,P3) + P11, P8, P7', () => {
    expect(sugerirRodapeFds(sabado, 'noturno')).toEqual([
      'JOAO HENRIQUE', 'GUILHERME DIDOMENICO', 'MATHEUS', 'CRISTINA', // P2 P1 P4 P3
      'GABRIEL', 'RAFAEL', 'MARILIO',                                  // P11 P8 P7
    ])
  })

  it('domingo: grade 19-07 (P3,P4,P1,P2) + P11, P6, P5 — e o P\'s são OUTROS', () => {
    // sáb e dom NÃO recebem os mesmos numerados; um teste só com o sábado
    // passaria com a lista errada dos dois lados.
    expect(sugerirRodapeFds(domingo, 'noturno')).toEqual([
      'JOAO RICARDO', 'MATHEUS', 'GUILHERME DIDOMENICO', 'JOAO HENRIQUE', // P3(vaga) P4 P1 P2
      'GABRIEL', 'ERLEI', 'GABRIELA',                                      // P11 P6 P5
    ])
  })

  it('os numerados entram DEPOIS dos quatro da grade — são os que liberam primeiro', () => {
    const fila = sugerirRodapeFds(sabado, 'noturno')
    // convenção do rodapé: a 1ª posição sai por ÚLTIMO. Os quatro postos ficam
    // na frente; inverter isto mandaria o plantão da Unimed embora primeiro.
    expect(fila.slice(0, 4)).toEqual(['JOAO HENRIQUE', 'GUILHERME DIDOMENICO', 'MATHEUS', 'CRISTINA'])
    expect(fila.indexOf('MARILIO')).toBe(fila.length - 1)
  })

  it('substituto na vaga entra no lugar dele, sem duplicar (JOAO RICARDO cobre o P3)', () => {
    // a grade de domingo traz JOAO RICARDO onde CRISTINA (P3) estaria; ele é
    // quem entra na fila, e CRISTINA não aparece
    const fila = sugerirRodapeFds(domingo, 'noturno')
    expect(fila).toContain('JOAO RICARDO')
    expect(fila).not.toContain('CRISTINA')
  })

  it('Pn sem dono no mapeamento é omitido, nunca chutado', () => {
    const semP8 = { ...sabado, posicoes: { ...POSICOES_SAB, P8: '' } }
    expect(sugerirRodapeFds(semP8, 'noturno')).toEqual([
      'JOAO HENRIQUE', 'GUILHERME DIDOMENICO', 'MATHEUS', 'CRISTINA', 'GABRIEL', 'MARILIO',
    ])
  })

  it('feriado não tem fila de noite — a data não é sáb/dom e a lista fica só na grade', () => {
    const feriado = { ...sabado, data: '2026-08-25' } // terça-feira
    expect(sugerirRodapeFds(feriado, 'noturno')).toEqual([
      'JOAO HENRIQUE', 'GUILHERME DIDOMENICO', 'MATHEUS', 'CRISTINA',
    ])
  })
})

describe('plantonistasFaixaFds', () => {
  it('devolve quem está fisicamente em Unimed/HRO na faixa', () => {
    expect(plantonistasFaixaFds(GRADE_SAB, '7-13')).toEqual({ unimed: 'GUILHERME DIDOMENICO', hro: 'JOAO HENRIQUE' })
    expect(plantonistasFaixaFds(GRADE_SAB, '13-19')).toEqual({ unimed: 'CRISTINA', hro: 'MATHEUS' })
    expect(plantonistasFaixaFds(GRADE_SAB, '19-07')).toEqual({ unimed: 'JOAO HENRIQUE', hro: 'GUILHERME DIDOMENICO' })
  })
  it('grade ausente → nulls', () => {
    expect(plantonistasFaixaFds(null, '7-13')).toEqual({ unimed: null, hro: null })
  })
})

describe('linhasNoturnasFds — só os 4 plantões da faixa 19-07', () => {
  it('sábado: cols 1–2 fixas (foraDaFila) e cols 3–4 na ordem de chamada, com selo Pn', () => {
    const linhas = linhasNoturnasFds(GRADE_SAB, POSICOES_SAB)
    expect(linhas.map((l) => l.nome)).toEqual(['JOAO HENRIQUE', 'GUILHERME DIDOMENICO', 'MATHEUS', 'CRISTINA'])
    expect(linhas.map((l) => l.setor)).toEqual(['P2', 'P1', 'P4', 'P3'])
    expect(linhas.map((l) => l.foraDaFila)).toEqual([true, true, false, false])
    // sem badge genérico "Plantonista" à noite: o papel (Plantão Unimed/HRO) já
    // diz o posto — e dois badges iguais diriam menos que "qual hospital"
    expect(linhas.every((l) => l.isPlantonista === false)).toBe(true)
    expect(linhas[0].papel).toBe('Plantão Unimed')
    expect(linhas[1].papel).toBe('Plantão HRO')
  })
  it('domingo: JOAO RICARDO (substituto) assume a VAGA P3 da Cristina — nunca o P2 do JOAO HENRIQUE', () => {
    // ordem ditada pelo dono p/ domingo à noite: P3, P4, P1, P2
    const linhas = linhasNoturnasFds(GRADE_DOM, POSICOES_SAB)
    expect(linhas.map((l) => l.nome)).toEqual(['JOAO RICARDO', 'MATHEUS', 'GUILHERME DIDOMENICO', 'JOAO HENRIQUE'])
    expect(linhas.map((l) => l.setor)).toEqual(['P3', 'P4', 'P1', 'P2'])
    const joaoRicardo = linhas[0]
    expect(joaoRicardo.cobrindo).toBe('CRISTINA') // a vaga é dela (cor no documento)
    expect(joaoRicardo.papel).toBe('Plantão Unimed · Substituindo CRISTINA')
    expect(joaoRicardo.foraDaFila).toBe(true) // fixo na Unimed
  })
  it('vaga só é atribuída quando é 1↔1 (2 desconhecidos → ninguém recebe selo)', () => {
    const grade = { '19-07': { unimed: 'FULANO', hro: 'BELTRANO', ret1: 'MATHEUS', ret2: 'CRISTINA' } }
    const linhas = linhasNoturnasFds(grade, POSICOES_SAB)
    expect(linhas.filter((l) => !l.setor).map((l) => l.nome)).toEqual(['FULANO', 'BELTRANO'])
  })
  it('célula vazia não vira card', () => {
    const linhas = linhasNoturnasFds({ '19-07': { unimed: 'A', hro: '', ret1: ' ', ret2: 'B' } }, {})
    expect(linhas.map((l) => l.nome)).toEqual(['A', 'B'])
  })
})

describe('ordem DITADA da noite (dono 16/08 — "apenas adicione os P\'s faltantes")', () => {
  // sáb: P2, P1, P4, P3 (grade 19-07) + P11, P8, P7 da lista numerada
  const ORDEM_NOITE_SAB = ['JOAO HENRIQUE', 'GUILHERME DIDOMENICO', 'MATHEUS', 'CRISTINA', 'GABRIEL', 'RAFAEL', 'MARILIO']
  // dom: P3 (coberto por JOAO RICARDO), P4, P1, P2 + P11, P6, P5
  const ORDEM_NOITE_DOM = ['JOAO RICARDO', 'MATHEUS', 'GUILHERME DIDOMENICO', 'JOAO HENRIQUE', 'GABRIEL', 'ERLEI', 'GABRIELA']

  it('sábado: os 7 na ordem ditada, com o Pn de cada um', () => {
    const linhas = linhasNoturnasFds(GRADE_SAB, POSICOES_SAB, { ordem: ORDEM_NOITE_SAB })
    expect(linhas.map((l) => l.setor)).toEqual(['P2', 'P1', 'P4', 'P3', 'P11', 'P8', 'P7'])
    expect(linhas.map((l) => l.nome)).toEqual(ORDEM_NOITE_SAB)
  })

  it('quem veio da lista numerada entra na FILA (libera primeiro) e sem posto', () => {
    const linhas = linhasNoturnasFds(GRADE_SAB, POSICOES_SAB, { ordem: ORDEM_NOITE_SAB })
    const acrescentados = linhas.slice(4)
    expect(acrescentados.every((l) => l.foraDaFila === false)).toBe(true)
    expect(acrescentados.every((l) => l.papel === null)).toBe(true)
    // os dois plantões físicos seguem fora do "próximo a ser liberado"
    expect(linhas.slice(0, 2).every((l) => l.foraDaFila === true)).toBe(true)
    expect(linhas[0].papel).toBe('Plantão Unimed')
  })

  it('domingo: o substituto abre a fila com a vaga que cobre', () => {
    const linhas = linhasNoturnasFds(GRADE_DOM, POSICOES_SAB, { ordem: ORDEM_NOITE_DOM })
    expect(linhas.map((l) => l.setor)).toEqual(['P3', 'P4', 'P1', 'P2', 'P11', 'P6', 'P5'])
    expect(linhas[0].papel).toBe('Plantão Unimed · Substituindo CRISTINA')
  })

  it('sem ordem publicada, a fila continua sendo a linha 19-07 (comportamento de sempre)', () => {
    expect(linhasNoturnasFds(GRADE_SAB, POSICOES_SAB, { ordem: [] }).map((l) => l.setor))
      .toEqual(['P2', 'P1', 'P4', 'P3'])
  })

  it('quem está de plantão e ficou FORA da ordem não some — entra na frente (sai por último)', () => {
    const linhas = linhasNoturnasFds(GRADE_SAB, POSICOES_SAB, { ordem: ['MATHEUS', 'CRISTINA', 'GABRIEL'] })
    expect(linhas.map((l) => l.nome)).toEqual(['JOAO HENRIQUE', 'GUILHERME DIDOMENICO', 'MATHEUS', 'CRISTINA', 'GABRIEL'])
  })

  it('nome repetido na ordem não duplica card', () => {
    const linhas = linhasNoturnasFds(GRADE_SAB, POSICOES_SAB, { ordem: ['MATHEUS', 'MATHEUS', 'GABRIEL'] })
    expect(linhas.filter((l) => l.nome === 'MATHEUS')).toHaveLength(1)
  })
})

describe('resolverNomeEstrito — sem colapso por primeiro nome (16/08)', () => {
  // dicionário real: alias "JOAO" aponta p/ o JOAO HENRIQUE
  const resolverUid = (n) => ({ 'JOAO': 'uid-jh', 'JOAO HENRIQUE': 'uid-jh', 'MATHEUS': 'uid-mat' }[String(n).toUpperCase()] || null)
  it('nome COMPOSTO não casa por token solto — JOAO RICARDO ≠ JOAO HENRIQUE', () => {
    expect(resolverNomeEstrito('JOAO RICARDO', resolverUid)).toBe(null)
    expect(resolverNomeEstrito('JOAO HENRIQUE', resolverUid)).toBe('uid-jh')
  })
  it('nome de UM token continua valendo por ele mesmo', () => {
    expect(resolverNomeEstrito('MATHEUS', resolverUid)).toBe('uid-mat')
  })
  it('sem resolver → null', () => {
    expect(resolverNomeEstrito('QUALQUER', null)).toBe(null)
  })
})

describe('marcarSelosFds — badge P1–P12 na fila conforme a posição', () => {
  const linha = (over) => ({ chave: '', uid: null, nomeOriginal: null, anestesista: '', ...over })
  it('marca pelo nome do rodapé e deixa sem selo quem não tem posição', () => {
    const linhas = [
      linha({ chave: 'GUILHERME DIDOMENICO', anestesista: 'Guilherme Didomenico', nomeOriginal: 'GUILHERME DIDOMENICO' }),
      linha({ chave: 'VICENTE', anestesista: 'Vicente', nomeOriginal: 'VICENTE' }),
      linha({ chave: 'AJUDA AVULSA', anestesista: 'Ajuda Avulsa', nomeOriginal: 'AJUDA AVULSA' }),
    ]
    const out = marcarSelosFds(linhas, POSICOES_SAB)
    expect(out[0].selo).toBe('P1')
    expect(out[1].selo).toBe('P12')
    expect(out[2].selo).toBeUndefined()
  })
  it('casa por uid quando o resolver conhece o vínculo (nunca pelo nome exibido)', () => {
    const resolverUid = (nome) => (String(nome).toUpperCase().includes('STAUB') ? 'uid-staub' : null)
    const linhas = [linha({ chave: 'uid-staub', uid: 'uid-staub', anestesista: 'Gustavo Staub' })]
    const out = marcarSelosFds(linhas, POSICOES_SAB, { resolverUid })
    expect(out[0].selo).toBe('P10')
  })
  it('card noturno que já veio com selo da fusão não é sobrescrito', () => {
    const out = marcarSelosFds([linha({ chave: 'CRISTINA', selo: 'P3', noturno: true })], POSICOES_SAB)
    expect(out[0].selo).toBe('P3')
  })
  it('sem posições → linhas intactas', () => {
    const linhas = [linha({ chave: 'X' })]
    expect(marcarSelosFds(linhas, {})).toBe(linhas)
  })
})

describe('normalizarParseFds — resposta da edge → modelo da conferência', () => {
  const respostaEdge = {
    dias: [
      {
        data: '2026-08-15',
        plantoes: { P1: 'GUILHERME DIDOMENICO', P2: 'JOAO HENRIQUE', P3: 'CRISTINA', P4: 'MATHEUS' },
        grade: GRADE_SAB,
        listas: {
          matutino: [
            { n: 5, nome: 'GABRIELA' }, { n: 6, nome: 'ERLEI' }, { n: 7, nome: 'MARILIO' },
            { n: 8, nome: 'RAFAEL' }, { n: 9, nome: 'ROBERTA' }, { n: 10, nome: 'STAUB' },
            { n: 11, nome: 'GABRIEL' }, { n: 12, nome: 'VICENTE' },
          ],
          vespertino: [
            { n: 6, nome: 'ERLEI' }, { n: 5, nome: 'GABRIELA' }, { n: 9, nome: 'ROBERTA' },
            { n: 10, nome: 'STAUB' }, { n: 11, nome: 'GABRIEL' },
          ],
        },
        ordemLiberacaoDoc: { matutino: ORDEM_DOC_SAB_MAT, vespertino: ORDEM_DOC_SAB_VESP },
      },
      {
        data: '2026-08-16',
        grade: GRADE_DOM,
        listas: {
          matutino: [{ n: 8, nome: 'RAFAEL' }, { n: 7, nome: 'THAYNA' }, { n: 11, nome: 'GABRIEL' }],
          vespertino: [{ n: 7, nome: 'THAYNA' }, { n: 8, nome: 'RAFAEL' }, { n: 11, nome: 'GABRIEL' }],
        },
        ordemLiberacaoDoc: { matutino: [], vespertino: [] },
      },
    ],
    ignorados: ['PLANTÃO MATERNO: 15/08 – RENATA', 'PLANTÃO MATERNO: 16/08 – ELISETE'],
  }

  it('sábado completo: posições P1–P12, escalação por período e ordem do doc normalizada (P09→P9)', () => {
    const { dias, ignorados, avisos } = normalizarParseFds(respostaEdge)
    expect(avisos).toEqual([])
    expect(ignorados).toHaveLength(2) // funcionárias NUNCA viram posição/linha — só informativo
    const sab = dias.find((d) => d.data === '2026-08-15')
    expect(sab.posicoes).toEqual(POSICOES_SAB)
    expect(sab.escalacao).toEqual(ESCALACAO_SAB)
    expect(sab.ordemDoc.matutino).toEqual(['P4', 'P3', 'P12', 'P9', 'P10', 'P11', 'P6', 'P5', 'P8', 'P7', 'P2', 'P1'])
  })
  it('domingo herda o mapeamento do sábado; a troca pessoal (7º=THAYNA) vence a herança', () => {
    const { dias } = normalizarParseFds(respostaEdge)
    const dom = dias.find((d) => d.data === '2026-08-16')
    expect(dom.posicoes.P7).toBe('THAYNA')   // do próprio dia
    expect(dom.posicoes.P7).not.toBe('MARILIO')
    expect(dom.posicoes.P1).toBe('GUILHERME DIDOMENICO') // herdado do sábado
    expect(dom.posicoes.P12).toBe('VICENTE')             // herdado do sábado
    expect(dom.escalacao.matutino).toEqual(['P8', 'P7', 'P11'])
    expect(dom.escalacao.vespertino).toEqual(['P7', 'P8', 'P11'])
  })
  it('dia que não é sábado/domingo é descartado com aviso', () => {
    const { dias, avisos } = normalizarParseFds({ dias: [{ data: '2026-08-14', grade: {}, listas: {} }] })
    expect(dias).toEqual([])
    expect(avisos.some((a) => a.includes('2026-08-14'))).toBe(true)
  })
  it('feriado cadastrado aceita lista simples e deriva as duas ordens sem Pn', () => {
    const { dias, avisos } = normalizarParseFds({
      dias: [{ data: '2026-08-25', listaFeriado: LISTA_FERIADO_25_08 }],
    })
    expect(avisos).toEqual([])
    expect(dias).toHaveLength(1)
    expect(dias[0].tipo).toBe('feriado')
    expect(dias[0].posicoes).toEqual({})
    expect(dias[0].ordemDoc).toEqual(ordensDocumentoFeriado(LISTA_FERIADO_25_08))
  })
  it('mesmo Pn com dois nomes diferentes no MESMO dia gera aviso (1ª ocorrência vence)', () => {
    const { dias, avisos } = normalizarParseFds({
      dias: [{
        data: '2026-08-15',
        grade: {},
        listas: { matutino: [{ n: 5, nome: 'GABRIELA' }], vespertino: [{ n: 5, nome: 'OUTRA' }] },
      }],
    })
    expect(dias[0].posicoes.P5).toBe('GABRIELA')
    expect(avisos.some((a) => a.includes('P5'))).toBe(true)
  })
  it('posicoesBase (importação só do domingo) preenche o que o dia não traz', () => {
    const { dias } = normalizarParseFds(
      { dias: [{ data: '2026-08-16', grade: GRADE_DOM, listas: { matutino: [{ n: 7, nome: 'THAYNA' }] } }] },
      { posicoesBase: POSICOES_SAB }
    )
    expect(dias[0].posicoes.P7).toBe('THAYNA')
    expect(dias[0].posicoes.P10).toBe('STAUB')
  })
})
