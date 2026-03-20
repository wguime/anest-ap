/**
 * UsersManagementContext - Single Source of Truth para gestao de usuarios
 *
 * Gerencia: profiles, emails autorizados, configuracoes de notificacao de incidentes.
 * Dados carregados do Supabase com real-time subscriptions.
 */
import { createContext, useContext, useReducer, useMemo, useCallback, useEffect, useState } from 'react'
import { ROLES } from '@/utils/userTypes'
import supabaseUsersService from '@/services/supabaseUsersService'
import { profilesToCamelCase } from '@/services/supabaseUsersService'
import { createReliableSubscription } from '@/services/supabaseSubscriptionHelper'
import { supabase } from '@/config/supabase'

const UsersManagementContext = createContext(null)

const initialState = {
  users: [],
  authorizedEmails: [],
  incidentResponsibles: [],
  lgpdSolicitacoes: [],
}

function usersReducer(state, action) {
  switch (action.type) {
    case 'SET_USERS':
      return { ...state, users: action.payload }
    case 'ADD_USER':
      return { ...state, users: [...state.users, action.payload] }
    case 'UPDATE_USER':
      return {
        ...state,
        users: state.users.map((u) =>
          u.id === action.payload.id ? { ...u, ...action.payload } : u
        ),
      }
    case 'DELETE_USER':
      return {
        ...state,
        users: state.users.filter((u) => u.id !== action.payload.id),
      }
    case 'SET_AUTHORIZED_EMAILS':
      return { ...state, authorizedEmails: action.payload }
    case 'ADD_AUTHORIZED_EMAIL':
      return {
        ...state,
        authorizedEmails: [...state.authorizedEmails, action.payload],
      }
    case 'UPDATE_AUTHORIZED_EMAIL':
      return {
        ...state,
        authorizedEmails: state.authorizedEmails.map((e) =>
          e.email === action.payload.email ? { ...e, ...action.payload } : e
        ),
      }
    case 'REMOVE_AUTHORIZED_EMAIL':
      return {
        ...state,
        authorizedEmails: state.authorizedEmails.filter(
          (e) => e.email !== action.payload.email
        ),
      }
    case 'SET_INCIDENT_RESPONSIBLES':
      return { ...state, incidentResponsibles: action.payload }
    case 'UPDATE_INCIDENT_RESPONSIBLE':
      return {
        ...state,
        incidentResponsibles: state.incidentResponsibles.some(
          (r) => r.id === action.payload.id
        )
          ? state.incidentResponsibles.map((r) =>
              r.id === action.payload.id ? { ...r, ...action.payload } : r
            )
          : [...state.incidentResponsibles, action.payload],
      }
    case 'REMOVE_INCIDENT_RESPONSIBLE':
      return {
        ...state,
        incidentResponsibles: state.incidentResponsibles.filter(
          (r) => r.id !== action.payload.id
        ),
      }
    case 'SET_LGPD_SOLICITACOES':
      return { ...state, lgpdSolicitacoes: action.payload }
    case 'ADD_LGPD_SOLICITACAO':
      return {
        ...state,
        lgpdSolicitacoes: [action.payload, ...state.lgpdSolicitacoes],
      }
    case 'UPDATE_LGPD_SOLICITACAO':
      return {
        ...state,
        lgpdSolicitacoes: state.lgpdSolicitacoes.map((s) =>
          s.id === action.payload.id ? { ...s, ...action.payload } : s
        ),
      }
    default:
      return state
  }
}

// Map Supabase channel status to a simplified connection status
function mapChannelStatus(status) {
  if (status === 'SUBSCRIBED') return 'connected'
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') return 'disconnected'
  if (status === 'CLOSED') return 'disconnected'
  // SUBSCRIBING, etc.
  return 'reconnecting'
}

export function UsersManagementProvider({ children }) {
  const [state, dispatch] = useReducer(usersReducer, initialState)
  const [loading, setLoading] = useState(true)
  const [emailsConnectionStatus, setEmailsConnectionStatus] = useState('reconnecting')

  // Load from Supabase on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [users, emails, responsibles] = await Promise.all([
          supabaseUsersService.fetchAllUsers(),
          supabaseUsersService.fetchAuthorizedEmails(),
          supabaseUsersService.fetchIncidentResponsibles(),
        ])
        dispatch({ type: 'SET_USERS', payload: users })
        dispatch({ type: 'SET_AUTHORIZED_EMAILS', payload: emails })
        dispatch({ type: 'SET_INCIDENT_RESPONSIBLES', payload: responsibles })
      } catch (err) {
        console.error('[UsersManagementContext] Failed to load from Supabase:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()

    // Real-time subscription for profiles with retry/reconnection
    const { cleanup: cleanupProfiles } = createReliableSubscription({
      channelName: 'profiles-changes',
      table: 'profiles',
      transformRow: profilesToCamelCase,
      callback: ({ eventType, new: newRow, old: oldRow }) => {
        if (eventType === 'DELETE') {
          if (oldRow) {
            dispatch({ type: 'DELETE_USER', payload: { id: oldRow.id } })
          }
          return
        }
        if (!newRow) return
        if (eventType === 'INSERT') {
          dispatch({ type: 'ADD_USER', payload: newRow })
        } else if (eventType === 'UPDATE') {
          dispatch({ type: 'UPDATE_USER', payload: newRow })
        }
      },
      onRefetch: loadData,
    })

    // Real-time subscription for authorized_emails
    const { cleanup: cleanupEmails } = createReliableSubscription({
      channelName: 'authorized-emails-changes',
      table: 'authorized_emails',
      callback: ({ eventType, new: newRow, old: oldRow }) => {
        if (eventType === 'DELETE') {
          if (oldRow) {
            dispatch({ type: 'REMOVE_AUTHORIZED_EMAIL', payload: { email: oldRow.email } })
          }
          return
        }
        if (!newRow) return
        const mapped = { email: newRow.email, addedAt: newRow.added_at, addedBy: newRow.added_by }
        if (eventType === 'INSERT') {
          dispatch({ type: 'ADD_AUTHORIZED_EMAIL', payload: mapped })
        } else if (eventType === 'UPDATE') {
          dispatch({ type: 'UPDATE_AUTHORIZED_EMAIL', payload: mapped })
        }
      },
      onRefetch: async () => {
        const emails = await supabaseUsersService.fetchAuthorizedEmails()
        dispatch({ type: 'SET_AUTHORIZED_EMAILS', payload: emails })
      },
    }, {
      onStatusChange: (status) => {
        setEmailsConnectionStatus(mapChannelStatus(status))
      },
    })

    // Load LGPD requests
    const loadLgpdSolicitacoes = async () => {
      try {
        const { data } = await supabase.from('lgpd_solicitacoes').select('*').order('created_at', { ascending: false })
        if (data) dispatch({ type: 'SET_LGPD_SOLICITACOES', payload: data })
      } catch (err) {
        console.warn('[UsersManagementContext] Failed to load LGPD solicitacoes:', err)
      }
    }
    loadLgpdSolicitacoes()

    const { cleanup: cleanupLgpd } = createReliableSubscription({
      channelName: 'lgpd-solicitacoes-changes',
      table: 'lgpd_solicitacoes',
      callback: ({ eventType, new: newRow }) => {
        if (!newRow) return
        if (eventType === 'INSERT') {
          dispatch({ type: 'ADD_LGPD_SOLICITACAO', payload: newRow })
        } else if (eventType === 'UPDATE') {
          dispatch({ type: 'UPDATE_LGPD_SOLICITACAO', payload: newRow })
        }
      },
      onRefetch: loadLgpdSolicitacoes,
    })

    // Periodic background refresh as fallback for missed real-time events
    const refreshInterval = setInterval(() => {
      supabaseUsersService.fetchAllUsers().then(users => {
        dispatch({ type: 'SET_USERS', payload: users })
      }).catch(() => {})
    }, 5 * 60 * 1000)

    return () => {
      cleanupProfiles()
      cleanupEmails()
      cleanupLgpd()
      clearInterval(refreshInterval)
    }
  }, [])

  // ── Users ──────────────────────────────────────────────

  const refreshUsers = useCallback(async () => {
    const users = await supabaseUsersService.fetchAllUsers()
    dispatch({ type: 'SET_USERS', payload: users })
    return users
  }, [])

  const addUser = useCallback(async (userData) => {
    const result = await supabaseUsersService.createUser(userData)
    return result
  }, [])

  const updateUser = useCallback(async (id, updates, currentUserId) => {
    const result = await supabaseUsersService.updateUser(id, updates, currentUserId)
    // Optimistic: update local state immediately instead of waiting for real-time subscription
    if (result) {
      dispatch({ type: 'UPDATE_USER', payload: { id, ...updates, ...result } })
    }
    return result
  }, [])

  const deleteUser = useCallback(async (id) => {
    // Optimistic: remove from local state immediately
    dispatch({ type: 'DELETE_USER', payload: { id } })
    try {
      await supabaseUsersService.deleteUser(id)
    } catch (err) {
      // Revert: refetch all users on failure
      const users = await supabaseUsersService.fetchAllUsers()
      dispatch({ type: 'SET_USERS', payload: users })
      throw err
    }
  }, [])

  // ── Authorized Emails ──────────────────────────────────

  const addAuthorizedEmail = useCallback(async (email, addedBy = 'Admin') => {
    // Optimistic: add immediately to state
    const optimisticEntry = { email, addedBy, addedAt: new Date().toISOString() }
    dispatch({ type: 'ADD_AUTHORIZED_EMAIL', payload: optimisticEntry })

    try {
      const result = await supabaseUsersService.addAuthorizedEmail(email, addedBy)
      // Real-time subscription will reconcile the definitive state
      return result
    } catch (err) {
      // Revert optimistic update on failure
      dispatch({ type: 'REMOVE_AUTHORIZED_EMAIL', payload: { email } })
      throw err
    }
  }, [])

  const removeAuthorizedEmail = useCallback(async (email) => {
    // Save a copy for potential revert
    const existingEntry = state.authorizedEmails.find((e) => e.email === email)

    // Optimistic: remove immediately from state
    dispatch({ type: 'REMOVE_AUTHORIZED_EMAIL', payload: { email } })

    try {
      await supabaseUsersService.removeAuthorizedEmail(email)
      // Real-time subscription will confirm the removal
    } catch (err) {
      // Revert optimistic update on failure
      if (existingEntry) {
        dispatch({ type: 'ADD_AUTHORIZED_EMAIL', payload: existingEntry })
      }
      throw err
    }
  }, [state.authorizedEmails])

  // ── Incident Notification Settings ─────────────────────

  const toggleResponsibleSetting = useCallback(async (responsibleId, settingKey) => {
    const updated = await supabaseUsersService.toggleIncidentSetting(responsibleId, settingKey)
    if (updated) {
      dispatch({
        type: 'UPDATE_INCIDENT_RESPONSIBLE',
        payload: { id: responsibleId, ...updated },
      })
    }
  }, [])

  const updateIncidentResponsible = useCallback(
    async (userId, settings) => {
      // If should not receive notifications, remove
      if (!settings.receberIncidentes && !settings.receberDenuncias) {
        await supabaseUsersService.removeIncidentSettings(userId)
        dispatch({ type: 'REMOVE_INCIDENT_RESPONSIBLE', payload: { id: userId } })
        return
      }

      await supabaseUsersService.upsertIncidentSettings(userId, settings)
      // Refresh responsibles list
      const responsibles = await supabaseUsersService.fetchIncidentResponsibles()
      dispatch({ type: 'SET_INCIDENT_RESPONSIBLES', payload: responsibles })
    },
    []
  )

  // ── Computed values ────────────────────────────────────

  const roles = useMemo(
    () =>
      ROLES.map((role) => ({
        id: role.id,
        label: role.name || role.label,
        color: role.color,
      })),
    []
  )

  const activeUserCount = useMemo(
    () => state.users.filter((u) => u.active).length,
    [state.users]
  )

  const lgpdPendingCount = useMemo(
    () => state.lgpdSolicitacoes.filter((s) => s.status === 'pendente').length,
    [state.lgpdSolicitacoes]
  )

  const value = useMemo(
    () => ({
      users: state.users,
      authorizedEmails: state.authorizedEmails,
      incidentResponsibles: state.incidentResponsibles,
      lgpdSolicitacoes: state.lgpdSolicitacoes,
      lgpdPendingCount,
      roles,
      loading,
      activeUserCount,
      // Users
      refreshUsers,
      addUser,
      updateUser,
      deleteUser,
      // Emails
      addAuthorizedEmail,
      removeAuthorizedEmail,
      emailsConnectionStatus,
      // Incident settings
      toggleResponsibleSetting,
      updateIncidentResponsible,
    }),
    [
      state.users,
      state.authorizedEmails,
      state.incidentResponsibles,
      state.lgpdSolicitacoes,
      lgpdPendingCount,
      roles,
      loading,
      activeUserCount,
      refreshUsers,
      addUser,
      updateUser,
      deleteUser,
      addAuthorizedEmail,
      removeAuthorizedEmail,
      emailsConnectionStatus,
      toggleResponsibleSetting,
      updateIncidentResponsible,
    ]
  )

  return (
    <UsersManagementContext.Provider value={value}>
      {children}
    </UsersManagementContext.Provider>
  )
}

const USERS_MANAGEMENT_FALLBACK = {
  users: [],
  authorizedEmails: [],
  incidentResponsibles: [],
  lgpdSolicitacoes: [],
  lgpdPendingCount: 0,
  roles: [],
  loading: true,
  activeUserCount: 0,
  refreshUsers: async () => [],
  addUser: async () => {},
  updateUser: async () => {},
  deleteUser: async () => {},
  addAuthorizedEmail: async () => {},
  removeAuthorizedEmail: async () => {},
  emailsConnectionStatus: 'reconnecting',
  toggleResponsibleSetting: async () => {},
  updateIncidentResponsible: async () => {},
}

export const useUsersManagement = () => {
  const context = useContext(UsersManagementContext)
  if (!context) {
    // Safe fallback while DeferredProviders hasn't mounted yet
    return USERS_MANAGEMENT_FALLBACK
  }
  return context
}

export default UsersManagementContext
