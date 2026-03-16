/**
 * useReunioesStatusCheck Hook
 *
 * Automatically promotes meeting statuses based on date/time for the
 * ANEST v2.0 reunioes system. Runs once on mount to check for overdue
 * meetings and update their status according to the workflow.
 *
 * Status workflow: agendada → em_preparacao → em_andamento → concluida
 *
 * Auto-promotion logic:
 * - If meeting date is in the future: keep as "agendada"
 * - If meeting date is today or recent past (< 7 days): promote to "em_preparacao"
 * - If meeting date is past (>= 7 days) and not completed: promote to "concluida"
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import reunioesService, { STATUS_CONFIG } from '@/services/reunioesService'
import { useUser } from '@/contexts/UserContext'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PREPARATION_THRESHOLD_DAYS = 0 // Start prep on meeting day or after
const COMPLETION_THRESHOLD_DAYS = 7 // Auto-complete if > 7 days past

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate days difference between now and meeting date
 * Returns positive number if date is in the past, negative if in the future
 */
function daysSinceMeeting(meetingDate) {
  const now = new Date()
  const meeting = meetingDate instanceof Date ? meetingDate : new Date(meetingDate)

  // Reset time to midnight for date-only comparison
  now.setHours(0, 0, 0, 0)
  meeting.setHours(0, 0, 0, 0)

  const diffMs = now - meeting
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Determine the target status a meeting should have based on its date
 */
function getTargetStatus(meetingDate, currentStatus) {
  const daysDiff = daysSinceMeeting(meetingDate)

  // Already in terminal states - don't change
  if (currentStatus === 'concluida' || currentStatus === 'cancelada') {
    return currentStatus
  }

  // Meeting is in the future - should be "agendada"
  if (daysDiff < PREPARATION_THRESHOLD_DAYS) {
    return 'agendada'
  }

  // Meeting is today or recent past - should be "em_preparacao"
  if (daysDiff >= PREPARATION_THRESHOLD_DAYS && daysDiff < COMPLETION_THRESHOLD_DAYS) {
    return 'em_preparacao'
  }

  // Meeting is old (> 7 days) - auto-complete it
  if (daysDiff >= COMPLETION_THRESHOLD_DAYS) {
    return 'concluida'
  }

  return currentStatus
}

/**
 * Check if a status transition is valid according to STATUS_CONFIG
 */
function isValidTransition(fromStatus, toStatus) {
  if (fromStatus === toStatus) return false

  const config = STATUS_CONFIG[fromStatus]
  if (!config) return false

  return config.nextStates.includes(toStatus)
}

/**
 * Build the promotion path from current to target status
 * Returns array of status transitions needed
 */
function getPromotionPath(currentStatus, targetStatus) {
  if (currentStatus === targetStatus) return []

  // Direct transition possible
  if (isValidTransition(currentStatus, targetStatus)) {
    return [targetStatus]
  }

  // Multi-step transition required
  const path = []

  // Common promotion paths
  if (currentStatus === 'agendada' && targetStatus === 'em_andamento') {
    path.push('em_preparacao', 'em_andamento')
  } else if (currentStatus === 'agendada' && targetStatus === 'concluida') {
    path.push('em_preparacao', 'concluida')
  } else if (currentStatus === 'em_preparacao' && targetStatus === 'concluida') {
    // Can transition directly per STATUS_CONFIG
    // em_preparacao → em_andamento → concluida OR em_preparacao → concluida
    // We'll take the direct route if allowed
    if (isValidTransition(currentStatus, targetStatus)) {
      path.push('concluida')
    } else {
      path.push('em_andamento', 'concluida')
    }
  }

  return path
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useReunioesStatusCheck() {
  const { user, firebaseUser } = useUser()
  const [isChecking, setIsChecking] = useState(false)
  const [lastCheckTime, setLastCheckTime] = useState(null)
  const [promotedCount, setPromotedCount] = useState(0)
  const [errors, setErrors] = useState([])

  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  /**
   * Check all non-terminal meetings and promote statuses if needed
   */
  const checkAndPromoteMeetings = useCallback(async () => {
    if (!mountedRef.current) return

    setIsChecking(true)
    setErrors([])

    let promoted = 0
    const checkErrors = []

    try {
      // Fetch all meetings except completed and cancelled
      const meetings = await reunioesService.getReunioes({
        status: ['agendada', 'em_preparacao', 'em_andamento'],
        orderBy: 'dataReuniao',
        order: 'asc',
      })

      if (!mountedRef.current) return

      // Build user info for audit trail
      const userInfo = {
        userId: firebaseUser?.uid || user?.uid || user?.id || 'sistema',
        userName: user?.displayName || user?.firstName || 'Sistema Auto-Promocao',
        userEmail: firebaseUser?.email || user?.email || null,
      }

      // Check each meeting and promote if needed
      for (const meeting of meetings) {
        try {
          const currentStatus = meeting.status
          const targetStatus = getTargetStatus(meeting.dataReuniao, currentStatus)

          // No promotion needed
          if (currentStatus === targetStatus) continue

          // Get the promotion path
          const path = getPromotionPath(currentStatus, targetStatus)

          if (path.length === 0) {
            console.warn(
              `[useReunioesStatusCheck] No valid promotion path from ${currentStatus} to ${targetStatus} for meeting ${meeting.id}`
            )
            continue
          }

          // Execute status transitions sequentially
          for (const nextStatus of path) {
            if (!mountedRef.current) return

            const comment = `Auto-promocao baseada na data da reuniao (${
              meeting.dataReuniao instanceof Date
                ? meeting.dataReuniao.toLocaleDateString()
                : new Date(meeting.dataReuniao).toLocaleDateString()
            })`

            await reunioesService.updateStatus(
              meeting.id,
              nextStatus,
              userInfo,
              comment
            )

            promoted++
          }

        } catch (err) {
          console.error(
            `[useReunioesStatusCheck] Failed to promote meeting ${meeting.id}:`,
            err
          )
          checkErrors.push({
            meetingId: meeting.id,
            error: err.message,
          })
        }
      }

    } catch (err) {
      console.error('[useReunioesStatusCheck] Failed to fetch meetings:', err)
      checkErrors.push({
        general: true,
        error: err.message,
      })
    } finally {
      if (mountedRef.current) {
        setPromotedCount(promoted)
        setErrors(checkErrors)
        setLastCheckTime(new Date())
        setIsChecking(false)
      }
    }
  }, [user, firebaseUser])

  /**
   * Run check on mount
   */
  useEffect(() => {
    checkAndPromoteMeetings()
  }, [checkAndPromoteMeetings])

  /**
   * Manual refresh function
   */
  const refresh = useCallback(() => {
    checkAndPromoteMeetings()
  }, [checkAndPromoteMeetings])

  return {
    isChecking,
    lastCheckTime,
    promotedCount,
    errors,
    refresh,
  }
}

export default useReunioesStatusCheck
