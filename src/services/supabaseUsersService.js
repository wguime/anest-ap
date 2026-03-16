/**
 * Supabase Users Service — Gestao de Perfis, Emails Autorizados e Notificacoes de Incidentes
 *
 * CRUD completo para Centro de Gestao UsersTab, EmailsTab e IncidentsLayout.
 * Converte bidirecionalmente camelCase <-> snake_case para manter
 * compatibilidade total com hooks e componentes existentes.
 *
 * Segue o mesmo padrao de supabaseIncidentsService.js.
 */
import { supabase } from '@/config/supabase'

// ============================================================================
// FIELD MAPPING — camelCase <-> snake_case
// ============================================================================

const CAMEL_TO_SNAKE = {
  isAdmin: 'is_admin',
  isCoordenador: 'is_coordenador',
  customPermissions: 'custom_permissions',
  lastAccess: 'last_access',
  accessCount: 'access_count',
  documentsAccessed: 'documents_accessed',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
}

const SNAKE_TO_CAMEL = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([k, v]) => [v, k])
)

function toSnakeCase(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = CAMEL_TO_SNAKE[key] || key
    result[snakeKey] = value
  }
  return result
}

function toCamelCase(row) {
  if (!row || typeof row !== 'object') return row
  if (Array.isArray(row)) return row.map(toCamelCase)
  const result = {}
  for (const [key, value] of Object.entries(row)) {
    const camelKey = SNAKE_TO_CAMEL[key] || key
    result[camelKey] = value
  }
  return result
}

// ============================================================================
// INCIDENT NOTIFICATION FIELD MAPPING
// ============================================================================

const NOTIF_CAMEL_TO_SNAKE = {
  userId: 'user_id',
  receberIncidentes: 'receber_incidentes',
  receberDenuncias: 'receber_denuncias',
  notificarEmail: 'notificar_email',
  notificarApp: 'notificar_app',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
}

const NOTIF_SNAKE_TO_CAMEL = Object.fromEntries(
  Object.entries(NOTIF_CAMEL_TO_SNAKE).map(([k, v]) => [v, k])
)

function notifToSnakeCase(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = NOTIF_CAMEL_TO_SNAKE[key] || key
    result[snakeKey] = value
  }
  return result
}

function notifToCamelCase(row) {
  if (!row || typeof row !== 'object') return row
  if (Array.isArray(row)) return row.map(notifToCamelCase)
  const result = {}
  for (const [key, value] of Object.entries(row)) {
    const camelKey = NOTIF_SNAKE_TO_CAMEL[key] || key
    result[camelKey] = value
  }
  return result
}

// ============================================================================
// HELPERS
// ============================================================================

function handleError(error, context) {
  console.error(`[SupabaseUsersService] ${context}:`, error)
  // Provide more actionable error messages
  let msg = error.message || 'Erro desconhecido'
  if (error.code === 'PGRST116') {
    msg = 'Perfil nao encontrado ou sem permissao para atualizar (RLS). Verifique se voce esta logado como admin.'
  } else if (error.code === '42501' || msg.includes('permission denied')) {
    msg = 'Permissao negada pelo banco de dados. Verifique o token de autenticacao.'
  } else if (error.code === 'PGRST301' || msg.includes('JWT')) {
    msg = 'Token de autenticacao invalido ou expirado. Faca logout e login novamente.'
  }
  throw new Error(`${context}: ${msg}`)
}

async function logPermissionChange(targetUserId, changedBy, action, oldValue, newValue) {
  // Supabase JS client returns { data, error } — does NOT throw.
  // Must check the error return value explicitly.
  const { error } = await supabase.from('permission_audit_log').insert({
    target_user_id: targetUserId,
    changed_by: changedBy,
    action,
    old_value: oldValue,
    new_value: newValue,
  })
  if (error) {
    // Non-critical: don't fail the operation if audit log fails
    console.warn('[SupabaseUsersService] Audit log failed:', error.message, error.code)
  }
}

// ============================================================================
// PROFILES — LEITURA
// ============================================================================

async function fetchAllUsers(options = {}) {
  const { role, active, search, limit = 1000 } = options

  let query = supabase
    .from('profiles')
    .select('*')
    .order('nome', { ascending: true })
    .limit(limit)

  if (role) {
    query = query.eq('role', role)
  }
  if (typeof active === 'boolean') {
    query = query.eq('active', active)
  }
  if (search) {
    query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) handleError(error, 'fetchAllUsers')
  return (data || []).map(toCamelCase)
}

async function fetchUserById(id) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error) handleError(error, 'fetchUserById')
  return toCamelCase(data)
}

async function fetchUserByEmail(email) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single()

  if (error) handleError(error, 'fetchUserByEmail')
  return toCamelCase(data)
}

async function fetchActiveUserCount() {
  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)

  if (error) handleError(error, 'fetchActiveUserCount')
  return count || 0
}

async function fetchActiveUserCountByRoles(roles) {
  if (!roles || roles.length === 0) {
    return fetchActiveUserCount()
  }
  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)
    .in('role', roles)

  if (error) handleError(error, 'fetchActiveUserCountByRoles')
  return count || 0
}

// ============================================================================
// PROFILES — ESCRITA
// ============================================================================

async function createUser(userData) {
  const row = toSnakeCase(userData)
  delete row.created_at
  delete row.updated_at

  const { data, error } = await supabase
    .from('profiles')
    .insert(row)
    .select()
    .single()

  if (error) handleError(error, 'createUser')
  return toCamelCase(data)
}

async function updateUser(id, updates, currentUserId) {
  const snakeUpdates = toSnakeCase(updates)
  delete snakeUpdates.id
  delete snakeUpdates.created_at
  delete snakeUpdates.updated_by // not a real column — only used for audit context
  snakeUpdates.updated_at = new Date().toISOString()

  console.debug('[SupabaseUsersService] updateUser:', id, 'fields:', Object.keys(snakeUpdates))

  // Fetch old values for audit log if sensitive fields changed
  const sensitiveFields = ['role', 'is_admin', 'is_coordenador', 'custom_permissions', 'permissions']
  const hasSensitiveChange = sensitiveFields.some(f => f in snakeUpdates)
  let oldProfile = null
  if (hasSensitiveChange) {
    const { data: oldData, error: oldErr } = await supabase.from('profiles').select('role, is_admin, is_coordenador, custom_permissions, permissions').eq('id', id).single()
    if (oldErr) {
      console.warn('[SupabaseUsersService] Pre-read for audit failed (non-critical):', oldErr.message)
    } else {
      oldProfile = oldData
    }
  }

  // Log permissions being sent
  if ('permissions' in snakeUpdates) {
    const disabledSent = Object.entries(snakeUpdates.permissions || {}).filter(([, v]) => v === false).map(([k]) => k)
    console.info('[SupabaseUsersService] updateUser sending permissions:', id, {
      totalKeys: Object.keys(snakeUpdates.permissions || {}).length,
      disabled: disabledSent,
    })
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(snakeUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) handleError(error, `updateUser(${id})`)

  // Verify returned data matches what was sent
  if ('permissions' in snakeUpdates && data?.permissions) {
    const disabledSent = Object.entries(snakeUpdates.permissions).filter(([, v]) => v === false).map(([k]) => k)
    const disabledReturned = Object.entries(data.permissions).filter(([, v]) => v === false).map(([k]) => k)
    console.info('[SupabaseUsersService] updateUser OK:', id, {
      permKeysSent: Object.keys(snakeUpdates.permissions).length,
      permKeysReturned: Object.keys(data.permissions).length,
      disabledSent,
      disabledReturned,
      match: disabledSent.length === disabledReturned.length,
    })
    if (disabledSent.length > 0 && disabledReturned.length === 0) {
      console.error('[SupabaseUsersService] CRITICAL MISMATCH: sent disabled cards but returned ALL enabled!', { id, sent: snakeUpdates.permissions, returned: data.permissions })
    }
  } else {
    console.info('[SupabaseUsersService] updateUser OK:', id, 'permissions:', data?.permissions ? Object.keys(data.permissions).length + ' keys' : 'none')
  }

  // Log audit entry for sensitive changes
  if (hasSensitiveChange && oldProfile) {
    const changedBy = currentUserId || 'admin'
    if ('role' in snakeUpdates && snakeUpdates.role !== oldProfile.role) {
      logPermissionChange(id, changedBy, 'role_change', { role: oldProfile.role }, { role: snakeUpdates.role })
    }
    if ('is_admin' in snakeUpdates && snakeUpdates.is_admin !== oldProfile.is_admin) {
      logPermissionChange(id, changedBy, 'admin_toggle', { isAdmin: oldProfile.is_admin }, { isAdmin: snakeUpdates.is_admin })
    }
    if ('is_coordenador' in snakeUpdates && snakeUpdates.is_coordenador !== oldProfile.is_coordenador) {
      logPermissionChange(id, changedBy, 'coordenador_toggle', { isCoordenador: oldProfile.is_coordenador }, { isCoordenador: snakeUpdates.is_coordenador })
    }
    if ('custom_permissions' in snakeUpdates && JSON.stringify(snakeUpdates.custom_permissions) !== JSON.stringify(oldProfile?.custom_permissions)) {
      logPermissionChange(id, changedBy, 'permission_update',
        { customPermissions: oldProfile?.custom_permissions },
        { customPermissions: snakeUpdates.custom_permissions })
    }
    if ('permissions' in snakeUpdates && JSON.stringify(snakeUpdates.permissions) !== JSON.stringify(oldProfile?.permissions)) {
      logPermissionChange(id, changedBy, 'permission_update',
        { permissions: oldProfile?.permissions },
        { permissions: snakeUpdates.permissions })
    }
  }

  return toCamelCase(data)
}

async function deleteUser(id) {
  // Log before deletion
  logPermissionChange(id, 'admin', 'user_delete', { id }, null)
  const { error } = await supabase.from('profiles').delete().eq('id', id)
  if (error) handleError(error, 'deleteUser')
  return true
}

async function recordAccess(userId) {
  const { error } = await supabase.rpc('increment_access_count', {
    p_user_id: userId,
  })

  // Fallback: if RPC doesn't exist, fetch current value then increment
  if (error) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('access_count')
      .eq('id', userId)
      .single()

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        last_access: new Date().toISOString(),
        access_count: (profile?.access_count || 0) + 1,
      })
      .eq('id', userId)

    if (updateError) {
      console.warn('[SupabaseUsersService] recordAccess fallback failed:', updateError)
    }
  }
}

// ============================================================================
// AUTHORIZED EMAILS
// ============================================================================

async function fetchAuthorizedEmails() {
  const { data, error } = await supabase
    .from('authorized_emails')
    .select('*')
    .order('added_at', { ascending: false })

  if (error) handleError(error, 'fetchAuthorizedEmails')
  return (data || []).map((row) => ({
    email: row.email,
    addedAt: row.added_at,
    addedBy: row.added_by,
  }))
}

async function addAuthorizedEmail(email, addedBy) {
  const { data, error } = await supabase
    .from('authorized_emails')
    .insert({ email, added_by: addedBy })
    .select()
    .single()

  if (error) handleError(error, 'addAuthorizedEmail')
  return { email: data.email, addedAt: data.added_at, addedBy: data.added_by }
}

async function removeAuthorizedEmail(email) {
  const { error } = await supabase
    .from('authorized_emails')
    .delete()
    .eq('email', email)

  if (error) handleError(error, 'removeAuthorizedEmail')
  return true
}

// ============================================================================
// INCIDENT NOTIFICATION SETTINGS
// ============================================================================

async function fetchIncidentResponsibles() {
  // Join notification settings with profile data
  const { data, error } = await supabase
    .from('incident_notification_settings')
    .select(`
      user_id,
      receber_incidentes,
      receber_denuncias,
      categorias,
      notificar_email,
      notificar_app,
      profiles!inner (
        id,
        nome,
        email,
        role,
        is_admin,
        is_coordenador
      )
    `)
    .or('receber_incidentes.eq.true,receber_denuncias.eq.true')

  if (error) handleError(error, 'fetchIncidentResponsibles')

  return (data || []).map((row) => ({
    id: row.user_id,
    nome: row.profiles.nome,
    email: row.profiles.email,
    role: row.profiles.role,
    isAdmin: row.profiles.is_admin,
    isCoordenador: row.profiles.is_coordenador,
    receberIncidentes: row.receber_incidentes,
    receberDenuncias: row.receber_denuncias,
    categorias: row.categorias || [],
    notificarEmail: row.notificar_email,
    notificarApp: row.notificar_app,
  }))
}

async function upsertIncidentSettings(userId, settings) {
  const row = {
    user_id: userId,
    receber_incidentes: settings.receberIncidentes ?? false,
    receber_denuncias: settings.receberDenuncias ?? false,
    categorias: settings.categorias || [],
    notificar_email: settings.notificarEmail ?? true,
    notificar_app: settings.notificarApp ?? true,
  }

  const { data, error } = await supabase
    .from('incident_notification_settings')
    .upsert(row, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) handleError(error, 'upsertIncidentSettings')
  return notifToCamelCase(data)
}

async function toggleIncidentSetting(userId, settingKey) {
  const snakeKey = NOTIF_CAMEL_TO_SNAKE[settingKey] || settingKey

  // Fetch current value (maybeSingle to avoid crash when no record exists)
  const { data: current, error: fetchErr } = await supabase
    .from('incident_notification_settings')
    .select(snakeKey)
    .eq('user_id', userId)
    .maybeSingle()

  if (fetchErr) handleError(fetchErr, 'toggleIncidentSetting:fetch')

  if (!current) {
    // No record exists — create one with the setting ON
    const { data, error } = await supabase
      .from('incident_notification_settings')
      .upsert({ user_id: userId, [snakeKey]: true }, { onConflict: 'user_id' })
      .select()
      .single()
    if (error) handleError(error, 'toggleIncidentSetting:upsert')
    return notifToCamelCase(data)
  }

  // Record exists — toggle the value
  const newValue = !current[snakeKey]

  const { data, error } = await supabase
    .from('incident_notification_settings')
    .update({ [snakeKey]: newValue, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select()
    .single()

  if (error) handleError(error, 'toggleIncidentSetting:update')
  return notifToCamelCase(data)
}

async function removeIncidentSettings(userId) {
  const { error } = await supabase
    .from('incident_notification_settings')
    .delete()
    .eq('user_id', userId)

  if (error) handleError(error, 'removeIncidentSettings')
  return true
}

// ============================================================================
// AUDIT LOG
// ============================================================================

async function fetchAuditLog(filters = {}) {
  const { targetUserId, action, startDate, endDate } = filters

  let query = supabase
    .from('permission_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (targetUserId) {
    query = query.eq('target_user_id', targetUserId)
  }
  if (action) {
    query = query.eq('action', action)
  }
  if (startDate) {
    query = query.gte('created_at', startDate)
  }
  if (endDate) {
    query = query.lte('created_at', endDate)
  }

  const { data, error } = await query
  if (error) handleError(error, 'fetchAuditLog')

  return (data || []).map((row) => ({
    id: row.id,
    targetUserId: row.target_user_id,
    changedBy: row.changed_by,
    action: row.action,
    oldValue: row.old_value,
    newValue: row.new_value,
    createdAt: row.created_at,
  }))
}

// ============================================================================
// REAL-TIME
// ============================================================================

function subscribeToProfiles(callback) {
  const channel = supabase
    .channel('profiles-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profiles' },
      (payload) => {
        callback({
          eventType: payload.eventType,
          new: payload.new ? toCamelCase(payload.new) : null,
          old: payload.old ? toCamelCase(payload.old) : null,
        })
      }
    )
    .subscribe()

  return channel
}

function unsubscribe(channel) {
  if (channel) {
    supabase.removeChannel(channel)
  }
}

// ============================================================================
// EXPORT
// ============================================================================

const supabaseUsersService = {
  // Profiles
  fetchAllUsers,
  fetchUserById,
  fetchUserByEmail,
  fetchActiveUserCount,
  fetchActiveUserCountByRoles,
  createUser,
  updateUser,
  deleteUser,
  recordAccess,
  // Authorized emails
  fetchAuthorizedEmails,
  addAuthorizedEmail,
  removeAuthorizedEmail,
  // Incident notification settings
  fetchIncidentResponsibles,
  upsertIncidentSettings,
  toggleIncidentSetting,
  removeIncidentSettings,
  // Audit log
  fetchAuditLog,
  // Real-time
  subscribeToProfiles,
  unsubscribe,
}

export { toCamelCase as profilesToCamelCase }

export default supabaseUsersService
