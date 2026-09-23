/**
 * O aviso de republicar diz o que se perde de verdade (revisão 23/09): o texto
 * antigo afirmava "os tempos são zerados" (falso desde 05/09 — CAMPOS_RASTRO) e
 * calava o andamento das cirurgias e as urgências adicionadas à mão.
 */
import { describe, it, expect } from 'vitest'
import { perdaNaRepublicacao, frasePerdaRepublicacao } from '@/pages/escala-cirurgica/utils'

const escala = {
  casos: [
    { turno: 'matutino', statusCirurgia: 'terminada' },
    { turno: 'matutino', statusCirurgia: 'agendada', origem: 'manual' },
    { turno: 'vespertino', statusCirurgia: 'iniciada', origem: 'manual' },
  ],
  liberacoes: {
    'matutino:uid-a': { liberadoEm: 'x' },
    'matutino:uid-b': { escalado: true },   // marcador, não liberação
    'vespertino:uid-c': { liberadoEm: 'x' },
  },
}

describe('perdaNaRepublicacao', () => {
  it('conta só o TURNO publicado, e marcador de escalado não é liberação', () => {
    expect(perdaNaRepublicacao(escala, 'matutino')).toEqual({ liberacoes: 1, andamento: 1, manuais: 1 })
    expect(perdaNaRepublicacao(escala, 'vespertino')).toEqual({ liberacoes: 1, andamento: 1, manuais: 1 })
  })
  it('sem escala, ou turno vazio, não há aviso', () => {
    expect(perdaNaRepublicacao(null, 'matutino')).toBeNull()
    expect(perdaNaRepublicacao({ casos: [], liberacoes: {} }, 'matutino')).toBeNull()
    expect(frasePerdaRepublicacao(null)).toBeNull()
  })
})

describe('frasePerdaRepublicacao', () => {
  it('cita o que se perde e diz que tempo/observação/trocas ficam — nunca "tempos zerados"', () => {
    const f = frasePerdaRepublicacao({ liberacoes: 2, andamento: 1, manuais: 3 })
    expect(f).toContain('2 liberações marcadas')
    expect(f).toContain('1 cirurgia com andamento')
    expect(f).toContain('3 casos adicionados à mão')
    expect(f).toContain('Tempo, observação e trocas de quem continua na escala são mantidos')
    expect(f).not.toMatch(/tempos?.*zerad/i)
  })
  it('turno publicado sem nada marcado: só avisa que já existe', () => {
    expect(frasePerdaRepublicacao({ liberacoes: 0, andamento: 0, manuais: 0 })).toBe(
      'Este turno já está publicado. Tempo, observação e trocas de quem continua na escala são mantidos.',
    )
  })
})
