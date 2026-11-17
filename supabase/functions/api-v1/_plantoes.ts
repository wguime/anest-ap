// =============================================================================
// supabase/functions/api-v1/_plantoes.ts — plantões dos anestesistas (P1–P12)
//
//   GET /v1/escala-cirurgica/plantoes?data=YYYY-MM-DD
//   GET /v1/escala-cirurgica/plantoes?inicio=YYYY-MM-DD&fim=...  (máx MAX_DIAS_INTERVALO)
//   escopo: read:escala-cirurgica (o prefixo /v1/escala-cirurgica já casa)
//
// MESMA fonte e MESMA regra do app:
//   • Quem é P1..Pn: Pega Plantão (`/api/v1/plantoes`), setor "… P1" etc.,
//     nome = ProfDePlantao || ProfFixo — igual a getPlantoesHojePorSetor em
//     src/services/pegaPlantaoApi.js (card Plantões da Home), que alimenta os
//     selos e os cards P1–P4 da fase noturna (src/lib/plantaoNoturno.js).
//   • Dia útil (seg–sex, FERIADO INCLUÍDO): só P1–P4 com início ≥ 19h (o
//     plantão noturno). FDS: todas as posições Pn registradas naquela data.
//     Setor "Férias" e setor sem Pn ficam fora.
//   • Hospital (só dia útil, ORDEM_NOTURNA do app): P1 = HRO (plantonista),
//     P2 = Unimed (plantonista), P3 = Unimed, P4 = coringa → hospital marcado
//     em escala_plantao_p4_diario na data; sem marcação = null (o app mostra
//     o P4 nos três). No FDS o PP não diz o hospital → null.
//   • Identidade: o nome do PP casa com o dicionário de apelidos
//     (candidatosNome → apelido) e, em falta, inicial+sobrenome no roster ativo
//     (casarPorInicialSobrenome) — o mesmo resolvedor da LiberacoesView. Antes
//     disso, nome completo idêntico a UM cadastro. Mais de um candidato → id null.
//     O id é o de /v1/anestesistas (profiles.id, conta principal).
//
// LGPD — whitelist campo a campo. Fora: telefone, e-mail, valor, observação,
// CodigoPlantao, Local/Setor/Tipo crus do PP, ProfFixo×ProfDePlantao, quem
// marcou o P4.
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
import { getPlantoes, PegaPlantaoErro } from './_pegaplantao.ts'

type Linha = Record<string, unknown>

// ── Parâmetros ──────────────────────────────────────────────────────────────

export type ParseIntervalo =
  | { ok: true; inicio: string; fim: string }
  | { ok: false; erro: RotaResultado }

export function parseIntervalo(sp: URLSearchParams): ParseIntervalo {
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

// ── Datas e horas (parede de São Paulo; sem horário de verão desde 2019) ────

const OFFSET_SP = '-03:00'

/** Datas ISO de inicio a fim, inclusive. */
export function listarDias(inicio: string, fim: string): string[] {
  const out: string[] = []
  const d = new Date(`${inicio}T12:00:00Z`)
  const ultimo = Date.parse(`${fim}T12:00:00Z`)
  while (d.getTime() <= ultimo) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

/** Sábado ou domingo. Feriado em dia de semana segue a regra do dia útil (como o app). */
export function ehFimDeSemana(dataIso: string): boolean {
  const wd = new Date(`${dataIso}T12:00:00Z`).getUTCDay()
  return wd === 0 || wd === 6
}

/**
 * Horário do PP → 'YYYY-MM-DDTHH:MM:SS' na parede de São Paulo. O PP manda
 * hora local sem fuso (o app faz `new Date(Inicio).getHours()` no fuso do
 * aparelho); se um dia vier com Z/offset, converte para -03:00.
 */
export function paredeSP(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s)
  if (!m) return null
  if (/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(s)) {
    const t = Date.parse(s)
    if (Number.isNaN(t)) return null
    return new Date(t - 3 * 3_600_000).toISOString().slice(0, 19)
  }
  return `${m[1]}T${m[2]}:${m[3]}:${m[4] ?? '00'}`
}

// ── Identidade (espelha src/lib/plantaoNoturno.js + LiberacoesView) ─────────

/** = normNome da UI / normApelido do service (acento, caixa, prefixo PED). */
export const normNome = (s: unknown): string =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^\s*ped[.\s]\s*/i, '')
    .trim()
    .toUpperCase()

const ehInicial = (t: string) => /^[A-Za-zÀ-ü]\.?$/.test(t)

/** Cópia de candidatosNome (src/lib/plantaoNoturno.js). */
export function candidatosNome(nome: string): string[] {
  const tokens = String(nome || '').replace(/^Dr[a]?\.?\s+/i, '').trim().split(/\s+/).filter(Boolean)
  const significativos = tokens.filter((t) => !ehInicial(t))
  const t = significativos.length ? significativos : tokens
  if (!t.length) return []
  const c = new Set([t.join(' ')])
  if (t.length > 1) {
    c.add(`${t[0]} ${t[t.length - 1]}`)
    if (t.length > 2) c.add(`${t[0]} ${t[1]}`)
    c.add(t[t.length - 1])
    c.add(t[0])
  }
  return [...c]
}

export interface Pessoa {
  id: string
  nome: string
  apelidos: string[]
  ativo: boolean
}

/** Resolvedor nome do PP → profiles.id (null quando não há um único candidato). */
export function criarResolvedor(pessoas: Pessoa[]): (nome: string) => string | null {
  const porApelido = new Map<string, string>()
  const porNome = new Map<string, string[]>()
  for (const p of pessoas) {
    for (const a of p.apelidos) {
      const k = normNome(a)
      if (k && !porApelido.has(k)) porApelido.set(k, p.id)
    }
    const k = normNome(p.nome).replace(/\s+/g, ' ')
    porNome.set(k, [...(porNome.get(k) ?? []), p.id])
  }
  const ativos = pessoas.filter((p) => p.ativo)

  return (nome: string) => {
    const limpo = String(nome || '').replace(/^Dr[a]?\.?\s+/i, '').trim()
    if (!limpo) return null
    // 0) nome completo idêntico a UM cadastro
    const exatos = porNome.get(normNome(limpo).replace(/\s+/g, ' ')) ?? []
    if (exatos.length === 1) return exatos[0]
    if (exatos.length > 1) return null
    // 1) dicionário de apelidos, do candidato mais específico ao menos
    for (const cand of candidatosNome(limpo)) {
      const uid = porApelido.get(normNome(cand))
      if (uid) return uid
    }
    // 2) "A. Schmidt": inicial + sobrenome no roster ativo; 2+ candidatos → null
    const tokens = limpo.split(/\s+/).filter(Boolean)
    if (tokens.length < 2) return null
    const iniciais = tokens.filter(ehInicial).map((t) => normNome(t)[0])
    const sobrenomes = tokens.filter((t) => !ehInicial(t)).map(normNome)
    if (!iniciais.length || !sobrenomes.length) return null
    const achados = ativos.filter((r) => {
      const partes = normNome(r.nome).split(/\s+/).filter(Boolean)
      return partes.length > 0 && partes[0][0] === iniciais[0] && sobrenomes.every((s) => partes.includes(s))
    })
    return achados.length === 1 ? achados[0].id : null
  }
}

// ── Composição pura ─────────────────────────────────────────────────────────

/** ORDEM_NOTURNA do app: posição → hospital/papel no dia útil. P4 é coringa. */
const NOTURNO_DIA_UTIL: Record<string, { hospital: string | null; papel: string }> = {
  P1: { hospital: 'hro', papel: 'plantonista' },
  P2: { hospital: 'unimed', papel: 'plantonista' },
  P3: { hospital: 'unimed', papel: 'plantao_noturno' },
  P4: { hospital: null, papel: 'coringa' },
}

const PN = /\bP\s?(\d{1,2})\b/i
export function posicaoDoSetor(setor: unknown): string | null {
  const m = PN.exec(String(setor ?? ''))
  return m ? `P${Number(m[1])}` : null
}

export interface PlantaoApi {
  posicao: string
  hospital: string | null
  papel: string | null
  inicio: string
  fim: string | null
  anestesista: { id: string | null; nome: string } | null
}

export interface DiaPlantoesApi {
  data: string
  fim_de_semana: boolean
  plantoes: PlantaoApi[]
}

const numPos = (p: string) => Number(p.slice(1)) || 0

export function comporPlantoes({
  registros,
  pessoas,
  p4PorData,
  inicio,
  fim,
}: {
  registros: unknown
  pessoas: Pessoa[]
  p4PorData: Map<string, string>
  inicio: string
  fim: string
}): DiaPlantoesApi[] {
  const resolver = criarResolvedor(pessoas)
  const nomePorId = new Map(pessoas.map((p) => [p.id, p.nome]))
  const dias = listarDias(inicio, fim)
  const porDia = new Map<string, DiaPlantoesApi>(
    dias.map((d) => [d, { data: d, fim_de_semana: ehFimDeSemana(d), plantoes: [] }]),
  )

  for (const r of Array.isArray(registros) ? (registros as Linha[]) : []) {
    if (!r || typeof r !== 'object') continue
    const setor = String(r.Setor ?? '')
    if (/f[ée]rias/i.test(setor)) continue
    const posicao = posicaoDoSetor(setor)
    if (!posicao) continue
    const ini = paredeSP(r.Inicio)
    if (!ini) continue
    const dia = porDia.get(ini.slice(0, 10))
    if (!dia) continue

    let hospital: string | null = null
    let papel: string | null = null
    if (!dia.fim_de_semana) {
      const regra = NOTURNO_DIA_UTIL[posicao]
      // dia útil: só P1–P4 noturnos (início ≥ 19h), como getPlantoesHojePorSetor
      if (!regra || Number(ini.slice(11, 13)) < 19) continue
      papel = regra.papel
      hospital = posicao === 'P4' ? (p4PorData.get(dia.data) ?? null) : regra.hospital
    }

    const nomePP = [r.ProfDePlantao, r.ProfFixo]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .find((v) => v !== '') ?? null
    let anestesista: PlantaoApi['anestesista'] = null
    if (nomePP) {
      const id = resolver(nomePP)
      anestesista = { id, nome: (id && nomePorId.get(id)) || nomePP }
    }

    const fimP = paredeSP(r.Fim)
    dia.plantoes.push({
      posicao,
      hospital,
      papel,
      inicio: `${ini}${OFFSET_SP}`,
      fim: fimP ? `${fimP}${OFFSET_SP}` : null,
      anestesista,
    })
  }

  for (const d of porDia.values()) {
    d.plantoes.sort((a, b) => numPos(a.posicao) - numPos(b.posicao) || a.inicio.localeCompare(b.inicio))
  }
  return dias.map((d) => porDia.get(d)!)
}

// ── Rota ────────────────────────────────────────────────────────────────────

/** Cache curto: protege o PP de rajadas (rate limit da API é 50/min/IP). */
const CACHE_TTL_MS = 2 * 60_000
const cachePP = new Map<string, { em: number; dados: unknown }>()

async function plantoesDoPP(inicio: string, fim: string): Promise<unknown> {
  const chave = `${inicio}|${fim}`
  const c = cachePP.get(chave)
  if (c && Date.now() - c.em < CACHE_TTL_MS) return c.dados
  const dados = await getPlantoes(`${inicio}T00:00:00`, `${fim}T23:59:59`)
  if (cachePP.size > 50) cachePP.clear()
  cachePP.set(chave, { em: Date.now(), dados })
  return dados
}

export async function rotaEscalaPlantoes(ctx: RotaCtx): Promise<RotaResultado> {
  const p = parseIntervalo(ctx.url.searchParams)
  if (!p.ok) return p.erro
  const { inicio, fim } = p

  try {
    const [registros, roster, p4] = await Promise.all([
      plantoesDoPP(inicio, fim),
      ctx.supabase.from('vw_api_anestesistas').select('id,nome,ativo,apelidos'),
      ctx.supabase
        .from('escala_plantao_p4_diario')
        .select('data,hospital')
        .gte('data', inicio)
        .lte('data', fim),
    ])
    if (roster.error || p4.error) {
      console.error('api-v1 plantoes: query error', (roster.error ?? p4.error)?.message)
      return erroInterno()
    }

    const pessoas: Pessoa[] = ((roster.data ?? []) as unknown as Linha[])
      .map((r) => ({
        id: typeof r.id === 'string' ? r.id : '',
        nome: typeof r.nome === 'string' ? r.nome.trim() : '',
        apelidos: Array.isArray(r.apelidos) ? r.apelidos.filter((a): a is string => typeof a === 'string') : [],
        ativo: r.ativo !== false,
      }))
      .filter((r) => r.id && r.nome)
    const p4PorData = new Map<string, string>()
    for (const r of (p4.data ?? []) as unknown as Linha[]) {
      if (typeof r.data === 'string' && typeof r.hospital === 'string') p4PorData.set(r.data.slice(0, 10), r.hospital)
    }

    const dias = comporPlantoes({ registros, pessoas, p4PorData, inicio, fim })
    return ok({
      data: dias,
      meta: {
        inicio,
        fim,
        fonte: 'pega_plantao',
        total_dias: dias.length,
        total_plantoes: dias.reduce((n, d) => n + d.plantoes.length, 0),
      },
    })
  } catch (err) {
    if (err instanceof PegaPlantaoErro) {
      return { status: 502, body: { error: 'upstream_unavailable', detail: err.message } }
    }
    console.error('api-v1 plantoes: falha', err instanceof Error ? err.name : 'erro')
    return erroInterno()
  }
}
