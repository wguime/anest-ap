/**
 * useInfraStatus Hook
 * Probes infrastructure status of Firebase and Supabase services for the
 * ANEST v2.0 admin dashboard. Performs direct service checks (not app contexts)
 * to give admins a real-time view of backend health.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/config/supabase'
import { auth, db } from '@/config/firebase'
import { collection, getCountFromServer } from 'firebase/firestore'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIRESTORE_COLLECTIONS = [
  'userProfiles',
  'educacao_trilhas',
  'educacao_cursos',
  'educacao_aulas',
  'residencia',
  'staff',
  'trocas_plantao',
]

const SUPABASE_TABLES = [
  'documentos',
  'incidentes',
  'comunicados',
  'planos_acao',
  'auditoria_execucoes',
  'autoavaliacao_rop',
  'kpi_dados_mensais',
  'lgpd_solicitacoes',
]

const SYNC_MAP = [
  { module: 'Auth', backend: 'Firebase', collection: null },
  { module: 'User Profiles', backend: 'Firebase', collection: 'userProfiles' },
  { module: 'Educacao', backend: 'Firebase', collection: 'educacao_trilhas' },
  { module: 'Residencia', backend: 'Firebase', collection: 'residencia' },
  { module: 'Staff', backend: 'Firebase', collection: 'staff' },
  { module: 'Trocas Plantao', backend: 'Firebase', collection: 'trocas_plantao' },
  { module: 'Documentos', backend: 'Supabase', table: 'documentos' },
  { module: 'Incidentes', backend: 'Supabase', table: 'incidentes' },
  { module: 'Comunicados', backend: 'Supabase', table: 'comunicados' },
  { module: 'KPIs', backend: 'Supabase', table: 'kpi_dados_mensais' },
  { module: 'Auditorias', backend: 'Supabase', table: 'auditoria_execucoes' },
  { module: 'Autoavaliacao', backend: 'Supabase', table: 'autoavaliacao_rop' },
  { module: 'Planos de Acao', backend: 'Supabase', table: 'planos_acao' },
  { module: 'LGPD', backend: 'Supabase', table: 'lgpd_solicitacoes' },
]

// ---------------------------------------------------------------------------
// Initial state helpers
// ---------------------------------------------------------------------------

/** Wraps a promise with a timeout — resolves to fallback if the promise hangs */
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

const PROBE_TIMEOUT_MS = 4000

function buildInitialFirestoreCollections() {
  return FIRESTORE_COLLECTIONS.map((name) => ({
    name,
    count: 0,
    status: 'checking',
  }))
}

function buildInitialSupabaseTables() {
  return SUPABASE_TABLES.map((name) => ({
    name,
    count: 0,
    status: 'checking',
    isMocked: false,
  }))
}

function buildInitialSyncStatus() {
  return SYNC_MAP.map((entry) => ({
    module: entry.module,
    backend: entry.backend,
    status: 'checking',
  }))
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useInfraStatus() {
  const [isLoading, setIsLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState(null)

  // Firebase Auth
  const [firebaseAuth, setFirebaseAuth] = useState({
    connected: false,
    currentUser: null,
    totalUsers: null,
  })

  // Firestore collections
  const [firestoreCollections, setFirestoreCollections] = useState(
    buildInitialFirestoreCollections
  )

  // Supabase connection
  const [supabaseStatus, setSupabaseStatus] = useState({
    connected: false,
    latencyMs: null,
    error: null,
  })

  // Supabase tables
  const [supabaseTables, setSupabaseTables] = useState(
    buildInitialSupabaseTables
  )

  // Sync status
  const [syncStatus, setSyncStatus] = useState(buildInitialSyncStatus)

  // Guard against state updates after unmount
  const mountedRef = useRef(true)
  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  // -------------------------------------------------------------------
  // Probe functions
  // -------------------------------------------------------------------

  /** 1. Firebase Auth probe */
  const probeFirebaseAuth = useCallback(async () => {
    try {
      const currentUser = auth.currentUser
      const connected = !!currentUser

      // Try to get total user count from userProfiles collection
      let totalUsers = null
      try {
        const snap = await getCountFromServer(collection(db, 'userProfiles'))
        totalUsers = snap.data().count
      } catch (_e) {
        // Non-critical: we may not have permission or the collection may be empty
      }

      return {
        connected,
        currentUser: currentUser
          ? { uid: currentUser.uid.slice(0, 4) + '***', email: currentUser.email }
          : null,
        totalUsers,
      }
    } catch (err) {
      console.error('[useInfraStatus] Firebase Auth probe failed')
      return { connected: false, currentUser: null, totalUsers: null }
    }
  }, [])

  /** 2. Firestore collections probe */
  const probeFirestoreCollections = useCallback(async () => {
    const promises = FIRESTORE_COLLECTIONS.map(async (name) => {
      try {
        const snap = await getCountFromServer(collection(db, name))
        return { name, count: snap.data().count, status: 'live' }
      } catch (err) {
        console.warn(`[useInfraStatus] Firestore "${name}" probe failed`)
        return { name, count: 0, status: 'error' }
      }
    })

    const results = await Promise.allSettled(promises)
    return results.map((r) =>
      r.status === 'fulfilled'
        ? r.value
        : { name: 'unknown', count: 0, status: 'error' }
    )
  }, [])

  /** 3. Supabase connection probe (with latency measurement) */
  const probeSupabaseConnection = useCallback(async () => {
    try {
      const start = performance.now()
      const { count, error } = await supabase
        .from('documentos')
        .select('id', { count: 'exact', head: true })
      const latencyMs = Math.round(performance.now() - start)

      if (error) {
        return { connected: false, latencyMs, error: error.message }
      }
      return { connected: true, latencyMs, error: null }
    } catch (err) {
      console.error('[useInfraStatus] Supabase connection probe failed')
      return { connected: false, latencyMs: null, error: err.message }
    }
  }, [])

  /** 4. Supabase tables probe */
  const probeSupabaseTables = useCallback(async () => {
    const promises = SUPABASE_TABLES.map(async (name) => {
      try {
        const { count, error } = await supabase
          .from(name)
          .select('id', { count: 'exact', head: true })

        if (error) {
          console.warn(`[useInfraStatus] Supabase "${name}" probe failed`)
          return { name, count: 0, status: 'error', isMocked: false }
        }
        return { name, count: count ?? 0, status: 'live', isMocked: false }
      } catch (err) {
        console.warn(`[useInfraStatus] Supabase "${name}" probe failed`)
        return { name, count: 0, status: 'error', isMocked: false }
      }
    })

    const results = await Promise.allSettled(promises)
    return results.map((r) =>
      r.status === 'fulfilled'
        ? r.value
        : { name: 'unknown', count: 0, status: 'error', isMocked: false }
    )
  }, [])

  /** 5. Derive sync status from probe results */
  const deriveSyncStatus = useCallback(
    (authResult, firestoreResults, supabaseConn, supabaseResults) => {
      return SYNC_MAP.map((entry) => {
        if (entry.backend === 'Firebase') {
          // Auth module has no collection
          if (entry.collection === null) {
            return {
              module: entry.module,
              backend: entry.backend,
              status: authResult.connected ? 'live' : 'error',
            }
          }
          // Find matching Firestore collection result
          const col = firestoreResults.find((c) => c.name === entry.collection)
          return {
            module: entry.module,
            backend: entry.backend,
            status: col ? col.status : 'error',
          }
        }

        // Supabase module
        if (entry.backend === 'Supabase') {
          if (!supabaseConn.connected) {
            return {
              module: entry.module,
              backend: entry.backend,
              status: 'error',
            }
          }

          const tbl = supabaseResults.find((t) => t.name === entry.table)
          return {
            module: entry.module,
            backend: entry.backend,
            status: tbl && tbl.status === 'live' ? 'live' : 'error',
          }
        }

        return { module: entry.module, backend: entry.backend, status: 'error' }
      })
    },
    []
  )

  // -------------------------------------------------------------------
  // Health check persistence & cleanup (Gap 5.1 / 5.2)
  // -------------------------------------------------------------------

  /** Save a summary row into infra_health_history */
  const saveHealthCheck = useCallback(async (authResult, supaConn, syncResults) => {
    try {
      const modulesLive = syncResults.filter(s => s.status === 'live').length
      await supabase.from('infra_health_history').insert({
        firebase_status: authResult.connected ? 'connected' : 'disconnected',
        supabase_status: supaConn.connected ? 'connected' : 'disconnected',
        supabase_latency_ms: supaConn.latencyMs,
        modules_live: modulesLive,
        modules_total: syncResults.length,
        checked_by: auth.currentUser?.uid || 'system',
      })
    } catch (err) {
      console.warn('[useInfraStatus] Failed to save health check:', err.message)
    }
  }, [])

  /** Delete health-check records older than 90 days */
  const cleanupOldHealthChecks = useCallback(async () => {
    try {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 90)
      await supabase
        .from('infra_health_history')
        .delete()
        .lt('checked_at', cutoff.toISOString())
    } catch (err) {
      console.warn('[useInfraStatus] Cleanup failed:', err.message)
    }
  }, [])

  // -------------------------------------------------------------------
  // Run all probes
  // -------------------------------------------------------------------

  const runProbes = useCallback(async () => {
    if (!mountedRef.current) return

    setIsLoading(true)

    // Reset to 'checking' state
    setFirestoreCollections(buildInitialFirestoreCollections())
    setSupabaseTables(buildInitialSupabaseTables())
    setSyncStatus(buildInitialSyncStatus())

    // Default fallbacks for when probes fail or timeout
    const fallbackAuth = { connected: false, currentUser: null, totalUsers: null }
    const fallbackFirestore = buildInitialFirestoreCollections().map(
      (c) => ({ ...c, status: 'error' })
    )
    const fallbackSupaConn = { connected: false, latencyMs: null, error: 'Probe timeout' }
    const fallbackSupaTables = buildInitialSupabaseTables().map(
      (t) => ({ ...t, status: 'error' })
    )

    let safeAuth = fallbackAuth
    let safeFirestore = fallbackFirestore
    let safeSupaConn = fallbackSupaConn
    let safeSupaTables = fallbackSupaTables

    try {
      // Run all probes in parallel with per-probe timeout
      const [authResult, firestoreResults, supabaseConn, supabaseResults] =
        await Promise.all([
          withTimeout(probeFirebaseAuth(), PROBE_TIMEOUT_MS, null),
          withTimeout(probeFirestoreCollections(), PROBE_TIMEOUT_MS, null),
          withTimeout(probeSupabaseConnection(), PROBE_TIMEOUT_MS, null),
          withTimeout(probeSupabaseTables(), PROBE_TIMEOUT_MS, null),
        ])

      if (!mountedRef.current) return

      safeAuth = authResult || fallbackAuth
      safeFirestore = firestoreResults || fallbackFirestore
      safeSupaConn = supabaseConn || fallbackSupaConn
      safeSupaTables = supabaseResults || fallbackSupaTables
    } catch (err) {
      console.error('[useInfraStatus] Unexpected error during probes')
    }

    if (!mountedRef.current) return

    // Always derive sync status — even on error, show error badges not '...'
    const sync = deriveSyncStatus(safeAuth, safeFirestore, safeSupaConn, safeSupaTables)

    setFirebaseAuth(safeAuth)
    setFirestoreCollections(safeFirestore)
    setSupabaseStatus(safeSupaConn)
    setSupabaseTables(safeSupaTables)
    setSyncStatus(sync)
    setLastChecked(new Date())
    setIsLoading(false)

    // Persist health check & clean old records (fire-and-forget)
    saveHealthCheck(safeAuth, safeSupaConn, sync)
    cleanupOldHealthChecks()
  }, [
    probeFirebaseAuth,
    probeFirestoreCollections,
    probeSupabaseConnection,
    probeSupabaseTables,
    deriveSyncStatus,
    saveHealthCheck,
    cleanupOldHealthChecks,
  ])

  // -------------------------------------------------------------------
  // Run on mount
  // -------------------------------------------------------------------

  useEffect(() => {
    runProbes()
  }, [runProbes])

  // -------------------------------------------------------------------
  // Computed summary
  // -------------------------------------------------------------------

  const totalFirestoreRecords = firestoreCollections.reduce(
    (sum, c) => sum + (c.count || 0),
    0
  )
  const totalSupabaseRecords = supabaseTables.reduce(
    (sum, t) => sum + (t.count || 0),
    0
  )
  const modulesLive = syncStatus.filter((s) => s.status === 'live').length
  const modulesMocked = syncStatus.filter((s) => s.status === 'mock').length
  const modulesError = syncStatus.filter((s) => s.status === 'error').length

  // -------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------

  return {
    isLoading,
    lastChecked,
    refresh: runProbes,
    firebaseAuth,
    firestoreCollections,
    supabaseStatus,
    supabaseTables,
    syncStatus,
    summary: {
      totalFirestoreRecords,
      totalSupabaseRecords,
      modulesLive,
      modulesMocked,
      modulesError,
    },
  }
}

export default useInfraStatus
