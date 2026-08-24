/**
 * "Passa para tarde" PERSISTE na tarde (dono 2026-08-22).
 *
 * O marcador existia desde 20/08, mas só pintava o badge no turno de ORIGEM: a
 * cirurgia continuava só na manhã e, na tela da tarde, quem estava nela aparecia
 * sem caso — sumia da conta de quem está ocupado bem no turno em que ela vai
 * acontecer.
 *
 * INVARIANTE (não persona): toda cirurgia marcada e ainda aberta é alcançável no
 * turno da tarde, e nenhuma aparece duas vezes no mesmo turno. Escrito como
 * invariante de propósito — "isolar por turno" já regrediu três vezes neste
 * módulo, e persona morre junto com o revert.
 */
import { describe, it, expect } from 'vitest'
import {
  filtrarPorTurno, filtrarPorTurnoExibicao, casoSegueParaOTurno,
  casosQuePassamParaOTurno, casosTransferiveis, casosResolvidos, casosDaFilaDoTurno,
} from '@/pages/escala-cirurgica/utils'
import { casoPassaDeTurno, extraDoCaso } from '@/lib/escalaCirurgicaRegras'

const caso = (o) => ({ id: o.id, sala: 'Sala 1', ordem: 0, turno: 'matutino', anestesista: 'THAYNA', procedimento: 'X', ...o })

const MANHA_PASSA = caso({ id: 'p1', statusExtra: 'passa_tarde' })
const MANHA_COMUM = caso({ id: 'm1' })
const TARDE = caso({ id: 't1', turno: 'vespertino', hora: '13:00' })

describe('a marcação', () => {
  it('lê o extra do campo novo e do legado (demo/dados antigos)', () => {
    expect(casoPassaDeTurno({ statusExtra: 'passa_tarde' })).toBe(true)
    expect(casoPassaDeTurno({ statusCirurgia: 'passa_tarde' })).toBe(true)
    expect(casoPassaDeTurno({ statusExtra: 'atrasada' })).toBe(false)
    expect(casoPassaDeTurno({})).toBe(false)
    expect(extraDoCaso({ statusCirurgia: 'iniciada' })).toBe('')
  })
})

describe('travessia — só da manhã para a tarde, e só enquanto está aberta', () => {
  it('a cirurgia da manhã marcada aparece na TARDE', () => {
    expect(casoSegueParaOTurno(MANHA_PASSA, 'vespertino')).toBe(true)
  })

  it('e continua aparecendo na MANHÃ — não muda de turno, atravessa', () => {
    expect(filtrarPorTurno([MANHA_PASSA], 'matutino')).toHaveLength(1)
    expect(filtrarPorTurnoExibicao([MANHA_PASSA], 'matutino')).toHaveLength(1)
  })

  it('cirurgia comum da manhã NÃO atravessa', () => {
    expect(casoSegueParaOTurno(MANHA_COMUM, 'vespertino')).toBe(false)
  })

  it('terminada ou suspensa encerra a travessia', () => {
    expect(casoSegueParaOTurno({ ...MANHA_PASSA, statusCirurgia: 'terminada' }, 'vespertino')).toBe(false)
    expect(casoSegueParaOTurno({ ...MANHA_PASSA, statusExtra: 'suspensa' }, 'vespertino')).toBe(false)
  })

  it('a marcada da TARDE não volta para a manhã', () => {
    const tardeMarcada = { ...TARDE, statusExtra: 'passa_tarde' }
    expect(casoSegueParaOTurno(tardeMarcada, 'matutino')).toBe(false)
    expect(filtrarPorTurnoExibicao([tardeMarcada], 'matutino')).toHaveLength(0)
  })
})

describe('INVARIANTE: alcançável na tarde, uma vez só', () => {
  const escala = { casos: [MANHA_PASSA, MANHA_COMUM, TARDE] }

  it('a tarde mostra os casos dela MAIS a que atravessou', () => {
    const tarde = filtrarPorTurnoExibicao(escala.casos, 'vespertino')
    expect(tarde.map((c) => c.id).sort()).toEqual(['p1', 't1'])
  })

  it('nenhum caso aparece duas vezes no mesmo turno', () => {
    for (const turno of ['matutino', 'vespertino']) {
      const ids = filtrarPorTurnoExibicao(escala.casos, turno).map((c) => c.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('o quadro da tarde recebe a que atravessou pelo grupo das herdadas', () => {
    expect(casosQuePassamParaOTurno(casosResolvidos(escala), 'vespertino').map((c) => c.id)).toEqual(['p1'])
    expect(casosQuePassamParaOTurno(casosResolvidos(escala), 'matutino')).toEqual([])
  })
})

describe('o que NÃO pode mudar junto', () => {
  const escala = { id: 'e1', casos: [MANHA_PASSA, TARDE] }
  const pessoa = { uid: null, nome: 'THAYNA' }

  it('TROCA e posição seguem com o filtro EXATO (regra estruturante de 13/08)', () => {
    // a cirurgia da manhã não pode ser transferida ao trocar a posição da TARDE:
    // seria reatribuir caso de outro turno, que é o que a regra proíbe
    const ids = casosTransferiveis(escala, pessoa, null, 'vespertino').map((c) => c)
    expect(ids).not.toContain('p1')
  })

  it('filtrarPorTurno continua ESTRITO — é ele que troca e slot usam', () => {
    expect(filtrarPorTurno(escala.casos, 'vespertino').map((c) => c.id)).toEqual(['t1'])
  })
})

// ════════════════════════════════════════════════════════════════════════════
// A TRAVESSIA CONTA PARA QUEM JÁ ESTÁ NO TURNO — NUNCA CRIA POSIÇÃO NA FILA
// (dono 24/08, caso Gabriela na Unimed)
//
// A cirurgia dela das 07:00 ficou marcada "passa para tarde" e à tarde ela
// estava escalada no HRO. A fila da tarde da Unimed ganhou uma linha dela no
// fim, com badge "Ajuda" — o app afirmando o que não era verdade. A cirurgia
// não some: segue no quadro da Completa, no grupo "Ainda abertas — Manhã".
// ════════════════════════════════════════════════════════════════════════════
describe('INVARIANTE: a travessia não inventa gente na fila', () => {
  const G_MANHA = caso({ id: 'g1', anestesista: 'GABRIELA', anestesistaUserId: 'uid-gab', hora: '07:00', statusExtra: 'passa_tarde' })
  const R_TARDE = caso({ id: 'r1', anestesista: 'RAUL', anestesistaUserId: 'uid-raul', turno: 'vespertino', hora: '13:00' })

  it('quem NÃO está na ordem nem tem cirurgia própria do turno fica fora da fila', () => {
    const fila = casosDaFilaDoTurno([G_MANHA, R_TARDE], 'vespertino', ['RAUL', 'VICENTE'])
    expect(fila.map((c) => c.id)).toEqual(['r1'])
  })

  it('mas a cirurgia continua existindo para a tela que pergunta "isto existe?"', () => {
    // é o que a Completa e a aba Minhas usam — a travessia de 22/08 segue de pé
    expect(filtrarPorTurnoExibicao([G_MANHA, R_TARDE], 'vespertino').map((c) => c.id))
      .toEqual(['g1', 'r1'])
  })

  it('quem ESTÁ na ordem da tarde leva a cirurgia junto (caso Humberto, mesmo dia)', () => {
    const fila = casosDaFilaDoTurno([G_MANHA, R_TARDE], 'vespertino', ['GABRIELA', 'RAUL'])
    expect(fila.map((c) => c.id).sort()).toEqual(['g1', 'r1'])
  })

  it('quem tem cirurgia PRÓPRIA da tarde também leva a da manhã junto', () => {
    const gTarde = caso({ id: 'g2', anestesista: 'GABRIELA', anestesistaUserId: 'uid-gab', turno: 'vespertino', hora: '14:00' })
    const fila = casosDaFilaDoTurno([G_MANHA, gTarde], 'vespertino', [])
    expect(fila.map((c) => c.id).sort()).toEqual(['g1', 'g2'])
  })

  it('casa por LOGIN quando a grafia diverge (o rodapé diz o apelido, o caso diz outro)', () => {
    const resolver = (n) => (String(n).toUpperCase().startsWith('GABRIELA') ? 'uid-gab' : null)
    const fila = casosDaFilaDoTurno([G_MANHA, R_TARDE], 'vespertino', ['GABRIELA VEDANA', 'RAUL'], resolver)
    expect(fila.map((c) => c.id).sort()).toEqual(['g1', 'r1'])
  })

  it('sem nenhuma travessia, devolve exatamente o filtro estrito do turno', () => {
    expect(casosDaFilaDoTurno([MANHA_COMUM, TARDE], 'vespertino', ['THAYNA']).map((c) => c.id))
      .toEqual(filtrarPorTurno([MANHA_COMUM, TARDE], 'vespertino').map((c) => c.id))
  })
})
