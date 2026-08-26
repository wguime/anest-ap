import { describe, it, expect } from 'vitest'
import { agruparVariantes, resumoDoGrupo } from '../../lib/agrupamentoFarmacos'
import { ANTICOAGULANTES } from '../../lib/anticoagulantes'
import { INIBIDORES, CLASSES } from '../../lib/inibidoresApetite'

describe('agruparVariantes', () => {
  it('quem não declara grupo é o próprio cartão', () => {
    const cards = agruparVariantes([{ id: 'a', farmaco: 'A' }, { id: 'b', farmaco: 'B' }])
    expect(cards).toHaveLength(2)
    expect(cards.every((c) => c.unico)).toBe(true)
    expect(cards.map((c) => c.nome)).toEqual(['A', 'B'])
  })

  it('junta variantes do mesmo grupo num cartão só, com os rótulos', () => {
    const cards = agruparVariantes([
      { id: 'x1', farmaco: 'X — dose baixa', grupo: 'x', grupoNome: 'X', variante: 'Dose baixa' },
      { id: 'x2', farmaco: 'X — dose alta', grupo: 'x', grupoNome: 'X', variante: 'Dose alta' },
    ])
    expect(cards).toHaveLength(1)
    expect(cards[0].unico).toBe(false)
    expect(cards[0].nome).toBe('X')
    expect(cards[0].rotulos).toEqual(['Dose baixa', 'Dose alta'])
  })

  /**
   * A ordem dentro da classe é decisão clínica (dose baixa antes de alta),
   * não alfabética — ordenar aqui reescreveria a base em silêncio.
   */
  it('preserva a ordem de aparição da base', () => {
    const cards = agruparVariantes([
      { id: 'b', farmaco: 'B' },
      { id: 'a1', farmaco: 'A1', grupo: 'a', grupoNome: 'A', variante: 'um' },
      { id: 'a2', farmaco: 'A2', grupo: 'a', grupoNome: 'A', variante: 'dois' },
      { id: 'c', farmaco: 'C' },
    ])
    expect(cards.map((c) => c.chave)).toEqual(['b', 'a', 'c'])
    expect(cards[1].variantes.map((v) => v.id)).toEqual(['a1', 'a2'])
  })

  /**
   * Com a busca casando SÓ uma variante, o cartão tem de mostrar o nome
   * completo do fármaco: exibir "Enoxaparina" ali esconderia qual das duas
   * doses o resultado é.
   */
  it('grupo com uma variante presente exibe o nome COMPLETO do fármaco', () => {
    const cards = agruparVariantes([
      { id: 'x2', farmaco: 'X — dose alta', grupo: 'x', grupoNome: 'X', variante: 'Dose alta' },
    ])
    expect(cards[0].unico).toBe(true)
    expect(cards[0].nome).toBe('X — dose alta')
  })

  it('o cartão do grupo reúne as marcas de todas as apresentações, sem repetir', () => {
    const cards = agruparVariantes([
      { id: 'x1', farmaco: 'X1', grupo: 'x', grupoNome: 'X', variante: 'um', comerciais: ['Aa', 'Bb'] },
      { id: 'x2', farmaco: 'X2', grupo: 'x', grupoNome: 'X', variante: 'dois', comerciais: ['Bb', 'Cc'] },
    ])
    expect(cards[0].comerciais).toEqual(['Aa', 'Bb', 'Cc'])
  })

  it('fármaco sem marca não quebra o cartão', () => {
    expect(agruparVariantes([{ id: 'a', farmaco: 'A' }])[0].comerciais).toEqual([])
  })

  it('lista vazia não quebra', () => {
    expect(agruparVariantes([])).toEqual([])
    expect(agruparVariantes()).toEqual([])
  })

  it('não perde nem duplica fármaco em nenhuma das duas bases', () => {
    ;[ANTICOAGULANTES, INIBIDORES].forEach((base) => {
      const dentro = agruparVariantes(base).flatMap((c) => c.variantes.map((v) => v.id))
      expect(dentro.sort()).toEqual(base.map((f) => f.id).sort())
    })
  })
})

describe('resumoDoGrupo', () => {
  const ler = (f) => f.r

  it('variante única devolve o próprio resumo', () => {
    expect(resumoDoGrupo([{ r: '7 dias' }], ler)).toBe('7 dias')
  })

  it('variantes convergentes mostram o valor, que vale para todas', () => {
    expect(resumoDoGrupo([{ r: '7 dias' }, { r: '7 dias' }], ler)).toBe('7 dias')
  })

  /**
   * Invariante clínico: um número no cartão da lista seria lido como "o"
   * intervalo daquela medicação, e ele depende da dose que ainda não foi
   * escolhida.
   *
   * ⚠️ Este teste MUDOU DE LADO em 25/08. A 1ª versão devolvia a contagem
   * ("2 opções") e o dono reprovou: badge é lugar de dado clínico, não de
   * metadado da lista. Divergindo, o cartão fica SEM badge — quem quer o
   * número abre a medicação.
   */
  it('variantes divergentes não ganham badge nenhum', () => {
    expect(resumoDoGrupo([{ r: '1 dia' }, { r: '7 dias' }], ler)).toBeNull()
    expect(resumoDoGrupo([{ r: '4–6 h' }, { r: '12 h' }, { r: '24 h' }], ler)).toBeNull()
  })

  it('variante sem resumo legível também não inventa badge', () => {
    expect(resumoDoGrupo([{ r: '7 dias' }, { r: null }], ler)).toBeNull()
  })

  it('lista vazia devolve null', () => {
    expect(resumoDoGrupo([], ler)).toBeNull()
  })
})

describe('as duas bases estão marcadas como o componente espera', () => {
  it('anticoagulantes: 30 fármacos viram 22 cartões', () => {
    expect(ANTICOAGULANTES).toHaveLength(30)
    expect(agruparVariantes(ANTICOAGULANTES)).toHaveLength(22)
  })

  it('inibidores: 15 fármacos viram 13 cartões', () => {
    expect(INIBIDORES).toHaveLength(15)
    expect(agruparVariantes(INIBIDORES)).toHaveLength(13)
  })

  it('toda variante declara grupo, grupoNome e rótulo — sem os três o cartão sai sem nome', () => {
    ;[ANTICOAGULANTES, INIBIDORES].forEach((base) => {
      agruparVariantes(base)
        .filter((c) => !c.unico)
        .forEach((c) => {
          c.variantes.forEach((v) => {
            expect(v.grupo, `grupo em ${v.id}`).toBeTruthy()
            expect(v.grupoNome, `grupoNome em ${v.id}`).toBeTruthy()
            expect(v.variante, `variante em ${v.id}`).toBeTruthy()
          })
          // o mesmo grupoNome em todas: o cartão lê o da primeira
          expect(new Set(c.variantes.map((v) => v.grupoNome)).size).toBe(1)
          // rótulos distintos: dois "Dose alta" no mesmo cartão seriam ilegíveis
          expect(new Set(c.rotulos).size).toBe(c.rotulos.length)
        })
    })
  })

  it('variantes do mesmo grupo ficam na MESMA classe — senão o cartão apareceria duas vezes', () => {
    ;[ANTICOAGULANTES, INIBIDORES].forEach((base) => {
      const porGrupo = new Map()
      base.filter((f) => f.grupo).forEach((f) => {
        if (!porGrupo.has(f.grupo)) porGrupo.set(f.grupo, new Set())
        porGrupo.get(f.grupo).add(f.classe)
      })
      porGrupo.forEach((classes, grupo) => {
        expect(classes.size, `grupo ${grupo} espalhado por ${[...classes].join(', ')}`).toBe(1)
      })
    })
  })

  /**
   * O dono pediu (25/08) a marca em TODOS os cartões das duas listas. A linha
   * só aparece se o dado existir, então o que protege o pedido é a base estar
   * completa — hoje 45 de 45.
   */
  it('todo cartão das duas listas tem pelo menos uma marca comercial', () => {
    ;[ANTICOAGULANTES, INIBIDORES].forEach((base) => {
      agruparVariantes(base).forEach((c) => {
        expect(c.comerciais.length, `sem marca em "${c.nome}"`).toBeGreaterThan(0)
      })
    })
  })

  it('a classe de cada inibidor continua declarada', () => {
    INIBIDORES.forEach((f) => expect(CLASSES[f.classe], f.id).toBeDefined())
  })
})
