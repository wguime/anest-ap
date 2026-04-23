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
import {
  CATETER_REMINDER_THRESHOLDS,
  getCateterRecipients,
  buildCateterReminderPayload,
} from '../utils/cateterNotifications'
import { calcHorasCateter } from '../data/cateterPeridualConfig'
import { supabase } from '../config/supabase'

const processedSessions = new Set()

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

export function useCateterReminders() {
  const { user } = useUser()
  const { createSystemNotification } = useMessages()
  const { cateteres, loading } = useCateterPeridural()
  const { users = [] } = useUsersManagement()
  const hasRun = useRef(false)

  useEffect(() => {
    if (loading) return
    if (!user?.isAdmin) return
    if (!users.length) return
    if (hasRun.current) return

    const today = new Date().toISOString().split('T')[0]
    const sessionKey = `cateter_reminders_${today}`
    if (processedSessions.has(sessionKey)) return

    hasRun.current = true
    processedSessions.add(sessionKey)

    process().catch((err) => {
      console.error('[CateterReminders] Erro:', err)
      hasRun.current = false
      processedSessions.delete(sessionKey)
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
            setor: item.cateter.setor,
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
  }, [loading, cateteres, users, user, createSystemNotification])
}
