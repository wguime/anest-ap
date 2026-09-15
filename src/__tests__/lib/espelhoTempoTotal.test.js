/**
 * ESPELHO DO TEMPO TOTAL (dono 30/07): com UMA só cirurgia ativa no turno, gravar
 * o término da cirurgia preenche sozinho o cronômetro da pessoa nas Liberações —
 * os dois campos divergiam ("caso 18:30, pílula 17:00") e ninguém sabia qual valia.
 * Estes testes travam o contrato do helper puro: QUANDO espelha, quando NÃO
 * ("A + B", sem anestesista, posição assumida, total manual sem cirurgia informada)
 * e que o override devolvido é COMPLETO (parcial apagaria local/cirurgião/observação).
 *
 * ⚠️ 15/09: a regra de 29/07 "com 2+ cirurgias o total é 100% manual" vale SÓ
 * enquanto nenhuma tem término. Com alguma informada, o total é o ÚLTIMO término
 * entre as abertas — ver o describe do fim ("tempo informado = tempo total").
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

  it('2+ casos ativos, NENHUM com término, e a pessoa LIMPA o dela: o total manual fica', () => {
    // a pílula é a única informação que existe — mexer nela seria inventar
    const c2 = caso('c2', 'MARILIO', { anestesistaUserId: 'uid-mar' })
    expect(espelhoTempoTotal(escalaCom([c1, c2], { 'matutino:uid-mar': { termino: '19:00' } }), c1, '')).toBeNull()
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

// Produção grava as chaves NAMESPACED por turno ("matutino:uid") desde a
// migração 20260805130000 — e foi assim que o espelho quebrou em silêncio
// (defeito 07/08): o guard de assumidaPor comparava a chave crua (morto) e a
// leitura do override voltava vazia, então definir o término APAGAVA
// local/observação da linha. Estes casos travam o contrato namespaced;
// os de cima (chave crua) seguem valendo como compat legado.
describe('espelhoTempoTotal — chaves namespaced por turno (produção)', () => {
  const c1 = caso('c1', 'MARILIO', { anestesistaUserId: 'uid-mar' })

  it('preserva local/observação gravados sob a chave do turno (o bug: voltavam vazios)', () => {
    const esc = escalaCom([c1], {
      'matutino:uid-mar': { local: 'IOSC', cirurgioes: 'Taciana A', observacao: 'recado', termino: '17:00' },
    })
    expect(espelhoTempoTotal(esc, c1, '18:30').override).toEqual({
      local: 'IOSC', cirurgioes: 'Taciana A', termino: '18:30', observacao: 'recado',
    })
  })

  it('posição assumida sob chave namespaced inibe o espelho (guard estava morto)', () => {
    const esc = escalaCom([c1], { 'matutino:uid-mar': { assumidaPor: { uid: 'uid-kar', nome: 'KARINE' } } })
    expect(espelhoTempoTotal(esc, c1, '18:30')).toBeNull()
  })

  it('assunção no OUTRO turno NÃO inibe (a manhã não bloqueia a tarde)', () => {
    const esc = escalaCom([c1], { 'vespertino:uid-mar': { assumidaPor: { uid: 'uid-kar', nome: 'KARINE' } } })
    expect(espelhoTempoTotal(esc, c1, '18:30')).not.toBeNull()
  })

  it('término já igual sob a chave do turno → nada a espelhar', () => {
    const esc = escalaCom([c1], { 'matutino:uid-mar': { termino: '18:30' } })
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

// ════════════════════════════════════════════════════════════════════════════
// SOMA DOS TEMPOS (dono 14/09): "se for adicionado tempo em todas as cirurgias,
// some os tempos e coloque no tempo total". Na linha do tempo a soma é o ÚLTIMO
// término — cada duração escolhida numa cirurgia que ainda não começou é
// encadeada depois da anterior (`terminoEncadeado`). Com alguma cirurgia sem
// término o total segue manual (29/07); limpar uma delas desfaz a soma gravada.
// ════════════════════════════════════════════════════════════════════════════
import { terminoEncadeado } from '../../pages/escala-cirurgica/utils'

describe('espelhoTempoTotal — soma quando TODAS as cirurgias têm término (dono 14/09)', () => {
  const c1 = caso('c1', 'MARILIO', { hora: '07:30', terminoPrevisto: '10:00', statusCirurgia: 'iniciada' })
  const c2 = caso('c2', 'MARILIO', { hora: '10:15' })

  it('a segunda ganha término → o total vira o ÚLTIMO término (= soma encadeada)', () => {
    const r = espelhoTempoTotal(escalaCom([c1, c2]), c2, '11:15')
    expect(r).not.toBeNull()
    expect(r.override.termino).toBe('11:15')
  })

  it('a segunda ainda sem término → o total é o término da que TEM (15/09; era manual até 14/09)', () => {
    expect(espelhoTempoTotal(escalaCom([c1, c2]), c1, '10:05').override.termino).toBe('10:05')
  })

  it('a maior é a que vale, mesmo editando a mais cedo', () => {
    const c2b = { ...c2, terminoPrevisto: '11:15' }
    const r = espelhoTempoTotal(escalaCom([c1, c2b]), c1, '10:20')
    expect(r.override.termino).toBe('11:15')
  })

  it('limpar uma delas: o total volta a ser o término da que sobrou informada', () => {
    const c2b = { ...c2, terminoPrevisto: '11:15' }
    const r = espelhoTempoTotal(escalaCom([c1, c2b], { 'matutino:MARILIO': { termino: '11:15' } }), c2b, '')
    expect(r.override.termino).toBe('10:00')
  })

  it('limpar a ÚLTIMA informada quando o total era o espelho: o total sai junto', () => {
    const c1b = { ...c1, terminoPrevisto: '' }
    const c2b = { ...c2, terminoPrevisto: '11:15' }
    const r = espelhoTempoTotal(escalaCom([c1b, c2b], { 'matutino:MARILIO': { termino: '11:15' } }), c2b, '')
    expect(r.override.termino).toBe('')
  })

  it('limpar a ÚLTIMA informada quando o total foi mexido à mão: o total fica', () => {
    const c1b = { ...c1, terminoPrevisto: '' }
    const c2b = { ...c2, terminoPrevisto: '11:15' }
    expect(espelhoTempoTotal(escalaCom([c1b, c2b], { 'matutino:MARILIO': { termino: '12:00' } }), c2b, '')).toBeNull()
  })

  it('total já igual à soma → nada a gravar', () => {
    const c2b = { ...c2, terminoPrevisto: '11:15' }
    expect(espelhoTempoTotal(escalaCom([c1, c2b], { 'matutino:MARILIO': { termino: '11:15' } }), c2b, '11:15')).toBeNull()
  })
})

describe('terminoEncadeado — a duração de quem ainda não começou vale depois da anterior', () => {
  const agora = 9 * 60 + 40 // 09:40
  const emCurso = caso('c1', 'MARILIO', { hora: '07:30', terminoPrevisto: '10:00', statusCirurgia: 'iniciada' })
  const proxima = caso('c2', 'MARILIO', { hora: '10:15' })

  it('cirurgia em andamento: agora + duração', () => {
    expect(terminoEncadeado(escalaCom([emCurso, proxima]), emCurso, 60, agora)).toBe('10:40')
  })
  it('cirurgia agendada com anterior já com término: término da anterior + duração', () => {
    expect(terminoEncadeado(escalaCom([emCurso, proxima]), proxima, 60, agora)).toBe('11:00')
  })
  it('sem anterior com término: agora + duração (comportamento de sempre)', () => {
    const semTermino = { ...emCurso, terminoPrevisto: '' }
    expect(terminoEncadeado(escalaCom([semTermino, proxima]), proxima, 45, agora)).toBe('10:25')
  })
  it('anterior que termina ANTES de agora não puxa para trás', () => {
    const atrasada = { ...emCurso, terminoPrevisto: '09:00' }
    expect(terminoEncadeado(escalaCom([atrasada, proxima]), proxima, 30, agora)).toBe('10:10')
  })
  it('cirurgia POSTERIOR por hora não é base da anterior', () => {
    const depois = { ...proxima, terminoPrevisto: '13:00' }
    const meio = caso('c3', 'MARILIO', { hora: '09:50' })
    expect(terminoEncadeado(escalaCom([emCurso, meio, depois]), meio, 30, agora)).toBe('10:30')
  })
  it('sem minutos válidos devolve vazio', () => {
    expect(terminoEncadeado(escalaCom([emCurso]), emCurso, 0, agora)).toBe('')
    expect(terminoEncadeado(escalaCom([emCurso]), emCurso, 'x', agora)).toBe('')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// TEMPO INFORMADO = TEMPO TOTAL (dono 15/09, foto do próprio card: "13:00 Varizes
// · faltam 1h56" e a pílula em "2h29" — "tempo informado não corresponde ao tempo
// total"; "ao clicar em terminada o tempo referente àquela cirurgia fique zerado
// para que não continue contando como tempo"). Reproduzido com os dados reais do
// HRO de 15/09 à tarde: total 19:00 gravado à mão às 14:56 com 3 cirurgias sem
// término; às 16:27 uma terminou, outra ganhou 18:27 e a terceira seguiu sem
// término — e a pílula ficou em 19:00.
// ════════════════════════════════════════════════════════════════════════════
describe('espelhoTempoTotal — tempo informado = tempo total (dono 15/09)', () => {
  // `turno` publicado como em produção: "AS" (a seguir) não tem hora, e sem a
  // coluna o caso cairia na manhã — fora do turno da pílula
  const uid = { anestesistaUserId: 'uid-melo', turno: 'vespertino' }
  const leticia = caso('c-let', 'MELO', { ...uid, hora: '13:00', statusCirurgia: 'iniciada' })
  const helio1 = caso('c-h1', 'MELO', { ...uid, hora: 'AS', statusCirurgia: 'iniciada' })
  const helio2 = caso('c-h2', 'MELO', { ...uid, hora: 'AS' })
  const totalManual = { 'vespertino:uid-melo': { termino: '19:00' } }

  it('o caso real: 18:27 numa cirurgia, a outra sem término → a pílula vira 18:27 (era 19:00 à mão)', () => {
    const r = espelhoTempoTotal(escalaCom([leticia, helio2], totalManual), leticia, '18:27')
    expect(r.override.termino).toBe('18:27')
  })

  it('duas informadas, uma não → o total é o ÚLTIMO término entre as informadas', () => {
    const l = { ...leticia, terminoPrevisto: '18:27' }
    const r = espelhoTempoTotal(escalaCom([l, helio1, helio2]), helio1, '19:10')
    expect(r.override.termino).toBe('19:10')
  })

  describe('terminada tira a cirurgia da conta (`patch` = o status novo)', () => {
    const terminada = { statusCirurgia: 'terminada' }

    it('a que tinha o término do total termina → o total vira o término da que ficou', () => {
      const l = { ...leticia, terminoPrevisto: '18:27' }
      const h = { ...helio1, terminoPrevisto: '19:00' }
      const r = espelhoTempoTotal(escalaCom([l, h], totalManual), h, '', { patch: terminada })
      expect(r.override.termino).toBe('18:27')
    })

    it('termina a ÚNICA informada e o total era ela → o total sai junto ("não continue contando")', () => {
      const h = { ...helio1, terminoPrevisto: '19:00' }
      const r = espelhoTempoTotal(escalaCom([leticia, h, helio2], totalManual), h, '', { patch: terminada })
      expect(r.override.termino).toBe('')
    })

    it('termina uma SEM término com o total à mão → o total fica (a pílula era a única informação)', () => {
      expect(espelhoTempoTotal(escalaCom([leticia, helio1, helio2], totalManual), helio1, '', { patch: terminada })).toBeNull()
    })

    it('termina a última cirurgia aberta e o total era o espelho dela → sai junto', () => {
      const l = { ...leticia, terminoPrevisto: '18:27' }
      const r = espelhoTempoTotal(escalaCom([l], { 'vespertino:uid-melo': { termino: '18:27' } }), l, '', { patch: terminada })
      expect(r.override.termino).toBe('')
    })

    it('SUSPENSA (eixo extra) também sai da conta — e voltar da suspensão entra de novo', () => {
      const l = { ...leticia, terminoPrevisto: '18:27' }
      const h = { ...helio1, terminoPrevisto: '19:00' }
      const esc = escalaCom([l, h], { 'vespertino:uid-melo': { termino: '19:00' } })
      expect(espelhoTempoTotal(esc, h, '19:00', { patch: { statusExtra: 'suspensa' } }).override.termino).toBe('18:27')
      const hs = { ...h, statusExtra: 'suspensa' }
      const esc2 = escalaCom([l, hs], { 'vespertino:uid-melo': { termino: '18:27' } })
      expect(espelhoTempoTotal(esc2, hs, '19:00', { patch: { statusExtra: null } }).override.termino).toBe('19:00')
    })

    it('reabrir uma terminada (sem término, já zerado) não mexe num total que já é o espelho', () => {
      const l = { ...leticia, terminoPrevisto: '18:27' }
      const done = { ...helio1, statusCirurgia: 'terminada', terminoPrevisto: null }
      const esc = escalaCom([l, done], { 'vespertino:uid-melo': { termino: '18:27' } })
      expect(espelhoTempoTotal(esc, done, '', { patch: { statusCirurgia: 'iniciada' } })).toBeNull()
    })

    it('a chave e o override completo saem como nos outros caminhos (local/observação preservados)', () => {
      const h = { ...helio1, terminoPrevisto: '19:00' }
      const esc = escalaCom([h], { 'vespertino:uid-melo': { termino: '19:00', local: 'Bloco M', observacao: 'recado' } })
      expect(espelhoTempoTotal(esc, h, '', { patch: terminada })).toEqual({
        chave: 'uid-melo', nome: 'MELO',
        override: { local: 'Bloco M', cirurgioes: '', termino: '', observacao: 'recado' },
      })
    })
  })
})
