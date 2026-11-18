/**
 * api-v1 — filtro de saída (supabase/functions/api-v1/_saida.ts).
 *
 * Pedido do dono (18/11/2026): a chave externa entrega só dados de escalas e
 * férias, nada da arquitetura do app. Trava:
 *  1. uid interno nunca sai — vira id opaco estável (mesma pessoa, mesmo id);
 *  2. `fonte` não carrega nome de tabela/coleção;
 *  3. erro 5xx sem detalhe técnico;
 *  4. todo exemplo, depois do filtro, sai sem nenhum desses vestígios;
 *  5. o index liga o filtro nas duas saídas e não nomeia escopo no recusado.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sanitizarSaida, idOpaco, fontePublica } from '../../../supabase/functions/api-v1/_saida.ts'
import { EXEMPLOS } from '../../../supabase/functions/api-v1/_exemplos.ts'

const INDEX = readFileSync(resolve(__dirname, '../../../supabase/functions/api-v1/index.ts'), 'utf8')
const UID = 'LeFdhA2yKzaRujiU9diLhqa0dbB3'
const INTERNOS = /ferias_movimentacoes|escala_numerica_observacao|trocas_feriado|escala_de_feriados|firestore|supabase|profiles|vw_api|db_|service_role|pegaplantao_auth/i

describe('api-v1 — filtro de saída', () => {
  it('troca uid por id opaco estável e igual em todo o corpo', async () => {
    const out = await sanitizarSaida(200, {
      data: [{ anestesista: { id: UID, nome: 'X' } }, { pessoa: { id: UID, nome: 'X' } }, { pessoa: { id: null, nome: 'Y' } }],
    })
    const a = out.data[0].anestesista.id
    expect(a).toMatch(/^p_[0-9a-f]{20}$/)
    expect(out.data[1].pessoa.id).toBe(a)
    expect(out.data[2].pessoa.id).toBeNull()
    expect(JSON.stringify(out)).not.toContain(UID)
    expect(await idOpaco(UID)).toBe(a)
  })

  it('fonte só cita o Pega Plantão e "app"', () => {
    expect(fontePublica('pega_plantao+ferias_movimentacoes')).toBe('pega_plantao+app')
    expect(fontePublica('escala_numerica+pega_plantao+escala_numerica_observacao')).toBe('app+pega_plantao')
    expect(fontePublica('pega_plantao')).toBe('pega_plantao')
  })

  it('erro 5xx sai sem detalhe técnico; 4xx de parâmetro mantém o texto', async () => {
    expect(await sanitizarSaida(502, { error: 'upstream_unavailable', detail: 'pegaplantao_auth_401' }))
      .toEqual({ error: 'upstream_unavailable', detail: expect.not.stringMatching(INTERNOS) })
    expect(await sanitizarSaida(500, { error: 'internal_error', detail: 'db_identidades' })).toEqual({ error: 'internal_error' })
    expect(await sanitizarSaida(502, { error: 'upstream_unavailable', detail: 'firestore' })).not.toHaveProperty('detail', 'firestore')
    expect(await sanitizarSaida(400, { error: 'invalid_parameter', detail: 'intervalo máximo de 62 dias' }))
      .toEqual({ error: 'invalid_parameter', detail: 'intervalo máximo de 62 dias' })
  })

  it('nenhum exemplo, depois do filtro, carrega vestígio interno', async () => {
    for (const [rota, body] of Object.entries(EXEMPLOS)) {
      const txt = JSON.stringify(await sanitizarSaida(200, structuredClone(body)))
      expect(txt, rota).not.toMatch(INTERNOS)
      expect(txt, rota).not.toMatch(/"id":"(?!p_)[^"]+"/)
    }
  })

  it('index passa as duas saídas pelo filtro e não nomeia escopo', () => {
    expect(INDEX).toMatch(/jsonResponse\(r\.status, await sanitizarSaida\(r\.status, r\.body\)/)
    expect(INDEX).toMatch(/jsonResponse\(ex\.status, await sanitizarSaida\(ex\.status, ex\.body\)/)
    expect(INDEX).not.toContain('required_scope')
  })
})
