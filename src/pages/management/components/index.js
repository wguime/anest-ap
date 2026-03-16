/**
 * Management Module - Reusable Components
 *
 * This module exports common UI components used across the management section.
 */

export { default as FilterBar } from './FilterBar'
export { default as StatsCard } from './StatsCard'
export { default as DocumentCard } from './DocumentCard'
export { default as PermissionsModal } from './PermissionsModal'
export { default as NewDocumentModal } from './NewDocumentModal'
export { default as AuditTrailModal } from './AuditTrailModal'
export { default as ChangeLogTimeline } from './ChangeLogTimeline'

// Also export as named exports for convenience
import FilterBar from './FilterBar'
import StatsCard from './StatsCard'
import DocumentCard from './DocumentCard'
import PermissionsModal from './PermissionsModal'
import NewDocumentModal from './NewDocumentModal'
import AuditTrailModal from './AuditTrailModal'
import ChangeLogTimeline from './ChangeLogTimeline'

export default {
  FilterBar,
  StatsCard,
  DocumentCard,
  PermissionsModal,
  NewDocumentModal,
  AuditTrailModal,
  ChangeLogTimeline,
}
