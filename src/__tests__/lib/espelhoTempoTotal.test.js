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

  it('a segunda ainda sem término → nada a espelhar (total manual)', () => {
    expect(espelhoTempoTotal(escalaCom([c1, c2]), c1, '10:05')).toBeNull()
  })

  it('a maior é a que vale, mesmo editando a mais cedo', () => {
    const c2b = { ...c2, terminoPrevisto: '11:15' }
    const r = espelhoTempoTotal(escalaCom([c1, c2b]), c1, '10:20')
    expect(r.override.termino).toBe('11:15')
  })

  it('limpar uma delas quando o total É a soma gravada limpa o total junto', () => {
    const c2b = { ...c2, terminoPrevisto: '11:15' }
    const r = espelhoTempoTotal(escalaCom([c1, c2b], { 'matutino:MARILIO': { termino: '11:15' } }), c2b, '')
    expect(r.override.termino).toBe('')
  })

  it('limpar uma delas quando o total foi mexido à mão NÃO toca no total', () => {
    const c2b = { ...c2, terminoPrevisto: '11:15' }
    expect(espelhoTempoTotal(escalaCom([c1, c2b], { 'matutino:MARILIO': { termino: '12:00' } }), c2b, '')).toBeNull()
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

// A FOLHA DO TEMPO TOTAL DIZ, ANTES DO TOQUE, DE ONDE A DURAÇÃO CONTA (dono 25/09):
// "Ainda não começou: a duração conta a partir das 10:00". A frase sai de
// `inicioDaDuracao` e o valor gravado de `terminoEncadeado`, que soma a duração à
// MESMA base — se as duas divergissem, a folha prometeria um horário e gravaria outro.
import { inicioDaDuracao } from '../../pages/escala-cirurgica/utils'

describe('inicioDaDuracao — a base que a folha anuncia é a que terminoEncadeado grava', () => {
  const agora = 9 * 60 + 40 // 09:40
  const emCurso = caso('c1', 'MARILIO', { hora: '07:30', terminoPrevisto: '10:00', statusCirurgia: 'iniciada' })
  const proxima = caso('c2', 'MARILIO', { hora: '10:15' })

  it('agendada depois de uma com término: base = término da anterior, e ela é anunciada', () => {
    const r = inicioDaDuracao(escalaCom([emCurso, proxima]), proxima, agora)
    expect(r).toEqual({ baseMin: 10 * 60, anterior: '10:00' })
    // a mesma base que o valor gravado usa
    expect(terminoEncadeado(escalaCom([emCurso, proxima]), proxima, 60, agora)).toBe('11:00')
  })
  it('em andamento: conta de agora, sem anterior para anunciar', () => {
    expect(inicioDaDuracao(escalaCom([emCurso, proxima]), emCurso, agora)).toEqual({ baseMin: agora, anterior: null })
  })
  it('anterior sem término ou que já passou: conta de agora, sem frase', () => {
    const semTermino = { ...emCurso, terminoPrevisto: '' }
    expect(inicioDaDuracao(escalaCom([semTermino, proxima]), proxima, agora).anterior).toBeNull()
    const passou = { ...emCurso, terminoPrevisto: '09:00' }
    expect(inicioDaDuracao(escalaCom([passou, proxima]), proxima, agora)).toEqual({ baseMin: agora, anterior: null })
  })
})

// ════════════════════════════════════════════════════════════════════════════
// O TOTAL É INFORMADO INDEPENDENTE DOS TEMPOS INDIVIDUAIS (dono 15/09, à tarde).
// A v5.12.8 tentou o espelho PARCIAL ("com alguma informada, o total vira o último
// término entre as que têm") a partir da foto do card do dono — "faltam 1h56" na
// cirurgia, "2h29" na pílula — e foi revertida no mesmo dia: "quero que mantenha o
// sistema em que é informado o tempo total independente dos tempos individuais das
// cirurgias". Estes casos são a trava: o helper devolve null onde a v5.12.8 gravava.
// ════════════════════════════════════════════════════════════════════════════
describe('espelhoTempoTotal — o total é independente dos tempos individuais (dono 15/09)', () => {
  // o cenário real do HRO de 15/09 à tarde (turno publicado: "AS" não tem hora)
  const uid = { anestesistaUserId: 'uid-melo', turno: 'vespertino' }
  const leticia = caso('c-let', 'MELO', { ...uid, hora: '13:00', statusCirurgia: 'iniciada' })
  const helio2 = caso('c-h2', 'MELO', { ...uid, hora: 'AS' })
  const totalManual = { 'vespertino:uid-melo': { termino: '19:00' } }

  it('a foto do dono: 18:27 numa cirurgia com a outra sem término NÃO mexe na pílula (19:00 à mão)', () => {
    expect(espelhoTempoTotal(escalaCom([leticia, helio2], totalManual), leticia, '18:27')).toBeNull()
  })

  it('limpar o término de uma cirurgia com outra sem término também não mexe (não era a soma)', () => {
    const l = { ...leticia, terminoPrevisto: '18:27' }
    expect(espelhoTempoTotal(escalaCom([l, helio2], totalManual), l, '')).toBeNull()
  })

  it('o helper não aceita "status novo": terminar/suspender uma cirurgia não passa por aqui', () => {
    // a assinatura não tem `patch`; se alguém reintroduzir, este teste passa a falhar
    expect(espelhoTempoTotal.length).toBe(3)
  })
})
