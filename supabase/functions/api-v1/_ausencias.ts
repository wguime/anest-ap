// =============================================================================
// supabase/functions/api-v1/_ausencias.ts — GET /v1/ferias/ausencias   (scope read:ferias)
//
//   ?data=YYYY-MM-DD   ou   ?inicio=YYYY-MM-DD&fim=YYYY-MM-DD (máx MAX_DIAS_INTERVALO dias)
//
// Por dia, quem está fora: { data, pessoa: { id, nome }, tipo: 'ferias' | 'ausente' }.
//   ferias  — o MESMO cálculo do extrato: registros de férias do Pega Plantão
//             → normalizarRegistrosFerias → aplicarMovimentacoes (replay do app).
//   ausente — licença no Pega Plantão (setor /licen[çc]a/, o filtro de
//             getLicencasDoAno), como a Escala Numérica: só "ausente".
// Mesma pessoa com férias e licença no mesmo dia → uma linha 'ferias' (a mesma
// precedência de situacao() em src/pages/escala-numerica/situacao.js).
//
// Fim de semana e feriado: seguem o app (feriasNaData da Escala Numérica) —
// o dia aparece se o Pega Plantão (ou o app) tem o registro naquele dia; não
// se inventa nem se apaga dia. A regra "FDS não conta" é do SALDO (extrato),
// não de quem está fora.
//
// LGPD (art. 11 — licença é dado de saúde): a resposta NUNCA traz motivo,
// setor, código, comentário nem outro campo cru do PP. A licença já chega
// minimizada do cache (só nome+data, _ferias.ts) e a linha é montada campo a
// campo aqui. Nome do PP sem casamento único → id null (nunca adivinhar).
// =============================================================================

import {
  dataIsoValida,
  diasEntre,
  erroInterno,
  MAX_DIAS_INTERVALO,
  ok,
  parametroInvalido,
  type RotaCtx,
  type RotaResultado,
} from './_contrato.ts'
import { PegaPlantaoErro } from './_pegaplantao.ts'
import {
  ANO_MINIMO,
  anoCorrenteSaoPaulo,
  idUnico,
  type Identidades,
  indexarAnestesistas,
  lerIdentidades,
  lerMovimentacoes,
  type LicencaMin,
  normalizarNome,
  ppDoAnoComCache,
  resolverIdsSocios,
} from './_ferias.ts'
import { normalizarRegistrosFerias } from './_lib-ferias/extratoFerias.js'
import { aplicarMovimentacoes } from './_lib-ferias/feriasMovimentacoes.js'
import { getSocios } from './_lib-ferias/feriasSocios.js'

export type TipoAusencia = 'ferias' | 'ausente'

export interface AusenciaApi {
  data: string
  pessoa: { id: string | null; nome: string }
  tipo: TipoAusencia
}

// ─── Composição pura ────────────────────────────────────────────────────────

export function comporAusencias({
  inicio,
  fim,
  ferias,
  licencas,
  socios,
  identidades,
}: {
  inicio: string
  fim: string
  /** registros de férias JÁ com o replay das movimentações ({ nome, data } no formato do PP) */
  ferias: { nome: string; data: string }[]
  licencas: LicencaMin[]
  socios: { nome: string; nomeCompleto: string }[]
  identidades: Identidades
}): AusenciaApi[] {
  const idsSocios = resolverIdsSocios(socios, identidades)
  const socioPorChave = new Map(socios.map((s) => [normalizarNome(s.nome), s]))
  const idx = indexarAnestesistas(identidades.anestesistas)
  const nomePorId = new Map(identidades.anestesistas.map((a) => [a.id, a.nome]))

  const pessoaDe = (nomePP: string): AusenciaApi['pessoa'] => {
    const socio = socioPorChave.get(normalizarNome(nomePP))
    if (socio) return { id: idsSocios.get(socio.nome) ?? null, nome: socio.nomeCompleto }
    const id = idUnico(idx, [nomePP])
    return { id, nome: (id && nomePorId.get(id)) || nomePP }
  }

  const noIntervalo = (d: string) => d >= inicio && d <= fim
  const porChave = new Map<string, { nomePP: string; data: string; tipo: TipoAusencia }>()
  for (const r of ferias) {
    if (!noIntervalo(r.data)) continue
    porChave.set(`${normalizarNome(r.nome)}|${r.data}`, { nomePP: r.nome, data: r.data, tipo: 'ferias' })
  }
  for (const l of licencas) {
    if (!noIntervalo(l.data)) continue
    const k = `${normalizarNome(l.nome)}|${l.data}`
    if (porChave.has(k)) continue // férias vence: a licença nem aparece
    porChave.set(k, { nomePP: l.nome, data: l.data, tipo: 'ausente' })
  }

  // whitelist: só data, pessoa {id, nome} e tipo
  return [...porChave.values()]
    .map(({ nomePP, data, tipo }) => ({ data, pessoa: pessoaDe(nomePP), tipo }))
    .sort((a, b) => a.data.localeCompare(b.data) || a.pessoa.nome.localeCompare(b.pessoa.nome, 'pt-BR'))
}

// ─── Parâmetros ─────────────────────────────────────────────────────────────

export function parseIntervalo(
  sp: URLSearchParams,
  anoAtual: number,
): { ok: true; inicio: string; fim: string } | { ok: false; erro: RotaResultado } {
  const data = sp.get('data')
  const inicioQ = sp.get('inicio')
  const fimQ = sp.get('fim')
  let inicio: string
  let fim: string
  if (data !== null) {
    if (inicioQ !== null || fimQ !== null) return { ok: false, erro: parametroInvalido('use data OU inicio+fim, não os dois') }
    if (!dataIsoValida(data)) return { ok: false, erro: parametroInvalido('data deve ser YYYY-MM-DD') }
    inicio = fim = data
  } else {
    if (inicioQ === null || fimQ === null) return { ok: false, erro: parametroInvalido('informe data=YYYY-MM-DD ou inicio=&fim=') }
    if (!dataIsoValida(inicioQ) || !dataIsoValida(fimQ)) return { ok: false, erro: parametroInvalido('inicio e fim devem ser YYYY-MM-DD') }
    const dias = diasEntre(inicioQ, fimQ)
    if (dias < 0) return { ok: false, erro: parametroInvalido('fim anterior a inicio') }
    if (dias > MAX_DIAS_INTERVALO) return { ok: false, erro: parametroInvalido(`intervalo máximo de ${MAX_DIAS_INTERVALO} dias`) }
    inicio = inicioQ
    fim = fimQ
  }
  const anoIni = Number(inicio.slice(0, 4))
  const anoFim = Number(fim.slice(0, 4))
  if (anoIni < ANO_MINIMO || anoFim > anoAtual + 1) {
    return { ok: false, erro: parametroInvalido(`datas devem estar entre ${ANO_MINIMO} e ${anoAtual + 1}`) }
  }
  return { ok: true, inicio, fim }
}

// ─── Rota ───────────────────────────────────────────────────────────────────

export async function rotaFeriasAusencias(ctx: RotaCtx): Promise<RotaResultado> {
  const p = parseIntervalo(ctx.url.searchParams, anoCorrenteSaoPaulo())
  if (!p.ok) return p.erro
  const { inicio, fim } = p

  const anos: number[] = []
  for (let a = Number(inicio.slice(0, 4)); a <= Number(fim.slice(0, 4)); a++) anos.push(a)

  try {
    const [porAno, identidades] = await Promise.all([
      Promise.all(anos.map(async (ano) => {
        const [pp, movimentacoes] = await Promise.all([ppDoAnoComCache(ano), lerMovimentacoes(ctx, ano)])
        const ferias = aplicarMovimentacoes(normalizarRegistrosFerias(pp.ferias), movimentacoes)
        return { ano, ferias, licencas: pp.licencas }
      })),
      lerIdentidades(ctx),
    ])

    const socios = new Map<string, { nome: string; nomeCompleto: string }>()
    for (const { ano } of porAno) for (const s of getSocios(ano)) if (!socios.has(s.nome)) socios.set(s.nome, s)

    const lista = comporAusencias({
      inicio,
      fim,
      ferias: porAno.flatMap((x) => x.ferias),
      licencas: porAno.flatMap((x) => x.licencas),
      socios: [...socios.values()],
      identidades,
    })

    return ok({
      data: lista,
      meta: {
        inicio,
        fim,
        total: lista.length,
        fonte: 'pega_plantao+ferias_movimentacoes',
        tipos: {
          ferias: 'férias (Pega Plantão + marcações/desmarcações do app)',
          ausente: 'afastamento no Pega Plantão — o motivo não é informado',
        },
      },
    })
  } catch (err) {
    if (err instanceof PegaPlantaoErro) {
      return { status: 502, body: { error: 'upstream_unavailable', detail: err.message } }
    }
    const msg = err instanceof Error && /^db_/.test(err.message) ? err.message : 'internal_error'
    console.error('[api-v1/ferias/ausencias] falha:', msg)
    return erroInterno(msg)
  }
}
