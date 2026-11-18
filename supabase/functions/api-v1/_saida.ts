// =============================================================================
// supabase/functions/api-v1/_saida.ts — filtro único de saída das rotas de leitura
//
// Pedido do dono (18/11/2026): a API entrega SÓ dados de escalas e férias, nada
// sobre a arquitetura do app. Toda resposta de ROTAS_LEITURA (real ou exemplo)
// passa por aqui antes de sair:
//   - `id`: o uid interno da conta (Firebase) nunca sai; vira um id opaco e
//     estável (`p_` + 20 hex de SHA-256). Mesma pessoa → mesmo id em todas as
//     rotas, então o integrador continua ligando tudo pelo id.
//   - `fonte`: nome de tabela/coleção interna nunca sai; só 'pega_plantao'
//     (sistema externo que o integrador já conhece) e 'app'.
//   - erro: sem `detail` técnico (mensagem de banco, Firestore, PP, código db_*).
// Travado por src/__tests__/functions/apiV1Saida.test.js.
// =============================================================================

const SAL = 'anest-api-v1:id:'
const FONTES_EXTERNAS = new Set(['pega_plantao'])

const DETALHE_ERRO: Record<string, string | undefined> = {
  internal_error: undefined,
  upstream_unavailable: 'fonte de dados temporariamente indisponível; tente novamente em alguns minutos',
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** id interno → id opaco estável. */
export async function idOpaco(id: string): Promise<string> {
  return 'p_' + (await sha256Hex(SAL + id)).slice(0, 20)
}

/** 'pega_plantao+ferias_movimentacoes' → 'pega_plantao+app' */
export function fontePublica(fonte: string): string {
  const partes = String(fonte)
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (FONTES_EXTERNAS.has(p) ? p : 'app'))
  return [...new Set(partes)].join('+') || 'app'
}

function coletarIds(v: unknown, out: Set<string>) {
  if (Array.isArray(v)) {
    for (const x of v) coletarIds(x, out)
  } else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (k === 'id' && typeof x === 'string' && x) out.add(x)
      else coletarIds(x, out)
    }
  }
}

function reescrever(v: unknown, ids: Map<string, string>): unknown {
  if (Array.isArray(v)) return v.map((x) => reescrever(x, ids))
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (k === 'id' && typeof x === 'string' && x) o[k] = ids.get(x) ?? x
      else if (k === 'fonte' && typeof x === 'string') o[k] = fontePublica(x)
      else o[k] = reescrever(x, ids)
    }
    return o
  }
  return v
}

/** Corpo pronto para sair: ids opacos, fontes públicas, erro sem detalhe técnico. */
export async function sanitizarSaida(status: number, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (status >= 500 || typeof body.error === 'string') {
    const erro = typeof body.error === 'string' ? body.error : 'internal_error'
    // 4xx de validação (invalid_parameter, not_found) mantém o detail: é texto
    // nosso sobre o parâmetro, escrito para o integrador.
    if (status >= 500) {
      const detail = DETALHE_ERRO[erro]
      return detail ? { error: erro, detail } : { error: status === 502 ? 'upstream_unavailable' : 'internal_error' }
    }
    return body
  }
  const brutos = new Set<string>()
  coletarIds(body, brutos)
  const ids = new Map<string, string>()
  await Promise.all([...brutos].map(async (b) => ids.set(b, await idOpaco(b))))
  return reescrever(body, ids) as Record<string, unknown>
}
