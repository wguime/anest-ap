/**
 * Approval Queue helpers — extracted so ApprovalQueue.jsx only exports React
 * components (react-refresh/only-export-components). Keep this file pure and
 * dependency-free for easy unit testing.
 */

/**
 * Returns true when the current approver is the same person that created the doc.
 * Both author and approver IDs may live under several aliases (createdBy /
 * created_by / createdById, uid / id) so we check each combination.
 *
 * @param {Object|null} doc       Document object (createdBy / created_by / createdById)
 * @param {Object|null} approver  Approver object (uid / id / userId)
 * @returns {boolean}
 */
export function isSelfApproval(doc, approver) {
  if (!doc || !approver) return false
  const authorId = doc.createdBy || doc.created_by || doc.createdById || null
  const approverId = approver.uid || approver.id || approver.userId || null
  if (!authorId || !approverId) return false
  return String(authorId) === String(approverId)
}
