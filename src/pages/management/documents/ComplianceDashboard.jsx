import { useMemo } from 'react'
import { useComplianceMetrics } from '@/hooks/useComplianceMetrics'
import { Card, CardContent, Badge } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import {
  Shield,
  AlertTriangle,
  Clock,
  FileText,
  CheckCircle,
  Activity,
} from 'lucide-react'
import { CATEGORY_LABELS } from '@/types/documents'
import { usePdfExport } from '@/hooks/usePdfExport'
import ExportButton from '@/components/ExportButton'

/**
 * Action labels mapping (pt-BR)
 */
const ACTION_LABELS = {
  created: 'Documento criado',
  status_changed: 'Status alterado',
  updated: 'Documento atualizado',
  version_added: 'Nova versao adicionada',
  approved: 'Documento aprovado',
  rejected: 'Documento rejeitado',
  archived: 'Documento arquivado',
  restored: 'Documento restaurado',
}

/**
 * Returns a score-based color class set for backgrounds and text
 * Green >= 80, Amber >= 50, Red otherwise
 */
function getScoreColor(score) {
  if (score >= 80) return { bg: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500', ring: 'ring-emerald-500/20' }
  if (score >= 50) return { bg: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500', ring: 'ring-amber-500/20' }
  return { bg: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bar: 'bg-red-500', ring: 'ring-red-500/20' }
}

/**
 * Formats a timestamp into a relative time string in Portuguese
 */
function formatRelativeTime(timestamp) {
  if (!timestamp) return ''

  const now = new Date()
  const date = new Date(timestamp)
  const diffMs = now - date
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return 'Agora mesmo'
  if (diffMinutes < 60) return `${diffMinutes} min atras`
  if (diffHours < 24) return `${diffHours}h atras`
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return `${diffDays} dias atras`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} sem atras`
  return `${Math.floor(diffDays / 30)} mes(es) atras`
}

/**
 * Calculates how many days a document is overdue
 */
function calcDaysOverdue(proximaRevisao) {
  if (!proximaRevisao) return 0
  const now = new Date()
  const reviewDate = new Date(proximaRevisao)
  const diffMs = now - reviewDate
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

/**
 * Loading spinner component
 */
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <div
          className={cn(
            'w-10 h-10 rounded-full border-4',
            'border-[#C8E6C9] border-t-[#006837]',
            'dark:border-[#2A3F36] dark:border-t-[#2ECC71]',
            'animate-spin'
          )}
        />
        <p className="text-sm text-muted-foreground">
          Carregando metricas de compliance...
        </p>
      </div>
    </div>
  )
}

/**
 * StatCard - Individual stat card for the 2x2 grid
 */
function StatCard({ icon: Icon, label, value, variant, subtitle }) {
  const variantStyles = {
    score: {
      iconBg: 'bg-[#E8F5E9] dark:bg-[#243530]',
      iconColor: 'text-[#006837] dark:text-[#2ECC71]',
    },
    danger: {
      iconBg: 'bg-red-50 dark:bg-red-950/30',
      iconColor: 'text-red-600 dark:text-red-400',
    },
    warning: {
      iconBg: 'bg-amber-50 dark:bg-amber-950/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    success: {
      iconBg: 'bg-[#E8F5E9] dark:bg-[#243530]',
      iconColor: 'text-[#006837] dark:text-[#2ECC71]',
    },
  }

  const style = variantStyles[variant] || variantStyles.score

  return (
    <Card
      className={cn(
        'rounded-2xl border-[#C8E6C9] dark:border-[#2A3F36]',
        'bg-white dark:bg-[#1A2420]'
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
              style.iconBg
            )}
          >
            <Icon className={cn('w-5 h-5', style.iconColor)} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground font-medium truncate">
              {label}
            </p>
            <p className="text-2xl font-bold text-foreground mt-0.5">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * CategoryComplianceBar - Horizontal bar for a single category
 */
function CategoryComplianceBar({ item }) {
  const colors = getScoreColor(item.score)

  return (
    <div className="flex items-center gap-3">
      <div className="w-28 flex-shrink-0">
        <p className="text-sm font-medium text-foreground truncate">
          {item.label}
        </p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="h-3 rounded-full bg-[#E8F5E9] dark:bg-[#243530] overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', colors.bar)}
            style={{ width: `${item.score}%` }}
          />
        </div>
      </div>
      <div className="w-12 flex-shrink-0 text-right">
        <span className={cn('text-sm font-bold', colors.text)}>
          {item.score}%
        </span>
      </div>
    </div>
  )
}

/**
 * ComplianceDashboard - Qmentum compliance overview
 *
 * Displays:
 * - 4 stat cards (compliance score, overdue, pending, active)
 * - Category compliance bars
 * - Overdue documents list
 * - Recent activity log
 */
function ComplianceDashboard() {
  const {
    complianceScore,
    isFullyCompliant,
    totalDocuments,
    activeCount,
    overdueCount,
    pendingCount,
    upcomingCount,
    categoryCompliance,
    overdueDocuments,
    upcomingReviews,
    recentChanges,
    isReady,
    qmentumScore,
    reviewComplianceRate,
    documentCoverage,
    lgpdMetrics,
  } = useComplianceMetrics()

  const { exportPdf, exporting } = usePdfExport()

  const handleExportPdf = () => {
    exportPdf('complianceReport', {
      complianceScore,
      qmentumScore,
      totalDocuments,
      activeCount,
      overdueCount,
      pendingCount,
      upcomingCount,
      categoryCompliance,
      overdueDocuments,
      documentCoverage,
      reviewComplianceRate,
    }, {
      filename: `ANEST_Compliance_${new Date().toISOString().slice(0, 10)}.pdf`,
    })
  }

  // Determine score color for the main compliance card
  const scoreColors = useMemo(() => getScoreColor(qmentumScore), [qmentumScore])

  if (!isReady) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-5">
      {/* Export Button */}
      <div className="flex justify-end">
        <ExportButton
          onExport={handleExportPdf}
          loading={exporting}
          label="Exportar PDF"
          size="sm"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section A: 4 Stats Cards (2x2 grid)                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 gap-3">
        {/* Compliance Score (Qmentum weighted) */}
        <StatCard
          icon={Shield}
          label="Qmentum Score"
          value={`${qmentumScore}%`}
          variant="score"
          subtitle={
            isFullyCompliant
              ? 'Em total conformidade'
              : `${totalDocuments} documentos no total`
          }
        />

        {/* Docs Vencidos */}
        <StatCard
          icon={AlertTriangle}
          label="Docs Vencidos"
          value={overdueCount}
          variant="danger"
          subtitle={
            overdueCount === 0
              ? 'Nenhum documento vencido'
              : 'Necessitam revisao imediata'
          }
        />

        {/* Pendentes Aprovacao */}
        <StatCard
          icon={Clock}
          label="Pendentes Aprovacao"
          value={pendingCount}
          variant="warning"
          subtitle={
            pendingCount === 0
              ? 'Nenhum pendente'
              : 'Aguardando aprovacao'
          }
        />

        {/* Docs Ativos */}
        <StatCard
          icon={FileText}
          label="Docs Ativos"
          value={activeCount}
          variant="success"
          subtitle={
            upcomingCount > 0
              ? `${upcomingCount} revisao(oes) proxima(s)`
              : 'Todos em dia'
          }
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section B: Compliance por Categoria                                */}
      {/* ------------------------------------------------------------------ */}
      <Card
        className={cn(
          'rounded-2xl border-[#C8E6C9] dark:border-[#2A3F36]',
          'bg-white dark:bg-[#1A2420]'
        )}
      >
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
            <h3 className="text-sm font-bold text-foreground">
              Compliance por Categoria
            </h3>
          </div>

          <div className="space-y-3">
            {categoryCompliance.map((item) => (
              <CategoryComplianceBar key={item.category} item={item} />
            ))}
          </div>

          {categoryCompliance.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma categoria encontrada.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Section C: Docs Vencidos (overdue list)                            */}
      {/* ------------------------------------------------------------------ */}
      <Card
        className={cn(
          'rounded-2xl border-[#C8E6C9] dark:border-[#2A3F36]',
          'bg-white dark:bg-[#1A2420]'
        )}
      >
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <h3 className="text-sm font-bold text-foreground">
              Documentos Vencidos
            </h3>
            {overdueCount > 0 && (
              <Badge
                className={cn(
                  'ml-auto text-xs',
                  'bg-red-100 text-red-700',
                  'dark:bg-red-950/40 dark:text-red-400'
                )}
              >
                {overdueCount}
              </Badge>
            )}
          </div>

          {overdueDocuments.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div
                className={cn(
                  'w-12 h-12 rounded-2xl flex items-center justify-center mb-3',
                  'bg-[#E8F5E9] dark:bg-[#243530]'
                )}
              >
                <CheckCircle className="w-6 h-6 text-[#006837] dark:text-[#2ECC71]" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Nenhum documento vencido
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Todos os documentos estao dentro do prazo de revisao.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {overdueDocuments.map((doc, index) => {
                const daysOverdue = calcDaysOverdue(doc.proximaRevisao)
                const categoryLabel =
                  CATEGORY_LABELS[doc.category] || doc.category || ''

                return (
                  <div
                    key={doc.id || index}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-xl',
                      'bg-red-50/60 dark:bg-red-950/20',
                      'border border-red-200/60 dark:border-red-900/30'
                    )}
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                        'bg-red-100 dark:bg-red-950/40'
                      )}
                    >
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {doc.titulo || 'Sem titulo'}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {doc.codigo && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {doc.codigo}
                          </span>
                        )}
                        {categoryLabel && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-1.5 py-0',
                              'border-red-300 text-red-600',
                              'dark:border-red-800 dark:text-red-400'
                            )}
                          >
                            {categoryLabel}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="text-xs font-bold text-red-600 dark:text-red-400">
                        {daysOverdue}d
                      </span>
                      <p className="text-[10px] text-red-500 dark:text-red-500">
                        vencido
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Section D: Atividade Recente                                       */}
      {/* ------------------------------------------------------------------ */}
      <Card
        className={cn(
          'rounded-2xl border-[#C8E6C9] dark:border-[#2A3F36]',
          'bg-white dark:bg-[#1A2420]'
        )}
      >
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
            <h3 className="text-sm font-bold text-foreground">
              Atividade Recente
            </h3>
          </div>

          {recentChanges.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div
                className={cn(
                  'w-12 h-12 rounded-2xl flex items-center justify-center mb-3',
                  'bg-[#E8F5E9] dark:bg-[#243530]'
                )}
              >
                <Activity className="w-6 h-6 text-[#006837] dark:text-[#2ECC71]" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Nenhuma atividade recente
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                As alteracoes em documentos aparecerao aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentChanges.slice(0, 20).map((entry, index) => {
                const actionLabel =
                  ACTION_LABELS[entry.action] || entry.action || 'Acao desconhecida'
                const relativeTime = formatRelativeTime(entry.timestamp)

                return (
                  <div
                    key={`${entry.documentId}-${entry.timestamp}-${index}`}
                    className={cn(
                      'flex items-start gap-3 px-3 py-2.5 rounded-xl',
                      'hover:bg-[#F0FFF4] dark:hover:bg-[#243530]/50',
                      'transition-colors duration-150'
                    )}
                  >
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full flex-shrink-0 mt-1.5',
                        'bg-[#006837] dark:bg-[#2ECC71]'
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-foreground">
                          {actionLabel}
                        </span>
                        {entry.userName && (
                          <span className="text-xs text-muted-foreground">
                            por {entry.userName}
                          </span>
                        )}
                      </div>
                      {entry.documentTitle && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {entry.documentTitle}
                          {entry.documentCode ? ` (${entry.documentCode})` : ''}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0 mt-0.5 whitespace-nowrap">
                      {relativeTime}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Section E: LGPD Compliance                                         */}
      {/* ------------------------------------------------------------------ */}
      <Card className="rounded-2xl border-[#C8E6C9] dark:border-[#2A3F36] bg-white dark:bg-[#1A2420]">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
            <h3 className="text-sm font-bold text-foreground">
              LGPD - Protecao de Dados
            </h3>
          </div>

          {lgpdMetrics.totalSolicitacoes === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <Shield className="w-10 h-10 text-[#006837] dark:text-[#2ECC71] mb-2" />
              <p className="text-sm font-medium text-foreground">Nenhuma solicitacao pendente</p>
              <p className="text-xs text-muted-foreground mt-1">Nao ha solicitacoes LGPD registradas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-muted/30">
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-xl font-bold text-foreground">{lgpdMetrics.pendentes}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30">
                <p className="text-xs text-muted-foreground">Resolvidas</p>
                <p className="text-xl font-bold text-foreground">{lgpdMetrics.resolvidas}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30">
                <p className="text-xs text-muted-foreground">Taxa Resolucao</p>
                <p className="text-xl font-bold text-foreground">
                  {lgpdMetrics.totalSolicitacoes > 0
                    ? `${Math.round((lgpdMetrics.resolvidas / lgpdMetrics.totalSolicitacoes) * 100)}%`
                    : '-'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30">
                <p className="text-xs text-muted-foreground">Tempo Medio</p>
                <p className="text-xl font-bold text-foreground">
                  {lgpdMetrics.tempoMedioResposta != null ? `${lgpdMetrics.tempoMedioResposta}d` : '-'}
                </p>
              </div>
              {/* Overall status */}
              <div className="col-span-2 p-3 rounded-xl border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Status Geral</span>
                  <Badge variant={lgpdMetrics.pendentes === 0 ? 'success' : 'warning'}>
                    {lgpdMetrics.pendentes === 0 ? 'Conforme' : 'Atencao'}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ComplianceDashboard
