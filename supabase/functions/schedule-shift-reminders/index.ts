/**
 * Edge Function: schedule-shift-reminders
 *
 * Cria lembretes (D-1 e D-0) de plantão na caixa de mensagens dos usuários
 * escalados. Substitui a dependência do hook client-side (useShiftReminders /
 * useFuncionariaShiftReminders / useResidenteShiftReminders) que só dispara
 * quando alguém abre o app.
 *
 * Modos:
 * 1) POST sem payload: modo "cron" — a função assume "agora" e gera lembretes
 *    D-1 (para amanhã) e D-0 (para hoje).
 * 2) POST com payload { items: [{ recipientId, subject, content, ..., relatedEntityId }] }:
 *    modo "manual" — apenas cria as notifications informadas, com dedup.
 *
 * Dedup: por `related_entity_id`. Se já existe notificação com o mesmo
 *   related_entity_id na tabela, não insere novamente.
 *
 * Authz: exige Supabase JWT service_role (ou usa SUPABASE_SERVICE_ROLE_KEY
 *   do env). Admins/schedulers chamam com esse token.
 *
 * Agendamento: configurar pg_cron para chamar essa função via
 *   supabase.functions.invoke("schedule-shift-reminders") duas vezes ao dia:
 *   - 06:00 BRT (para D-1 de amanhã)
 *   - a cada hora entre 06:00 e 22:00 (para D-0 dentro de 2h do início)
 *
 * NOTA: Este MVP apenas aceita payload externo (modo "manual"). A geração
 *   automática a partir das escalas estáticas (PLANTOES_2026) deve ser
 *   portada para Deno como follow-up. Ver documentação inline abaixo.
 */

// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
// @ts-ignore - Deno import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

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
    const items: ReminderItem[] = Array.isArray(body.items) ? body.items : []
    const dryRun = body.dryRun === true

    if (items.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          inserted: 0,
          skipped: 0,
          message: 'No items — provide { items: [...] } in POST body.',
          hint: 'Full auto-scheduling from static shift data is a follow-up task. See function source.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1) Dedup via related_entity_id
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
        JSON.stringify({ ok: true, inserted: 0, skipped, dryRun }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (dryRun) {
      return new Response(
        JSON.stringify({
          ok: true,
          inserted: 0,
          skipped,
          wouldInsert: toInsert.length,
          preview: toInsert.slice(0, 3),
          dryRun: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2) Insert batch
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
      JSON.stringify({ ok: true, inserted: inserted?.length || 0, skipped }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ============================================================================
// FOLLOW-UP (não implementado neste MVP)
// ============================================================================
// Para automação completa (sem depender de client-side):
// 1. Portar PLANTOES_2026, RESIDENTES_2026, FERIADOS_2026 (de src/data/)
//    para uma tabela Supabase `residencia_plantao_estatico` (seed via SQL),
//    ou embutir inline neste arquivo.
// 2. Adicionar rota GET/POST "/generate" que calcula itens D-1/D-0 para
//    hoje/amanhã a partir desses dados + overrides Firestore, e chama o
//    mesmo endpoint de insert.
// 3. Configurar pg_cron no Supabase:
//      SELECT cron.schedule('shift-reminders-daily', '0 9 * * *',
//        $$SELECT net.http_post(
//            url := 'https://<proj>.supabase.co/functions/v1/schedule-shift-reminders',
//            headers := jsonb_build_object('Authorization', 'Bearer <service_role_jwt>')
//          )$$);
// 4. Para anestesistas (dados vêm da API pegaplantao), reutilizar
//    `pegaplantao-proxy` Edge Function já existente.
