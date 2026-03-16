/**
 * useShiftReminders
 * Admin-only hook that creates inbox notifications for upcoming shifts and vacations.
 * - Shifts: 1 day before + 1 hour before
 * - Vacations: 1 day before
 */
import { useEffect, useRef } from 'react'
import { useUser } from '../contexts/UserContext'
import { useMessages } from '../contexts/MessagesContext'
import { getPlantoesPorData } from '../services/pegaPlantaoApi'
import { matchNamesToProfiles } from '../services/userMatchingService'
import { notifyPlantaoReminder, notifyFeriasReminder } from '../services/notificationService'
import { supabase } from '../config/supabase'

// Module-level dedup: prevents re-execution in the same browser tab
const processedSessions = new Set()

/**
 * Format date as YYYY-MM-DD using local timezone
 */
function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Format date as DD/MM for display
 */
function formatDisplay(dateStr) {
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Generate a deterministic entity ID for dedup
 */
function makeEntityId(type, dateStr, setor, nome, reminderType) {
  const slug = (nome || '').toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return `${type}_${dateStr}_${setor}_${slug}_${reminderType}`
}

/**
 * Check which entity IDs already exist in notifications table
 */
async function checkExistingNotifications(entityIds) {
  if (entityIds.length === 0) return new Set()

  const { data, error } = await supabase
    .from('notifications')
    .select('related_entity_id')
    .in('related_entity_id', entityIds)

  if (error) {
    console.error('[ShiftReminders] Error checking existing notifications:', error)
    return new Set()
  }
  return new Set((data || []).map(r => r.related_entity_id))
}

export function useShiftReminders({ dataLoaded, usandoMock }) {
  const { user } = useUser()
  const { createSystemNotification } = useMessages()
  const hasRun = useRef(false)

  useEffect(() => {
    // Guards
    if (!dataLoaded || usandoMock) return
    if (!user?.isAdmin) return
    if (hasRun.current) return

    const today = formatDate(new Date())
    const sessionKey = `shift_reminders_${today}`
    if (processedSessions.has(sessionKey)) return

    hasRun.current = true
    processedSessions.add(sessionKey)

    processReminders().catch(err => {
      console.error('[ShiftReminders] Error:', err)
      // Allow retry on next mount if it failed
      hasRun.current = false
      processedSessions.delete(sessionKey)
    })

    async function processReminders() {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const todayStr = formatDate(now)
      const tomorrowStr = formatDate(tomorrow)

      // Fetch shifts for today (1h reminders) and tomorrow (1day reminders)
      const [todayData, tomorrowData] = await Promise.all([
        getPlantoesPorData(todayStr),
        getPlantoesPorData(tomorrowStr),
      ])

      // Collect all unique names for matching
      const allNames = new Set()
      for (const p of todayData.plantoes) allNames.add(p.nome)
      for (const p of tomorrowData.plantoes) allNames.add(p.nome)
      for (const f of tomorrowData.ferias) allNames.add(f.nome)

      if (allNames.size === 0) {
        console.log('[ShiftReminders] No shifts/vacations found')
        return
      }

      // Match names to profiles
      const nameMap = await matchNamesToProfiles([...allNames])

      // Build pending notifications
      const pending = []

      // Tomorrow's shifts → 1 day reminders
      for (const p of tomorrowData.plantoes) {
        const profile = nameMap.get(p.nome)
        if (!profile) continue
        const entityId = makeEntityId('plantao', tomorrowStr, p.setor, p.nome, '1day')
        pending.push({
          type: 'plantao',
          entityId,
          recipientId: profile.id,
          data: {
            profissionalNome: profile.nome,
            setor: p.setor,
            horario: p.horario,
            dataPlantao: formatDisplay(p.inicio),
            tipoLembrete: '1day',
            recipientId: profile.id,
            relatedEntityId: entityId,
          },
        })
      }

      // Today's shifts → 1 hour reminders (only if shift hasn't started and is within 2h)
      for (const p of todayData.plantoes) {
        const profile = nameMap.get(p.nome)
        if (!profile) continue

        const shiftStart = new Date(p.inicio)
        const diffMs = shiftStart.getTime() - now.getTime()
        // Only create if shift hasn't started AND is within 2 hours
        if (diffMs <= 0 || diffMs > 2 * 60 * 60 * 1000) continue

        const entityId = makeEntityId('plantao', todayStr, p.setor, p.nome, '1hour')
        pending.push({
          type: 'plantao',
          entityId,
          recipientId: profile.id,
          data: {
            profissionalNome: profile.nome,
            setor: p.setor,
            horario: p.horario,
            dataPlantao: formatDisplay(p.inicio),
            tipoLembrete: '1hour',
            recipientId: profile.id,
            relatedEntityId: entityId,
          },
        })
      }

      // Tomorrow's vacations → 1 day reminders
      for (const f of tomorrowData.ferias) {
        const profile = nameMap.get(f.nome)
        if (!profile) continue
        const entityId = makeEntityId('ferias', tomorrowStr, 'ferias', f.nome, '1day')
        pending.push({
          type: 'ferias',
          entityId,
          recipientId: profile.id,
          data: {
            profissionalNome: profile.nome,
            periodo: f.periodo,
            recipientId: profile.id,
            relatedEntityId: entityId,
          },
        })
      }

      if (pending.length === 0) {
        console.log('[ShiftReminders] No notifications to create (no matched profiles)')
        return
      }

      // Dedup against Supabase
      const allEntityIds = pending.map(p => p.entityId)
      const existing = await checkExistingNotifications(allEntityIds)
      const toCreate = pending.filter(p => !existing.has(p.entityId))

      if (toCreate.length === 0) {
        console.log(`[ShiftReminders] 0 created (${existing.size} already existed)`)
        return
      }

      // Create notifications
      let created = 0
      for (const item of toCreate) {
        try {
          if (item.type === 'plantao') {
            notifyPlantaoReminder(createSystemNotification, item.data)
          } else {
            notifyFeriasReminder(createSystemNotification, item.data)
          }
          created++
        } catch (err) {
          console.error(`[ShiftReminders] Failed to create notification for ${item.entityId}:`, err)
        }
      }

      console.log(`[ShiftReminders] Created ${created} notifications (${existing.size} already existed)`)
    }
  }, [dataLoaded, usandoMock, user, createSystemNotification])
}
