/**
 * supabaseSubscriptionHelper - Reliable Supabase real-time subscriptions
 * with automatic retry/reconnection and exponential backoff.
 */
import { supabase } from '@/config/supabase'

const DEFAULT_OPTIONS = {
  maxRetries: 20,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  onStatusChange: null,
  onReconnect: null,
}

/**
 * Creates a Supabase real-time subscription with retry/reconnection logic.
 *
 * @param {Object} config
 * @param {string} config.channelName - Unique channel name
 * @param {string} config.table - Postgres table to subscribe to
 * @param {string} [config.schema='public'] - Postgres schema
 * @param {string} [config.event='*'] - Event filter: '*', 'INSERT', 'UPDATE', 'DELETE'
 * @param {Function} config.callback - Called with { eventType, new, old } on changes
 * @param {Function} [config.transformRow] - Optional row transformer (e.g. toCamelCase)
 * @param {Function} [config.onRefetch] - Called on reconnection to re-fetch full data
 * @param {Object} [options] - Override default options
 * @returns {{ cleanup: Function }} - Call cleanup() to tear down the subscription
 */
export function createReliableSubscription(config, options = {}) {
  const {
    channelName,
    table,
    schema = 'public',
    event = '*',
    callback,
    transformRow,
    onRefetch,
  } = config

  const opts = { ...DEFAULT_OPTIONS, ...options }

  let channel = null
  let retryCount = 0
  let retryTimer = null
  let destroyed = false

  function getBackoffDelay() {
    const delay = Math.min(
      opts.initialDelayMs * Math.pow(2, retryCount),
      opts.maxDelayMs
    )
    return delay
  }

  function subscribe() {
    if (destroyed) return

    // Clean up any existing channel before creating a new one
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }

    const channelId = retryCount > 0
      ? `${channelName}-retry-${retryCount}`
      : channelName

    channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event, schema, table },
        (payload) => {
          if (destroyed) return
          const newRow = payload.new && transformRow
            ? transformRow(payload.new)
            : payload.new || null
          const oldRow = payload.old && transformRow
            ? transformRow(payload.old)
            : payload.old || null

          callback({
            eventType: payload.eventType,
            new: newRow,
            old: oldRow,
          })
        }
      )
      .subscribe((status) => {
        if (destroyed) return

        if (opts.onStatusChange) {
          opts.onStatusChange(status)
        }

        if (status === 'SUBSCRIBED') {
          if (retryCount > 0) {
            retryCount = 0
            if (onRefetch) {
              onRefetch()
            }
            if (opts.onReconnect) {
              opts.onReconnect()
            }
          }
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[ReliableSubscription] ${channelName}: ${status}, scheduling retry...`)
          scheduleRetry()
        }
      })
  }

  function scheduleRetry() {
    if (destroyed) return
    if (retryCount >= opts.maxRetries) {
      console.error(`[ReliableSubscription] ${channelName}: max retries (${opts.maxRetries}) exceeded`)
      return
    }

    const delay = getBackoffDelay()
    retryCount++

    retryTimer = setTimeout(() => {
      if (!destroyed) {
        subscribe()
      }
    }, delay)
  }

  function cleanup() {
    destroyed = true
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
  }

  // Start initial subscription
  subscribe()

  return { cleanup }
}

export default createReliableSubscription
