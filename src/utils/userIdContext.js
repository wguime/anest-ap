/**
 * userIdContext — Helpers para extrair Firebase UID do contexto auth.
 *
 * Sprint 1 Wave 1.1 T1.1.5: substitui o anti-pattern
 *   `const userId = user?.uid || user?.id || 'system';`
 * que silenciava bug de audit trail (mutations gravavam `changedBy='system'`
 * quando user não estava carregado, violando regra `.claude/rules/audit-trail.md`).
 *
 * Uso:
 * - `getUserId(user)` — render-time, retorna `null` se user ausente.
 *   Caller deve fazer early return (`if (!userId) return null;`).
 * - `requireUserId(user)` — mutation-time, **throws** se user ausente.
 *   Garante que toda mutation tem audit trail real.
 */

/**
 * Extrai UID do user (Firebase Auth) sem fallback inseguro.
 *
 * @param {object|null|undefined} user - User do AuthContext (UserContext)
 * @returns {string|null} UID se disponível, null caso contrário.
 */
export function getUserId(user) {
  if (!user) return null;
  return user.uid || user.id || null;
}

/**
 * Extrai UID do user, lança erro se ausente.
 *
 * Usar em mutations (insert/update/delete Firestore/Supabase) onde audit trail
 * exige `changedBy` real. Falhar cedo é melhor que gravar `'system'`.
 *
 * @param {object|null|undefined} user - User do AuthContext
 * @param {string} [context] - Descrição opcional da ação (mensagem de erro)
 * @returns {string} UID
 * @throws {Error} se user ausente ou sem uid/id
 */
export function requireUserId(user, context = 'this action') {
  const id = getUserId(user);
  if (!id) {
    throw new Error(`requireUserId: user authentication required for ${context}`);
  }
  return id;
}
