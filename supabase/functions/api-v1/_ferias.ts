// =============================================================================
// supabase/functions/api-v1/_ferias.ts — GET /v1/ferias/extrato?ano=YYYY[&nome=]
//
// Extrato de Férias por sócio, com o MESMO número da tela (ExtratoFeriasPage):
//   registros de férias do Pega Plantão (12 meses do ano)
//   → normalizarRegistrosFerias
//   → aplicarMovimentacoes (replay de ferias_movimentacoes, append-only)
//   → construirExtrato (FDS nunca conta; feriado só não conta em semana inteira; cota por ano de entrada)
//   → penalidade da 7ª vaga (ultimoAMarcar + penalidadesSetimaVaga + aplicarPenalidades)
// As libs são CÓPIAS GERADAS de src/lib (_lib-ferias/, scripts/gerar-libs-ferias-api-v1.mjs);
// a paridade é travada em src/__tests__/functions/apiV1FeriasExtrato.test.js.
//
// Diferença consciente: a tela também GRAVA o first-seen dos códigos do PP
// (ferias_marcacoes_vistas) antes de ler; a API é read-only e só lê. Como todo
// registro do PP traz DataCriacao (que tem precedência sobre o first-seen), o
// resultado só pode divergir em registro do PP sem DataCriacao que nenhuma tela
// aberta tenha visto ainda.
//
// LGPD — whitelist campo a campo. FORA da resposta: licenças (só o setor
// "Férias" é lido; licença/motivo nem entra no cache), campos crus do Pega
// Plantão, e-mail/CPF/CRM, user_id de quem registrou movimentação,
// avisos_aceitos, nomes do PP fora da lista de sócios.
// =============================================================================

import { type RotaCtx, type RotaResultado, ok, parametroInvalido, erroInterno } from './_contrato.ts'
import { getPlantoes, PegaPlantaoErro } from './_pegaplantao.ts'
import { normalizarRegistrosFerias, construirExtrato } from './_lib-ferias/extratoFerias.js'
import { aplicarMovimentacoes, vistasDasMovimentacoes } from './_lib-ferias/feriasMovimentacoes.js'
import { ultimoAMarcar, penalidadesSetimaVaga, aplicarPenalidades } from './_lib-ferias/feriasAnalise.js'
import { MAX_VAGAS_DIA } from './_lib-ferias/extratoFeriasRegras.js'
import { getSocios } from './_lib-ferias/feriasSocios.js'
import { getFeriados } from './_lib-ferias/feriasFeriados.js'

// ─── Tipos mínimos ──────────────────────────────────────────────────────────

/** Projeção mínima de um plantão do PP — só o que a normalização lê. */
export interface PlantaoFeriasMin {
  CodigoPlantao: string | null
  Setor: string
  ProfDePlantao: string | null
  ProfFixo: string | null
  Inicio: string
  DataCriacao: string | null
}

export interface MovimentacaoMin {
  id: string
  nome: string
  data: string
  acao: 'marcar' | 'desmarcar'
  origemDia: string | null
  codigoPp: string | null
  criadoEm: string
}

export type MarcacoesVistas = Map<string, { nome: string; data: string; firstSeenAt: string }>

// deno-lint-ignore no-explicit-any
type Extrato = any

// ─── Composição pura (espelha ExtratoFeriasPage.jsx, memos registrosPP → extrato) ─

export function comporExtratoFerias({
  plantoesRaw,
  movimentacoes,
  marcacoesVistas,
  ano,
}: {
  plantoesRaw: PlantaoFeriasMin[]
  movimentacoes: MovimentacaoMin[]
  marcacoesVistas: MarcacoesVistas
  ano: number
}): Extrato {
  const socios = getSocios(ano)
  const feriados = getFeriados(ano)
  const registrosPP = normalizarRegistrosFerias(plantoesRaw)
  const registros = aplicarMovimentacoes(registrosPP, movimentacoes)
  const extratoBase = construirExtrato({ registros, ano, socios, feriados })

  const doPP = new Map(
    registrosPP
      .filter((r: { criadoEm: string | null }) => r.criadoEm)
      .map((r: { codigo: string; nome: string; data: string; criadoEm: string }) =>
        [r.codigo, { nome: r.nome, data: r.data, firstSeenAt: r.criadoEm }]),
  )
  const vistas = new Map([...marcacoesVistas, ...doPP, ...vistasDasMovimentacoes(movimentacoes)])

  const codigosPorDia = new Map<string, string[]>()
  for (const r of registros) {
    if (r.ehFimDeSemana) continue
    if (!codigosPorDia.has(r.data)) codigosPorDia.set(r.data, [])
    codigosPorDia.get(r.data)!.push(r.codigo)
  }
  const ultimosPorDia = new Map()
  for (const [data, nomes] of extratoBase.porDia) {
    if (nomes.length <= MAX_VAGAS_DIA) continue
    const info = ultimoAMarcar(codigosPorDia.get(data) || [], vistas)
    if (info) ultimosPorDia.set(data, info)
  }

  const penalidadesPorPessoa = penalidadesSetimaVaga(extratoBase.porDia, ultimosPorDia)
  return aplicarPenalidades(extratoBase, penalidadesPorPessoa)
}

// ─── Serialização (WHITELIST) ───────────────────────────────────────────────

export function serializarSocio(p: Extrato) {
  return {
    nome: p.nomeCompleto,
    nome_escala: p.nome,
    cota: p.cota,
    regra_cota: p.regraCota,
    dias_marcados: p.diasContados,
    dias_penalidade: p.diasPenalidade,
    dias_usados: p.diasEfetivos,
    saldo: p.saldo,
    periodos: (p.periodos || []).map((per: { inicio: string; fim: string; diasUteis: number }) => ({
      inicio: per.inicio,
      fim: per.fim,
      dias_uteis: per.diasUteis,
    })),
    penalidades: (p.penalidades || []).map((x: { data: string; diasExtras: number }) => ({
      data: x.data,
      dias_extras: x.diasExtras,
    })),
  }
}

/** Comparação de nome sem caixa/acento/pontuação ("G. Melo" = "G. MELO", "Thayna" = "THAYNÁ"). */
export function normalizarNome(s: string): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .toUpperCase()
}

// ─── I/O ────────────────────────────────────────────────────────────────────

const RE_FERIAS = /f[ée]rias/i
const CACHE_TTL_MS = 5 * 60 * 1000
const cachePP = new Map<number, { expira: number; promessa: Promise<PlantaoFeriasMin[]> }>()

/** Espelha registrosDoAnoPorSetor (pegaPlantaoApi.js): 12 meses em lotes de 3, dedup por código. */
async function varrerFeriasDoAno(ano: number): Promise<PlantaoFeriasMin[]> {
  const porCodigo = new Map<string, PlantaoFeriasMin>()
  for (let i = 1; i <= 12; i += 3) {
    const lote = [i, i + 1, i + 2]
    const resultados = await Promise.all(
      lote.map((mes) => {
        const mm = String(mes).padStart(2, '0')
        const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
        return getPlantoes(`${ano}-${mm}-01T00:00:00`, `${ano}-${mm}-${ultimoDia}T23:59:59`)
      }),
    )
    for (const plantoes of resultados) {
      if (!Array.isArray(plantoes)) continue
      for (const p of plantoes) {
        if (!p?.Setor || !RE_FERIAS.test(p.Setor)) continue
        const codigo = p.CodigoPlantao || `${p.ProfDePlantao || p.ProfFixo}|${p.Inicio}`
        if (porCodigo.has(codigo)) continue
        // minimização: só os 6 campos que a normalização lê; o resto do PP nunca fica em memória
        porCodigo.set(codigo, {
          CodigoPlantao: p.CodigoPlantao ?? null,
          Setor: p.Setor,
          ProfDePlantao: p.ProfDePlantao ?? null,
          ProfFixo: p.ProfFixo ?? null,
          Inicio: p.Inicio,
          DataCriacao: p.DataCriacao ?? null,
        })
      }
    }
  }
  return [...porCodigo.values()]
}

/** Cache em memória por isolate (5 min) + dedup de requisições simultâneas. */
function feriasDoAnoComCache(ano: number): Promise<PlantaoFeriasMin[]> {
  const agora = Date.now()
  const hit = cachePP.get(ano)
  if (hit && hit.expira > agora) return hit.promessa
  const promessa = varrerFeriasDoAno(ano)
  cachePP.set(ano, { expira: agora + CACHE_TTL_MS, promessa })
  promessa.catch(() => cachePP.delete(ano)) // erro não fica cacheado
  return promessa
}

const PAGINA = 1000

async function lerMovimentacoes(ctx: RotaCtx, ano: number): Promise<MovimentacaoMin[]> {
  const out: MovimentacaoMin[] = []
  for (let de = 0; ; de += PAGINA) {
    // colunas explícitas: user_id, avisos_aceitos, req_id, custo_dias NUNCA saem do banco
    const { data, error } = await ctx.supabase
      .from('ferias_movimentacoes')
      .select('id, nome, data, acao, origem_dia, codigo_pp, criado_em')
      .eq('ano', ano)
      .order('criado_em', { ascending: true })
      .order('id', { ascending: true })
      .range(de, de + PAGINA - 1)
    if (error) throw new Error('db_movimentacoes')
    for (const r of data || []) {
      out.push({ id: r.id, nome: r.nome, data: r.data, acao: r.acao, origemDia: r.origem_dia, codigoPp: r.codigo_pp, criadoEm: r.criado_em })
    }
    if (!data || data.length < PAGINA) return out
  }
}

async function lerMarcacoesVistas(ctx: RotaCtx, ano: number): Promise<MarcacoesVistas> {
  const out: MarcacoesVistas = new Map()
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await ctx.supabase
      .from('ferias_marcacoes_vistas')
      .select('codigo, nome, data, first_seen_at')
      .eq('ano', ano)
      .order('codigo', { ascending: true })
      .range(de, de + PAGINA - 1)
    if (error) throw new Error('db_marcacoes_vistas')
    for (const r of data || []) out.set(r.codigo, { nome: r.nome, data: r.data, firstSeenAt: r.first_seen_at })
    if (!data || data.length < PAGINA) return out
  }
}

function anoCorrenteSaoPaulo(): number {
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric' }).format(new Date()))
}

const ANO_MINIMO = 2023 // o Pega Plantão serve 2023+ (mesmo piso do Mapa)

// ─── Rota ───────────────────────────────────────────────────────────────────

export async function rotaFeriasExtrato(ctx: RotaCtx): Promise<RotaResultado> {
  const anoAtual = anoCorrenteSaoPaulo()
  const anoParam = ctx.url.searchParams.get('ano')
  let ano = anoAtual
  if (anoParam !== null) {
    if (!/^\d{4}$/.test(anoParam)) return parametroInvalido('ano deve ser YYYY')
    ano = Number(anoParam)
    if (ano < ANO_MINIMO || ano > anoAtual + 1) {
      return parametroInvalido(`ano deve estar entre ${ANO_MINIMO} e ${anoAtual + 1}`)
    }
  }
  const nomeParam = ctx.url.searchParams.get('nome')
  if (nomeParam !== null && (nomeParam.trim().length < 2 || nomeParam.length > 120)) {
    return parametroInvalido('nome deve ter entre 2 e 120 caracteres')
  }

  try {
    const [plantoesRaw, movimentacoes, marcacoesVistas] = await Promise.all([
      feriasDoAnoComCache(ano),
      lerMovimentacoes(ctx, ano),
      lerMarcacoesVistas(ctx, ano),
    ])
    const extrato = comporExtratoFerias({ plantoesRaw, movimentacoes, marcacoesVistas, ano })

    let socios = extrato.porPessoa
    if (nomeParam !== null) {
      const alvo = normalizarNome(nomeParam)
      socios = socios.filter(
        (p: Extrato) => normalizarNome(p.nome) === alvo || normalizarNome(p.nomeCompleto) === alvo,
      )
      if (socios.length === 0) {
        return { status: 404, body: { error: 'not_found', detail: 'sócio não encontrado' } }
      }
    }

    return ok({
      ano,
      fonte: 'pega_plantao+ferias_movimentacoes',
      regras: {
        fim_de_semana: 'não conta',
        feriado: 'só não conta quando a semana inteira está marcada',
        setima_vaga: 'quem marcou por último um dia com mais de 6 sócios paga 3 dias (2 extras)',
      },
      total: socios.length,
      socios: socios.map(serializarSocio),
    })
  } catch (err) {
    // só o código da etapa — nunca mensagem/corpo do upstream
    if (err instanceof PegaPlantaoErro) {
      return { status: 502, body: { error: 'upstream_unavailable', detail: err.message } }
    }
    const msg = err instanceof Error && /^db_/.test(err.message) ? err.message : 'internal_error'
    console.error('[api-v1/ferias] falha:', msg)
    return erroInterno(msg)
  }
}
