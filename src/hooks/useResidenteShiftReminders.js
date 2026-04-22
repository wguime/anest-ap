/**
 * useResidenteShiftReminders
 * Cria notificações de lembrete (D-1 e D-0) para residentes de plantão.
 *
 * Fonte de dados:
 * - Base estática: PLANTOES_2026 (src/data/plantao2026.js)
 * - Overrides: Firestore residenciaPlantaoDiario/{YYYY-MM-DD}
 *
 * Match residente → profile: via email (RESIDENTES_2026[i].email → profiles.email).
 *
 * Dedup via notifications.related_entity_id (mesmo padrão de useShiftReminders).
 */
import { useEffect, useRef } from 'react'
import { useUser } from '../contexts/UserContext'
import { useMessages } from '../contexts/MessagesContext'
import {
  PLANTOES_2026,
  getHorarioPlantao,
  isPlantao24h,
} from '../data/plantao2026'
import { RESIDENTES_2026 } from '../data/residencia2026'
import { getPlantaoDiario } from '../services/residenciaPlantaoDiarioService'
import { notifyPlantaoResidenteReminder } from '../services/notificationService'
import { supabase } from '../config/supabase'

// Dedup entre montagens na mesma sessão
const processedSessions = new Set()

function formatDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDisplay(dateKey) {
  const [y, m, d] = dateKey.split('-')
  return `${d}/${m}/${y}`
}

function makeEntityId(dateKey, residenteId, reminderType) {
  return `plantao-residencia_${dateKey}_${residenteId}_${reminderType}`
}

async function resolveResidenteParaData(dateKey) {
  try {
    const { data: override } = await getPlantaoDiario(dateKey)
    if (override?.residenteOverride) return override.residenteOverride
  } catch (err) {
    console.warn('[ResidenteShiftReminders] Falha lendo override Firestore:', err)
  }
  return PLANTOES_2026[dateKey] || null
}

async function matchResidenteToProfile(residenteId) {
  const residente = RESIDENTES_2026.find(r => r.id === residenteId)
  if (!residente?.email) return null
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nome, email')
      .ilike('email', residente.email)
      .limit(1)
      .maybeSingle()
    if (error || !data) return null
    return {
      ...data,
      residenteNome: residente.nome,
      residenteAno: residente.ano,
    }
  } catch {
    return null
  }
}

async function checkExistingNotifications(entityIds) {
  if (entityIds.length === 0) return new Set()
  const { data, error } = await supabase
    .from('notifications')
    .select('related_entity_id')
    .in('related_entity_id', entityIds)
  if (error) {
    console.error('[ResidenteShiftReminders] Erro checando dedup:', error)
    return new Set()
  }
  return new Set((data || []).map(r => r.related_entity_id))
}

export function useResidenteShiftReminders({ dataLoaded = true, usandoMock = false } = {}) {
  const { user } = useUser()
  const { createSystemNotification } = useMessages()
  const hasRun = useRef(false)

  useEffect(() => {
    if (!dataLoaded || usandoMock) return
    if (!user?.isAdmin) return
    if (hasRun.current) return

    const today = formatDateKey(new Date())
    const sessionKey = `residente_shift_reminders_${today}`
    if (processedSessions.has(sessionKey)) return

    hasRun.current = true
    processedSessions.add(sessionKey)

    process().catch(err => {
      console.error('[ResidenteShiftReminders] Erro:', err)
      hasRun.current = false
      processedSessions.delete(sessionKey)
    })

    async function process() {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const todayKey = formatDateKey(now)
      const tomorrowKey = formatDateKey(tomorrow)

      const pending = []

      // D-1: plantão de amanhã
      const residenteAmanha = await resolveResidenteParaData(tomorrowKey)
      if (residenteAmanha) {
        const profile = await matchResidenteToProfile(residenteAmanha)
        if (profile) {
          const entityId = makeEntityId(tomorrowKey, residenteAmanha, '1day')
          const horarioInfo = getHorarioPlantao(tomorrow)
          const setor = isPlantao24h(tomorrow)
            ? 'Plantão Residência (24h)'
            : 'Plantão Residência (12h)'
          pending.push({
            entityId,
            data: {
              profissionalNome: profile.nome,
              setor,
              horario: horarioInfo.inicio,
              dataPlantao: formatDisplay(tomorrowKey),
              tipoLembrete: '1day',
              recipientId: profile.id,
              relatedEntityId: entityId,
            },
          })
        }
      }

      // D-0 (1 hora antes): plantão de hoje
      const residenteHoje = await resolveResidenteParaData(todayKey)
      if (residenteHoje) {
        const profile = await matchResidenteToProfile(residenteHoje)
        if (profile) {
          const horarioInfo = getHorarioPlantao(now)
          const [hh, mm] = horarioInfo.inicio.split(':').map(Number)
          const shiftStart = new Date(now)
          shiftStart.setHours(hh, mm, 0, 0)
          const diffMs = shiftStart.getTime() - now.getTime()
          // Só cria se plantão ainda não começou e está dentro de 2h
          if (diffMs > 0 && diffMs <= 2 * 60 * 60 * 1000) {
            const entityId = makeEntityId(todayKey, residenteHoje, '1hour')
            const setor = isPlantao24h(now)
              ? 'Plantão Residência (24h)'
              : 'Plantão Residência (12h)'
            pending.push({
              entityId,
              data: {
                profissionalNome: profile.nome,
                setor,
                horario: horarioInfo.inicio,
                dataPlantao: formatDisplay(todayKey),
                tipoLembrete: '1hour',
                recipientId: profile.id,
                relatedEntityId: entityId,
              },
            })
          }
        }
      }

      if (pending.length === 0) {
        console.log('[ResidenteShiftReminders] Nada a notificar')
        return
      }

      const entityIds = pending.map(p => p.entityId)
      const existing = await checkExistingNotifications(entityIds)
      const toCreate = pending.filter(p => !existing.has(p.entityId))

      if (toCreate.length === 0) {
        console.log(`[ResidenteShiftReminders] 0 criados (${existing.size} já existiam)`)
        return
      }

      let created = 0
      for (const item of toCreate) {
        try {
          notifyPlantaoResidenteReminder(createSystemNotification, item.data)
          created++
        } catch (err) {
          console.error(`[ResidenteShiftReminders] Falha criando ${item.entityId}:`, err)
        }
      }

      console.log(`[ResidenteShiftReminders] Criados ${created} (${existing.size} já existiam)`)
    }
  }, [dataLoaded, usandoMock, user, createSystemNotification])
}
