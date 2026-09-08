/**
 * O roster como vocabulário da leitura (Onda 4, item 4.7).
 *
 * As duas metades desta trava puxam para lados opostos, de propósito:
 *
 * - FECHAR: "GUILHERME M ELO" (o kerning parte o sobrenome) tem que voltar a
 *   ser o GUILHERME MELO do grupo, na leitura, e não só lá na conferência.
 * - NÃO FECHAR DEMAIS: quem ajuda vindo de outro hospital pode legitimamente
 *   não estar no roster. Forçar o nome dele para o mais parecido do grupo
 *   trocaria a pessoa — erro pior que o original. Nome ambíguo é nulo (a mesma
 *   regra que a legenda da escala numérica já segue).
 */
import { describe, it, expect } from 'vitest'
import {
  prepararRoster, casarComRoster, resolverRoster,
} from '../../../supabase/functions/_shared/escala-roster.ts'
import { vocabularioVision } from '../../lib/escalaVocabularioVision'

const ROSTER = ['GUILHERME MELO', 'JOÃO HENRIQUE', 'RAQUEL', 'GABRIELA', 'DANIELA']

describe('prepararRoster', () => {
  it('tira repetido, lixo e vazio, e ORDENA (o cache do system depende disso)', () => {
    const a = prepararRoster(['Raquel', 'raquel', '  ', '123', null, 'Ana'])
    const b = prepararRoster(['Ana', '123', 'Raquel'])
    expect(a).toEqual(b) // mesma lista em ordem diferente → mesmo prefixo cacheado
    expect(a).toEqual(['Ana', 'Raquel'])
  })

  it('o teto NÃO corta o grupo real — o dicionário tem 102 apelidos', () => {
    const muitos = Array.from({ length: 102 }, (_, i) => `APELIDO${String(i).padStart(3, '0')}`)
    expect(prepararRoster(muitos)).toHaveLength(102)
    // e ainda protege de lista absurda vinda de cliente adulterado
    expect(prepararRoster(Array.from({ length: 400 }, (_, i) => `N${i}`))).toHaveLength(150)
  })

  it('devolve lista vazia para entrada inválida', () => {
    expect(prepararRoster(null)).toEqual([])
    expect(prepararRoster('RAQUEL')).toEqual([])
  })
})

describe('casarComRoster', () => {
  it('conserta o espaço que o kerning inventou no meio do sobrenome', () => {
    expect(casarComRoster('GUILHERME M ELO', ROSTER)).toBe('GUILHERME MELO')
    expect(casarComRoster('GUILHERMEMELO', ROSTER)).toBe('GUILHERME MELO')
  })

  it('casa o nome abreviado com o canônico', () => {
    expect(casarComRoster('JOAO H', ROSTER)).toBe('JOÃO HENRIQUE')
    expect(casarComRoster('João Henrique', ROSTER)).toBe('JOÃO HENRIQUE')
  })

  it('casa pelo primeiro nome quando só uma pessoa do grupo o tem', () => {
    expect(casarComRoster('RAQUEL SOUZA', ROSTER)).toBe('RAQUEL')
  })

  it('NÃO casa quando dois do grupo têm o mesmo primeiro nome — ambíguo é nulo', () => {
    const comDoisJoao = [...ROSTER, 'JOÃO PEDRO']
    expect(casarComRoster('JOAO', comDoisJoao)).toBe('')
  })

  it('NÃO casa quem é de fora do grupo', () => {
    expect(casarComRoster('CRISTINA', ROSTER)).toBe('')
    expect(casarComRoster('', ROSTER)).toBe('')
    expect(casarComRoster('RAQUEL', [])).toBe('')
  })

  it('não casa por prefixo curto demais (evita colar em quase tudo)', () => {
    expect(casarComRoster('G', ROSTER)).toBe('')
    expect(casarComRoster('DA', ROSTER)).toBe('')
  })
})

describe('resolverRoster', () => {
  it('corrige o nome que o modelo escolheu quando ele é do grupo mal escrito', () => {
    const { casos, contagem } = resolverRoster(
      [{ anestesista: 'GUILHERME M ELO' }], ROSTER,
    )
    expect(casos[0].anestesista).toBe('GUILHERME MELO')
    expect(contagem.rosterCorrigido).toBe(1)
  })

  it('PRESERVA quem é de fora e marca — nunca troca pela pessoa mais parecida', () => {
    const { casos, contagem } = resolverRoster([{ anestesista: 'CRISTINA' }], ROSTER)
    expect(casos[0].anestesista).toBe('CRISTINA')
    expect(casos[0].foraDoRoster).toBe(true)
    expect(contagem.foraDoRoster).toBe(1)
  })

  it('`foraDoRoster` é RESULTADO do casamento, não pergunta ao modelo', () => {
    // perguntar custaria mais uma propriedade opcional no schema, e esse
    // orçamento é o que decide se a saída dobra de tamanho
    const { casos } = resolverRoster([{ anestesista: 'GABRIELA' }], ROSTER)
    expect(casos[0].foraDoRoster).toBeUndefined()
  })

  it('não mexe em "//", em "?" nem em célula vazia', () => {
    const { casos } = resolverRoster(
      [{ anestesista: '//' }, { anestesista: '' }, { anestesista: '?' }], ROSTER,
    )
    expect(casos.map((c) => c.anestesista)).toEqual(['//', '', '?'])
    expect(casos.every((c) => c.foraDoRoster === undefined)).toBe(true)
  })

  it('sem roster, não faz nada (o lote pode ler antes do roster carregar)', () => {
    const { casos, contagem } = resolverRoster([{ anestesista: 'QUALQUER' }], [])
    expect(casos[0].anestesista).toBe('QUALQUER')
    expect(contagem).toEqual({})
  })
})

describe('vocabularioVision (o que o cliente manda)', () => {
  it('manda os APELIDOS, que é como o mapa escreve — não o nome completo', () => {
    expect(vocabularioVision([
      { uid: '1', nome: 'Guilherme Melo Didomenico', apelidos: ['GUILHERME M', 'DIDOMENICO'] },
    ])).toEqual(['GUILHERME M', 'DIDOMENICO'])
  })

  it('quem não tem apelido entra pelo PRIMEIRO nome (nome completo não aparece no quadro)', () => {
    expect(vocabularioVision([{ uid: '2', nome: 'Raquel Ferreira', apelidos: [] }]))
      .toEqual(['Raquel'])
  })

  it('sobrevive a roster vazio, nulo e a entradas quebradas', () => {
    expect(vocabularioVision([])).toEqual([])
    expect(vocabularioVision(null)).toEqual([])
    expect(vocabularioVision([{ uid: '3' }, { uid: '4', nome: '  ', apelidos: [] }])).toEqual([])
  })
})
