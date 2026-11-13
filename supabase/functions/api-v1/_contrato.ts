// =============================================================================
// supabase/functions/api-v1/_contrato.ts — contrato dos módulos de rota (nov/2026)
//
// Cada módulo de domínio (_escala-cirurgica.ts, _pessoas-escalas.ts, _ferias.ts)
// exporta funções `async (ctx: RotaCtx) => Promise<RotaResultado>`. O index.ts
// faz auth, escopo, rate limit e serialização; o módulo só lê e devolve o body.
//
// Regra de PII (LGPD): o body devolvido é WHITELIST explícita, montada campo a
// campo. Nunca espalhar (`...row`) uma linha do banco/Firestore/Pega Plantão.
// =============================================================================

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

export interface RotaCtx {
  /** cliente service-role (lê views/tabelas; RLS não se aplica) */
  supabase: SupabaseClient
  /** URL completa da request (query params em url.searchParams) */
  url: URL
  /** caminho lógico já sem o prefixo /functions/v1/api-v1, ex. '/v1/ferias/extrato' */
  pathname: string
}

export interface RotaResultado {
  status: number
  body: Record<string, unknown>
}

export const ok = (body: Record<string, unknown>): RotaResultado => ({ status: 200, body })

export const parametroInvalido = (detail: string): RotaResultado => ({
  status: 400,
  body: { error: 'invalid_parameter', detail },
})

export const erroInterno = (detail = 'internal_error'): RotaResultado => ({
  status: 500,
  body: { error: 'internal_error', detail },
})

/** 'YYYY-MM-DD' válido no calendário. */
export function dataIsoValida(s: string | null): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** Diferença em dias entre duas datas ISO (fim - início). */
export function diasEntre(inicio: string, fim: string): number {
  return Math.round(
    (Date.parse(`${fim}T12:00:00Z`) - Date.parse(`${inicio}T12:00:00Z`)) / 86_400_000,
  )
}

/** Intervalo máximo aceito em rotas com ?inicio=&fim= (evita varredura do ano inteiro). */
export const MAX_DIAS_INTERVALO = 62
