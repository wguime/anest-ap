// =============================================================================
// supabase/functions/api-v1/_escala-cirurgica.ts — escala cirúrgica + anestesistas
//
// Rotas (registradas no router do index.ts):
//   GET /v1/escala-cirurgica?data=YYYY-MM-DD            (scope read:escala-cirurgica)
//   GET /v1/escala-cirurgica?inicio=YYYY-MM-DD&fim=...  (máx MAX_DIAS_INTERVALO dias)
//        filtros opcionais: hospital=unimed|hro|materno, turno=matutino|vespertino
//   GET /v1/anestesistas[?ativos=true|false]             (scope read:anestesistas)
//
// Fontes: views whitelist vw_api_escala_cirurgica e vw_api_anestesistas
// (migration 20261112150000). Só escala publicada (e turno publicado).
//
// LGPD: a resposta é montada campo a campo (mapCasoApi / mapAnestesistaApi).
// Nunca sai: paciente_iniciais, idade, procedimento, convenio, gravidade,
// observações/linha_overrides, source_image_path, e-mail, permissions,
// last_access, is_admin — nem estão nas views.
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

export const HOSPITAIS_ESCALA = ['unimed', 'hro', 'materno'] as const
export const TURNOS_ESCALA = ['matutino', 'vespertino'] as const

/** PostgREST devolve no máximo ~1000 linhas por request: paginamos com .range(). */
const PAGINA_DB = 1000
/** Teto de segurança da varredura (62 dias ≈ 6 mil casos hoje). */
const MAX_LINHAS = 20_000

// ──────────────────────────────────────────────────────────────────────────
// Parâmetros
// ──────────────────────────────────────────────────────────────────────────
export interface ParamsEscala {
  inicio: string
  fim: string
  hospital: string | null
  turno: string | null
}

export type ParseResultado<T> = { ok: true; params: T } | { ok: false; erro: RotaResultado }

export function parseParamsEscala(sp: URLSearchParams): ParseResultado<ParamsEscala> {
  const data = sp.get('data')
  const inicioQ = sp.get('inicio')
  const fimQ = sp.get('fim')

  let inicio: string
  let fim: string
  if (data !== null) {
    if (inicioQ !== null || fimQ !== null) {
      return { ok: false, erro: parametroInvalido('use data OU inicio+fim, não os dois') }
    }
    if (!dataIsoValida(data)) {
      return { ok: false, erro: parametroInvalido('data deve ser YYYY-MM-DD') }
    }
    inicio = data
    fim = data
  } else {
    if (inicioQ === null || fimQ === null) {
      return { ok: false, erro: parametroInvalido('informe data=YYYY-MM-DD ou inicio=&fim=') }
    }
    if (!dataIsoValida(inicioQ) || !dataIsoValida(fimQ)) {
      return { ok: false, erro: parametroInvalido('inicio e fim devem ser YYYY-MM-DD') }
    }
    const dias = diasEntre(inicioQ, fimQ)
    if (dias < 0) return { ok: false, erro: parametroInvalido('fim anterior a inicio') }
    if (dias > MAX_DIAS_INTERVALO) {
      return {
        ok: false,
        erro: parametroInvalido(`intervalo máximo de ${MAX_DIAS_INTERVALO} dias`),
      }
    }
    inicio = inicioQ
    fim = fimQ
  }

  const hospitalQ = sp.get('hospital')
  const hospital = hospitalQ === null ? null : hospitalQ.trim().toLowerCase()
  if (hospital !== null && !(HOSPITAIS_ESCALA as readonly string[]).includes(hospital)) {
    return {
      ok: false,
      erro: parametroInvalido(`hospital deve ser um de: ${HOSPITAIS_ESCALA.join(', ')}`),
    }
  }

  const turnoQ = sp.get('turno')
  const turno = turnoQ === null ? null : turnoQ.trim().toLowerCase()
  if (turno !== null && !(TURNOS_ESCALA as readonly string[]).includes(turno)) {
    return {
      ok: false,
      erro: parametroInvalido(`turno deve ser um de: ${TURNOS_ESCALA.join(', ')}`),
    }
  }

  return { ok: true, params: { inicio, fim, hospital, turno } }
}

/** ?ativos=true|false → boolean; ausente → null (todos). */
export function parseAtivos(sp: URLSearchParams): ParseResultado<boolean | null> {
  const v = sp.get('ativos')
  if (v === null) return { ok: true, params: null }
  const n = v.trim().toLowerCase()
  if (n === 'true') return { ok: true, params: true }
  if (n === 'false') return { ok: true, params: false }
  return { ok: false, erro: parametroInvalido('ativos deve ser true ou false') }
}

// ──────────────────────────────────────────────────────────────────────────
// Mapeamento (whitelist campo a campo)
// ──────────────────────────────────────────────────────────────────────────
type Linha = Record<string, unknown>

const texto = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}
const inteiro = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

const TIPOS_CASO = ['eletiva', 'urgencia', 'emergencia'] as const

/**
 * Nome de pessoa vindo da escala. O rodapé usa marcadores que não são nome
 * ('?' = sem anestesista, '//', '???'): texto sem nenhuma letra vira null.
 * A view já anula; aqui é a segunda camada.
 */
export function nomePessoa(v: unknown): string | null {
  const t = texto(v)
  return t && /\p{L}/u.test(t) ? t : null
}

function pessoa(id: unknown, nome: unknown): { id: string | null; nome: string | null } | null {
  const n = nomePessoa(nome)
  const i = texto(id)
  if (!n && !i) return null
  return { id: i, nome: n }
}

export interface CasoApi {
  sala: string | null
  ordem: number | null
  hora: string | null
  termino_previsto: string | null
  tempo_estimado: string | null
  cirurgiao: string | null
  anestesista: { id: string | null; nome: string | null } | null
  residente: { id: string | null; nome: string | null } | null
  sem_anestesista: boolean
  continuacao: boolean
  tipo: string | null
  status: string | null
  inicio_real: string | null
  termino_real: string | null
}

export function mapCasoApi(r: Linha): CasoApi {
  const tipo = texto(r.tipo)
  const semAnestesista = r.sem_anestesista === true
  return {
    sala: texto(r.sala),
    ordem: inteiro(r.ordem),
    hora: texto(r.hora),
    termino_previsto: texto(r.termino_previsto),
    tempo_estimado: texto(r.tempo_estimado),
    cirurgiao: texto(r.cirurgiao_nome),
    anestesista: semAnestesista ? null : pessoa(r.anestesista_id, r.anestesista_nome),
    residente: pessoa(r.residente_id, r.residente_nome),
    sem_anestesista: semAnestesista,
    continuacao: r.continuacao === true,
    tipo: tipo && (TIPOS_CASO as readonly string[]).includes(tipo) ? tipo : null,
    status: texto(r.status_cirurgia),
    inicio_real: texto(r.inicio_real),
    termino_real: texto(r.termino_real),
  }
}

export interface EscalaApi {
  data: string
  hospital: string
  turno: string | null
  casos: CasoApi[]
}

const ORDEM_HOSPITAL: Record<string, number> = { unimed: 0, hro: 1, materno: 2 }
const ORDEM_TURNO: Record<string, number> = { matutino: 0, vespertino: 1 }

const cmpSala = (a: string | null, b: string | null) =>
  (a ?? '').localeCompare(b ?? '', 'pt-BR', { numeric: true })

/** Agrupa linhas da view (1 caso/linha) em escalas data+hospital+turno, ordenadas. */
export function agruparEscalas(rows: Linha[]): EscalaApi[] {
  const porChave = new Map<string, EscalaApi>()
  for (const r of rows) {
    const data = texto(r.data)
    const hospital = texto(r.hospital)
    if (!data || !hospital) continue
    const turno = texto(r.turno)
    const chave = `${data}|${hospital}|${turno ?? ''}`
    let esc = porChave.get(chave)
    if (!esc) {
      esc = { data, hospital, turno, casos: [] }
      porChave.set(chave, esc)
    }
    esc.casos.push(mapCasoApi(r))
  }
  const escalas = [...porChave.values()]
  for (const e of escalas) {
    e.casos.sort(
      (a, b) => cmpSala(a.sala, b.sala) || (a.ordem ?? 1e9) - (b.ordem ?? 1e9),
    )
  }
  escalas.sort(
    (a, b) =>
      a.data.localeCompare(b.data) ||
      (ORDEM_HOSPITAL[a.hospital] ?? 9) - (ORDEM_HOSPITAL[b.hospital] ?? 9) ||
      (ORDEM_TURNO[a.turno ?? ''] ?? 9) - (ORDEM_TURNO[b.turno ?? ''] ?? 9),
  )
  return escalas
}

export interface AnestesistaApi {
  id: string
  nome: string
  apelidos: string[]
  ativo: boolean
}

export function mapAnestesistaApi(r: Linha): AnestesistaApi | null {
  const id = texto(r.id)
  const nome = texto(r.nome)
  if (!id || !nome) return null
  const apelidos = Array.isArray(r.apelidos)
    ? [...new Set(r.apelidos.map(texto).filter((a): a is string => a !== null))]
    : []
  return { id, nome, apelidos, ativo: r.ativo !== false }
}

// ──────────────────────────────────────────────────────────────────────────
// Rotas
// ──────────────────────────────────────────────────────────────────────────
const COLUNAS_ESCALA =
  'data,hospital,turno,sala,ordem,hora,termino_previsto,tempo_estimado,cirurgiao_nome,' +
  'anestesista_id,anestesista_nome,residente_id,residente_nome,tipo,status_cirurgia,' +
  'inicio_real,termino_real,sem_anestesista,continuacao'

export async function rotaEscalaCirurgica(ctx: RotaCtx): Promise<RotaResultado> {
  const p = parseParamsEscala(ctx.url.searchParams)
  if (!p.ok) return p.erro
  const { inicio, fim, hospital, turno } = p.params

  const rows: Linha[] = []
  for (let de = 0; de < MAX_LINHAS; de += PAGINA_DB) {
    let q = ctx.supabase
      .from('vw_api_escala_cirurgica')
      .select(COLUNAS_ESCALA)
      .gte('data', inicio)
      .lte('data', fim)
    if (hospital) q = q.eq('hospital', hospital)
    if (turno) q = q.eq('turno', turno)
    // ordem estável (caso_id desempata) para a paginação não pular/repetir linha
    const { data, error } = await q
      .order('data')
      .order('caso_id')
      .range(de, de + PAGINA_DB - 1)
    if (error) {
      console.error('api-v1 escala-cirurgica: query error', error.message)
      return erroInterno()
    }
    const pagina = (data ?? []) as unknown as Linha[]
    rows.push(...pagina)
    if (pagina.length < PAGINA_DB) break
  }

  const escalas = agruparEscalas(rows)
  return ok({
    data: escalas,
    meta: {
      inicio,
      fim,
      hospital,
      turno,
      total_escalas: escalas.length,
      total_casos: escalas.reduce((n, e) => n + e.casos.length, 0),
    },
  })
}

export async function rotaAnestesistas(ctx: RotaCtx): Promise<RotaResultado> {
  const p = parseAtivos(ctx.url.searchParams)
  if (!p.ok) return p.erro
  const ativos = p.params

  let q = ctx.supabase.from('vw_api_anestesistas').select('id,nome,ativo,apelidos')
  if (ativos !== null) q = q.eq('ativo', ativos)
  const { data, error } = await q.order('nome')
  if (error) {
    console.error('api-v1 anestesistas: query error', error.message)
    return erroInterno()
  }
  const lista = ((data ?? []) as unknown as Linha[])
    .map(mapAnestesistaApi)
    .filter((a): a is AnestesistaApi => a !== null)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  return ok({ data: lista, meta: { total: lista.length, ativos } })
}
