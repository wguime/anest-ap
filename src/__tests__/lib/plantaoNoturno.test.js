/**
 * plantaoNoturno — fase noturna das Liberações (decisões do dono a/b/c 23/07):
 * 19h vira 'noite' (HRO P1→P4 · Unimed P2→P3→P4 · Materno P4), 23h ZERA
 * mantendo só os P1–P4 (pedido do dono 24/07),
 * FDS sem transição, feriado seg–sex SEGUE a regra, outra data sempre 'dia'.
 */
import { describe, it, expect } from 'vitest'
import {
  faseLiberacoes, plantonistasNoturnos, candidatosNome, plantonistaNoturnoDe, linhasNoturnas,
  fundirLinhasNoturnas, marcarSelosNoTurno, ehDiaUtil,
} from '../../lib/plantaoNoturno'

const HOJE = '2026-07-23' // quinta-feira
const args = (agoraMin, dataEscala = HOJE, hojeIso = HOJE) => ({ agoraMin, dataEscala, hojeIso })

describe('faseLiberacoes', () => {
  // corte movido de 22h para 23h (pedido do dono 24/07)
  it('dia útil: dia antes das 19h, noite 19h–23h, zerada às 23h', () => {
    expect(faseLiberacoes(args(18 * 60 + 59))).toBe('dia')
    expect(faseLiberacoes(args(19 * 60))).toBe('noite')
    expect(faseLiberacoes(args(21 * 60 + 59))).toBe('noite')
    expect(faseLiberacoes(args(22 * 60))).toBe('noite')      // 22h ainda é noite
    expect(faseLiberacoes(args(22 * 60 + 59))).toBe('noite')
    expect(faseLiberacoes(args(23 * 60))).toBe('zerada')
    expect(faseLiberacoes(args(23 * 60 + 59))).toBe('zerada')
  })
  it('FDS: sem transição (sempre dia)', () => {
    expect(faseLiberacoes({ agoraMin: 20 * 60, dataEscala: '2026-07-25', hojeIso: '2026-07-25' })).toBe('dia') // sábado
    expect(faseLiberacoes({ agoraMin: 22 * 60, dataEscala: '2026-07-26', hojeIso: '2026-07-26' })).toBe('dia') // domingo
  })
  it('feriado em dia de semana SEGUE a regra (decisão c) — qualquer seg–sex vira noite às 19h', () => {
    // 2026-09-07 (Independência) cai numa segunda
    expect(faseLiberacoes({ agoraMin: 20 * 60, dataEscala: '2026-09-07', hojeIso: '2026-09-07' })).toBe('noite')
  })
  it('outra data que não hoje: sempre dia (consultar ontem/amanhã não zera nada)', () => {
    expect(faseLiberacoes({ agoraMin: 23 * 60, dataEscala: '2026-07-22', hojeIso: '2026-07-23' })).toBe('dia')
  })
})

describe('ehDiaUtil', () => {
  it('seg–sex é dia útil; sábado e domingo não', () => {
    expect(ehDiaUtil('2026-07-23')).toBe(true)  // quinta
    expect(ehDiaUtil('2026-07-24')).toBe(true)  // sexta
    expect(ehDiaUtil('2026-07-25')).toBe(false) // sábado
    expect(ehDiaUtil('2026-07-26')).toBe(false) // domingo
    expect(ehDiaUtil('2026-07-27')).toBe(true)  // segunda
  })
  it('feriado em dia de semana continua sendo dia útil (a regra segue)', () => {
    expect(ehDiaUtil('2026-09-07')).toBe(true) // Independência, numa segunda
  })
  it('sem data → false', () => {
    expect(ehDiaUtil('')).toBe(false)
    expect(ehDiaUtil(null)).toBe(false)
  })
})

describe('plantonistasNoturnos', () => {
  it('extrai P1–P4 pelo setor (1º de cada), ignorando P5+ e vazios', () => {
    const plantoes = [
      { setor: 'P1', nome: 'Guilherme Xavier Di Domenico', hora: '19:00' },
      { setor: 'P2', nome: 'G. Staub', hora: '19:00' },
      { setor: 'P3', nome: 'João Ricardo Moreira', hora: '19:00' },
      { setor: 'P4', nome: 'Gabriel Juan Kettenhuber Costa', hora: '19:00' },
      { setor: 'P5', nome: 'Fulano' },
      { setor: 'P1', nome: 'Duplicado Ignorado' },
      { setor: 'P2', nome: '' },
    ]
    expect(plantonistasNoturnos(plantoes)).toEqual({
      P1: 'Guilherme Xavier Di Domenico',
      P2: 'G. Staub',
      P3: 'João Ricardo Moreira',
      P4: 'Gabriel Juan Kettenhuber Costa',
    })
  })
  it('vazio/null → {}', () => {
    expect(plantonistasNoturnos([])).toEqual({})
    expect(plantonistasNoturnos(null)).toEqual({})
  })
})

describe('candidatosNome', () => {
  it('nome completo gera variações (completo, primeiro+último, último, primeiro)', () => {
    expect(candidatosNome('João Ricardo Moreira')).toEqual([
      'João Ricardo Moreira', 'João Moreira', 'Moreira', 'João',
    ])
  })
  it('inicial abreviada ("G. Staub") cai no sobrenome', () => {
    expect(candidatosNome('G. Staub')).toEqual(['Staub'])
  })
  it('honorífico "Dr."/"Dra." é descartado', () => {
    expect(candidatosNome('Dr. Carlos Silva')).toContain('Carlos Silva')
  })
  it('vazio → []', () => {
    expect(candidatosNome('')).toEqual([])
  })
})

describe('linhasNoturnas — ordem por hospital (pedido do dono 24/07)', () => {
  const noturnos = { P1: 'P1 Nome', P2: 'P2 Nome', P3: 'P3 Nome', P4: 'P4 Nome' }
  const setores = (h, p4) => linhasNoturnas(h, noturnos, p4).map((l) => l.setor)

  it('HRO: P1 (plantonista) → P4', () => {
    expect(setores('hro')).toEqual(['P1', 'P4'])
    expect(plantonistaNoturnoDe('hro', noturnos)).toBe('P1 Nome')
  })
  it('Unimed: P2 (plantonista) → P3 → P4', () => {
    expect(setores('unimed')).toEqual(['P2', 'P3', 'P4'])
    expect(plantonistaNoturnoDe('unimed', noturnos)).toBe('P2 Nome')
  })
  it('Materno: só o P4, que é o plantonista de lá', () => {
    expect(setores('materno')).toEqual(['P4'])
    expect(plantonistaNoturnoDe('materno', noturnos)).toBe('P4 Nome')
  })
  it('hospital desconhecido → sem linhas', () => {
    expect(setores('outro')).toEqual([])
  })
  it('setores ausentes somem das linhas (e o plantonista pode não existir)', () => {
    expect(linhasNoturnas('unimed', { P3: 'X' }).map((l) => l.setor)).toEqual(['P3'])
    expect(plantonistaNoturnoDe('hro', { P4: 'Só o coringa' })).toBeNull()
  })
  it('papel: 1º do hospital = Plantonista, P4 = Coringa, meio = Plantão noturno', () => {
    expect(linhasNoturnas('unimed', noturnos).map((l) => l.papel))
      .toEqual(['Plantonista', 'Plantão noturno', 'Coringa'])
    expect(linhasNoturnas('materno', noturnos)[0].papel).toBe('Coringa')
  })
})

describe('linhasNoturnas — marcação do P4 (coringa)', () => {
  const noturnos = { P1: 'P1 Nome', P2: 'P2 Nome', P3: 'P3 Nome', P4: 'P4 Nome' }
  const temP4 = (h, p4) => linhasNoturnas(h, noturnos, p4).some((l) => l.setor === 'P4')

  it('SEM marcação: o P4 aparece nos TRÊS hospitais', () => {
    expect(temP4('unimed', null)).toBe(true)
    expect(temP4('hro', null)).toBe(true)
    expect(temP4('materno', null)).toBe(true)
  })
  it('marcado na Unimed: some do HRO e do Materno', () => {
    expect(temP4('unimed', 'unimed')).toBe(true)
    expect(temP4('hro', 'unimed')).toBe(false)
    expect(temP4('materno', 'unimed')).toBe(false)
  })
  it('marcado no HRO: some da Unimed e do Materno', () => {
    expect(temP4('hro', 'hro')).toBe(true)
    expect(temP4('unimed', 'hro')).toBe(false)
    expect(temP4('materno', 'hro')).toBe(false)
  })
  it('marcado no Materno: some dos outros dois — e o Materno fica sem lista', () => {
    expect(temP4('materno', 'materno')).toBe(true)
    expect(linhasNoturnas('unimed', noturnos, 'materno').map((l) => l.setor)).toEqual(['P2', 'P3'])
    expect(linhasNoturnas('hro', noturnos, 'materno').map((l) => l.setor)).toEqual(['P1'])
  })
  it('P4 marcado em outro hospital não deixa o Materno com plantonista', () => {
    expect(plantonistaNoturnoDe('materno', noturnos, 'unimed')).toBeNull()
    expect(linhasNoturnas('materno', noturnos, 'unimed')).toEqual([])
  })
  it('marcação não afeta P1/P2/P3 (só o coringa se move)', () => {
    for (const p4 of [null, 'unimed', 'hro', 'materno']) {
      expect(linhasNoturnas('hro', noturnos, p4)[0]?.setor).toBe('P1')
      expect(linhasNoturnas('unimed', noturnos, p4).slice(0, 2).map((l) => l.setor)).toEqual(['P2', 'P3'])
    }
  })
})

describe('marcarSelosNoTurno — aviso na lista da tarde (pedido do dono 25/07)', () => {
  const linha = (nome, chave) => ({ anestesista: nome, chave, cirurgioes: ['Cir'], salas: ['S1'], teveCasos: true, isPlantonista: chave === 'LEONARDO' })
  const lista = [linha('Leonardo', 'LEONARDO'), linha('Marilio', 'MARILIO'), linha('Diego', 'DIEGO')]
  const opts = { normalizar: (s) => String(s || '').trim().toUpperCase() }

  it('põe o selo em quem entra no plantão, SEM mexer na ordem nem no status', () => {
    const out = marcarSelosNoTurno(lista, { P2: 'Diego', P3: 'Leonardo' }, opts)
    expect(out.map((l) => l.anestesista)).toEqual(['Leonardo', 'Marilio', 'Diego']) // ordem do dia
    expect(out.map((l) => l.selo)).toEqual(['P3', undefined, 'P2'])
    expect(out[0].isPlantonista).toBe(true) // plantonista do dia intacto
    expect(out.every((l) => l.noturno === undefined)).toBe(true) // não é card de plantão
    expect(out[0].chave).toBe('LEONARDO') // chave do dia (marcações do dia valem)
  })

  it('NÃO filtra por hospital: o selo é da pessoa, onde ela estiver escalada', () => {
    const out = marcarSelosNoTurno(lista, { P4: 'Marilio' }, opts)
    expect(out[1].selo).toBe('P4')
  })

  it('casa pelo uid do vínculo quando o nome do plantão difere do apelido', () => {
    const comUid = [linha('Janaína Favorito', 'uid-jana')]
    const out = marcarSelosNoTurno(comUid, { P1: 'J. Favorito' }, {
      ...opts, resolverUid: (n) => (n === 'J. Favorito' ? 'uid-jana' : null),
    })
    expect(out[0].selo).toBe('P1')
  })

  it('sem plantonistas ou sem linhas devolve a lista intacta', () => {
    expect(marcarSelosNoTurno(lista, {}, opts)).toBe(lista)
    expect(marcarSelosNoTurno(lista, null, opts)).toBe(lista)
    expect(marcarSelosNoTurno([], { P1: 'X' }, opts)).toEqual([])
  })

  it('quem não está de plantão não ganha selo', () => {
    const out = marcarSelosNoTurno(lista, { P1: 'Ninguém Daqui' }, opts)
    expect(out.every((l) => l.selo === undefined)).toBe(true)
  })
})

describe('fundirLinhasNoturnas — noturnos no topo, vespertina abaixo', () => {
  const linha = (nome, chave, extra = {}) => ({
    anestesista: nome, chave, uid: null, nomeOriginal: nome.toUpperCase(),
    cirurgioes: ['Cir'], salas: ['Sala 1'], teveCasos: true, isPlantonista: false, isAjuda: false,
    texto: `${nome} — Cir`, ...extra,
  })
  const vespertina = [
    linha('Leonardo', 'LEONARDO', { isPlantonista: true }),
    linha('Marilio', 'MARILIO'),
    linha('Diego', 'DIEGO'),
  ]
  const opts = { normalizar: (s) => String(s || '').trim().toUpperCase() }
  const noite = (setores) => setores.map((s, i) => ({
    setor: s, nome: s === 'P1' ? 'Marilio' : `Noturno ${s}`,
    papel: i === 0 ? 'Plantonista' : s === 'P4' ? 'Coringa' : 'Plantão noturno',
    isPlantonista: i === 0,
  }))

  it('sem linhas noturnas devolve a lista intacta', () => {
    expect(fundirLinhasNoturnas(vespertina, [], opts)).toBe(vespertina)
  })

  it('HRO: P1 → P4 → resto da vespertina, na ordem', () => {
    const out = fundirLinhasNoturnas(vespertina, noite(['P1', 'P4']), opts)
    expect(out.map((l) => l.anestesista)).toEqual(['Marilio', 'Noturno P4', 'Leonardo', 'Diego'])
    expect(out.map((l) => l.selo)).toEqual(['P1', 'P4', undefined, undefined])
  })

  it('Unimed: P2 → P3 → P4 → resto da vespertina', () => {
    const out = fundirLinhasNoturnas(vespertina, noite(['P2', 'P3', 'P4']), opts)
    expect(out.slice(0, 3).map((l) => l.selo)).toEqual(['P2', 'P3', 'P4'])
    expect(out.slice(3).map((l) => l.anestesista)).toEqual(['Leonardo', 'Marilio', 'Diego'])
  })

  it('quem já está na vespertina é HOISTADO (não duplica) e mantém a chave estável', () => {
    const out = fundirLinhasNoturnas(vespertina, noite(['P1', 'P4']), opts)
    expect(out.filter((l) => l.anestesista === 'Marilio')).toHaveLength(1)
    expect(out.filter((l) => l.chaveDia === 'MARILIO')).toHaveLength(1)
    const hoistado = out[0]
    expect(hoistado.chave).toBe('noite:MARILIO')   // chave da NOITE (não herda o status do dia)
    expect(hoistado.chaveDia).toBe('MARILIO')      // a original fica guardada
    expect(hoistado.nomeOriginal).toBe('MARILIO')   // rodapé preservado
    expect(hoistado.cirurgioes).toEqual(['Cir'])    // conteúdo do dia preservado
    expect(hoistado.sintetico).toBeUndefined()
  })

  it('quem NÃO está na vespertina vira card sintético (não reordenável) e conta como em sala', () => {
    const out = fundirLinhasNoturnas(vespertina, noite(['P4']), opts)
    const p4 = out[0]
    expect(p4.sintetico).toBe(true)
    expect(p4.teveCasos).toBe(true) // senão nasceria "liberado" e afundaria
    expect(p4.chave).toBe('noite:NOTURNO P4')
    expect(p4.papelNoturno).toBe('Plantonista')
  })

  it('plantonista do rodapé SEM caso no dia continua em sala ao virar card noturno', () => {
    // regressão real (26/06 demo): "CRISTINA" está no rodapé sem caso → teveCasos
    // false → a regra de "não escalado" a marcava como já liberada e ela AFUNDAVA
    // para o fim da lista em vez de liderar como P3.
    const semCaso = [linha('Cristina', 'CRISTINA', { teveCasos: false, cirurgioes: [], salas: [] })]
    const out = fundirLinhasNoturnas(semCaso, [
      { setor: 'P3', nome: 'Cristina', papel: 'Plantão noturno', isPlantonista: false },
    ], opts)
    expect(out[0].chaveDia).toBe('CRISTINA')
    expect(out[0].teveCasos).toBe(true)
  })

  it('card noturno é marcado com `noturno` (o selo sozinho é só aviso da tarde)', () => {
    const out = fundirLinhasNoturnas(vespertina, noite(['P1']), opts)
    expect(out[0].noturno).toBe(true)
    expect(out[1].noturno).toBeUndefined()
  })

  it('quem está de plantão NUNCA fica como Ajuda (badge do dia não persiste à noite)', () => {
    const ajudou = [linha('Marilio', 'MARILIO', { isAjuda: true })]
    const out = fundirLinhasNoturnas(ajudou, noite(['P1']), opts)
    expect(out[0].selo).toBe('P1')
    expect(out[0].isAjuda).toBe(false)
  })

  it('só UM plantonista na tela: o da noite tira o badge do diurno', () => {
    const out = fundirLinhasNoturnas(vespertina, noite(['P4']), opts)
    expect(out.filter((l) => l.isPlantonista).map((l) => l.anestesista)).toEqual(['Noturno P4'])
    expect(out.find((l) => l.chave === 'LEONARDO').isPlantonista).toBe(false)
  })

  it('mesma pessoa em dois setores gera um card só', () => {
    const doisSetores = [
      { setor: 'P2', nome: 'Marilio', papel: 'Plantonista', isPlantonista: true },
      { setor: 'P3', nome: 'Marilio', papel: 'Plantão noturno', isPlantonista: false },
    ]
    const out = fundirLinhasNoturnas(vespertina, doisSetores, opts)
    expect(out.filter((l) => l.anestesista === 'Marilio')).toHaveLength(1)
    expect(out[0].selo).toBe('P2')
  })

  it('casa pelo UID do vínculo quando o nome do plantão difere do apelido da escala', () => {
    const comUid = [linha('Janaína Favorito', 'uid-jana', { uid: 'uid-jana' }), linha('Diego', 'DIEGO')]
    const out = fundirLinhasNoturnas(comUid, noite(['P1']).map((l) => ({ ...l, nome: 'J. Favorito' })), {
      ...opts,
      resolverUid: (nome) => (nome === 'J. Favorito' ? 'uid-jana' : null),
    })
    expect(out).toHaveLength(2)                       // hoistou, não duplicou
    expect(out[0].chave).toBe('noite:uid-jana')
    expect(out[0].chaveDia).toBe('uid-jana')
    expect(out[0].selo).toBe('P1')
  })
})
