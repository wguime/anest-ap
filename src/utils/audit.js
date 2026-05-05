/**
 * Audit utilities — ensure mutations have a real user identifier.
 *
 * Per project rule `.claude/rules/audit-trail.md`:
 *   "changedBy SEMPRE userId real (Firebase UID) — nunca 'admin' / 'system' hardcoded"
 *
 * The previous codebase silently fell back to literal strings ('sistema', 'Sistema',
 * 'admin') when the auth context wasn't propagated. This corrupted the audit trail
 * and violated the RLS contract on `documento_changelog` (cl_insert: user_id = firebase_uid()).
 *
 * Use {@link requireUserId} at every mutation boundary. It throws a typed error if
 * userId is missing, forcing the caller to surface the issue (toast, retry,
 * re-auth) rather than silently writing a forged audit entry.
 */

export class MissingUserIdError extends Error {
  constructor(context = 'audit') {
    super(
      `[${context}] User ID is required for audit trail. ` +
      `Caller must pass userInfo with a real Firebase UID. ` +
      `Never use 'sistema'/'admin' fallbacks (rule: audit-trail.md).`
    );
    this.name = 'MissingUserIdError';
  }
}

/**
 * Validates and normalizes a userInfo object. Returns `{ userId, userName, userEmail }`
 * or throws `MissingUserIdError` if userId is absent or contains a forbidden literal.
 *
 * @param {object} userInfo
 * @param {string} [userInfo.userId] - Firebase UID (preferred)
 * @param {string} [userInfo.uid] - Alias for userId
 * @param {string} [userInfo.userName]
 * @param {string} [userInfo.displayName] - Alias for userName
 * @param {string} [userInfo.userEmail]
 * @param {string} [userInfo.email] - Alias for userEmail
 * @param {string} [context] - Free-text label for the call site (improves error message)
 * @returns {{userId: string, userName: string, userEmail: string|null}}
 */
export function requireUserId(userInfo, context = 'mutation') {
  const userId = userInfo?.userId || userInfo?.uid;
  if (!userId) {
    throw new MissingUserIdError(context);
  }
  // Reject the legacy fallback literals — defense in depth.
  if (userId === 'sistema' || userId === 'system' || userId === 'admin') {
    throw new MissingUserIdError(`${context}: forbidden literal "${userId}"`);
  }
  return {
    userId,
    userName: userInfo?.userName || userInfo?.displayName || 'Usuário',
    userEmail: userInfo?.userEmail || userInfo?.email || null,
  };
}

/**
 * Non-throwing variant — returns null if userId is missing.
 * Use only in non-critical paths (e.g., view tracking) where missing audit
 * is preferable to surfacing an error to the user. Document the reason with
 * a comment at every call site.
 */
export function tryRequireUserId(userInfo, context = 'mutation') {
  try {
    return requireUserId(userInfo, context);
  } catch {
    return null;
  }
}
