import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, Badge, Select, SearchBar } from '@/design-system'
import { FileText, RefreshCw, ArrowRight } from 'lucide-react'
import supabaseUsersService from '@/services/supabaseUsersService'
import { useUsersManagement } from '@/contexts/UsersManagementContext'
import { NAV_STRUCTURE } from '@/data/rolePermissionTemplates'

/**
 * ACTION_LABELS - Map action codes to human-readable Portuguese labels
 */
const ACTION_LABELS = {
  role_change: 'Alteracao de Cargo',
  admin_toggle: 'Toggle Admin',
  coordenador_toggle: 'Toggle Coordenador',
  permission_update: 'Permissoes Personalizadas',
  user_delete: 'Exclusao de Usuario',
}

/**
 * ACTION_COLORS - Badge color classes per action type
 */
const ACTION_COLORS = {
  role_change: 'bg-blue-500',
  admin_toggle: 'bg-amber-500',
  coordenador_toggle: 'bg-purple-500',
  permission_update: 'bg-teal-500',
  user_delete: 'bg-red-500',
}

/**
 * SPECIAL_PERMISSION_LABELS - Human-readable names for special permission keys
 */
const SPECIAL_PERMISSION_LABELS = {
  'residencia-edit': 'Editar Residencia',
  'tec-enf-secretaria-edit': 'Editar Tec. Enfermagem e Secretarias',
}

/**
 * Build a map of cardId → human-readable label from NAV_STRUCTURE
 */
const CARD_LABEL_MAP = (() => {
  const map = { ...SPECIAL_PERMISSION_LABELS }
  Object.values(NAV_STRUCTURE).forEach((section) => {
    section.cards.forEach((card) => {
      map[card.id] = card.label
    })
  })
  return map
})()

/**
 * Get a human-readable label for a permission key
 */
function getPermLabel(key) {
  return CARD_LABEL_MAP[key] || key
}

/**
 * ROLE_LABELS - Human-readable names for role keys
 */
const ROLE_LABELS = {
  anestesiologista: 'Anestesiologista',
  'medico-residente': 'Medico Residente',
  enfermeiro: 'Enfermeiro',
  'tec-enfermagem': 'Tec. Enfermagem',
  farmaceutico: 'Farmaceutico',
  colaborador: 'Colaborador',
  secretaria: 'Secretaria',
}

/**
 * Format a date string for display
 */
function formatDate(dateString) {
  if (!dateString) return '-'
  const d = new Date(dateString)
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Render old/new value as readable text (for non-permission actions)
 */
function formatValue(val) {
  if (val === null || val === undefined) return '-'
  if (typeof val === 'object') {
    return Object.entries(val)
      .map(([k, v]) => {
        if (k === 'role') return ROLE_LABELS[v] || v
        if (typeof v === 'boolean') return `${v ? 'Sim' : 'Nao'}`
        return String(v)
      })
      .join(', ')
  }
  return String(val)
}

/**
 * Compute the diff between two permission objects.
 * Returns an array of { key, label, from, to } for changed keys only.
 */
function computePermissionDiff(oldPerms, newPerms) {
  if (!oldPerms || !newPerms) return null
  const allKeys = new Set([...Object.keys(oldPerms), ...Object.keys(newPerms)])
  const changes = []
  for (const key of allKeys) {
    const oldVal = oldPerms[key]
    const newVal = newPerms[key]
    if (oldVal !== newVal) {
      changes.push({
        key,
        label: getPermLabel(key),
        from: oldVal,
        to: newVal,
      })
    }
  }
  return changes
}

/**
 * Extract the inner permissions object from an audit value.
 * Audit stores { permissions: {...} } or { customPermissions: {...} }
 */
function extractPermsObject(val) {
  if (!val || typeof val !== 'object') return null
  if (val.permissions && typeof val.permissions === 'object') return val.permissions
  if (val.customPermissions && typeof val.customPermissions === 'object') return val.customPermissions
  return val
}

/**
 * PermissionDiffView - Shows only what changed between two permission objects
 */
function PermissionDiffView({ oldValue, newValue }) {
  const oldPerms = extractPermsObject(oldValue)
  const newPerms = extractPermsObject(newValue)
  const changes = computePermissionDiff(oldPerms, newPerms)

  if (!changes || changes.length === 0) {
    return (
      <p className="text-xs text-[#9CA3AF] dark:text-[#6B8178] italic">
        Nenhuma alteracao detectada
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-[#9CA3AF] dark:text-[#6B8178] mb-1">
        {changes.length} alterac{changes.length === 1 ? 'ao' : 'oes'}:
      </p>
      {changes.map((c) => (
        <div
          key={c.key}
          className="flex items-center gap-1.5 text-xs"
        >
          <span className="font-medium text-black dark:text-white">
            {c.label}
          </span>
          <span className={`px-1.5 py-0.5 rounded ${c.from ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
            {c.from === undefined ? '-' : c.from === true ? 'ON' : c.from === false ? 'OFF' : String(c.from)}
          </span>
          <ArrowRight className="w-3 h-3 text-[#9CA3AF] dark:text-[#6B8178] shrink-0" />
          <span className={`px-1.5 py-0.5 rounded ${c.to ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
            {c.to === undefined ? '-' : c.to === true ? 'ON' : c.to === false ? 'OFF' : String(c.to)}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * AuditLogTab - Displays the permission audit log table
 *
 * Columns: Data, Usuario Alvo, Acao, Alterado Por, Valor Antigo, Valor Novo
 * Filters: text search, action type select
 *
 * Only accessible for admins (parent component handles access control).
 */
function AuditLogTab() {
  const { users } = useUsersManagement()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  // Build a lookup map: id/firebaseUid → user name
  const userNameMap = useMemo(() => {
    const map = {}
    if (users) {
      users.forEach((u) => {
        const name = u.nome || u.email || u.id
        if (u.id) map[u.id] = name
        if (u.firebaseUid) map[u.firebaseUid] = name
      })
    }
    return map
  }, [users])

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const filters = {}
      if (actionFilter) filters.action = actionFilter
      const data = await supabaseUsersService.fetchAuditLog(filters)
      setLogs(data)
    } catch (err) {
      console.error('[AuditLogTab] Failed to load audit log:', err)
    } finally {
      setLoading(false)
    }
  }, [actionFilter])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  // Resolve a UID to user name via the lookup map
  const resolveName = useCallback(
    (uid) => (uid ? userNameMap[uid] || uid : '-'),
    [userNameMap]
  )

  // Text-based filtering on loaded data (search by resolved names too)
  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logs
    const q = searchQuery.toLowerCase()
    return logs.filter(
      (log) =>
        resolveName(log.targetUserId)?.toLowerCase().includes(q) ||
        resolveName(log.changedBy)?.toLowerCase().includes(q) ||
        (ACTION_LABELS[log.action] || log.action)?.toLowerCase().includes(q)
    )
  }, [logs, searchQuery, resolveName])

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-[#C8E6C9] dark:border-[#2A3F36] bg-white dark:bg-[#1A2420] p-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <SearchBar
        value={searchQuery}
        onChange={(val) =>
          setSearchQuery(typeof val === 'string' ? val : val?.target?.value || '')
        }
        placeholder="Buscar por usuario ou acao..."
      />

      {/* Action Filter */}
      <Select
        value={actionFilter || ''}
        onChange={(value) => setActionFilter(value)}
        placeholder="Filtrar por tipo de acao"
        options={[
          { value: '', label: 'Todas as acoes' },
          { value: 'role_change', label: 'Alteracao de Cargo' },
          { value: 'admin_toggle', label: 'Toggle Admin' },
          { value: 'coordenador_toggle', label: 'Toggle Coordenador' },
          { value: 'permission_update', label: 'Permissoes Personalizadas' },
          { value: 'user_delete', label: 'Exclusao de Usuario' },
        ]}
      />

      {/* Counter + Refresh */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#6B7280] dark:text-[#A3B8B0]">
          {filteredLogs.length} registro{filteredLogs.length !== 1 ? 's' : ''} encontrado{filteredLogs.length !== 1 ? 's' : ''}
        </p>
        <button
          type="button"
          onClick={loadLogs}
          className="flex items-center gap-1.5 text-sm text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Log entries */}
      {filteredLogs.length === 0 ? (
        <Card variant="default" className="border-[#C8E6C9] dark:border-[#2A3F36]">
          <CardContent className="p-6 text-center">
            <FileText className="w-12 h-12 mx-auto mb-3 text-[#9CA3AF] dark:text-[#6B8178]" />
            <p className="text-[#6B7280] dark:text-[#A3B8B0]">
              Nenhum registro de auditoria encontrado.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="rounded-xl border border-[#C8E6C9] dark:border-[#2A3F36] bg-white dark:bg-[#1A2420] p-4"
            >
              {/* Row 1: Date + Action badge */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#9CA3AF] dark:text-[#6B8178]">
                  {formatDate(log.createdAt)}
                </span>
                <Badge
                  size="sm"
                  className={`${ACTION_COLORS[log.action] || 'bg-gray-500'} text-white`}
                >
                  {ACTION_LABELS[log.action] || log.action}
                </Badge>
              </div>

              {/* Row 2: Target user + Changed by */}
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <p className="text-xs text-[#9CA3AF] dark:text-[#6B8178] mb-0.5">
                    Usuario Alvo
                  </p>
                  <p className="text-sm font-medium text-black dark:text-white truncate">
                    {resolveName(log.targetUserId)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#9CA3AF] dark:text-[#6B8178] mb-0.5">
                    Alterado Por
                  </p>
                  <p className="text-sm font-medium text-black dark:text-white truncate">
                    {resolveName(log.changedBy)}
                  </p>
                </div>
              </div>

              {/* Row 3: Changes */}
              {log.action === 'permission_update' ? (
                <PermissionDiffView oldValue={log.oldValue} newValue={log.newValue} />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-[#9CA3AF] dark:text-[#6B8178] mb-0.5">
                      Valor Antigo
                    </p>
                    <p className="text-xs text-[#6B7280] dark:text-[#A3B8B0] break-words">
                      {formatValue(log.oldValue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#9CA3AF] dark:text-[#6B8178] mb-0.5">
                      Valor Novo
                    </p>
                    <p className="text-xs text-[#6B7280] dark:text-[#A3B8B0] break-words">
                      {formatValue(log.newValue)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AuditLogTab
