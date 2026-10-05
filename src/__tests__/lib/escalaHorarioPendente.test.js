/**
 * HORÁRIO PENDENTE — alerta público da cirurgia sem início/término (dono 05/10, modelo A).
 *
 * Travas das decisões do dono:
 *  1. entra quando o anestesista é LIBERADO ou quando o turno ACABA (13h/19h);
 *  2. sai só com início E término — ou Suspensa;
 *  3. conta a partir da TARDE de 05/10;
 *  4. liberado com cirurgia ABERTA (uma ou mais) → `aberta` (o alerta oferece "quem
 *     assumiu"); trocado o anestesista, a cirurgia segue a regra pelo nome novo;
 *  5. dupla conta para os dois; "?" não é pessoa; continuação não conta em dobro.
 */
import { describe, it, expect } from 'vitest'
import {
  INICIO_ALERTA_HORARIO, agruparPorAnestesista, anestesistasDoCaso, casoEntraNaConta,
  dentroDoInicioDoAlerta, faltaHorario, pendenciasDoDia, prazoDoCaso, quantasPilulasCabem,
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
  it('pelo relógio: manhã às 13h, tarde às 19h', () => {
    const e = escala([caso({ id: 'm' }), caso({ id: 't', turno: 'vespertino', hora: '14:00' })])
    expect(pendenciasDoDia([e], { hoje: HOJE, agoraMin: 12 * 60 + 59, liberado: ninguemLiberado })).toHaveLength(0)
    expect(pendenciasDoDia([e], { hoje: HOJE, agoraMin: 13 * 60, liberado: ninguemLiberado }).map((p) => p.caso.id)).toEqual(['m'])
    expect(pendenciasDoDia([e], { hoje: HOJE, agoraMin: 19 * 60, liberado: ninguemLiberado }).map((p) => p.caso.id)).toEqual(['m', 't'])
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
    // e no fim do turno volta a valer a regra — agora no nome de quem assumiu
    const [p] = pendenciasDoDia([e], { hoje: HOJE, agoraMin: 13 * 60, liberado })
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

describe('pílulas que cabem na faixa', () => {
  it('reserva o "+N" quando sobra gente; a última não reserva', () => {
    expect(quantasPilulasCabem([102, 101, 117, 34], 374, { gap: 6, mais: 34 })).toBe(4)
    expect(quantasPilulasCabem([102, 101, 117, 117], 374, { gap: 6, mais: 34 })).toBe(3)
    expect(quantasPilulasCabem([102, 101, 117, 117], 300, { gap: 6, mais: 34 })).toBe(2)
    expect(quantasPilulasCabem([], 300)).toBe(0)
  })
})
