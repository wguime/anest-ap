// Centro de Gestao (Management Center) Module Exports
// New modular architecture for the PermissionsPage refactoring

// Main page component
export { default as CentroGestaoPage } from './CentroGestaoPage'

// Layout components
export { default as ManagementLayout } from './ManagementLayout'

// Section components
export { default as UsersTab } from './users/UsersTab'
export { default as EmailsTab } from './emails/EmailsTab'
export { default as DocumentsLayout } from './documents/DocumentsLayout'
export { default as StatsTab } from './stats/StatsTab'
export { default as DashboardGestaoTab } from './stats/DashboardGestaoTab'
export { default as InfraStatusTab } from './infra/InfraStatusTab'
export { default as IncidentsLayout } from './incidents/IncidentsLayout'
export { default as ResidencyTab } from './residency/ResidencyTab'

// Comunicados monitoring
export { default as ComunicadosMonitorTab } from './comunicados/ComunicadosMonitorTab'

// Reusable components
export { FilterBar, StatsCard, DocumentCard, PermissionsModal } from './components'
