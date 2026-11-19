/**
 * O expurgo da retenção (20261119210000) troca por "Outro" todo motivo que NÃO é rótulo de chip.
 * O array dele é espelho das listas do app: um chip novo que não entre lá seria apagado em 180
 * dias como se fosse texto livre. Este teste trava os dois iguais.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MOTIVOS_ATRASO, MOTIVOS_SUSPENSAO } from '@/lib/escalaMotivoStatus'

const sql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261119210000_escala_motivo_retencao.sql'), 'utf8')
const bloco = sql.slice(sql.indexOf('v_rotulos text[] := array['), sql.indexOf('];', sql.indexOf('v_rotulos text[] := array[')))
const rotulosSql = [...bloco.matchAll(/'([^']+)'/g)].map((m) => m[1])

describe('retenção do motivo: o array do banco espelha os chips do app', () => {
  it('todo chip do app está no array do expurgo', () => {
    for (const r of [...MOTIVOS_SUSPENSAO, ...MOTIVOS_ATRASO]) expect(rotulosSql).toContain(r)
  })

  it('o rótulo aposentado continua protegido e "Outro" também', () => {
    expect(rotulosSql).toContain('Cirurgião atrasado ou em outra sala')
    expect(rotulosSql).toContain('Outro')
  })

  it('180 dias pela data da escala', () => {
    expect(sql).toMatch(/e\.data < current_date - 180/)
  })
})
