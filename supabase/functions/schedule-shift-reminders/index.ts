/**
 * Edge Function: schedule-shift-reminders
 *
 * Cria lembretes (D-1 e D-0) de plantão da residência na caixa de mensagens.
 *
 * Modos:
 * 1) POST sem items (ou body vazio): modo AUTO. A função calcula os itens
 *    D-1 (plantão de amanhã) e D-0 (plantão de hoje dentro de 2h do início)
 *    a partir dos dados estáticos (_data.ts) + overrides em
 *    residencia_plantao_diario_overrides (se existir), resolve o residente
 *    → profile via email e insere notifications em batch com dedup.
 * 2) POST com { items: [...] }: modo MANUAL. Apenas insere os items
 *    informados, com dedup por related_entity_id.
 *
 * Dedup: via UNIQUE(related_entity_type, related_entity_id, recipient_id)
 *        criado pela migration 20260422213000_notify_public_incidents.sql.
 *        Se o índice não existir, cai no check manual via SELECT ... IN.
 *
 * Authz: exige Supabase JWT (geralmente service_role vindo de pg_cron /
 *        scheduler). Usa SUPABASE_SERVICE_ROLE_KEY do env.
 */

// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
// @ts-ignore - Deno import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
// Dados estáticos da escala de residência (gerado por
// src/scripts/generate-edge-function-data.js)
import {
  PLANTOES_2026,
  RESIDENTES_2026,
  horarioPlantao,
  findResidente,
} from './_data.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ReminderItem {
  recipientId: string
  category: string
  subject: string
  content: string
  senderName?: string
  priority?: 'urgente' | 'alta' | 'normal' | 'baixa'
  actionUrl?: string
  actionLabel?: string
  actionParams?: Record<string, unknown>
  relatedEntityType: string
  relatedEntityId: string
  dismissable?: boolean
}

interface RequestBody {
  items?: ReminderItem[]
  dryRun?: boolean
  mode?: 'auto' | 'manual'
  now?: string // ISO — para testes
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDisplay(dateKey: string): string {
  const [y, m, d] = dateKey.split('-')
  return `${d}/${m}/${y}`
}

function makeEntityId(dateKey: string, residenteId: string, reminderType: string): string {
  return `plantao-residencia_${dateKey}_${residenteId}_${reminderType}`
}

/**
 * Resolve qual residente está de plantão em `dateKey`. Primeiro tenta
 * override na tabela residencia_plantao_diario_overrides; se vazio usa a
 * base estática PLANTOES_2026. Retorna null se nenhum.
 */
async function resolveResidente(
  supabase: any,
  dateKey: string,
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('residencia_plantao_diario_overrides')
      .select('residente_override')
      .eq('data_plantao', dateKey)
      .maybeSingle()
    if (data?.residente_override) return data.residente_override
  } catch {
    // Tabela pode não existir ainda — segue para base estática
  }
  return PLANTOES_2026[dateKey] ?? null
}

async function matchResidenteToProfile(
  supabase: any,
  residenteId: string,
): Promise<{ id: string; nome: string } | null> {
  const residente = findResidente(residenteId)
  if (!residente?.email) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nome')
    .ilike('email', residente.email)
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return data
}

function buildPlantaoResidenteItem(
  dateKey: string,
  residenteId: string,
  tipoLembrete: '1day' | '1hour',
  recipientId: string,
): ReminderItem {
  const horario = horarioPlantao(dateKey)
  const eh1Dia = tipoLembrete === '1day'
  const dataPlantao = formatDisplay(dateKey)
  return {
    recipientId,
    category: 'plantao',
    subject: eh1Dia
      ? `Plantão amanhã: ${horario.setor}`
      : `Plantão em 1 hora: ${horario.setor}`,
    content: eh1Dia
      ? `Você está escalado(a) para plantão amanhã (${dataPlantao}) no ${horario.setor} a partir de ${horario.inicio}`
      : `Seu plantão no ${horario.setor} começa em 1 hora (${horario.inicio})`,
    senderName: 'Escala de Residência',
    priority: eh1Dia ? 'normal' : 'alta',
    actionUrl: 'residencia',
    actionLabel: 'Ver Residência',
    actionParams: { dataPlantao },
    relatedEntityType: 'plantao-residencia',
    relatedEntityId: makeEntityId(dateKey, residenteId, tipoLembrete),
    dismissable: true,
  }
}

/**
 * Calcula items D-1 e D-0 para residentes a partir de `now`.
 * D-0 só é incluído se o plantão ainda não começou E começa em até 2h.
 */
async function generateResidentItems(
  supabase: any,
  now: Date,
): Promise<ReminderItem[]> {
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const todayKey = formatDateKey(now)
  const tomorrowKey = formatDateKey(tomorrow)

  const items: ReminderItem[] = []

  // D-1
  const residenteAmanha = await resolveResidente(supabase, tomorrowKey)
  if (residenteAmanha) {
    const profile = await matchResidenteToProfile(supabase, residenteAmanha)
    if (profile) {
      items.push(buildPlantaoResidenteItem(tomorrowKey, residenteAmanha, '1day', profile.id))
    }
  }

  // D-0: 1 hora antes (janela de até 2h antes do início)
  const residenteHoje = await resolveResidente(supabase, todayKey)
  if (residenteHoje) {
    const horario = horarioPlantao(todayKey)
    const [hh, mm] = horario.inicio.split(':').map(Number)
    const shiftStart = new Date(now)
    shiftStart.setHours(hh, mm, 0, 0)
    const diffMs = shiftStart.getTime() - now.getTime()
    if (diffMs > 0 && diffMs <= 2 * 60 * 60 * 1000) {
      const profile = await matchResidenteToProfile(supabase, residenteHoje)
      if (profile) {
        items.push(buildPlantaoResidenteItem(todayKey, residenteHoje, '1hour', profile.id))
      }
    }
  }

  return items
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // @ts-ignore - Deno global
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    // @ts-ignore - Deno global
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const body: RequestBody = await req.json().catch(() => ({}))
    const dryRun = body.dryRun === true
    const now = body.now ? new Date(body.now) : new Date()

    // Determina modo: auto (sem items) ou manual (com items)
    let items: ReminderItem[] = Array.isArray(body.items) ? body.items : []
    const isAutoMode = items.length === 0

    if (isAutoMode) {
      items = await generateResidentItems(supabase, now)
    }

    if (items.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          mode: isAutoMode ? 'auto' : 'manual',
          inserted: 0,
          skipped: 0,
          message: isAutoMode
            ? 'Nenhum plantão de residência para notificar agora.'
            : 'Nenhum item informado no POST body.',
          now: now.toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Dedup via related_entity_id
    const entityIds = items.map((i) => i.relatedEntityId).filter(Boolean)
    let existing = new Set<string>()
    if (entityIds.length > 0) {
      const { data: existingRows, error: existingErr } = await supabase
        .from('notifications')
        .select('related_entity_id')
        .in('related_entity_id', entityIds)
      if (existingErr) {
        return new Response(
          JSON.stringify({ error: `Dedup check failed: ${existingErr.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      existing = new Set((existingRows || []).map((r: any) => r.related_entity_id))
    }

    const toInsert = items.filter((i) => !existing.has(i.relatedEntityId))
    const skipped = items.length - toInsert.length

    if (toInsert.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, mode: isAutoMode ? 'auto' : 'manual', inserted: 0, skipped, dryRun }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (dryRun) {
      return new Response(
        JSON.stringify({
          ok: true,
          mode: isAutoMode ? 'auto' : 'manual',
          inserted: 0,
          skipped,
          wouldInsert: toInsert.length,
          preview: toInsert,
          dryRun: true,
          now: now.toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const rows = toInsert.map((i) => ({
      recipient_id: i.recipientId,
      category: i.category,
      subject: i.subject,
      content: i.content,
      sender_name: i.senderName || 'Sistema ANEST',
      priority: i.priority || 'normal',
      action_url: i.actionUrl || null,
      action_label: i.actionLabel || null,
      action_params: i.actionParams || null,
      dismissable: i.dismissable !== false,
      related_entity_type: i.relatedEntityType,
      related_entity_id: i.relatedEntityId,
    }))

    const { data: inserted, error: insertErr } = await supabase
      .from('notifications')
      .insert(rows)
      .select('id')

    if (insertErr) {
      return new Response(
        JSON.stringify({ error: `Insert failed: ${insertErr.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        ok: true,
        mode: isAutoMode ? 'auto' : 'manual',
        inserted: inserted?.length || 0,
        skipped,
        now: now.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ============================================================================
// FOLLOW-UP (ainda não portado)
// ============================================================================
// Anestesistas (via pegaPlantaoApi) e funcionárias (sobreaviso + hospitais)
// seguem nos hooks client-side. Para portar:
// 1. Chamar pegaplantao-proxy da Edge Function (já existe) para anestesistas.
// 2. Embutir FUNCIONARIAS_SOBREAVISO/HOSPITAIS + HOSPITAIS_2026 em _data.ts.
// 3. Adicionar generateAnesthesistItems() e generateFuncionariaItems().
// Silos atualmente cobertos: residentes (D-1 + D-0 dentro de 2h).
