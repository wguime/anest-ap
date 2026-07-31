/**
 * ESPELHO DO TEMPO TOTAL (dono 30/07): com UMA só cirurgia ativa no turno, gravar
 * o término da cirurgia preenche sozinho o cronômetro da pessoa nas Liberações —
 * os dois campos divergiam ("caso 18:30, pílula 17:00") e ninguém sabia qual valia.
 * Estes testes travam o contrato do helper puro: QUANDO espelha (1 caso ativo),
 * quando NÃO (2+ casos, "A + B", sem anestesista, posição assumida) e que o
 * override devolvido é COMPLETO (parcial apagaria local/cirurgião/observação).
 */
import { describe, it, expect } from 'vitest'
import { espelhoTempoTotal, observacaoDaLinha } from '../../pages/escala-cirurgica/utils'

const caso = (id, anestesista, extra = {}) => ({
  id, sala: `Sala ${id}`, ordem: 0, hora: '07:30', anestesista,
  cirurgiao: 'Cirurgião X', semAnestesista: false, ...extra,
})

const escalaCom = (casos, linhaOverrides = {}) => ({
  id: 'e1', hospital: 'hro', casos, linhaOverrides,
})

describe('espelhoTempoTotal — quando espelha', () => {
  it('1 caso ativo no turno → devolve chave (uid do caso) e override completo', () => {
    const c = caso('c1', 'MARILIO', { anestesistaUserId: 'uid-mar' })
    const esc = escalaCom([c, caso('c2', 'KARINE', { anestesistaUserId: 'uid-kar' })])
    const esp = espelhoTempoTotal(esc, c, '18:30')
    expect(esp).toMatchObject({
      chave: 'uid-mar',
      nome: 'MARILIO',
      override: { local: '', cirurgioes: '', termino: '18:30', observacao: '' },
    })
  })

  it('preserva local/cirurgião/observação do override existente (gravar parcial apagaria)', () => {
    const c = caso('c1', 'MARILIO', { anestesistaUserId: 'uid-mar' })
    const esc = escalaCom([c], {
      'uid-mar': { local: 'IOSC', cirurgioes: 'Taciana A', observacao: 'foi para o HRO', termino: '17:00' },
    })
    expect(espelhoTempoTotal(esc, c, '18:30').override).toEqual({
      local: 'IOSC', cirurgioes: 'Taciana A', termino: '18:30', observacao: 'foi para o HRO',
    })
  })

  it('2º caso da pessoa já TERMINADO não bloqueia — o ativo é um só', () => {
    const c = caso('c1', 'MARILIO', { anestesistaUserId: 'uid-mar' })
    const done = caso('c2', 'MARILIO', { anestesistaUserId: 'uid-mar', statusCirurgia: 'terminada' })
    expect(espelhoTempoTotal(escalaCom([c, done]), c, '18:30')).not.toBeNull()
  })

  it('2º caso da pessoa em OUTRO turno não bloqueia (o total é do turno)', () => {
    const c = caso('c1', 'MARILIO', { anestesistaUserId: 'uid-mar' })
    const tarde = caso('c2', 'MARILIO', { anestesistaUserId: 'uid-mar', hora: '14:00' })
    expect(espelhoTempoTotal(escalaCom([c, tarde]), c, '18:30')).not.toBeNull()
  })

  it('sem uid em lugar nenhum, a chave é o nome normalizado', () => {
    const c = caso('c1', 'Marílio')
    expect(espelhoTempoTotal(escalaCom([c]), c, '18:30').chave).toBe('MARILIO')
  })

  it('limpar o término do caso limpa o total junto (divergência nos dois sentidos)', () => {
    const c = caso('c1', 'MARILIO', { anestesistaUserId: 'uid-mar' })
    const esc = escalaCom([c], { 'uid-mar': { termino: '18:30', local: 'IOSC' } })
    expect(espelhoTempoTotal(esc, c, '').override).toMatchObject({ termino: '', local: 'IOSC' })
  })

  it('nota `troca` legada vira observação no override (não some no espelho)', () => {
    const c = caso('c1', 'MARILIO', { anestesistaUserId: 'uid-mar' })
    const esc = escalaCom([c], { 'uid-mar': { troca: { com: 'CURY', hospital: 'hro' } } })
    expect(espelhoTempoTotal(esc, c, '18:30', { hospitalLabels: { hro: 'HRO' } }).override.observacao)
      .toBe('Troca com Cury · HRO')
  })
})

describe('espelhoTempoTotal — quando NÃO espelha', () => {
  const c1 = caso('c1', 'MARILIO', { anestesistaUserId: 'uid-mar' })

  it('2+ casos ativos no turno (o total nunca é soma de estimativas)', () => {
    const c2 = caso('c2', 'MARILIO', { anestesistaUserId: 'uid-mar' })
    expect(espelhoTempoTotal(escalaCom([c1, c2]), c1, '18:30')).toBeNull()
  })

  it('sala compartilhada "A + B" no caso editado', () => {
    const c = caso('c1', 'MARILIO + KARINE')
    expect(espelhoTempoTotal(escalaCom([c]), c, '18:30')).toBeNull()
  })

  it('caso sem anestesista ("?" ou flag)', () => {
    const semFlag = caso('c1', '?', { semAnestesista: true })
    expect(espelhoTempoTotal(escalaCom([semFlag]), semFlag, '18:30')).toBeNull()
  })

  it('caso editado já concluído (não está na fila)', () => {
    const done = caso('c1', 'MARILIO', { anestesistaUserId: 'uid-mar', statusCirurgia: 'terminada' })
    expect(espelhoTempoTotal(escalaCom([done]), done, '18:30')).toBeNull()
  })

  it('posição da pessoa foi ASSUMIDA por outro (identidade do slot em outra chave)', () => {
    const esc = escalaCom([c1], { 'uid-mar': { assumidaPor: { uid: 'uid-kar', nome: 'KARINE' } } })
    expect(espelhoTempoTotal(esc, c1, '18:30')).toBeNull()
  })

  it('a pessoa ASSUMIU a posição de outro (os casos dela exibem sob a chave do dono)', () => {
    const esc = escalaCom([c1], { 'uid-leo': { assumidaPor: { uid: 'uid-mar', nome: 'MARILIO' } } })
    expect(espelhoTempoTotal(esc, c1, '18:30')).toBeNull()
  })

  it('término já igual ao gravado (write à toa)', () => {
    const esc = escalaCom([c1], { 'uid-mar': { termino: '18:30' } })
    expect(espelhoTempoTotal(esc, c1, '18:30')).toBeNull()
  })
})

describe('observacaoDaLinha', () => {
  it('observação escrita vence a nota legada', () => {
    expect(observacaoDaLinha({ observacao: 'recado', troca: { com: 'CURY' } })).toBe('recado')
  })
  it('sem nada → vazio', () => {
    expect(observacaoDaLinha(null)).toBe('')
    expect(observacaoDaLinha({})).toBe('')
  })
})
