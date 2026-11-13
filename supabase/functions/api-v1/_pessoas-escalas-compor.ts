// =============================================================================
// supabase/functions/api-v1/_pessoas-escalas-compor.ts — composição PURA
// (sem rede, sem Deno) das escalas de residentes e funcionárias: base estática
// (_dados-gerados.ts) + ajustes do dia lidos do Firestore.
//
// Separado de _pessoas-escalas.ts para o Vitest importar sem resolver URL Deno
// (src/__tests__/functions/apiV1PessoasEscalas.test.js).
//
// Regra do domínio (rule escalas-trocas): escala EFETIVA = base + override do
// dia, e o override SUBSTITUI o slot inteiro. Cada função abaixo espelha o que a
// tela do app faz — o comentário diz qual — para a API não divergir do app.
//
// LGPD: tudo que sai daqui é montado campo a campo (id/nome/ano/data/turno/
// local/horário/origem). Nada de e-mail, cargo, updatedBy, trocaId, cirurgião.
// =============================================================================

import {
  FERIADOS_FUNCIONARIAS,
  FERIADOS_RESIDENCIA,
  FUNCIONARIAS_HOSPITAIS,
  FUNCIONARIAS_SOBREAVISO,
  HOSPITAIS_BASE_ESTATICA,
  PLANTOES_RESIDENCIA,
  RESIDENTES,
  ROTACOES,
  SOBREAVISO_BASE_ESTATICA,
  type HospitaisDia,
  type Pessoa,
  type Residente,
} from './_dados-gerados.ts'

// ── Tipos de entrada (docs do Firestore já convertidos para JS) ─────────────

/** residenciaPlantaoDiario/{data} · sobreavisoMaternoDiario/{data} · hospitaisDiario/{id} */
export interface DocAjuste {
  residenteOverride?: unknown
  funcionariaOverride?: unknown
  origem?: unknown
}

/** residenciaEstagiosDiarios/{data}-{turno} */
export interface DocSlotEstagios {
  estagiosOverride?: Record<string, unknown>
}

/** escalasFuncionarias/{YYYY-MM} */
export interface DocMesFuncionarias {
  sobreaviso?: Record<string, unknown>
  hospitais?: Record<string, { hro?: unknown; unimed?: unknown; plantaoPago?: unknown }>
}

export type Origem = 'base' | 'troca' | 'ajuste'

// ── Datas ───────────────────────────────────────────────────────────────────

/** Datas ISO de inicio a fim, inclusive (aritmética em UTC — sem fuso). */
export function listarDias(inicio: string, fim: string): string[] {
  const dias: string[] = []
  const d = new Date(`${inicio}T12:00:00Z`)
  const ultimo = Date.parse(`${fim}T12:00:00Z`)
  while (d.getTime() <= ultimo) {
    dias.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return dias
}

function diaDaSemana(data: string): number {
  return new Date(`${data}T12:00:00Z`).getUTCDay()
}

const ehFimDeSemana = (data: string) => {
  const dow = diaDaSemana(data)
  return dow === 0 || dow === 6
}

// ── Helpers de whitelist ────────────────────────────────────────────────────

const texto = (v: unknown, max = 80): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

/** 'troca' (aceite de troca) vs qualquer outra coisa ('manual' etc.) = 'ajuste'. */
export function normalizarOrigem(origem: unknown): Exclude<Origem, 'base'> {
  return typeof origem === 'string' && origem.startsWith('troca') ? 'troca' : 'ajuste'
}

// ── Residentes ──────────────────────────────────────────────────────────────

/**
 * Cadastro efetivo: doc `residencia/roster` quando tem alguém; senão a tabela
 * estática (mesmo fallback de useResidencia / residenciaRosterService).
 */
export function comporRoster(residentesFirestore: unknown): Residente[] {
  const lista = Array.isArray(residentesFirestore) ? residentesFirestore : []
  const limpos = lista
    .filter((r) => r && typeof r === 'object' && (r as { id?: unknown }).id && texto((r as { nome?: unknown }).nome))
    .map((r) => {
      const o = r as { id: unknown; nome: unknown; ano?: unknown }
      return { id: String(o.id), nome: texto(o.nome) as string, ano: texto(o.ano, 4) ?? 'R1' }
    })
  return limpos.length > 0 ? limpos : RESIDENTES.map((r) => ({ id: r.id, nome: r.nome, ano: r.ano }))
}

function acharResidente(id: string, roster: Residente[]): Residente | null {
  // O card de plantão resolve pelo RESIDENTES_2026 estático; o roster cobre id novo.
  const r = RESIDENTES.find((x) => x.id === id) ?? roster.find((x) => x.id === id)
  return r ? { id: r.id, nome: r.nome, ano: r.ano } : null
}

/** Sáb/dom/feriado = 24h das 07h às 07h; dia útil = 12h das 19h às 07h (plantao2026.getHorarioPlantao). */
export function horarioPlantaoResidencia(data: string) {
  const h24 = ehFimDeSemana(data) || data in FERIADOS_RESIDENCIA
  return h24
    ? { inicio: '07:00', fim: '07:00', duracaoHoras: 24 }
    : { inicio: '19:00', fim: '07:00', duracaoHoras: 12 }
}

/**
 * Residente efetivo por dia = override de `residenciaPlantaoDiario` || base
 * (plantao2026.getResidenteEfetivo). Doc sem `residenteOverride` é ignorado,
 * como em useOverridesDiario.
 */
export function comporPlantoesResidencia(
  dias: string[],
  ajustes: Record<string, DocAjuste | null | undefined>,
  roster: Residente[],
  base: Record<string, string> = PLANTOES_RESIDENCIA,
) {
  return dias.map((data) => {
    const doc = ajustes[data]
    const overrideId = texto(doc?.residenteOverride, 64)
    const id = overrideId ?? base[data] ?? null
    return {
      data,
      residente: id ? (acharResidente(id, roster) ?? { id, nome: null, ano: null }) : null,
      origem: (overrideId ? normalizarOrigem(doc?.origem) : 'base') as Origem,
      ...horarioPlantaoResidencia(data),
      feriado: FERIADOS_RESIDENCIA[data] ?? null,
    }
  })
}

/** Estágio de rodízio da quinzena, já formatado (residencia2026.getEstagiosParaData). */
function estagioBase(data: string, residenteId: string): string | null {
  const q = ROTACOES.find((r) => data >= r.inicio && data <= r.fim)
  return q?.estagios[residenteId] ?? null
}

export const TURNOS_ESTAGIO = ['manha', 'tarde'] as const

/** Dias com estágio: o app esconde o card de estágios em sáb/dom/feriado (isDiaNaoUtil). */
export function ehDiaUtilResidencia(data: string): boolean {
  return !ehFimDeSemana(data) && !(data in FERIADOS_RESIDENCIA)
}

/**
 * Estágio por residente e turno = `estagiosOverride[id]` do slot || base da
 * quinzena (useResidencia: `slotDoc.estagiosOverride?.[r.id] ?? r.estagio`).
 * `slots` indexado por `${data}-${turno}` (id do doc no Firestore).
 * O nome do cirurgião do slot NÃO sai (terceiro, fora do pedido).
 */
export function comporEstagiosResidencia(
  dias: string[],
  slots: Record<string, DocSlotEstagios | null | undefined>,
  roster: Residente[],
) {
  return dias.filter(ehDiaUtilResidencia).map((data) => ({
    data,
    turnos: TURNOS_ESTAGIO.map((turno) => {
      const overrides = slots[`${data}-${turno}`]?.estagiosOverride ?? {}
      return {
        turno,
        residentes: roster.map((r) => {
          const ajustado = texto(overrides[r.id])
          return {
            id: r.id,
            nome: r.nome,
            ano: r.ano,
            estagio: ajustado ?? estagioBase(data, r.id),
            origem: (ajustado ? 'ajuste' : 'base') as Origem,
          }
        }),
      }
    }),
  }))
}

// ── Funcionárias ────────────────────────────────────────────────────────────

/**
 * Base ativa = estático + meses publicados (`escalasFuncionarias/{YYYY-MM}`);
 * mês publicado SUBSTITUI o mês inteiro do estático
 * (setSobreavisoBaseDinamica / setHospitaisBaseDinamica).
 */
export function comporBaseFuncionarias(meses: Record<string, DocMesFuncionarias | null | undefined>) {
  const sobreaviso: Record<string, string> = { ...SOBREAVISO_BASE_ESTATICA }
  const hospitais: Record<string, HospitaisDia> = { ...HOSPITAIS_BASE_ESTATICA }
  for (const [mes, doc] of Object.entries(meses)) {
    if (!doc) continue
    for (const k of Object.keys(sobreaviso)) if (k.startsWith(mes)) delete sobreaviso[k]
    for (const k of Object.keys(hospitais)) if (k.startsWith(mes)) delete hospitais[k]
    for (const [data, id] of Object.entries(doc.sobreaviso ?? {})) {
      const v = texto(id, 64)
      if (v) sobreaviso[data] = v
    }
    for (const [data, h] of Object.entries(doc.hospitais ?? {})) {
      if (!h || typeof h !== 'object') continue
      hospitais[data] = { hro: texto(h.hro), unimed: texto(h.unimed), plantaoPago: texto(h.plantaoPago) }
    }
  }
  return { sobreaviso, hospitais }
}

const pessoa = (lista: Pessoa[], id: string | null) => {
  const f = id ? lista.find((x) => x.id === id) : undefined
  return f ? { id: f.id, nome: f.nome } : null
}

/** Slots de hospital: id do doc de ajuste = `${data}_${hospital}_${turno}` (hospitaisTecnicas2026). */
export const SLOTS_HOSPITAIS = [
  { campo: 'hro', hospital: 'hro', local: 'HRO', turno: 'manha', inicio: '07:00', fim: '15:00' },
  { campo: 'unimed', hospital: 'unimed', local: 'UNIMED', turno: 'manha', inicio: '07:00', fim: '15:00' },
  { campo: 'plantaoPago', hospital: 'plantao_pago', local: 'Plantão Pago', turno: 'tarde', inicio: '15:00', fim: '23:00' },
] as const

export const idAjusteHospital = (data: string, slot: (typeof SLOTS_HOSPITAIS)[number]) =>
  `${data}_${slot.hospital}_${slot.turno}`

/**
 * Por dia: sobreaviso materno (19h–07h) e os slots de hospital de FDS/feriado.
 *
 * Sobreaviso (ConsultaSobreavisoPage): base só conta se o id existe no cadastro;
 * `funcionariaOverride ?? base`, e override com id desconhecido cai na base.
 * Hospitais (getHospitaisEfetivos): override só vale em dia que TEM base; um
 * override com id desconhecido mantém o nome da base; slot sem nome não aparece.
 * A base de hospitais guarda NOME — o id sai resolvido pelo cadastro (ou null).
 */
export function comporEscalaFuncionarias(
  dias: string[],
  base: { sobreaviso: Record<string, string>; hospitais: Record<string, HospitaisDia> },
  ajustesSobreaviso: Record<string, DocAjuste | null | undefined>,
  ajustesHospitais: Record<string, DocAjuste | null | undefined>,
) {
  return dias.map((data) => {
    // Sobreaviso materno
    const baseF = pessoa(FUNCIONARIAS_SOBREAVISO, base.sobreaviso[data] ?? null)
    const docS = ajustesSobreaviso[data]
    const ovF = pessoa(FUNCIONARIAS_SOBREAVISO, texto(docS?.funcionariaOverride, 64))
    const efetiva = ovF ?? baseF
    const sobreavisoMaterno = efetiva
      ? {
          funcionaria: efetiva,
          inicio: '19:00',
          fim: '07:00',
          origem: (ovF ? normalizarOrigem(docS?.origem) : 'base') as Origem,
        }
      : null

    // Hospitais (FDS/feriado)
    const h = base.hospitais[data]
    const hospitais = !h
      ? []
      : SLOTS_HOSPITAIS.flatMap((slot) => {
          const doc = ajustesHospitais[idAjusteHospital(data, slot)]
          const ov = pessoa(FUNCIONARIAS_HOSPITAIS, texto(doc?.funcionariaOverride, 64))
          const nomeBase = h[slot.campo]
          const nome = ov?.nome ?? nomeBase
          if (!nome) return []
          const id = ov?.id ?? FUNCIONARIAS_HOSPITAIS.find((f) => f.nome === nomeBase)?.id ?? null
          return [{
            local: slot.local,
            turno: slot.turno,
            inicio: slot.inicio,
            fim: slot.fim,
            funcionaria: { id, nome },
            origem: (ov ? normalizarOrigem(doc?.origem) : 'base') as Origem,
          }]
        })

    return {
      data,
      feriado: FERIADOS_FUNCIONARIAS[data] ?? null,
      sobreavisoMaterno,
      hospitais,
    }
  })
}
