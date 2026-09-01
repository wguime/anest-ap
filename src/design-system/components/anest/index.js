// Base list items
export { ListItem } from "./list-item"
export { PlantaoListItem } from "./plantao-list-item"
export { FeriasListItem } from "./ferias-list-item"
export { ComunicadoItem } from "./comunicado-item"
export { StaffListItem } from "./staff-list-item"

// Modals
export { EditStaffModal } from "./edit-staff-modal"
export { AssignStaffModal } from "./assign-staff-modal"

// Cards
export { ActionPill, ACTION_PILL_CLASSES } from "./action-pill"
export { SectionCard } from "./section-card"
export { ComunicadosCard } from "./comunicados-card"
export { PlantaoCard } from "./plantao-card"
export { FeriasCard } from "./ferias-card"
export { ComunicadoCard } from "./comunicado-card"
export { ROPProgressCard } from "./rop-progress-card"
export { KPICard, statusConfig, accentColors } from "./kpi-card"
export { CalculadoraCard } from "./calculadora-card"
export { StaffScheduleCard } from "./staff-schedule-card"
export { EducacaoSummaryCard } from "./educacao-summary-card"

// KPI Data Management
export { KPIDataProvider, useKPIData, defaultKPIs } from "./kpi-data-context"
export { KPIEditor, KPIEditorCompact } from "./kpi-editor"

// Error Handling
export { ErrorBoundary } from "./ErrorBoundary"

// Navigation & Layout
export { Header } from "./header"
export { SearchBar } from "./search-bar"
export { BottomNav } from "./bottom-nav"
export { QuickLinksGrid } from "./quick-links-grid"
export { NotificationBell } from "./notification-bell"
export { BackButton } from "./back-button"
export { SearchToggleButton } from "./search-toggle-button"
export { FilterChips } from "./filter-chips"
export { ClinicalDisclaimer } from "./clinical-disclaimer"
export { WarningCallout, warningCalloutVariants } from "./warning-callout"
export { ConfirmationPage } from "./confirmation-page"
export { BreadcrumbEducacao } from "./breadcrumb-educacao"
export { StreakRing } from "./streak-ring"
export { AutoSaveIndicator } from "./auto-save-indicator"

// Permission Controls
export {
  AdminOnly,
  RequirePermission,
  RoleGate,
  CanWrite,
  CanCreate,
  CanEdit,
  CanDelete,
  isAdministrator,
  hasPermission,
  canWriteDocument,
  hasRole,
  ROLES_TEMPLATES,
} from "./admin-only"

// Admin Buttons
export {
  AddButton,
  AddDocumentButton,
  EditButton,
  DeleteButton,
  UploadButton,
  SettingsButton,
  AddUserButton,
  AdminActionBar,
} from "./admin-buttons"

// Clinical Calculators
export {
  ScoreTracker,
  ScoreTrackerMini,
  riskLevelConfig,
} from "./score-tracker"

export {
  RiskFactorCard,
  RiskFactorGroup,
  severityConfig,
} from "./risk-factor-card"

// Loading States (Skeletons)
// NOTE: `Skeleton` itself is intentionally NOT re-exported here to avoid
// namespace collision with the pre-existing variant-rich `Skeleton` exported
// from `components/ui/skeleton`. Consumers wanting the simple ANEST primitive
// can import it directly: `@/design-system/components/anest/skeleton`.
export {
  SkeletonCard,
  SkeletonRow,
  SkeletonText,
  SkeletonAvatar,
} from "./skeleton"


