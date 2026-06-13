/**
 * useCateterReminders
 * Admin-only hook que cria notificações de alerta para cateteres peridurais ativos
 * conforme limiares de duração (24h / 48h / 72h / 96h).
 *
 * Cada limiar é enviado uma única vez por cateter (dedup via related_entity_id).
 * Destinatários: todos anestesiologistas + residentes ativos (mesmo critério dos
 * eventos novo/evolução/retirada).
 */
import { useEffect, useRef } from 'react'
import { useUser } from '../contexts/UserContext'
import { useMessages } from '../contexts/MessagesContext'
import { useCateterPeridural } from '../contexts/CateterPeridualContext'
import { useUsersManagement } from '../contexts/UsersManagementContext'
import { CATETER_REMINDER_THRESHOLDS, getCateterRecipients, buildCateterReminderPayload } from '../utils/cateterNotifications'
import { calcHorasCateter } from '../data/cateterPeridualConfig'
import { supabase } from '../config/supabase'

// Lock terminal por dia (sucesso OU desistência após MAX_ATTEMPTS).
const processedSessions = new Set()
// Contagem de tentativas por dia — permite re-tentar um erro transitório
// (ex.: token Supabase ainda não pronto no cold start) sem travar de vez no
// primeiro 403, mas com teto para não virar loop (fix original commit 5a4586b).
const attemptCounts = new Map()
const MAX_ATTEMPTS = 3

async function checkExistingReminderIds(entityIds) {
  if (entityIds.length === 0) return new Set()
  const { data, error } = await supabase
    .from('notifications')
    .select('related_entity_id')
    .in('related_entity_id', entityIds)
  if (error) {
    console.error('[CateterReminders] Erro checando dedup:', error)
    return new Set()
  }
  return new Set((data || []).map((r) => r.related_entity_id))
}

export function useCateterReminders({ enabled = true } = {}) {
  const { user } = useUser()
  const { createSystemNotification } = useMessages()
  const { cateteres, loading } = useCateterPeridural()
  const { users = [] } = useUsersManagement()
  // Guard de concorrência: impede que mudanças de deps disparem duas execuções
  // sobrepostas enquanto process() está em voo.
  const runningRef = useRef(false)

  useEffect(() => {
    if (!enabled) return
    if (loading) return
    if (!user?.isAdmin) return
    if (!users.length) return
    if (runningRef.current) return

    const today = new Date().toISOString().split('T')[0]
    const sessionKey = `cateter_reminders_${today}`
    if (processedSessions.has(sessionKey)) return

    const attempts = attemptCounts.get(sessionKey) || 0
    if (attempts >= MAX_ATTEMPTS) {
      // Já desistiu hoje — evita loop de 403 persistente.
      processedSessions.add(sessionKey)
      return
    }

    runningRef.current = true
    attemptCounts.set(sessionKey, attempts + 1)

    process()
      .then(() => {
        // Sucesso: trava o dia (dedup via related_entity_id cobre re-execuções).
        processedSessions.add(sessionKey)
      })
      .catch((err) => {
        // Erro transitório (ex.: 403 por token ainda não pronto): deixa
        // destravado para re-tentar numa próxima mudança de deps, até o teto.
        if (attempts + 1 >= MAX_ATTEMPTS) {
          processedSessions.add(sessionKey)
          console.warn('[CateterReminders] desistindo após', MAX_ATTEMPTS, 'tentativas:', err?.message || err)
        } else {
          console.warn(`[CateterReminders] tentativa ${attempts + 1} falhou, re-tentará:`, err?.message || err)
        }
      })
      .finally(() => {
        runningRef.current = false
      })

    async function process() {
      const recipientIds = getCateterRecipients(users)
      if (recipientIds.length === 0) {
        console.log('[CateterReminders] Nenhum destinatário')
        return
      }

      const ativos = cateteres.filter((c) => c.status === 'ativo' && c.dataInsercao)
      if (ativos.length === 0) {
        console.log('[CateterReminders] Nenhum cateter ativo')
        return
      }

      // Determinar quais (cateter × threshold) já foram atingidos
      const pending = []
      for (const cateter of ativos) {
        const horas = calcHorasCateter(cateter.dataInsercao)
        for (const threshold of CATETER_REMINDER_THRESHOLDS) {
          if (horas >= threshold.hours) {
            pending.push({
              cateter,
              thresholdKey: threshold.key,
              entityId: `cateter-reminder_${cateter.id}_${threshold.key}`,
            })
          }
        }
      }

      if (pending.length === 0) {
        console.log('[CateterReminders] Nada a notificar')
        return
      }

      const entityIds = pending.map((p) => p.entityId)
      const existing = await checkExistingReminderIds(entityIds)
      const toCreate = pending.filter((p) => !existing.has(p.entityId))

      if (toCreate.length === 0) {
        console.log(`[CateterReminders] 0 criados (${existing.size} já existiam)`)
        return
      }

      let created = 0
      for (const item of toCreate) {
        try {
          const payload = buildCateterReminderPayload({
            thresholdKey: item.thresholdKey,
            cateterId: item.cateter.id,
            pacienteNome: item.cateter.paciente,
            hospital: item.cateter.hospital,
            recipientIds,
          })
          await createSystemNotification(payload)
          created++
        } catch (err) {
          console.error(`[CateterReminders] Falha criando ${item.entityId}:`, err)
        }
      }

      console.log(`[CateterReminders] Criados ${created} (${existing.size} já existiam)`)
    }
  }, [enabled, loading, cateteres, users, user, createSystemNotification])
}
