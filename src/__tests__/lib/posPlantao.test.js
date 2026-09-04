/**
 * Pós-plantão (regra do dono, 03/09/2026).
 *
 * Quem fez a noite P1 (HRO) / P2 (Unimed) da véspera assume, na manhã seguinte, a 2ª posição
 * do hospital em que plantonou — SAINDO da coluna que a numérica lhe deu. À tarde não é
 * escalado, mas fica na posição da numérica com a marca.
 *
 * O caso âncora é real: na noite de 03/09 o ROMULO foi P1 (HRO) e o KLISMAN foi P2 (Unimed);
 * na manhã de 04/09 a numérica traz os DOIS na coluna da Unimed, então o Romulo tem de
 * atravessar para o HRO.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { montarOrdem, HOSPITAIS_NUMERICA } from '../../lib/escalaNumerica'
import {
  vesperaDe, ehDiaUtilNumerica, fonteDoNoturno, noturnosDoPegaPlantao, noturnosDoDocumentoFds,
  aplicarPosPlantaoManha, marcarPosPlantaoTarde,
} from '../../lib/posPlantao'

const dados = JSON.parse(readFileSync(resolve(__dirname, '../../data/escalaNumerica.json'), 'utf8'))

const NOTURNOS_03_09 = { hro: 'Romulo Santos Roxo', unimed: 'Klisman Drescher Hilleshein' }

const grade = (data, turno) => {
  const base = montarOrdem(dados, { data, hospital: 'hro', turno, ferias: null })
  return {
    blocos: HOSPITAIS_NUMERICA.map((hospital) => ({
      hospital,
      lista: montarOrdem(dados, { data, hospital, turno, ferias: null }).lista,
    })),
    consultorio: base.consultorio,
  }
}
const nomes = (blocos, hospital) => blocos.find((b) => b.hospital === hospital).lista.map((p) => p.nome)

describe('de onde vem o plantão da véspera', () => {
  it('a véspera é sempre o dia anterior', () => {
    expect(vesperaDe('2026-09-04')).toBe('2026-09-03')
    expect(vesperaDe('2026-08-31')).toBe('2026-08-30')
    expect(vesperaDe('2026-01-01')).toBe('2025-12-31')
  })

  it('sábado e domingo não têm escala numérica, então não têm a regra', () => {
    expect(ehDiaUtilNumerica('2026-09-05')).toBe(false)
    expect(ehDiaUtilNumerica('2026-09-06')).toBe(false)
    expect(fonteDoNoturno('2026-09-05')).toBeNull()
    expect(fonteDoNoturno('2026-09-06')).toBeNull()
  })

  it('de terça a sexta a fonte é o Pega Plantão; na SEGUNDA é o documento do fim de semana', () => {
    expect(fonteDoNoturno('2026-09-01')).toBe('pega-plantao') // terça
    expect(fonteDoNoturno('2026-09-04')).toBe('pega-plantao') // sexta
    expect(fonteDoNoturno('2026-08-31')).toBe('documento-fds') // segunda
    expect(fonteDoNoturno('2026-09-07')).toBe('documento-fds') // segunda (feriado)
  })

  it('sexta à noite não gera pós-plantão, porque o sábado não tem numérica', () => {
    // a regra é consultada pelo DIA que se olha; o sábado não consulta ninguém
    expect(fonteDoNoturno('2026-09-05')).toBeNull()
  })

  it('do Pega Plantão só entra o plantão que começa às 19h ou depois', () => {
    expect(noturnosDoPegaPlantao([
      { setor: 'P1', nome: 'Romulo Santos Roxo', horario: '19:00' },
      { setor: 'P2', nome: 'Tiago Iop Viana', horario: '19:00' },
      { setor: 'P1', nome: 'Alguem De Dia', horario: '07:00' },
      { setor: 'P4', nome: 'Erlei Perini', horario: '19:00' },
    ])).toEqual({ hro: 'Romulo Santos Roxo', unimed: 'Tiago Iop Viana' })
  })

  it('do documento de fim de semana sai a faixa 19-07, que já traz hro e unimed', () => {
    expect(noturnosDoDocumentoFds({ '19-07': { unimed: 'JOAO RICARDO', hro: 'MATHEUS', ret1: 'X' } }))
      .toEqual({ hro: 'MATHEUS', unimed: 'JOAO RICARDO' })
    expect(noturnosDoDocumentoFds(undefined)).toEqual({ hro: null, unimed: null })
  })
})

describe('MANHÃ — sobe para a 2ª posição do hospital em que plantonou', () => {
  it('04/09: o ROMULO atravessa da Unimed para a 2ª do HRO, e o KLISMAN sobe na Unimed', () => {
    const { blocos, consultorio } = grade('2026-09-04', 'matutino')
    expect(nomes(blocos, 'hro')).not.toContain('ROMULO')
    expect(nomes(blocos, 'unimed').indexOf('ROMULO')).toBe(8) // 9ª
    expect(nomes(blocos, 'unimed').indexOf('KLISMAN')).toBe(6) // 7ª

    const r = aplicarPosPlantaoManha(dados, blocos, consultorio, NOTURNOS_03_09)
    const hro = r.blocos.find((b) => b.hospital === 'hro').lista
    const uni = r.blocos.find((b) => b.hospital === 'unimed').lista

    // o posto entra nos dois turnos: de manhã é ele que explica a 2ª posição (dono 04/09)
    expect(hro[1]).toMatchObject({ posicao: 2, nome: 'ROMULO', movidoPorPlantao: true, postoPlantao: 'P1' })
    // de manhã eles TRABALHAM: nada de marca de pós plantão aqui
    expect(hro[1].posPlantao).toBeUndefined()
    expect(uni[1]).toMatchObject({ posicao: 2, nome: 'KLISMAN', movidoPorPlantao: true, postoPlantao: 'P2' })
    // o 1º de cada hospital não se move — a 2ª é ABAIXO do plantão da manhã
    expect(hro[0].nome).toBe(nomes(blocos, 'hro')[0])
    expect(uni[0].nome).toBe(nomes(blocos, 'unimed')[0])
    // uma pessoa, um lugar: o HRO ganha um e a Unimed perde um
    expect(hro).toHaveLength(nomes(blocos, 'hro').length + 1)
    expect(uni).toHaveLength(nomes(blocos, 'unimed').length - 1)
    expect(uni.filter((p) => p.nome === 'ROMULO')).toEqual([])
    expect(r.movidos).toEqual([{ hospital: 'hro', nome: 'ROMULO' }, { hospital: 'unimed', nome: 'KLISMAN' }])
  })

  it('a numeração é refeita: 1..n sem buraco, nos dois hospitais', () => {
    const { blocos, consultorio } = grade('2026-09-04', 'matutino')
    const r = aplicarPosPlantaoManha(dados, blocos, consultorio, NOTURNOS_03_09)
    for (const b of r.blocos) {
      expect(b.lista.map((p) => p.posicao)).toEqual(b.lista.map((_, i) => i + 1))
    }
  })

  it('quem plantonou e NÃO está na grade do dia entra assim mesmo, pela legenda', () => {
    const blocos = [
      { hospital: 'hro', lista: [{ posicao: 1, numero: '04', nome: 'MELO' }, { posicao: 2, numero: '08', nome: 'GIOVANA' }] },
      { hospital: 'unimed', lista: [{ posicao: 1, numero: '03', nome: 'RAUL' }] },
      { hospital: 'materno', lista: [] },
    ]
    const r = aplicarPosPlantaoManha(dados, blocos, [], { hro: 'Adriano Dall Magro', unimed: null })
    const hro = r.blocos[0].lista
    expect(hro.map((p) => p.nome)).toEqual(['MELO', 'ADRIANO', 'GIOVANA'])
    expect(hro[1]).toMatchObject({ numero: '22', movidoPorPlantao: true, postoPlantao: 'P1' })
  })

  it('nome que a legenda não reconhece não entra — não se inventa posição', () => {
    const blocos = [
      { hospital: 'hro', lista: [{ posicao: 1, numero: '04', nome: 'MELO' }] },
      { hospital: 'unimed', lista: [] }, { hospital: 'materno', lista: [] },
    ]
    const r = aplicarPosPlantaoManha(dados, blocos, [], { hro: 'Fulano De Tal', unimed: null })
    expect(r.blocos[0].lista.map((p) => p.nome)).toEqual(['MELO'])
    expect(r.movidos).toEqual([])
  })

  it('sem plantão noturno conhecido a grade sai intacta', () => {
    const { blocos, consultorio } = grade('2026-09-04', 'matutino')
    const r = aplicarPosPlantaoManha(dados, blocos, consultorio, { hro: null, unimed: null })
    expect(r.blocos).toBe(blocos)
    expect(r.movidos).toEqual([])
  })

  it('quem estava no CONSULTÓRIO também sai de lá para assumir a 2ª posição', () => {
    const blocos = [
      { hospital: 'hro', lista: [{ posicao: 1, numero: '04', nome: 'MELO' }] },
      { hospital: 'unimed', lista: [] }, { hospital: 'materno', lista: [] },
    ]
    const consultorio = [{ numero: '25', nome: 'ERLEI' }, { numero: '27', nome: 'NATHALIA' }]
    const r = aplicarPosPlantaoManha(dados, blocos, consultorio, { hro: 'Erlei Perini', unimed: null })
    expect(r.consultorio.map((c) => c.nome)).toEqual(['NATHALIA'])
    expect(r.blocos[0].lista.map((p) => p.nome)).toEqual(['MELO', 'ERLEI'])
  })
})

describe('TARDE — não é escalado, mas fica na posição da numérica, marcado', () => {
  it('04/09: os dois ficam onde a numérica os põe e ninguém é renumerado', () => {
    const { blocos, consultorio } = grade('2026-09-04', 'vespertino')
    const antes = nomes(blocos, 'unimed')
    const r = marcarPosPlantaoTarde(blocos, consultorio, NOTURNOS_03_09)
    const uni = r.blocos.find((b) => b.hospital === 'unimed').lista

    expect(uni.map((p) => p.nome)).toEqual(antes)
    expect(uni.map((p) => p.posicao)).toEqual(antes.map((_, i) => i + 1))
    expect(uni.filter((p) => p.posPlantao).map((p) => `${p.posicao} ${p.nome} ${p.postoPlantao}`))
      .toEqual(['12 ROMULO P1', '14 KLISMAN P2'])
    // ninguém no HRO: os dois estão na coluna da Unimed nesse dia
    expect(r.blocos.find((b) => b.hospital === 'hro').lista.some((p) => p.posPlantao)).toBe(false)
  })

  it('marca também quem está no consultório', () => {
    const r = marcarPosPlantaoTarde(
      [{ hospital: 'hro', lista: [] }],
      [{ numero: '25', nome: 'ERLEI' }, { numero: '27', nome: 'NATHALIA' }],
      { hro: 'Erlei Perini', unimed: null }
    )
    expect(r.consultorio[0]).toMatchObject({ nome: 'ERLEI', posPlantao: true, postoPlantao: 'P1' })
    expect(r.consultorio[1].posPlantao).toBeUndefined()
  })

  it('sem plantão noturno conhecido nada é marcado', () => {
    const { blocos, consultorio } = grade('2026-09-04', 'vespertino')
    const r = marcarPosPlantaoTarde(blocos, consultorio, {})
    expect(r.blocos).toBe(blocos)
    expect(r.marcados).toEqual([])
  })
})
