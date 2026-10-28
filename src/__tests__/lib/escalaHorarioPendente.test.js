/**
 * HORÁRIO PENDENTE — alerta público da cirurgia sem início/término (dono 05/10, modelo A).
 *
 * Travas das decisões do dono:
 *  1. entra quando o anestesista é LIBERADO ou quando o turno ACABA (13h/19h);
 *  2. sai só com início E término — ou Suspensa;
 *  3. conta a partir da TARDE de 05/10;
 *  3b. início VENCIDO (dono 05/10 à tarde): 30 min depois do horário agendado sem início
 *     já entra, durante o turno; "AS" conta do término da anterior; "Atrasada" pausa;
 *  4. liberado com cirurgia ABERTA (uma ou mais) → `aberta` (o alerta oferece "quem
 *     assumiu"); trocado o anestesista, a cirurgia segue a regra pelo nome novo;
 *  5. dupla conta para os dois; "?" não é pessoa; continuação não conta em dobro.
 */
import { describe, it, expect } from 'vitest'
import {
  INICIO_ALERTA_HORARIO, agruparPorAnestesista, anestesistasDoCaso, casoEntraNaConta,
  dentroDoInicioDoAlerta, faltaHorario, montarRelatorioHorario, pendenciasDoDia, prazoDoCaso,
  prazoInicio, rotuloDiaRelatorio, TOLERANCIA_INICIO_MIN, TOLERANCIA_INICIO_AS_MIN,
  pendenciasParaLiberar, pendenciasDeDiasAnteriores, CORTE_PENDENCIAS_MINHAS,
  paresDeContinuacao, herdaTermino, faltaNoPar, nomesDoCirurgiao, contaDoDia,
} from '@/lib/escalaHorarioPendente'

const HOJE = '2026-10-06'
const caso = (o = {}) => ({
  id: o.id || 'c1', turno: 'matutino', hora: '08:00', procedimento: 'Colecistectomia',
  anestesista: 'ANA', anestesistaUserId: 'uid-ana', statusCirurgia: 'terminada',
  inicioReal: null, terminoReal: null, ...o,
})
const escala = (casos, o = {}) => ({ hospital: 'unimed', data: HOJE, status: 'publicada', casos, ...o })
const ninguemLiberado = () => false

describe('o que falta', () => {
  it('diz o que falta: início, término ou os dois', () => {
    expect(faltaHorario({ inicioReal: null, terminoReal: '10:00' })).toBe('ini')
    expect(faltaHorario({ inicioReal: '08:00', terminoReal: '' })).toBe('ter')
    expect(faltaHorario({})).toBe('ambos')
    expect(faltaHorario({ inicioReal: '08:00', terminoReal: '10:00' })).toBeNull()
  })
})

describe('janela: a partir da tarde de 05/10', () => {
  it('a manhã de 05/10 fica fora; a tarde entra; depois, tudo', () => {
    expect(INICIO_ALERTA_HORARIO).toEqual({ data: '2026-10-05', turno: 'vespertino' })
    expect(dentroDoInicioDoAlerta('2026-10-05', 'matutino')).toBe(false)
    expect(dentroDoInicioDoAlerta('2026-10-05', 'vespertino')).toBe(true)
    expect(dentroDoInicioDoAlerta('2026-10-04', 'vespertino')).toBe(false)
    expect(dentroDoInicioDoAlerta('2026-10-06', 'matutino')).toBe(true)
  })
})

describe('quem entra na conta', () => {
  it('suspensa, sem anestesista, "?", continuação e linha sem procedimento ficam fora', () => {
    const d = { data: HOJE }
    expect(casoEntraNaConta(caso(), d)).toBe(true)
    expect(casoEntraNaConta(caso({ statusExtra: 'suspensa' }), d)).toBe(false)
    expect(casoEntraNaConta(caso({ semAnestesista: true }), d)).toBe(false)
    expect(casoEntraNaConta(caso({ anestesista: '?' }), d)).toBe(false)
    expect(casoEntraNaConta(caso({ isContinuacao: true }), d)).toBe(false)
    expect(casoEntraNaConta(caso({ procedimento: '  ' }), d)).toBe(false)
  })

  it('dupla conta para os DOIS, sem o uid do caso; "?" da dupla não é pessoa', () => {
    expect(anestesistasDoCaso(caso({ anestesista: 'ANA + BRUNO', anestesistaUserId: 'x' })))
      .toEqual([{ alias: 'ANA', uid: null }, { alias: 'BRUNO', uid: null }])
    expect(anestesistasDoCaso(caso({ anestesista: 'OSCAR + ?', anestesistaUserId: null })))
      .toEqual([{ alias: 'OSCAR', uid: null }])
  })
})

describe('quando entra no alerta', () => {
  it('pelo relógio: manhã às 13h, tarde às 19h — EM ANDAMENTO, a manhã às 19h e a tarde às 23h', () => {
    // com início e sem término: isola a regra do fim do turno (a do início vencido não se aplica).
    // MUDOU DE LADO em 15/10 (dono, causa 3 das 24 pendências): a tarde iniciada e não
    // terminada às 19h pode estar em curso — entrava às 19h, agora tem até as 23h.
    // E em 21/10 a manhã em curso às 13h (Sala 9 do HRO) — entrava às 13h, agora às 19h.
    const aberta = { statusCirurgia: 'iniciada', inicioReal: '08:05', terminoReal: null }
    const e = escala([
      caso({ id: 'm', ...aberta }),
      caso({ id: 'mt', statusCirurgia: 'terminada', inicioReal: '08:05', terminoReal: null }),
      caso({ id: 't', turno: 'vespertino', hora: '14:00', ...aberta, inicioReal: '14:10' }),
      caso({ id: 'tt', turno: 'vespertino', hora: '14:00', statusCirurgia: 'terminada', inicioReal: '14:10', terminoReal: null }),
    ])
    expect(pendenciasDoDia([e], { hoje: HOJE, agoraMin: 12 * 60 + 59, liberado: ninguemLiberado })).toHaveLength(0)
    expect(pendenciasDoDia([e], { hoje: HOJE, agoraMin: 13 * 60, liberado: ninguemLiberado }).map((p) => p.caso.id)).toEqual(['mt'])
    expect(pendenciasDoDia([e], { hoje: HOJE, agoraMin: 19 * 60, liberado: ninguemLiberado }).map((p) => p.caso.id)).toEqual(['m', 'mt', 'tt'])
    expect(pendenciasDoDia([e], { hoje: HOJE, agoraMin: 23 * 60, liberado: ninguemLiberado }).map((p) => p.caso.id)).toEqual(['m', 'mt', 't', 'tt'])
  })

  it('a que passa para tarde vence com a tarde; a que passa para a noite não vence no dia', () => {
    expect(prazoDoCaso(caso({ statusExtra: 'passa_tarde' }))).toBe(19 * 60)
    expect(prazoDoCaso(caso({ turno: 'vespertino', statusExtra: 'passa_tarde' }))).toBe(31 * 60)
  })

  it('pela LIBERAÇÃO, antes do fim do turno', () => {
    const e = escala([caso({ statusCirurgia: 'terminada', inicioReal: null, terminoReal: '09:40' })])
    const liberado = (esc, turno, parte) => turno === 'matutino' && parte.uid === 'uid-ana'
    const [p] = pendenciasDoDia([e], { hoje: HOJE, agoraMin: 10 * 60, liberado })
    expect(p).toMatchObject({ falta: 'ini', motivo: 'liberado', aberta: false })
  })

  it('INÍCIO VENCIDO (dono 05/10 à tarde): 30 min depois do horário agendado, sem início → "Falta início"', () => {
    const e = escala([caso({ id: 'ag', turno: 'vespertino', hora: '14:00', statusCirurgia: 'agendada', terminoReal: null })])
    expect(pendenciasDoDia([e], { hoje: HOJE, agoraMin: 14 * 60 + 29, liberado: ninguemLiberado })).toHaveLength(0)
    const [p] = pendenciasDoDia([e], { hoje: HOJE, agoraMin: 14 * 60 + 30, liberado: ninguemLiberado })
    expect(p).toMatchObject({ falta: 'ini', motivo: 'inicio', aberta: false })
  })

  // MUDOU DE LADO em 27/10 (dono, medido em outubro): era o término + 30 min, e 53% das "AS"
  // acendiam antes de começar (mediana término → início na sala = 35 min). Agora + 60.
  it('"a seguir" (sem hora) conta do término real da anterior da mesma sala, + 60 min', () => {
    const e = escala([
      caso({ id: 'a', ordem: 0, turno: 'vespertino', hora: '13:00', statusCirurgia: 'terminada', inicioReal: '13:05', terminoReal: '14:40' }),
      caso({ id: 'as', ordem: 1, turno: 'vespertino', hora: 'AS', statusCirurgia: 'agendada', terminoReal: null }),
    ])
    expect(TOLERANCIA_INICIO_AS_MIN).toBe(60)
    expect(prazoInicio(e.casos[1], e.casos[0])).toBe(14 * 60 + 40 + TOLERANCIA_INICIO_AS_MIN)
    expect(pendenciasDoDia([e], { hoje: HOJE, agoraMin: 15 * 60 + 39, liberado: ninguemLiberado })).toHaveLength(0)
    expect(pendenciasDoDia([e], { hoje: HOJE, agoraMin: 15 * 60 + 40, liberado: ninguemLiberado }).map((p) => p.caso.id)).toEqual(['as'])
  })

  it('"Atrasada" declarada pausa o início vencido — o fim do turno continua valendo', () => {
    const e = escala([caso({ turno: 'vespertino', hora: '14:00', statusCirurgia: 'agendada', terminoReal: null, statusExtra: 'atrasada' })])
    expect(pendenciasDoDia([e], { hoje: HOJE, agoraMin: 16 * 60, liberado: ninguemLiberado })).toHaveLength(0)
    expect(pendenciasDoDia([e], { hoje: HOJE, agoraMin: 19 * 60, liberado: ninguemLiberado })[0]).toMatchObject({ motivo: 'turno', falta: 'ambos' })
  })

  it('a liberação NÃO encerra a cirurgia que passa de turno', () => {
    const e = escala([caso({ statusCirurgia: 'iniciada', statusExtra: 'passa_tarde', inicioReal: '11:00' })])
    expect(pendenciasDoDia([e], { hoje: HOJE, agoraMin: 12 * 60, liberado: () => true })).toHaveLength(0)
  })

  it('só a data de HOJE e só escala publicada', () => {
    const ontem = escala([caso()], { data: '2026-10-05' })
    const rascunho = escala([caso()], { status: 'rascunho' })
    expect(pendenciasDoDia([ontem, rascunho], { hoje: HOJE, agoraMin: 20 * 60, liberado: ninguemLiberado })).toHaveLength(0)
  })
})

describe('liberado com cirurgia ABERTA (dono 05/10: "ou se ele foi substituído")', () => {
  it('uma ou mais abertas → aberta=true em cada uma; a terminada não', () => {
    const e = escala([
      caso({ id: 'a1', statusCirurgia: 'agendada' }),
      caso({ id: 'a2', statusCirurgia: 'iniciada', inicioReal: '09:00' }),
      caso({ id: 'fim', statusCirurgia: 'terminada', terminoReal: '08:50' }),
    ])
    const liberado = (esc, turno, parte) => parte.uid === 'uid-ana'
    const ps = pendenciasDoDia([e], { hoje: HOJE, agoraMin: 10 * 60, liberado })
    expect(Object.fromEntries(ps.map((p) => [p.caso.id, [p.falta, p.aberta]]))).toEqual({
      a1: ['ambos', true], a2: ['ter', true], fim: ['ini', false],
    })
  })

  it('passada para o colega que assumiu (não liberado), sai do alerta antes do fim do turno', () => {
    const e = escala([caso({ statusCirurgia: 'iniciada', inicioReal: '09:00', anestesista: 'BRUNO', anestesistaUserId: 'uid-bruno' })])
    const liberado = (esc, turno, parte) => parte.uid === 'uid-ana'
    expect(pendenciasDoDia([e], { hoje: HOJE, agoraMin: 10 * 60, liberado })).toHaveLength(0)
    // e no prazo volta a valer a regra — agora no nome de quem assumiu (em curso de manhã: 19h)
    const [p] = pendenciasDoDia([e], { hoje: HOJE, agoraMin: 19 * 60, liberado })
    expect(p.nomes).toEqual([{ alias: 'BRUNO', uid: 'uid-bruno' }])
  })
})

describe('agrupar por anestesista', () => {
  it('quem deve mais primeiro; a dupla aparece nos dois', () => {
    const e = escala([
      caso({ id: '1', anestesista: 'ANA' }),
      caso({ id: '2', anestesista: 'ANA', hora: '10:00' }),
      caso({ id: '3', anestesista: 'BRUNO', anestesistaUserId: 'uid-bruno', hora: '07:00' }),
      caso({ id: '4', anestesista: 'ANA + CARLA', anestesistaUserId: null, hora: '11:00' }),
    ])
    const itens = pendenciasDoDia([e], { hoje: HOJE, agoraMin: 14 * 60, liberado: ninguemLiberado })
    expect(itens).toHaveLength(4)
    // a página resolve o apelido da dupla pelo dicionário (aqui, ANA → uid-ana)
    const chaveDe = (p) => p.uid || (p.alias === 'ANA' ? 'uid-ana' : p.alias)
    const grupos = agruparPorAnestesista(itens, { chaveDe, nomeDe: (p) => p.alias })
    expect(grupos.map((g) => [g.chave, g.itens.map((i) => i.caso.id)])).toEqual([
      ['uid-ana', ['1', '2', '4']],
      ['uid-bruno', ['3']],
      ['CARLA', ['4']],
    ])
  })
})

describe('relatório: o que ficou sem horário nos dias encerrados', () => {
  const r = (o) => ({ id: o.id, data: o.data, turno: o.turno || 'matutino', hospital: 'unimed', sala: 'Sala 1', hora: o.hora || '08:00', procedimento: 'X', anestesista: o.a, anestesista_user_id: o.uid ?? null, falta: o.falta || 'ambos' })
  const dados = {
    desde: '2026-10-05', ate: '2026-10-07',
    casos: [
      r({ id: '1', data: '2026-10-05', turno: 'vespertino', a: 'ANA', uid: 'uid-ana' }),
      r({ id: '2', data: '2026-10-07', a: 'ANA', uid: 'uid-ana', falta: 'ini' }),
      r({ id: '3', data: '2026-10-06', a: 'BRUNO', uid: 'uid-bruno' }),
      r({ id: '4', data: '2026-10-07', a: 'CARLA', uid: 'uid-carla' }),
    ],
  }

  it('por pessoa: quem deixou mais primeiro; empate → o mais recente; cirurgias da mais nova à mais antiga', () => {
    const rel = montarRelatorioHorario(dados, { chaveDe: (p) => p.uid, nomeDe: (p) => p.alias })
    expect(rel.pessoas.map((g) => [g.nome, g.ultima, g.itens.map((i) => i.caso.id)])).toEqual([
      ['ANA', '2026-10-07', ['2', '1']],
      ['CARLA', '2026-10-07', ['4']],
      ['BRUNO', '2026-10-06', ['3']],
    ])
  })

  it('os três números: último dia, 7 dias e o período', () => {
    expect(montarRelatorioHorario(dados)).toMatchObject({ ultimoDia: 2, seteDias: 4, total: 4, vazio: false })
  })

  it('janela vazia (o primeiro dia ainda não encerrou) não conta nada', () => {
    expect(montarRelatorioHorario({ desde: '2026-10-05', ate: '2026-10-04', casos: [] })).toMatchObject({ vazio: true, total: 0, pessoas: [] })
  })

  it('rótulo do dia: "ontem" ou dia da semana com a data', () => {
    expect(rotuloDiaRelatorio('2026-10-06', '2026-10-07')).toBe('ontem')
    expect(rotuloDiaRelatorio('2026-10-02', '2026-10-07')).toBe('sex 02/10')
  })
})

// ANTES DE LIBERAR (dono 14/10): o que trava a liberação de quem tem cirurgia sem horário
describe('pendenciasParaLiberar', () => {
  const c = (extra) => ({ id: 'x', procedimento: 'HERNIORRAFIA', anestesista: 'PAULO', hora: '13:00', ...extra })

  // MUDOU DE LADO em 27/10 (dono, reabre 14/10): 96% das liberações eram de outra pessoa e
  // 177 términos entraram com a hora do toque só para destravar. Terminada sem horário não
  // segura mais ninguém — vira pendência de quem operou (Minhas).
  it('só a aberta (agendada ou em andamento) trava; terminada sem início ou término não', () => {
    const r = pendenciasParaLiberar([
      c({ id: 'a', statusCirurgia: 'agendada' }),
      c({ id: 'b', statusCirurgia: 'iniciada', inicioReal: '13:05' }),
      c({ id: 't1', statusCirurgia: 'terminada', terminoReal: '14:00' }),
      c({ id: 't2', statusCirurgia: 'terminada', inicioReal: '13:00' }),
      c({ id: 't3', statusCirurgia: 'terminada' }),
      c({ id: 'ok', statusCirurgia: 'terminada', inicioReal: '13:00', terminoReal: '14:00' }),
    ])
    expect(r.map((p) => [p.caso.id, p.inicio, p.termino, p.aberta])).toEqual([
      ['a', true, true, true], ['b', false, true, true],
    ])
  })

  it('não trava: suspensa, continuação, sem anestesista, sem procedimento', () => {
    expect(pendenciasParaLiberar([
      c({ statusExtra: 'suspensa' }), c({ statusCirurgia: 'suspensa' }), c({ isContinuacao: true }),
      c({ semAnestesista: true }), c({ procedimento: '' }),
    ])).toEqual([])
  })

  // a dupla terminada sem início cobrava na liberação até 27/10 — virou pendência (Minhas)
  it('a que SEGUE com outra pessoa não trava enquanto aberta; terminada também não', () => {
    expect(pendenciasParaLiberar([
      c({ statusExtra: 'passa_tarde', statusCirurgia: 'iniciada', inicioReal: '13:00' }),
      c({ anestesista: 'PAULO + ANA', statusCirurgia: 'iniciada', inicioReal: '13:00' }),
      c({ anestesista: 'PAULO + ANA', statusCirurgia: 'terminada', terminoReal: '14:00' }),
    ])).toEqual([])
  })

  it('em ordem de horário (sem hora vai ao fim)', () => {
    const r = pendenciasParaLiberar([c({ id: 's', hora: 'AS' }), c({ id: '2', hora: '15:00' }), c({ id: '1', hora: '08:00' })])
    expect(r.map((p) => p.caso.id)).toEqual(['1', '2', 's'])
  })
})

describe('o fim do turno só cobra o que já devia ter acontecido (dono 15/10, causa 3)', () => {
  // HRO, tarde de 15/10, faixa das 19h: o Diego aparecia com 2 pendentes — uma cirurgia
  // agendada para 19:15 (ainda não era hora) e outra iniciada às 16:20, em curso.
  const diego = (o) => caso({ turno: 'vespertino', anestesista: 'DIEGO', anestesistaUserId: 'u-die', terminoReal: null, ...o })
  const e = escala([
    // salas diferentes desde 27/10: na MESMA sala, a cirurgia em curso segura a das 19:15
    // (sala ocupada não cobra início) — o que se trava aqui é o fim do turno de 15/10
    diego({ id: 'curso', sala: 'Sala 2', hora: '16:00', statusCirurgia: 'iniciada', inicioReal: '16:20' }),
    diego({ id: 'noite', sala: 'Sala 4', hora: '19:15', statusCirurgia: 'agendada', inicioReal: null }),
  ], { hospital: 'hro' })
  const ids = (agoraMin) => pendenciasDoDia([e], { hoje: HOJE, agoraMin, liberado: ninguemLiberado }).map((p) => p.caso.id)

  it('às 19h nenhuma das duas entra', () => {
    expect(ids(19 * 60)).toEqual([])
  })

  it('a das 19:15 entra pelo início vencido, às 19:45, cobrando só o início', () => {
    expect(ids(19 * 60 + 44)).toEqual([])
    const [p] = pendenciasDoDia([e], { hoje: HOJE, agoraMin: 19 * 60 + 45, liberado: ninguemLiberado })
    expect(p).toMatchObject({ motivo: 'inicio', falta: 'ini' })
    expect(p.caso.id).toBe('noite')
  })

  it('a que está em curso entra às 23h se ainda estiver sem término', () => {
    expect(ids(22 * 60 + 59)).not.toContain('curso')
    expect(ids(23 * 60)).toContain('curso')
  })

  it('de manhã: em curso vence às 19h (dono 21/10); agendada para depois das 13h espera o início vencido', () => {
    expect(prazoDoCaso(caso({ statusCirurgia: 'iniciada', inicioReal: '12:25', terminoReal: null }))).toBe(19 * 60)
    expect(prazoDoCaso(caso({ hora: '13:30', statusCirurgia: 'agendada' }))).toBe(31 * 60)
    expect(prazoDoCaso(caso({ hora: '12:30', statusCirurgia: 'agendada' }))).toBe(13 * 60)
  })

  it('liberado com ela aberta continua entrando na hora (a liberação não espera o relógio)', () => {
    const liberado = (esc, turno, parte) => parte.uid === 'u-die'
    expect(pendenciasDoDia([e], { hoje: HOJE, agoraMin: 18 * 60, liberado }).map((p) => p.caso.id)).toEqual(['curso', 'noite'])
  })
})

describe('consultório não pede horário (dono 16/10)', () => {
  const consult = (o) => caso({ sala: 'Consultório', hora: '07:45', statusCirurgia: 'agendada', terminoReal: null, ...o })
  it('nem pela faixa nem pela liberação — as grafias reais da base', () => {
    for (const procedimento of ['CONSULTORIO', 'CONSULTÓRIO – AJUDA (12 PACIENTES)', '11 CONSULTAS', 'Consultório ajuda']) {
      expect(casoEntraNaConta(consult({ procedimento }), { data: HOJE })).toBe(false)
      expect(pendenciasParaLiberar([consult({ procedimento })])).toEqual([])
    }
    expect(pendenciasDoDia([escala([consult({ procedimento: 'CONSULTORIO' })])], { hoje: HOJE, agoraMin: 19 * 60, liberado: () => true })).toEqual([])
  })
  it('cirurgia lançada na SALA Consultório continua pedindo (a blefaroplastia da Unimed)', () => {
    const blefaro = consult({ procedimento: '01 BLEFAROPLASTIA - 2h', hora: '07:30' })
    expect(casoEntraNaConta(blefaro, { data: HOJE })).toBe(true)
    expect(pendenciasParaLiberar([blefaro])).toHaveLength(1)
  })
})


describe('a sala ocupada não cobra início (dono 27/10, medido em outubro: 300 → 139 alertas falsos)', () => {
  const sala = (o) => caso({ turno: 'vespertino', sala: 'Sala 3', terminoReal: null, ...o })

  it('com hora, atrás de uma anterior AINDA ABERTA na mesma sala: não acende', () => {
    const e = escala([
      sala({ id: 'ant', ordem: 0, hora: '13:00', statusCirurgia: 'iniciada', inicioReal: '13:10' }),
      sala({ id: 'seg', ordem: 1, hora: '15:00', statusCirurgia: 'agendada' }),
    ])
    expect(prazoInicio(e.casos[1], e.casos[0])).toBeNull()
    expect(pendenciasDoDia([e], { hoje: HOJE, agoraMin: 16 * 60 + 30, liberado: ninguemLiberado })).toEqual([])
  })

  it('com hora, a anterior terminou DEPOIS da hora agendada: conta do término dela + 30', () => {
    const ant = sala({ id: 'ant', ordem: 0, hora: '13:00', statusCirurgia: 'terminada', inicioReal: '13:10', terminoReal: '15:20' })
    const seg = sala({ id: 'seg', ordem: 1, hora: '15:00', statusCirurgia: 'agendada' })
    expect(prazoInicio(seg, ant)).toBe(15 * 60 + 20 + TOLERANCIA_INICIO_MIN)
  })

  it('com hora, a anterior terminou ANTES da hora agendada: vale a hora agendada + 30, como antes', () => {
    const ant = sala({ id: 'ant', ordem: 0, hora: '13:00', statusCirurgia: 'terminada', inicioReal: '13:10', terminoReal: '14:20' })
    const seg = sala({ id: 'seg', ordem: 1, hora: '15:00', statusCirurgia: 'agendada' })
    expect(prazoInicio(seg, ant)).toBe(15 * 60 + TOLERANCIA_INICIO_MIN)
  })

  it('anterior suspensa não segura a sala', () => {
    const ant = sala({ id: 'ant', ordem: 0, hora: '13:00', statusCirurgia: 'agendada', statusExtra: 'suspensa' })
    const seg = sala({ id: 'seg', ordem: 1, hora: '15:00', statusCirurgia: 'agendada' })
    expect(prazoInicio(seg, ant)).toBe(15 * 60 + TOLERANCIA_INICIO_MIN)
  })

  it('anterior fechada sem término ("Terminou · horário depois"): conta da hora em que a marcaram Terminada', () => {
    const marcada = new Date(2026, 9, 6, 15, 50).toISOString()
    const ant = sala({ id: 'ant', ordem: 0, hora: '13:00', statusCirurgia: 'terminada', statusAtualizadoEm: marcada })
    const seg = sala({ id: 'seg', ordem: 1, hora: 'AS', statusCirurgia: 'agendada' })
    expect(prazoInicio(seg, ant)).toBe(15 * 60 + 50 + TOLERANCIA_INICIO_AS_MIN)
  })
})

describe('pendências que ficam na Minhas até serem preenchidas (dono 27/10)', () => {
  const dia = (data, casos, o = {}) => ({ hospital: 'hro', data, status: 'publicada', casos, ...o })
  const minha = (o) => caso({ turno: 'vespertino', hora: '13:30', anestesista: 'GIOVANA', anestesistaUserId: 'u-gio', ...o })

  it('a data de corte é 27/10/2026 — nada antes dela entra', () => {
    expect(CORTE_PENDENCIAS_MINHAS).toBe('2026-10-27')
    const r = pendenciasDeDiasAnteriores([
      dia('2026-10-26', [minha({ id: 'antes' })]),
      dia('2026-10-27', [minha({ id: 'corte' })]),
    ], { hoje: '2026-10-30' })
    expect(r.map((p) => p.caso.id)).toEqual(['corte'])
  })

  it('a regra é a da faixa, com o dia já virado: consultório, suspensa e continuação ficam fora', () => {
    const r = pendenciasDeDiasAnteriores([dia('2026-10-28', [
      minha({ id: 'sem-horario' }),
      minha({ id: 'consult', procedimento: 'CONSULTORIO' }),
      minha({ id: 'susp', statusExtra: 'suspensa' }),
      minha({ id: 'cont', isContinuacao: true }),
      minha({ id: 'ok', inicioReal: '13:30', terminoReal: '15:00' }),
    ])], { hoje: '2026-10-30' })
    expect(r.map((p) => [p.caso.id, p.falta, p.motivo])).toEqual([['sem-horario', 'ambos', 'turno']])
  })

  it('a agendada que nunca foi marcada também fica (pode não ter acontecido: a tela oferece "Não aconteceu")', () => {
    const r = pendenciasDeDiasAnteriores([dia('2026-10-28', [minha({ id: 'nunca', statusCirurgia: 'agendada' })])], { hoje: '2026-10-30' })
    expect(r.map((p) => p.caso.id)).toEqual(['nunca'])
  })

  it('hoje fica de fora (é da faixa do dia); do dia mais recente para o mais antigo', () => {
    const r = pendenciasDeDiasAnteriores([
      dia('2026-10-28', [minha({ id: 'qua' })]),
      dia('2026-10-30', [minha({ id: 'hoje' })]),
      dia('2026-10-29', [minha({ id: 'qui' })]),
    ], { hoje: '2026-10-30' })
    expect(r.map((p) => [p.caso.id, p.data])).toEqual([['qui', '2026-10-29'], ['qua', '2026-10-28']])
  })
})

describe('a continuação herda o término (dono 27/10, 19:52: "que essa herança fique com quem realmente estava com a cirurgia")', () => {
  const DIA = '2026-10-27'
  const hro = (casos) => ({ hospital: 'hro', data: DIA, status: 'publicada', casos })
  const manha = (o) => caso({ turno: 'matutino', sala: 'Sala 1', ordem: 1, hora: 'AS', procedimento: 'MICROCIRURGIA PARA TUMOR INTRACRANIANO', cirurgiao: 'Marcelo Vieira', anestesista: 'MELO', anestesistaUserId: 'u-melo', statusCirurgia: 'iniciada', statusExtra: 'passa_tarde', inicioReal: '10:45', terminoReal: null, ...o })
  const tarde = (o) => caso({ turno: 'vespertino', sala: 'Sala 1', ordem: 0, hora: '13:00', procedimento: 'CONTINUAÇÃO', cirurgiao: 'Marcelo Cunha', anestesista: 'FERNANDA', anestesistaUserId: 'u-fer', isContinuacao: true, statusCirurgia: 'agendada', inicioReal: null, terminoReal: null, ...o })
  const as = (escalas, agoraMin, o = {}) => pendenciasDoDia(escalas, { hoje: DIA, agoraMin, ...o })
  const quem = (r) => r.map((p) => [p.caso.id, p.nomes.map((n) => n.alias).join(' + '), p.falta])
  const H = (h, m = 0) => h * 60 + m

  it('o caso das 19:52: a Fernanda marcou a continuação 13:00→13:32 — o Melo não deve mais nada', () => {
    const casos = [
      manha({ id: 'm0', ordem: 0, hora: '07:00', statusCirurgia: 'terminada', statusExtra: null, inicioReal: '08:00', terminoReal: '09:44' }),
      manha({ id: 'm1' }),
      tarde({ id: 'c', statusCirurgia: 'terminada', inicioReal: '13:00', terminoReal: '13:32' }),
    ]
    expect(as([hro(casos)], H(19, 52))).toEqual([])
    // sem a continuação publicada, o término segue com quem começou (como antes)
    expect(quem(as([hro(casos.slice(0, 2))], H(19, 52)))).toEqual([['m1', 'MELO', 'ter']])
  })

  it('ninguém marcou a continuação: o "Falta término" vai para a Fernanda, não para o Melo', () => {
    const casos = [manha({ id: 'm1' }), tarde({ id: 'c' })]
    expect(quem(as([hro(casos)], H(19, 52)))).toEqual([['c', 'FERNANDA', 'ter']])
    // da continuação não se cobra o início: às 13:45 (agendada 13:00 + 30) nada acende
    expect(as([hro(casos)], H(13, 45))).toEqual([])
  })

  it('liberada à tarde com a continuação sem término, a cobrança vem na hora (como qualquer cirurgia)', () => {
    const casos = [manha({ id: 'm1' }), tarde({ id: 'c', statusCirurgia: 'iniciada', inicioReal: '13:00' })]
    const liberado = (_e, turno, p) => turno === 'vespertino' && p.alias === 'FERNANDA'
    expect(quem(as([hro(casos)], H(15), { liberado }))).toEqual([['c', 'FERNANDA', 'ter']])
  })

  it('o término marcado em QUALQUER card do par vale (o Melo voltou e marcou o dele)', () => {
    const casos = [manha({ id: 'm1', terminoReal: '14:10' }), tarde({ id: 'c' })]
    expect(as([hro(casos)], H(19, 52))).toEqual([])
  })

  it('dupla: HIPEC "OSCAR + ERLEI" de manhã, "ALEXANDRE D + ERLEI" na continuação — o término é dos dois da tarde', () => {
    const casos = [
      manha({ id: 'm', sala: 'CC - Sala 3', ordem: 12, hora: '07:30', procedimento: 'CIRURGIA CITORREDUTORA - HIPEC', cirurgiao: 'CRISTIANO VENDRAME', anestesista: 'OSCAR + ERLEI', anestesistaUserId: null, inicioReal: '08:00' }),
      tarde({ id: 'c', sala: 'CC - Sala 3', procedimento: 'CIRURGIA CITORREDUTORA - HIPEC · CONTINUAÇÃO +-21H', cirurgiao: 'CRISTIANO VENDRAME', anestesista: 'ALEXANDRE D + ERLEI', anestesistaUserId: null, statusCirurgia: 'iniciada', statusExtra: 'passa_tarde', inicioReal: '08:00' }),
    ]
    // passa para a noite: só cobra na virada do dia
    expect(as([{ ...hro(casos), hospital: 'unimed' }], H(22))).toEqual([])
    expect(quem(as([{ ...hro(casos), hospital: 'unimed' }], H(31)))).toEqual([['c', 'ALEXANDRE D + ERLEI', 'ter']])
  })

  it('o início segue com quem começou; marcado em qualquer card, vale', () => {
    const semNada = [manha({ id: 'm', statusCirurgia: 'agendada', statusExtra: null, inicioReal: null, anestesista: 'ALINE', anestesistaUserId: 'u-aline' }), tarde({ id: 'c' })]
    expect(quem(as([hro(semNada)], H(31)))).toEqual([['m', 'ALINE', 'ini'], ['c', 'FERNANDA', 'ter']])
    // Umanitá 27/10: a continuação do Eduardo trouxe 08:00→13:00 — a cirurgia está completa
    const completa = [semNada[0], tarde({ id: 'c', statusCirurgia: 'terminada', inicioReal: '08:00', terminoReal: '13:00' })]
    expect(as([hro(completa)], H(31))).toEqual([])
  })

  it('a MESMA pessoa nos dois cards não passa nada: deve o card da manhã (o que a tela mostra), valendo o horário da continuação', () => {
    const garim = { anestesista: 'GARIM', anestesistaUserId: 'u-garim' }
    const aberta = [manha({ id: 'm', ...garim, inicioReal: '08:00' }), tarde({ id: 'c', ...garim })]
    expect(quem(as([hro(aberta)], H(19, 52)))).toEqual([['m', 'GARIM', 'ter']])
    const marcada = [aberta[0], tarde({ id: 'c', ...garim, statusCirurgia: 'terminada', inicioReal: '08:00', terminoReal: '14:40' })]
    expect(as([hro(marcada)], H(19, 52))).toEqual([])
  })

  it('a manhã Terminada não passa nada adiante: quem marcou disse que acabou ali', () => {
    const casos = [manha({ id: 'm', statusCirurgia: 'terminada', statusExtra: null }), tarde({ id: 'c' })]
    expect(quem(as([hro(casos)], H(19, 52)))).toEqual([['m', 'MELO', 'ter']])
  })

  it('o par exige a mesma sala e cirurgião compatível (o IOSC do HRO é um bloco com várias salas)', () => {
    const iosc = { sala: 'IOSC' }
    const jorge = manha({ id: 'jorge', ...iosc, statusExtra: null, cirurgiao: 'Jorge Valentini', anestesista: 'NATHALIA', anestesistaUserId: 'u-nat' })
    const dalul = tarde({ id: 'dalul', ...iosc, cirurgiao: 'Guilherme Dalul', anestesista: 'PELISSARO', anestesistaUserId: 'u-pel' })
    expect(quem(as([hro([jorge, dalul])], H(19, 52)))).toEqual([['jorge', 'NATHALIA', 'ter']])
    const outraSala = tarde({ id: 'c', sala: 'Sala 2' })
    expect(quem(as([hro([manha({ id: 'm1' }), outraSala])], H(19, 52)))).toEqual([['m1', 'MELO', 'ter']])
  })

  it('entre várias da manhã: mais nomes do cirurgião em comum, depois "Passa para tarde", depois a última da sala', () => {
    const iosc = { sala: 'IOSC', statusExtra: null }
    const rafael = manha({ id: 'rafael', ...iosc, ordem: 20, cirurgiao: 'Rafael Tirapelle', statusExtra: 'passa_tarde', anestesista: 'NATHALIA', anestesistaUserId: 'u-nat' })
    const marco = manha({ id: 'marco', ...iosc, ordem: 22, cirurgiao: 'Marco Tesseroli', anestesista: 'OSCAR', anestesistaUserId: 'u-oscar' })
    const cont = tarde({ id: 'c', sala: 'IOSC', cirurgiao: 'Rafael Tirapelle', anestesista: 'MARILIO', anestesistaUserId: 'u-mar' })
    const pares = paresDeContinuacao([rafael, marco, cont])
    expect(pares.origemDe.get('c').id).toBe('rafael')
    expect(herdaTermino(cont, pares)).toBe(true)
    // sem nome do cirurgião (Imagem, Hemodinâmica): a marcação e depois a última da sala
    const sem = { sala: 'Imagem', cirurgiao: null, statusExtra: null }
    const a = manha({ id: 'a', ...sem, ordem: 3 })
    const b = manha({ id: 'b', ...sem, ordem: 4 })
    expect(paresDeContinuacao([a, b, tarde({ id: 'c', ...sem })]).origemDe.get('c').id).toBe('b')
    expect(paresDeContinuacao([{ ...a, statusExtra: 'passa_tarde' }, b, tarde({ id: 'c', ...sem })]).origemDe.get('c').id).toBe('a')
  })

  it('os nomes do cirurgião: sem acento, só os de 3+ letras, sem "da/dos"', () => {
    expect(nomesDoCirurgiao('Marcelo da Cunha Viêira')).toEqual(['MARCELO', 'CUNHA', 'VIEIRA'])
    expect(nomesDoCirurgiao('DIRCEU FELIPE VALENTINI JUNIOR')).toContain('VALENTINI')
    expect(nomesDoCirurgiao('')).toEqual([])
  })

  it('faltaNoPar: herdeira só o término; manhã que passou adiante só o início', () => {
    const m = manha({ id: 'm', inicioReal: null })
    const c = tarde({ id: 'c' })
    const pares = paresDeContinuacao([m, c])
    expect(faltaNoPar(c, pares)).toBe('ter')
    expect(faltaNoPar(m, pares)).toBe('ini')
    expect(faltaNoPar(caso({ id: 'x' }), pares)).toBe('ambos')
  })

  it('dias anteriores: com os dois cards na busca, a pendência é da continuação', () => {
    const r = pendenciasDeDiasAnteriores([hro([manha({ id: 'm1' }), tarde({ id: 'c' })])], { hoje: '2026-10-28' })
    expect(r.map((p) => [p.caso.id, p.falta, p.data])).toEqual([['c', 'ter', DIA]])
  })
})

describe('hoje no "Seu preenchimento" (dono 28/10: "aparece que tenho 100% de cirurgias marcadas mas falta 1?")', () => {
  const H = (h, m = 0) => h * 60 + m
  const conta = (escalas, agoraMin, o = {}) => contaDoDia(escalas, { hoje: HOJE, agoraMin, liberado: ninguemLiberado, ...o })
  const ids = (r) => r.map((i) => [i.caso.id, i.falta])

  it('entra a completa e a que está no aviso; a em andamento sem prazo vencido espera', () => {
    const casos = [
      caso({ id: 'ok', inicioReal: '08:00', terminoReal: '09:00' }),
      caso({ id: 'sem', hora: '07:30', statusCirurgia: 'terminada' }), // às 13:00 o turno acabou
      caso({ id: 'tarde', turno: 'vespertino', hora: '14:00', statusCirurgia: 'agendada' }),
    ]
    expect(ids(conta([escala(casos)], H(13)))).toEqual([['ok', null], ['sem', 'ambos']])
    // às 11h a da manhã ainda não venceu (o início sim: 07:30 + 30)
    expect(ids(conta([escala(casos)], H(11)))).toEqual([['ok', null], ['sem', 'ini']])
    expect(ids(conta([escala(casos)], H(7)))).toEqual([['ok', null]])
  })

  it('as que faltam são exatamente as do aviso, em qualquer hora do dia', () => {
    const casos = [
      caso({ id: 'a', hora: '07:00', inicioReal: '07:10' }),
      caso({ id: 'b', hora: '09:00', statusCirurgia: 'agendada', anestesista: 'ANA + BETO', anestesistaUserId: null }),
      caso({ id: 'c', turno: 'vespertino', hora: '13:30', statusCirurgia: 'iniciada', inicioReal: '13:40' }),
      caso({ id: 'd', turno: 'vespertino', hora: '15:00', statusExtra: 'suspensa' }),
      caso({ id: 'e', procedimento: 'CONSULTORIO' }),
    ]
    for (const agora of [H(8), H(10), H(13), H(16), H(19), H(23)]) {
      const pend = pendenciasDoDia([escala(casos)], { hoje: HOJE, agoraMin: agora, liberado: ninguemLiberado })
      const faltam = conta([escala(casos)], agora).filter((i) => i.falta)
      expect(ids(faltam)).toEqual(pend.map((p) => [p.caso.id, p.falta]))
    }
  })

  it('liberado entra na hora, como no aviso', () => {
    const casos = [caso({ id: 'x', hora: '08:00', statusCirurgia: 'terminada', inicioReal: '08:05' })]
    const liberado = (e, t, p) => p.alias === 'ANA'
    expect(ids(conta([escala(casos)], H(9)))).toEqual([])
    expect(ids(conta([escala(casos)], H(9), { liberado }))).toEqual([['x', 'ter']])
  })

  it('a continuação de outra pessoa: o término é de quem continuou, o início de quem começou', () => {
    const m = caso({ id: 'm', sala: 'Sala 1', hora: 'AS', cirurgiao: 'Marcelo', statusCirurgia: 'iniciada', statusExtra: 'passa_tarde', inicioReal: '10:45', anestesista: 'MELO', anestesistaUserId: 'u-melo' })
    const c = caso({ id: 'c', sala: 'Sala 1', turno: 'vespertino', hora: '13:00', procedimento: 'CONTINUAÇÃO', cirurgiao: 'Marcelo', isContinuacao: true, statusCirurgia: 'agendada', anestesista: 'FERNANDA', anestesistaUserId: 'u-fer' })
    // às 19h: o Melo já tem o início (completo para ele); a Fernanda deve o término
    expect(ids(conta([escala([m, c])], H(19)))).toEqual([['m', null], ['c', 'ter']])
    const c2 = { ...c, statusCirurgia: 'terminada', terminoReal: '15:30' }
    expect(ids(conta([escala([m, c2])], H(19)))).toEqual([['m', null], ['c', null]])
  })

  it('reaproveita as pendências que a tela já calculou', () => {
    const casos = [caso({ id: 'sem', hora: '07:30' })]
    const pendencias = pendenciasDoDia([escala(casos)], { hoje: HOJE, agoraMin: H(13) })
    expect(ids(contaDoDia([escala(casos)], { hoje: HOJE, pendencias }))).toEqual([['sem', 'ambos']])
    expect(contaDoDia([escala(casos)], { hoje: '2026-10-07', pendencias: [] })).toEqual([])
  })
})
