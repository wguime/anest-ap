/**
 * Trava da projeção de ATESTADO — o passo que faltava em produção.
 *
 * As duas Cloud Functions (`projetarIndisponibilidadeStaff` e
 * `projetarIndisponibilidadeStaffAoAlterar`) nunca foram deployadas, e a regra
 * do Firestore só deixa o Admin SDK escrever `indisponivel`. Resultado, em
 * 01/09/2026: o dono moveu uma funcionária para ATESTADO, ela saiu da UNIMED e
 * não apareceu em lugar nenhum.
 *
 * O que estes testes seguram é o SALDO: quem sai de uma seção tem de aparecer
 * na outra, e quem volta tem de ser devolvido à seção de origem.
 *
 * `functions/` é CommonJS; por isso o core é puro e entra aqui por `require`.
 */
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  isActiveOn,
  leavePeriodLabel,
  projectScope,
} = require('../../../functions/src/staffProjectionCore')

function ts(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  // 12:00 evita que a conversão para America/Sao_Paulo vire o dia.
  return { toDate: () => new Date(Date.UTC(year, month - 1, day, 15, 0, 0)) }
}

function leave(overrides = {}) {
  return {
    scope: 'hospitais',
    employeeName: 'Marta',
    status: 'active',
    startsAt: ts('2026-09-02'),
    endsAt: ts('2026-09-08'),
    previousAssignment: { sectionKey: 'unimed', turno: '07:00-16:45' },
    ...overrides,
  }
}

const grupoHospitais = () => ({
  hro: [{ nome: 'Elisete', turno: '13:00-22:00', status: 'ativa' }],
  unimed: [
    { nome: 'Bruna', turno: '07:00-16:45', status: 'ativa' },
    { nome: 'Marta', turno: '07:00-16:45', status: 'ativa' },
  ],
})

describe('projectScope — o saldo da escala fecha', () => {
  it('tira quem esta afastada da secao e poe em ATESTADO com nome e periodo', () => {
    const group = projectScope(grupoHospitais(), [leave()], '2026-09-02', 'hospitais')

    expect(group.unimed).toEqual([
      { nome: 'Bruna', turno: '07:00-16:45', status: 'ativa' },
    ])
    expect(group.indisponivel).toEqual([
      { nome: 'Marta', turno: '02/09-08/09', status: 'indisponivel' },
    ])
  })

  it('devolve a funcionaria a secao de origem quando o atestado termina', () => {
    // 09/09 é o dia seguinte ao fim do atestado: ela não está mais afastada.
    const semMarta = grupoHospitais()
    semMarta.unimed = [{ nome: 'Bruna', turno: '07:00-16:45', status: 'ativa' }]

    const group = projectScope(semMarta, [leave()], '2026-09-09', 'hospitais')

    expect(group.indisponivel).toEqual([])
    expect(group.unimed).toEqual([
      { nome: 'Bruna', turno: '07:00-16:45', status: 'ativa' },
      { nome: 'Marta', turno: '07:00-16:45', status: 'ativa' },
    ])
  })

  it('atestado que so comeca amanha nao tira ninguem da escala de hoje', () => {
    const group = projectScope(grupoHospitais(), [leave()], '2026-09-01', 'hospitais')

    expect(group.indisponivel).toEqual([])
    expect(group.unimed.map((e) => e.nome)).toEqual(['Bruna', 'Marta'])
  })

  it('a secao atestado nunca sobrevive no documento publico', () => {
    const comAtestado = grupoHospitais()
    comAtestado.atestado = [{ nome: 'Marta', startsOn: '2026-09-02' }]

    const group = projectScope(comAtestado, [leave()], '2026-09-02', 'hospitais')

    expect(group).not.toHaveProperty('atestado')
  })

  it('nao duplica quem ja voltou por conta propria para a secao', () => {
    // A escala já foi reeditada à mão e a Marta está de volta na UNIMED.
    const group = projectScope(grupoHospitais(), [leave()], '2026-09-09', 'hospitais')

    expect(group.unimed.filter((e) => e.nome === 'Marta')).toHaveLength(1)
  })

  it('ignora previousAssignment apontando para secao que nao existe no escopo', () => {
    const semMarta = grupoHospitais()
    semMarta.unimed = [{ nome: 'Bruna', turno: '07:00-16:45', status: 'ativa' }]
    const forjado = leave({
      previousAssignment: { sectionKey: 'recepcao', turno: '07:00-16:45' },
    })

    const group = projectScope(semMarta, [forjado], '2026-09-09', 'hospitais')

    expect(group).not.toHaveProperty('recepcao')
    expect(group.unimed.map((e) => e.nome)).toEqual(['Bruna'])
  })

  it('ordena ATESTADO por nome — duas execucoes do cron nao trocam as linhas', () => {
    const group = projectScope(
      grupoHospitais(),
      [
        leave({ employeeName: 'Renata', previousAssignment: { sectionKey: 'hro', turno: '13:00-22:00' } }),
        leave(),
      ],
      '2026-09-02',
      'hospitais'
    )

    expect(group.indisponivel.map((e) => e.nome)).toEqual(['Marta', 'Renata'])
  })

  it('afastamento cancelado nao conta como vigente', () => {
    const group = projectScope(
      grupoHospitais(), [leave({ status: 'cancelled' })], '2026-09-02', 'hospitais'
    )

    expect(group.indisponivel).toEqual([])
  })
})

describe('isActiveOn e leavePeriodLabel', () => {
  it('inclui o primeiro e o ultimo dia do atestado', () => {
    expect(isActiveOn(leave(), '2026-09-02')).toBe(true)
    expect(isActiveOn(leave(), '2026-09-08')).toBe(true)
    expect(isActiveOn(leave(), '2026-09-01')).toBe(false)
    expect(isActiveOn(leave(), '2026-09-09')).toBe(false)
  })

  it('formata o periodo no mesmo formato curto que o card usa em Ferias', () => {
    expect(leavePeriodLabel(leave())).toBe('02/09-08/09')
  })

  it('sem datas o periodo vira traco, nunca "undefined" na escala', () => {
    expect(leavePeriodLabel({ employeeName: 'Marta' })).toBe('-')
  })
})
