/**
 * incidentAccess.js — Política de acesso a Centro de Gestão > Incidentes
 *
 * Regra de negócio (definida em 2026-05-11):
 *   - Apenas administradores PLENOS e usuários explicitamente marcados como
 *     responsáveis por incidentes (incidentSettings.isResponsible) podem
 *     visualizar a aba Incidentes em Centro de Gestão e abrir as páginas
 *     `incidente-gestao` / `denuncia-gestao`.
 *   - Coordenadores comuns NÃO têm acesso automático (precisam ser marcados
 *     como responsáveis para vê-las).
 *
 * Helpers puros aqui — testáveis sem mock de provider.
 */

/**
 * Admin pleno = isAdmin true OU role 'administrador'.
 * Coordenadores (isCoordenador / role='coordenador') NÃO são admin pleno.
 */
export function isFullAdmin(user) {
  if (!user) return false
  if (user.isAdmin === true) return true
  const role = (user.role || '').toLowerCase()
  return role === 'administrador'
}

export function isCoordenador(user) {
  if (!user) return false
  if (user.isCoordenador === true) return true
  const role = (user.role || '').toLowerCase()
  return role === 'coordenador'
}

export function isIncidentResponsible(user) {
  return !!(user && user.incidentSettings && user.incidentSettings.isResponsible === true)
}

/**
 * Acesso à página `centroGestao` (entrada): admin/coord/responsável/perm. especial.
 */
export function canAccessCentroGestao(user) {
  if (!user) return false
  if (isFullAdmin(user) || isCoordenador(user)) return true
  if (isIncidentResponsible(user)) return true
  if (user.permissions && user.permissions['residencia-edit']) return true
  if (user.permissions && user.permissions['tec-enf-secretaria-edit']) return true
  if (user.permissions && user.permissions['staff-absence-private']) return true
  return false
}

/**
 * Acesso à aba Incidentes do Centro de Gestão (qualquer sub-tipo).
 * Admin pleno OU responsável com pelo menos um tipo marcado.
 */
export function canAccessIncidentManagement(user) {
  if (!user) return false
  return isFullAdmin(user) || isIncidentResponsible(user)
}

/**
 * Acesso granular à página `incidente-gestao`.
 * Admin pleno OU responsável com receberIncidentes=true.
 */
export function canAccessIncidenteGestao(user) {
  if (!user) return false
  if (isFullAdmin(user)) return true
  return isIncidentResponsible(user) &&
    !!(user.incidentSettings && user.incidentSettings.receberIncidentes)
}

/**
 * Acesso granular à página `denuncia-gestao`.
 * Admin pleno OU responsável com receberDenuncias=true.
 */
export function canAccessDenunciaGestao(user) {
  if (!user) return false
  if (isFullAdmin(user)) return true
  return isIncidentResponsible(user) &&
    !!(user.incidentSettings && user.incidentSettings.receberDenuncias)
}

/**
 * Lista de seções visíveis no sidebar de Centro de Gestão para um usuário.
 * - Admin pleno → null (significa "mostrar todas")
 * - Coordenador → todas EXCETO incidentes (a menos que seja responsável)
 * - Responsável puro → ['incidentes']
 * - residencia-edit / tec-enf-secretaria-edit → ['residencia'] / ['funcionarios']
 * - Sem nenhuma permissão → [] (lista vazia explícita; NUNCA null nesse caso,
 *   para não cair no fallback "mostrar tudo" do ManagementLayout).
 */
export function getVisibleCentroGestaoSections(user) {
  if (isFullAdmin(user)) return null

  const responsable = isIncidentResponsible(user)

  if (isCoordenador(user)) {
    const coordSections = [
      'usuarios', 'cargos', 'emails', 'auditLog',
      'documentos', 'comunicados',
      'residencia', 'educacao', 'funcionarios',
      'dashboard', 'infraestrutura', 'lgpd', 'indicadores', 'planosAcao',
    ]
    if (responsable) coordSections.push('incidentes')
    return coordSections
  }

  const sections = []
  if (responsable) sections.push('incidentes')
  if (user && user.permissions && user.permissions['residencia-edit']) {
    sections.push('residencia')
  }
  if (user && user.permissions && user.permissions['tec-enf-secretaria-edit']) {
    sections.push('funcionarios')
  }
  if (user && user.permissions && user.permissions['staff-absence-private']) {
    if (!sections.includes('funcionarios')) sections.push('funcionarios')
  }
  return sections
}

/**
 * Quais view modes (incidentes/denuncias) o user pode ver no Painel de Ética.
 * - Admin pleno: ambos.
 * - Demais: estritamente o que está marcado em receberIncidentes / receberDenuncias.
 *   Se nenhum estiver marcado, retorna [] (sem acesso a nenhum tipo).
 */
export function getAllowedIncidentViewModes(user) {
  if (isFullAdmin(user)) return ['incidentes', 'denuncias']
  const modes = []
  if (user && user.incidentSettings && user.incidentSettings.receberIncidentes) {
    modes.push('incidentes')
  }
  if (user && user.incidentSettings && user.incidentSettings.receberDenuncias) {
    modes.push('denuncias')
  }
  return modes
}
