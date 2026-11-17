/**
 * api-v1 — modo de exemplo (`?exemplo=true`, supabase/functions/api-v1/_exemplos.ts).
 *
 * Trava três coisas:
 *  1. toda rota de ROTAS_LEITURA (index.ts) tem exemplo — rota nova sem exemplo falha aqui;
 *  2. o exemplo tem o MESMO formato da resposta real (chaves do caso da escala e do sócio
 *     das férias comparadas com os mapeadores reais);
 *  3. nenhum campo proibido (LGPD) aparece nos exemplos. Desde nov/2026 o dono (controlador)
 *     autorizou motivo de licença, observações e justificativas — continuam proibidos
 *     paciente, e-mail, CPF e CRM.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { EXEMPLOS, respostaExemplo } from '../../../supabase/functions/api-v1/_exemplos.ts'
import { mapCasoApi, mapAnestesistaApi } from '../../../supabase/functions/api-v1/_escala-cirurgica.ts'
import { serializarSocio } from '../../../supabase/functions/api-v1/_ferias.ts'
import { criarIdentificador, linhaApi, trocaApi } from '../../../supabase/functions/api-v1/_escala-numerica.ts'
import { comporPlantoesPP } from '../../../supabase/functions/api-v1/_plantoes-pp.ts'

// _firestore.ts importa o jose por URL (https:) — o Node não carrega; a rota de feriados
// só precisa de listarColecao, simulada aqui.
vi.mock('../../../supabase/functions/api-v1/_firestore.ts', () => ({ listarColecao: vi.fn(async () => ({})) }))

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

  it('linha da numérica/feriados e troca têm as mesmas chaves dos serializadores reais', () => {
    const ident = criarIdentificador([])
    const real = linhaApi({ posicao: 1, numero: '01', nome: 'MELO' }, ident)
    const ex = EXEMPLOS['/v1/escala-numerica'].data[0].turnos[0]
    for (const l of [...ex.hospitais[0].lista, ...ex.consultorio.lista]) expect(chaves(l)).toEqual(chaves(real))
    for (const l of EXEMPLOS['/v1/feriados'].feriados[0].fila.matutino) expect(chaves(l)).toEqual(chaves(real))
    const troca = trocaApi({ status: 'pendente', escopo: 'data' }, ident)
    for (const t of EXEMPLOS['/v1/feriados'].trocas) expect(chaves(t)).toEqual(chaves(troca))
  })

  it('registro de /v1/plantoes tem as mesmas chaves do compositor real', () => {
    const [dia] = comporPlantoesPP({
      registros: [{ Setor: '1 - P1', Inicio: '2026-01-15T19:00:00', ProfDePlantao: 'X' }],
      pessoas: [], inicio: '2026-01-15', fim: '2026-01-15',
    })
    for (const r of EXEMPLOS['/v1/plantoes'].data[0].plantoes) expect(chaves(r)).toEqual(chaves(dia.plantoes[0]))
  })

  it('nenhum campo proibido nos exemplos', () => {
    const txt = JSON.stringify(EXEMPLOS)
    for (const k of ['paciente_iniciais', 'idade', 'procedimento', 'convenio', 'gravidade', 'email', 'cpf', 'crm', 'autor_nome', 'autor_id']) {
      expect(txt).not.toContain(`"${k}"`)
    }
  })
})
