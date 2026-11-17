/**
 * api-v1 — modo de exemplo (`?exemplo=true`, supabase/functions/api-v1/_exemplos.ts).
 *
 * Trava três coisas:
 *  1. toda rota de ROTAS_LEITURA (index.ts) tem exemplo — rota nova sem exemplo falha aqui;
 *  2. o exemplo tem o MESMO formato da resposta real (chaves do caso da escala e do sócio
 *     das férias comparadas com os mapeadores reais);
 *  3. nenhum campo proibido (LGPD) aparece nos exemplos.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EXEMPLOS, respostaExemplo } from '../../../supabase/functions/api-v1/_exemplos.ts'
import { mapCasoApi, mapAnestesistaApi } from '../../../supabase/functions/api-v1/_escala-cirurgica.ts'
import { serializarSocio } from '../../../supabase/functions/api-v1/_ferias.ts'

const INDEX = readFileSync(resolve(__dirname, '../../../supabase/functions/api-v1/index.ts'), 'utf8')

function rotasDeLeitura() {
  const bloco = INDEX.match(/const ROTAS_LEITURA[^{]*\{([\s\S]*?)\n\}/)
  expect(bloco, 'ROTAS_LEITURA não encontrado no index.ts').toBeTruthy()
  return [...bloco[1].matchAll(/'(\/v1\/[^']+)'\s*:/g)].map((m) => m[1])
}

const chaves = (o) => Object.keys(o).sort()

describe('api-v1 — exemplos fictícios', () => {
  it('toda rota de leitura tem exemplo', () => {
    const rotas = rotasDeLeitura()
    expect(rotas.length).toBeGreaterThanOrEqual(7)
    for (const r of rotas) expect(EXEMPLOS[r], `sem exemplo: ${r}`).toBeTruthy()
  })

  it('resposta marca exemplo:true e rota desconhecida dá 404', () => {
    const r = respostaExemplo('/v1/anestesistas')
    expect(r.status).toBe(200)
    expect(r.body.exemplo).toBe(true)
    expect(respostaExemplo('/v1/nao-existe').status).toBe(404)
  })

  it('caso da escala tem as mesmas chaves do mapeador real', () => {
    const real = mapCasoApi({
      sala: '1', ordem: 1, hora: '07:00', termino_previsto: null, tempo_estimado: null,
      cirurgiao: 'X', anestesista_id: 'u', anestesista_nome: 'NOME', residente_id: null, residente_nome: null,
      tipo: 'eletiva', status: 'agendada', inicio_real: null, termino_real: null,
      sem_anestesista: false, continuacao: false,
    })
    for (const caso of EXEMPLOS['/v1/escala-cirurgica'].data[0].casos) {
      expect(chaves(caso)).toEqual(chaves(real))
    }
  })

  it('anestesista tem as mesmas chaves do mapeador real', () => {
    const real = mapAnestesistaApi({ id: 'u', nome: 'NOME', apelidos: ['A'], ativo: true })
    for (const a of EXEMPLOS['/v1/anestesistas'].data) expect(chaves(a)).toEqual(chaves(real))
  })

  it('sócio das férias tem as mesmas chaves do serializador real', () => {
    const real = serializarSocio({
      id: null, nome: 'X', nomeCompleto: 'X', cota: 30, regraCota: 'r', diasContados: 0,
      diasPenalidade: 0, diasEfetivos: 0, saldo: 30, periodos: [], penalidades: [],
    })
    for (const s of EXEMPLOS['/v1/ferias/extrato'].socios) expect(chaves(s)).toEqual(chaves(real))
  })

  it('nenhum campo proibido nos exemplos', () => {
    const txt = JSON.stringify(EXEMPLOS)
    for (const k of ['paciente_iniciais', 'idade', 'procedimento', 'convenio', 'gravidade', 'email', 'motivo', 'setor', 'cpf', 'crm']) {
      expect(txt).not.toContain(`"${k}"`)
    }
  })
})
