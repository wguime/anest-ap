import * as React from "react"

/**
 * AdminOnly - Componentes de controle de acesso baseado em permissões
 *
 * Migrado do legado: permissions-system.js
 *
 * @example
 * // Mostrar apenas para admins
 * <AdminOnly user={currentUser}>
 *   <DeleteButton />
 * </AdminOnly>
 *
 * // Mostrar apenas se tiver permissão específica
 * <RequirePermission user={currentUser} permission="doc-create">
 *   <AddDocumentButton />
 * </RequirePermission>
 *
 * // Mostrar para roles específicos
 * <RoleGate user={currentUser} roles={['administrador', 'coordenador']}>
 *   <ManagementSection />
 * </RoleGate>
 *
 * // Mostrar apenas para quem pode criar documentos
 * <CanWrite user={currentUser} action="create" category="protocolos">
 *   <UploadButton />
 * </CanWrite>
 */

// Templates de roles - espelhado do legado
const ROLES_TEMPLATES = {
  administrador: { name: "Administrador", adminPanel: true },
  // Coordenador é função adicional (isCoordenador) – não precisa ser role principal
  coordenador: { name: "Coordenador", adminPanel: true },
  anestesiologista: { name: "Anestesiologista", adminPanel: false },
  "medico-residente": { name: "Médico Residente", adminPanel: false },
  enfermeiro: { name: "Enfermeiro", adminPanel: false },
  "tec-enfermagem": { name: "Téc. Enfermagem", adminPanel: false },
  farmaceutico: { name: "Farmacêutico", adminPanel: false },
  colaborador: { name: "Colaborador", adminPanel: false },
  secretaria: { name: "Secretária", adminPanel: false },
}

/**
 * Verifica se o usuário é administrador
 * @param {Object} user - Objeto do usuário com role e permissões
 * @returns {boolean}
 */
export function isAdministrator(user) {
  if (!user) return false
  const role = user.role ? user.role.toLowerCase() : ""
  return (
    user.isAdmin === true ||
    user.isCoordenador === true ||
    role === "administrador" ||
    role === "coordenador" ||
    user.customPermissions?.["admin-panel"] === true
  )
}

/**
 * Verifica se o usuário tem uma permissão específica
 * @param {Object} user - Objeto do usuário
 * @param {string} permissionKey - Chave da permissão (ex: 'doc-create')
 * @returns {boolean}
 */
export function hasPermission(user, permissionKey) {
  if (!user) return false

  // Verificar customPermissions primeiro (override individual)
  if (user.customPermissions?.[permissionKey] !== undefined) {
    return user.customPermissions[permissionKey] === true
  }

  // Verificar cardPermissions
  if (user.cardPermissions?.[permissionKey] !== undefined) {
    return user.cardPermissions[permissionKey] === true
  }

  // Verificar documentWritePermissions
  if (user.documentWritePermissions?.[permissionKey] !== undefined) {
    return user.documentWritePermissions[permissionKey] === true
  }

  // Verificar permissões base do role
  const roleKey = user.role?.toLowerCase()
  const roleTemplate = ROLES_TEMPLATES[roleKey]

  // Admins têm permissões de escrita
  if (roleKey === "administrador" || user.isAdmin === true) {
    if (
      permissionKey === "doc-create" ||
      permissionKey === "doc-edit" ||
      permissionKey === "doc-delete"
    ) {
      return true
    }
  }

  // Verificar admin-panel
  if (permissionKey === "admin-panel") {
    return isAdministrator(user) || roleTemplate?.adminPanel === true
  }

  // Por padrão, permissões de leitura são permitidas
  if (permissionKey.startsWith("doc-") && !permissionKey.includes("create") && !permissionKey.includes("edit") && !permissionKey.includes("delete")) {
    return true
  }

  if (permissionKey.startsWith("rop-") || permissionKey.startsWith("card-")) {
    return true
  }

  return false
}

/**
 * Verifica se o usuário pode criar/editar/deletar documentos
 * @param {Object} user - Objeto do usuário
 * @param {'create' | 'edit' | 'delete'} action - Ação desejada
 * @param {string} [category] - Categoria específica (opcional)
 * @returns {boolean}
 */
export function canWriteDocument(user, action, category) {
  if (!user) return false

  // Verificar permissão geral
  const generalPermission = `doc-${action}`
  if (hasPermission(user, generalPermission)) {
    return true
  }

  // Verificar permissão específica da categoria
  if (category) {
    const categoryPermission = `doc-${action}-${category}`
    if (hasPermission(user, categoryPermission)) {
      return true
    }
  }

  return false
}

/**
 * Verifica se o usuário tem um dos roles especificados
 * @param {Object} user - Objeto do usuário
 * @param {string[]} roles - Array de roles permitidos
 * @returns {boolean}
 */
export function hasRole(user, roles) {
  if (!user || !user.role) return false
  const userRole = user.role.toLowerCase()
  return roles.map((r) => r.toLowerCase()).includes(userRole)
}

// ==================== COMPONENTES ====================

/**
 * AdminOnly - Renderiza children apenas para administradores
 */
function AdminOnly({ user, children, fallback = null }) {
  if (!isAdministrator(user)) {
    return fallback
  }
  return <>{children}</>
}

/**
 * RequirePermission - Renderiza children apenas se tiver permissão específica
 */
function RequirePermission({ user, permission, children, fallback = null }) {
  if (!hasPermission(user, permission)) {
    return fallback
  }
  return <>{children}</>
}

/**
 * RoleGate - Renderiza children apenas para roles específicos
 */
function RoleGate({ user, roles, children, fallback = null }) {
  if (!hasRole(user, roles)) {
    return fallback
  }
  return <>{children}</>
}

/**
 * CanWrite - Renderiza children apenas se puder criar/editar/deletar documentos
 */
function CanWrite({ user, action, category, children, fallback = null }) {
  if (!canWriteDocument(user, action, category)) {
    return fallback
  }
  return <>{children}</>
}

/**
 * CanCreate - Atalho para verificar permissão de criar documentos
 */
function CanCreate({ user, category, children, fallback = null }) {
  return (
    <CanWrite user={user} action="create" category={category} fallback={fallback}>
      {children}
    </CanWrite>
  )
}

/**
 * CanEdit - Atalho para verificar permissão de editar documentos
 */
function CanEdit({ user, category, children, fallback = null }) {
  return (
    <CanWrite user={user} action="edit" category={category} fallback={fallback}>
      {children}
    </CanWrite>
  )
}

/**
 * CanDelete - Atalho para verificar permissão de deletar documentos
 */
function CanDelete({ user, category, children, fallback = null }) {
  return (
    <CanWrite user={user} action="delete" category={category} fallback={fallback}>
      {children}
    </CanWrite>
  )
}

export {
  AdminOnly,
  RequirePermission,
  RoleGate,
  CanWrite,
  CanCreate,
  CanEdit,
  CanDelete,
  ROLES_TEMPLATES,
}

export default AdminOnly
