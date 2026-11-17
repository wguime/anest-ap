// =============================================================================
// supabase/functions/api-v1/_plantoes-pp.ts — GET /v1/plantoes
//
//   ?data=YYYY-MM-DD   ou   ?inicio=&fim= (máx MAX_DIAS_INTERVALO)
//   escopo: read:escala-cirurgica (ENDPOINT_SCOPES no index.ts)
//
// TODOS os registros do Pega Plantão por dia de início — a fonte do card
// "Plantões" da página Escalas (getPlantoesHojePorSetor / getPlantoesPorData).
// Em nov/2026 o PP do grupo traz só os postos P1…P12 (noturno de dia útil e
// fim de semana), férias e licenças:
//   • plantão  → posicao (Pn), setor e tipo do PP, início/fim (-03:00), anestesista;
//   • licença  → licenca: true e `motivo` = setor do PP ("LICENÇA SAÚDE").
//     DADO SENSÍVEL (saúde, LGPD art. 11), incluído por decisão expressa do
//     dono (nov/2026) e coberto pelo contrato de operador;
//   • férias   → fora (estão em /v1/ferias/ausencias e /v1/ferias/extrato).
//
// Diferença para /v1/escala-cirurgica/plantoes: aquela é a VISÃO do app (só o
// noturno P1–P4 no dia útil, com hospital/papel); esta é o registro cru do PP,
// sem filtro de horário. O fim de semana é lançado no SÁBADO e vale 48 h.
//
// Nunca saem: CPF, valor, pagamentos, comentário interno, descrição, códigos e
// os demais campos crus do PP. Identidade: mesmo resolvedor de plantões.
// =============================================================================

import { erroInterno, ok, type RotaCtx, type RotaResultado } from './_contrato.ts'
import { getPlantoes, PegaPlantaoErro } from './_pegaplantao.ts'
import { criarResolvedor, listarDias, paredeSP, parseIntervalo, type Pessoa, posicaoDoSetor } from './_plantoes.ts'

type Linha = Record<string, unknown>
const OFFSET_SP = '-03:00'
const RE_FERIAS = /f[ée]rias/i
const RE_LICENCA = /licen[çc]a/i

export interface RegistroPP {
  posicao: string | null
  setor: string
  tipo: string | null
  inicio: string
  fim: string | null
  anestesista: { id: string | null; nome: string } | null
  licenca: boolean
  motivo: string | null
}

const numPos = (p: string | null) => (p ? Number(p.slice(1)) || 0 : 999)

export function comporPlantoesPP({
  registros,
  pessoas,
  inicio,
  fim,
}: {
  registros: unknown
  pessoas: Pessoa[]
  inicio: string
  fim: string
}): { data: string; plantoes: RegistroPP[] }[] {
  const resolver = criarResolvedor(pessoas)
  const nomePorId = new Map(pessoas.map((p) => [p.id, p.nome]))
  const dias = listarDias(inicio, fim)
  const porDia = new Map<string, RegistroPP[]>(dias.map((d) => [d, []]))

  for (const r of Array.isArray(registros) ? (registros as Linha[]) : []) {
    if (!r || typeof r !== 'object') continue
    const setor = typeof r.Setor === 'string' ? r.Setor.trim() : ''
    if (RE_FERIAS.test(setor)) continue
    const ini = paredeSP(r.Inicio)
    if (!ini) continue
    const lista = porDia.get(ini.slice(0, 10))
    if (!lista) continue
    const licenca = RE_LICENCA.test(setor)
    const nomePP = [r.ProfDePlantao, r.ProfFixo]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .find((v) => v !== '') ?? null
    let anestesista: RegistroPP['anestesista'] = null
    if (nomePP) {
      const id = resolver(nomePP)
      anestesista = { id, nome: (id && nomePorId.get(id)) || nomePP }
    }
    const fimP = paredeSP(r.Fim)
    lista.push({
      posicao: licenca ? null : posicaoDoSetor(setor),
      setor,
      tipo: typeof r.Tipo === 'string' && r.Tipo.trim() ? r.Tipo.trim() : null,
      inicio: `${ini}${OFFSET_SP}`,
      fim: fimP ? `${fimP}${OFFSET_SP}` : null,
      anestesista,
      licenca,
      motivo: licenca ? setor : null,
    })
  }

  return dias.map((d) => ({
    data: d,
    plantoes: porDia.get(d)!.sort(
      (a, b) => Number(a.licenca) - Number(b.licenca) || numPos(a.posicao) - numPos(b.posicao) || a.inicio.localeCompare(b.inicio),
    ),
  }))
}

export async function rotaPlantoesPP(ctx: RotaCtx): Promise<RotaResultado> {
  const p = parseIntervalo(ctx.url.searchParams)
  if (!p.ok) return p.erro
  const { inicio, fim } = p
  try {
    const [registros, roster] = await Promise.all([
      getPlantoes(`${inicio}T00:00:00`, `${fim}T23:59:59`),
      ctx.supabase.from('vw_api_anestesistas').select('id,nome,ativo,apelidos'),
    ])
    if (roster.error) return erroInterno()
    const pessoas: Pessoa[] = ((roster.data ?? []) as Linha[])
      .map((r) => ({
        id: typeof r.id === 'string' ? r.id : '',
        nome: typeof r.nome === 'string' ? r.nome.trim() : '',
        apelidos: Array.isArray(r.apelidos) ? r.apelidos.filter((a): a is string => typeof a === 'string') : [],
        ativo: r.ativo !== false,
      }))
      .filter((r) => r.id && r.nome)
    const dias = comporPlantoesPP({ registros, pessoas, inicio, fim })
    const todos = dias.flatMap((d) => d.plantoes)
    return ok({
      data: dias,
      meta: {
        inicio,
        fim,
        fonte: 'pega_plantao',
        total_dias: dias.length,
        total_plantoes: todos.filter((x) => !x.licenca).length,
        total_licencas: todos.filter((x) => x.licenca).length,
        observacao: 'fim de semana é lançado no sábado e vale 48 h; férias ficam em /v1/ferias/ausencias',
      },
    })
  } catch (err) {
    if (err instanceof PegaPlantaoErro) {
      return { status: 502, body: { error: 'upstream_unavailable', detail: err.message } }
    }
    console.error('api-v1 /v1/plantoes: falha', err instanceof Error ? err.name : 'erro')
    return erroInterno()
  }
}
