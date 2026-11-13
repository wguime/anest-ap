// =============================================================================
// supabase/functions/api-v1/_pessoas-escalas.ts — residentes e escala das
// funcionárias (nov/2026)
//
//   GET /v1/residentes                                → cadastro (id, nome, ano)
//   GET /v1/residentes/plantoes?inicio=&fim=          → residente efetivo por dia
//   GET /v1/residentes/estagios?inicio=&fim=          → estágio por residente/turno
//   GET /v1/funcionarias/escala?inicio=&fim=          → sobreaviso materno + hospitais
//   (as rotas com intervalo aceitam também ?data=YYYY-MM-DD; máx MAX_DIAS_INTERVALO)
//
// Fonte: base estática gerada (_dados-gerados.ts, `node scripts/gerar-dados-api-v1.mjs`)
// + ajustes do Firestore lidos na hora (_firestore.ts). A composição pura mora em
// _pessoas-escalas-compor.ts e espelha as telas do app.
//
// LGPD: whitelist campo a campo (id, nome, ano, data, turno, local, horário,
// origem). Sem e-mail, cargo, autor do ajuste, id da troca, cirurgião.
// =============================================================================

import {
  type RotaCtx,
  type RotaResultado,
  MAX_DIAS_INTERVALO,
  dataIsoValida,
  diasEntre,
  erroInterno,
  ok,
  parametroInvalido,
} from './_contrato.ts'
import { lerDocumento, lerDocumentos } from './_firestore.ts'
import {
  type DocAjuste,
  type DocMesFuncionarias,
  type DocSlotEstagios,
  SLOTS_HOSPITAIS,
  TURNOS_ESTAGIO,
  comporBaseFuncionarias,
  comporEscalaFuncionarias,
  comporEstagiosResidencia,
  comporPlantoesResidencia,
  comporRoster,
  ehDiaUtilResidencia,
  idAjusteHospital,
  listarDias,
} from './_pessoas-escalas-compor.ts'

// ── Intervalo ───────────────────────────────────────────────────────────────

type Intervalo = { ok: true; inicio: string; fim: string } | { ok: false; erro: RotaResultado }

function lerIntervalo(url: URL): Intervalo {
  const sp = url.searchParams
  const data = sp.get('data')
  const inicioQ = sp.get('inicio')
  const fimQ = sp.get('fim')
  if (data !== null) {
    if (inicioQ !== null || fimQ !== null) {
      return { ok: false, erro: parametroInvalido('use data OU inicio+fim, não os dois') }
    }
    if (!dataIsoValida(data)) return { ok: false, erro: parametroInvalido('data deve ser YYYY-MM-DD') }
    return { ok: true, inicio: data, fim: data }
  }
  if (inicioQ === null || fimQ === null) {
    return { ok: false, erro: parametroInvalido('informe data=YYYY-MM-DD ou inicio=&fim=') }
  }
  if (!dataIsoValida(inicioQ) || !dataIsoValida(fimQ)) {
    return { ok: false, erro: parametroInvalido('inicio e fim devem ser YYYY-MM-DD') }
  }
  const dias = diasEntre(inicioQ, fimQ)
  if (dias < 0) return { ok: false, erro: parametroInvalido('fim anterior a inicio') }
  if (dias > MAX_DIAS_INTERVALO) {
    return { ok: false, erro: parametroInvalido(`intervalo máximo de ${MAX_DIAS_INTERVALO} dias`) }
  }
  return { ok: true, inicio: inicioQ, fim: fimQ }
}

/** Remove o prefixo 'colecao/' das chaves devolvidas por lerDocumentos. */
function porId<T>(docs: Record<string, Record<string, unknown>>, colecao: string): Record<string, T> {
  const out: Record<string, T> = {}
  for (const [caminho, dados] of Object.entries(docs)) out[caminho.slice(colecao.length + 1)] = dados as T
  return out
}

async function lerRoster() {
  const doc = await lerDocumento('residencia/roster')
  return comporRoster(doc?.residentes)
}

function falha(rota: string, e: unknown): RotaResultado {
  console.error(`api-v1 ${rota}:`, e instanceof Error ? e.message : String(e))
  return erroInterno('upstream_unavailable')
}

// ── Rotas ───────────────────────────────────────────────────────────────────

export async function rotaResidentes(_ctx: RotaCtx): Promise<RotaResultado> {
  try {
    const roster = await lerRoster()
    return ok({ data: roster.map((r) => ({ id: r.id, nome: r.nome, ano: r.ano })) })
  } catch (e) {
    return falha('residentes', e)
  }
}

/**
 * Ajustes do plantão: Firestore `residenciaPlantaoDiario` (fonte da verdade, é o
 * que as telas leem). Se o Firestore falhar, cai no espelho Supabase
 * `residencia_plantao_diario_overrides` (o mesmo que a edge de lembretes usa).
 */
async function ajustesPlantao(ctx: RotaCtx, dias: string[]): Promise<Record<string, DocAjuste>> {
  try {
    const docs = await lerDocumentos(dias.map((d) => `residenciaPlantaoDiario/${d}`))
    return porId<DocAjuste>(docs, 'residenciaPlantaoDiario')
  } catch (e) {
    console.warn('api-v1 residentes/plantoes: Firestore indisponível, usando espelho Supabase:',
      e instanceof Error ? e.message : String(e))
    const { data, error } = await ctx.supabase
      .from('residencia_plantao_diario_overrides')
      .select('data_plantao, residente_override, origem')
      .gte('data_plantao', dias[0])
      .lte('data_plantao', dias[dias.length - 1])
    if (error) throw new Error(`espelho_falhou: ${error.message}`)
    const out: Record<string, DocAjuste> = {}
    for (const row of data ?? []) {
      out[String(row.data_plantao).slice(0, 10)] = { residenteOverride: row.residente_override, origem: row.origem }
    }
    return out
  }
}

export async function rotaResidentesPlantoes(ctx: RotaCtx): Promise<RotaResultado> {
  const intervalo = lerIntervalo(ctx.url)
  if (!intervalo.ok) return intervalo.erro
  try {
    const dias = listarDias(intervalo.inicio, intervalo.fim)
    const [roster, ajustes] = await Promise.all([lerRoster(), ajustesPlantao(ctx, dias)])
    return ok({
      inicio: intervalo.inicio,
      fim: intervalo.fim,
      data: comporPlantoesResidencia(dias, ajustes, roster),
    })
  } catch (e) {
    return falha('residentes/plantoes', e)
  }
}

export async function rotaResidentesEstagios(ctx: RotaCtx): Promise<RotaResultado> {
  const intervalo = lerIntervalo(ctx.url)
  if (!intervalo.ok) return intervalo.erro
  try {
    const dias = listarDias(intervalo.inicio, intervalo.fim)
    const caminhos = dias
      .filter(ehDiaUtilResidencia)
      .flatMap((d) => TURNOS_ESTAGIO.map((t) => `residenciaEstagiosDiarios/${d}-${t}`))
    const [roster, docs] = await Promise.all([lerRoster(), lerDocumentos(caminhos)])
    return ok({
      inicio: intervalo.inicio,
      fim: intervalo.fim,
      data: comporEstagiosResidencia(dias, porId<DocSlotEstagios>(docs, 'residenciaEstagiosDiarios'), roster),
    })
  } catch (e) {
    return falha('residentes/estagios', e)
  }
}

export async function rotaFuncionariasEscala(ctx: RotaCtx): Promise<RotaResultado> {
  const intervalo = lerIntervalo(ctx.url)
  if (!intervalo.ok) return intervalo.erro
  try {
    const dias = listarDias(intervalo.inicio, intervalo.fim)
    const meses = [...new Set(dias.map((d) => d.slice(0, 7)))]
    const [docsMeses, docsSobreaviso, docsHospitais] = await Promise.all([
      lerDocumentos(meses.map((m) => `escalasFuncionarias/${m}`)),
      lerDocumentos(dias.map((d) => `sobreavisoMaternoDiario/${d}`)),
      lerDocumentos(dias.flatMap((d) => SLOTS_HOSPITAIS.map((s) => `hospitaisDiario/${idAjusteHospital(d, s)}`))),
    ])
    const base = comporBaseFuncionarias(porId<DocMesFuncionarias>(docsMeses, 'escalasFuncionarias'))
    return ok({
      inicio: intervalo.inicio,
      fim: intervalo.fim,
      data: comporEscalaFuncionarias(
        dias,
        base,
        porId<DocAjuste>(docsSobreaviso, 'sobreavisoMaternoDiario'),
        porId<DocAjuste>(docsHospitais, 'hospitaisDiario'),
      ),
    })
  } catch (e) {
    return falha('funcionarias/escala', e)
  }
}
