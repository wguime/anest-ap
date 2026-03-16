/**
 * useActivityTracking - Hook for tracking user activity and presence
 *
 * Provides:
 * - Real-time presence tracking (online users via Supabase Realtime)
 * - Session duration tracking with visibility-aware timer
 * - Page view, document view, and feature use event tracking
 * - Historical aggregated data (login history, top pages, DAU, peak hours, etc.)
 *
 * All events are persisted to Supabase (user_activity_log table).
 * Session end is sent reliably via fetch keepalive on pagehide.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, getSupabaseToken } from '@/config/supabase'
import { useUser } from '@/contexts/UserContext'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_UPDATE_INTERVAL = 30_000 // 30 seconds
const HISTORICAL_REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes

// ---------------------------------------------------------------------------
// Module-level singleton for Supabase Realtime presence channel
// Prevents duplicate channels when multiple components call useActivityTracking()
// ---------------------------------------------------------------------------

let _presenceChannel = null
let _presenceRefCount = 0
let _presenceListeners = new Set() // callbacks to notify on sync

const PAGE_LABELS = {
  home: 'Home',
  dashboardExecutivo: 'Dashboard Executivo',
  auditoriasInterativas: 'Auditorias Interativas',
  autoavaliacao: 'Autoavaliacao ROPs',
  gestaoDocumental: 'Documentos Gestao',
  gestao: 'Gestao Qualidade',
  incidentes: 'Incidentes',
  comunicados: 'Comunicados',
  planosAcao: 'Planos de Acao',
  kpiDashboard: 'KPI Dashboard',
  educacao: 'Educacao',
  qualidade: 'Qualidade',
  permissions: 'Centro de Gestao',
  centroGestao: 'Centro de Gestao',
  biblioteca: 'Biblioteca',
  residencia: 'Residencia',
  profile: 'Perfil',
  menuPage: 'Menu',
}

const FEATURE_LABELS = {
  'quiz-rop': 'Quiz ROPs',
  'calculadora-morse': 'Calculadora Morse',
  'nova-auditoria': 'Nova Auditoria',
  'novo-incidente': 'Novo Incidente',
  'nova-denuncia': 'Nova Denuncia',
  'novo-plano': 'Novo Plano de Acao',
  'kpi-data-entry': 'Entrada Dados KPI',
  'exportar-relatorio': 'Exportar Relatorio',
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useActivityTracking() {
  const { user, firebaseUser, isAuthenticated } = useUser()

  // Derive stable user identity
  const userId = firebaseUser?.uid || user?.uid || user?.id || null
  const userName = user?.displayName || user?.firstName || 'Usuario'
  const userRole = user?.role || 'colaborador'

  // ---- State ----
  const [onlineUsersCount, setOnlineUsersCount] = useState(0)
  const [onlineUsersList, setOnlineUsersList] = useState([])
  const [sessionDuration, setSessionDuration] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Historical aggregated data
  const [loginHistory, setLoginHistory] = useState([])
  const [topPages, setTopPages] = useState([])
  const [topDocuments, setTopDocuments] = useState([])
  const [topFeatures, setTopFeatures] = useState([])
  const [dailyActiveUsers, setDailyActiveUsers] = useState([])
  const [avgSessionDuration, setAvgSessionDuration] = useState(0)
  const [peakHours, setPeakHours] = useState([])
  const [loginsToday, setLoginsToday] = useState(0)
  const [docsOpenedToday, setDocsOpenedToday] = useState(0)

  // ---- Refs ----
  const sessionStartRef = useRef(Date.now())
  const pausedAtRef = useRef(null)
  const accumulatedRef = useRef(0) // total ms while page was visible
  const lastTrackedPageRef = useRef(null)
  const channelRef = useRef(null)
  const sessionIntervalRef = useRef(null)
  const historicalIntervalRef = useRef(null)
  const accessTokenRef = useRef(null) // cached for pagehide fetch

  // =========================================================================
  // 0. Keep access token ref in sync for pagehide fetch
  // =========================================================================

  useEffect(() => {
    if (!isAuthenticated) return
    // Read current token immediately (custom accessToken flow — no supabase.auth.getSession)
    getSupabaseToken().then((token) => {
      accessTokenRef.current = token || null
    })
    // Refresh token periodically (every 5 min) since we can't listen to auth state changes
    const interval = setInterval(() => {
      getSupabaseToken().then((token) => {
        accessTokenRef.current = token || null
      })
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [isAuthenticated])

  // =========================================================================
  // 1. Session duration tracking
  // =========================================================================

  useEffect(() => {
    if (!isAuthenticated) return

    sessionStartRef.current = Date.now()
    accumulatedRef.current = 0
    pausedAtRef.current = null

    function handleVisibilityChange() {
      if (document.hidden) {
        // Page became hidden: accumulate elapsed time and pause
        if (pausedAtRef.current === null) {
          accumulatedRef.current += Date.now() - sessionStartRef.current
          pausedAtRef.current = Date.now()
        }
      } else {
        // Page became visible: resume timer
        sessionStartRef.current = Date.now()
        pausedAtRef.current = null
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Update sessionDuration state every 30 seconds
    sessionIntervalRef.current = setInterval(() => {
      let totalMs = accumulatedRef.current
      if (pausedAtRef.current === null) {
        // Currently visible: add live elapsed
        totalMs += Date.now() - sessionStartRef.current
      }
      setSessionDuration(Math.floor(totalMs / 1000))
    }, SESSION_UPDATE_INTERVAL)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (sessionIntervalRef.current) {
        clearInterval(sessionIntervalRef.current)
        sessionIntervalRef.current = null
      }
    }
  }, [isAuthenticated])

  // =========================================================================
  // 2. Presence tracking (Supabase Realtime) — singleton channel
  // =========================================================================

  useEffect(() => {
    if (!isAuthenticated || !userId) return

    // Parse presence state into user list
    function parsePresenceState(channel) {
      const state = channel.presenceState()
      const users = []
      const now = Date.now()

      Object.entries(state).forEach(([_key, presences]) => {
        if (presences && presences.length > 0) {
          const p = presences[0]
          const onlineSince = p.onlineSince || now
          users.push({
            userId: p.userId || _key,
            name: p.name || 'Usuario',
            role: p.role || 'colaborador',
            onlineSince,
            duration: Math.floor((now - onlineSince) / 1000),
          })
        }
      })
      return users
    }

    // Listener callback for this hook instance
    function onSync(users) {
      setOnlineUsersCount(users.length)
      setOnlineUsersList(users)
    }

    _presenceListeners.add(onSync)
    _presenceRefCount++

    if (!_presenceChannel) {
      // First subscriber: create and subscribe the channel
      const channel = supabase.channel('online-users', {
        config: { presence: { key: userId } },
      })

      channel.on('presence', { event: 'sync' }, () => {
        const users = parsePresenceState(channel)
        _presenceListeners.forEach((cb) => cb(users))
      })

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId,
            name: userName,
            role: userRole,
            onlineSince: Date.now(),
          })
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[useActivityTracking] Presence channel failed:', status)
        }
      })

      _presenceChannel = channel
    } else {
      // Channel already exists: read current state immediately
      const users = parsePresenceState(_presenceChannel)
      onSync(users)
    }

    channelRef.current = _presenceChannel

    return () => {
      _presenceListeners.delete(onSync)
      _presenceRefCount--

      if (_presenceRefCount <= 0) {
        // Last subscriber: tear down the channel
        if (_presenceChannel) {
          _presenceChannel.untrack().catch(() => {})
          supabase.removeChannel(_presenceChannel)
          _presenceChannel = null
        }
        _presenceRefCount = 0
      }
      channelRef.current = null
    }
  }, [isAuthenticated, userId, userName, userRole])

  // =========================================================================
  // 3. Event tracking functions
  // =========================================================================

  /**
   * Circuit breaker: stop calling user_activity_log after first 404/PGRST205
   * (table does not exist). Resets on page reload.
   */
  const tableDisabledRef = useRef(false)

  /**
   * Save an activity event to Supabase.
   */
  const saveEvent = useCallback(
    async (eventType, eventData) => {
      if (!userId) return
      if (tableDisabledRef.current) return // circuit breaker: table doesn't exist

      const event = {
        user_id: userId,
        event_type: eventType,
        event_data: eventData,
      }

      // Supabase JS client returns { data, error } — does NOT throw.
      const { error } = await supabase.from('user_activity_log').insert(event)
      if (error) {
        // Table not found → activate circuit breaker to stop all future calls
        if (error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('does not exist')) {
          tableDisabledRef.current = true
          return
        }
        console.warn('[useActivityTracking] Failed to save event:', error.message)
      }
    },
    [userId]
  )

  /**
   * Track a page view. Skips duplicate consecutive views of the same page.
   */
  const trackPageView = useCallback(
    (pageName) => {
      if (!pageName || pageName === lastTrackedPageRef.current) return
      lastTrackedPageRef.current = pageName
      saveEvent('page_view', {
        page: pageName,
        label: PAGE_LABELS[pageName] || pageName,
      })
    },
    [saveEvent]
  )

  /**
   * Track a document view.
   */
  const trackDocumentView = useCallback(
    (docId, title, category) => {
      if (!docId) return
      saveEvent('document_view', { docId, title, category })
    },
    [saveEvent]
  )

  /**
   * Track a feature use.
   */
  const trackFeatureUse = useCallback(
    (featureId) => {
      if (!featureId) return
      saveEvent('feature_use', {
        featureId,
        label: FEATURE_LABELS[featureId] || featureId,
      })
    },
    [saveEvent]
  )

  // =========================================================================
  // 4. Historical data fetching / generation
  // =========================================================================

  const fetchHistoricalData = useCallback(async () => {
    if (tableDisabledRef.current) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)

    try {
      const today = new Date().toISOString().split('T')[0]
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString()

      // Fetch all events from the last 30 days
      const { data: events, error } = await supabase
        .from('user_activity_log')
        .select('*')
        .gte('created_at', thirtyDaysAgoStr)
        .order('created_at', { ascending: false })
        .limit(5000)

      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('does not exist')) {
          tableDisabledRef.current = true
        }
        setIsLoading(false)
        return
      }

      const allEvents = events || []

      // ---- Login History ----
      const loginEvents = allEvents.filter((e) => e.event_type === 'login')
      const computedLoginHistory = loginEvents.slice(0, 50).map((e) => ({
        userId: e.user_id,
        name: e.event_data?.name || 'Usuario',
        date: e.created_at,
        sessionDuration: e.event_data?.sessionDuration || 0,
      }))
      setLoginHistory(computedLoginHistory)

      // ---- Top Pages ----
      const pageViewEvents = allEvents.filter((e) => e.event_type === 'page_view')
      const pageCounts = {}
      pageViewEvents.forEach((e) => {
        const page = e.event_data?.page || 'unknown'
        pageCounts[page] = (pageCounts[page] || 0) + 1
      })
      const computedTopPages = Object.entries(pageCounts)
        .map(([page, views]) => ({
          page,
          label: PAGE_LABELS[page] || page,
          views,
        }))
        .sort((a, b) => b.views - a.views)
      setTopPages(computedTopPages)

      // ---- Top Documents ----
      const docViewEvents = allEvents.filter((e) => e.event_type === 'document_view')
      const docCounts = {}
      const docTitles = {}
      docViewEvents.forEach((e) => {
        const docId = e.event_data?.docId || 'unknown'
        docCounts[docId] = (docCounts[docId] || 0) + 1
        if (e.event_data?.title) {
          docTitles[docId] = e.event_data.title
        }
      })
      const computedTopDocs = Object.entries(docCounts)
        .map(([docId, views]) => ({
          docId,
          title: docTitles[docId] || docId,
          views,
        }))
        .sort((a, b) => b.views - a.views)
      setTopDocuments(computedTopDocs)

      // ---- Top Features ----
      const featureEvents = allEvents.filter((e) => e.event_type === 'feature_use')
      const featureCounts = {}
      featureEvents.forEach((e) => {
        const fId = e.event_data?.featureId || 'unknown'
        featureCounts[fId] = (featureCounts[fId] || 0) + 1
      })
      const computedTopFeatures = Object.entries(featureCounts)
        .map(([featureId, uses]) => ({
          featureId,
          label: FEATURE_LABELS[featureId] || featureId,
          uses,
        }))
        .sort((a, b) => b.uses - a.uses)
      setTopFeatures(computedTopFeatures)

      // ---- Daily Active Users ----
      const dauMap = {}
      allEvents.forEach((e) => {
        const date = (e.created_at || '').split('T')[0]
        if (!date) return
        if (!dauMap[date]) dauMap[date] = new Set()
        dauMap[date].add(e.user_id)
      })
      const computedDAU = Object.entries(dauMap)
        .map(([date, userSet]) => ({ date, count: userSet.size }))
        .sort((a, b) => a.date.localeCompare(b.date))
      setDailyActiveUsers(computedDAU)

      // ---- Average Session Duration ----
      const sessionEndEvents = allEvents.filter((e) => e.event_type === 'session_end')
      if (sessionEndEvents.length > 0) {
        const totalDuration = sessionEndEvents.reduce(
          (sum, e) => sum + (e.event_data?.duration || 0),
          0
        )
        setAvgSessionDuration(Math.floor(totalDuration / sessionEndEvents.length))
      } else if (loginEvents.length > 0) {
        const totalDuration = loginEvents.reduce(
          (sum, e) => sum + (e.event_data?.sessionDuration || 0),
          0
        )
        setAvgSessionDuration(Math.floor(totalDuration / loginEvents.length))
      } else {
        setAvgSessionDuration(0)
      }

      // ---- Peak Hours ----
      const hourCounts = new Array(24).fill(0)
      allEvents.forEach((e) => {
        if (e.created_at) {
          const hour = new Date(e.created_at).getHours()
          hourCounts[hour]++
        }
      })
      setPeakHours(hourCounts.map((count, hour) => ({ hour, count })))

      // ---- Logins Today ----
      const todayLoginCount = loginEvents.filter(
        (e) => (e.created_at || '').startsWith(today)
      ).length
      setLoginsToday(todayLoginCount)

      // ---- Docs Opened Today ----
      const todayDocCount = docViewEvents.filter(
        (e) => (e.created_at || '').startsWith(today)
      ).length
      setDocsOpenedToday(todayDocCount)
    } catch (err) {
      console.warn('[useActivityTracking] Error fetching historical data:', err.message || err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // =========================================================================
  // 5. Fetch historical data on mount + refresh every 5 minutes
  // =========================================================================

  useEffect(() => {
    if (!isAuthenticated) return

    fetchHistoricalData()

    historicalIntervalRef.current = setInterval(
      fetchHistoricalData,
      HISTORICAL_REFRESH_INTERVAL
    )

    return () => {
      if (historicalIntervalRef.current) {
        clearInterval(historicalIntervalRef.current)
        historicalIntervalRef.current = null
      }
    }
  }, [isAuthenticated, fetchHistoricalData])

  // =========================================================================
  // 6. Log login event on mount
  // =========================================================================

  useEffect(() => {
    if (!isAuthenticated || !userId) return

    // Only track login once per browser session to avoid duplicate login events
    // on every hook mount (e.g., page navigation).
    const loginKey = 'anest_login_tracked'
    if (!sessionStorage.getItem(loginKey)) {
      sessionStorage.setItem(loginKey, 'true')
      saveEvent('login', {
        name: userName,
        role: userRole,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userId])

  // =========================================================================
  // 6b. Reliable session_end via pagehide + sendBeacon
  // =========================================================================

  useEffect(() => {
    if (!isAuthenticated || !userId) return

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    const handlePageHide = () => {
      let totalMs = accumulatedRef.current
      if (pausedAtRef.current === null) {
        totalMs += Date.now() - sessionStartRef.current
      }
      const durationSecs = Math.floor(totalMs / 1000)

      const endEvent = {
        user_id: userId,
        event_type: 'session_end',
        event_data: { duration: durationSecs },
      }

      // Use sendBeacon for reliable delivery during page unload
      if (supabaseUrl && supabaseAnonKey && !tableDisabledRef.current) {
        try {
          const payload = JSON.stringify(endEvent)
          const blob = new Blob([payload], { type: 'application/json' })
          const token = accessTokenRef.current
          const headers = {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            'Prefer': 'return=minimal',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          }
          // sendBeacon does not support custom headers, so use fetch with keepalive
          fetch(`${supabaseUrl}/rest/v1/user_activity_log`, {
            method: 'POST',
            headers,
            body: payload,
            keepalive: true,
          }).catch(() => {})
        } catch {
          // Best-effort, ignore errors during page unload
        }
      }
    }

    window.addEventListener('pagehide', handlePageHide)
    return () => window.removeEventListener('pagehide', handlePageHide)
  }, [isAuthenticated, userId])

  // =========================================================================
  // 7. Admin access tracking
  // =========================================================================

  /**
   * Track when an admin enters Centro de Gestao.
   * Should be called once on mount by the CentroGestaoPage (or similar).
   */
  const trackAdminAccess = useCallback(() => {
    saveEvent('admin_login', {
      name: userName,
      role: userRole,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    })
  }, [saveEvent, userName, userRole])

  // =========================================================================
  // Return
  // =========================================================================

  return {
    // Real-time presence
    onlineUsersCount,
    onlineUsersList,

    // Current session
    sessionDuration,

    // Tracking functions
    trackPageView,
    trackDocumentView,
    trackFeatureUse,
    trackAdminAccess,

    // Historical aggregated data
    loginHistory,
    topPages,
    topDocuments,
    topFeatures,
    dailyActiveUsers,
    avgSessionDuration,
    peakHours,
    loginsToday,
    docsOpenedToday,

    // State
    isLoading,
  }
}

export default useActivityTracking
