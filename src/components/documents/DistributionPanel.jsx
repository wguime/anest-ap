/**
 * DistributionPanel - Painel de status de distribuicao de documento
 *
 * Exibe metricas (% distribuido, visualizado, reconhecido),
 * tabela de status por usuario e botao de distribuicao (admin).
 *
 * @param {string}   docId        - ID do documento
 * @param {boolean}  isAdmin      - Se o usuario logado e admin
 * @param {Function} onDistribute - Callback para abrir o modal de distribuicao
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Send,
  Eye,
  CheckCircle2,
  Users,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'

import { Card, CardContent } from '@/design-system'
import { Badge } from '@/design-system'
import { Button } from '@/design-system'
import { Progress } from '@/design-system'
import { Table } from '@/design-system'
import { Spinner } from '@/design-system'
import supabaseDocumentService from '@/services/supabaseDocumentService'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format an ISO timestamp to a short pt-BR locale string, or return fallback */
function fmtDate(isoString, fallback = '-') {
  if (!isoString) return fallback
  try {
    return new Date(isoString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return fallback
  }
}

/** Compute metrics from a distribution list */
function computeMetrics(list) {
  const total = list.length
  if (total === 0) return { total: 0, viewed: 0, acknowledged: 0, pctDist: 0, pctView: 0, pctAck: 0 }

  const viewed = list.filter((r) => r.visualizadoEm).length
  const acknowledged = list.filter((r) => r.reconhecidoEm).length

  return {
    total,
    viewed,
    acknowledged,
    pctDist: 100,                          // all rows represent distributed users
    pctView: Math.round((viewed / total) * 100),
    pctAck: Math.round((acknowledged / total) * 100),
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DistributionPanel({ docId, isAdmin = false, onDistribute }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch distribution data
  const loadData = useCallback(async () => {
    if (!docId) return
    setLoading(true)
    setError(null)
    try {
      const data = await supabaseDocumentService.getDistributionList(docId)
      setList(data)
    } catch (err) {
      console.error('[DistributionPanel] Failed to load distribution list:', err)
      setError(err.message || 'Erro ao carregar dados de distribuicao')
    } finally {
      setLoading(false)
    }
  }, [docId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const metrics = computeMetrics(list)

  // Table column definitions
  const columns = [
    {
      key: 'userName',
      header: 'Usuario',
      sortable: true,
      render: (val, row) => (
        <span className="font-medium text-foreground">
          {val || row.userId || '-'}
        </span>
      ),
    },
    {
      key: 'userRole',
      header: 'Cargo',
      sortable: true,
      render: (val) =>
        val ? (
          <Badge variant="secondary" badgeStyle="subtle">
            {val}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: 'distribuidoEm',
      header: 'Distribuido',
      sortable: true,
      render: (val) => (
        <span className={val ? 'text-primary' : 'text-muted-foreground'}>
          {fmtDate(val)}
        </span>
      ),
    },
    {
      key: 'visualizadoEm',
      header: 'Visualizado',
      sortable: true,
      render: (val) => (
        <span className={val ? 'text-primary' : 'text-muted-foreground'}>
          {fmtDate(val)}
        </span>
      ),
    },
    {
      key: 'reconhecidoEm',
      header: 'Reconhecido',
      sortable: true,
      render: (val) => (
        <span className={val ? 'text-primary' : 'text-muted-foreground'}>
          {fmtDate(val)}
        </span>
      ),
    },
  ]

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* SECTION 1 - Metricas                                              */}
      {/* ----------------------------------------------------------------- */}
      <Card className="border-border bg-card">
        <div className="flex items-center gap-2 p-6 pb-0">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            Metricas de Distribuicao
          </h3>
        </div>

        <CardContent className="pt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="h-6 w-6 text-primary" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 py-6 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : metrics.total === 0 ? (
            <p className="py-6 text-sm text-muted-foreground text-center">
              Nenhum usuario recebeu este documento ainda.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Distribuido */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Send className="w-3.5 h-3.5 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    Distribuido
                  </span>
                  <span className="ml-auto text-sm font-semibold text-foreground">
                    {metrics.total} usuario{metrics.total !== 1 ? 's' : ''}
                  </span>
                </div>
                <Progress value={metrics.pctDist} variant="default" size="md" />
              </div>

              {/* Visualizado */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Eye className="w-3.5 h-3.5 text-warning" />
                  <span className="text-sm font-medium text-foreground">
                    Visualizado
                  </span>
                  <span className="ml-auto text-sm font-semibold text-foreground">
                    {metrics.viewed}/{metrics.total} ({metrics.pctView}%)
                  </span>
                </div>
                <Progress
                  value={metrics.pctView}
                  variant={metrics.pctView >= 80 ? 'success' : metrics.pctView >= 50 ? 'warning' : 'error'}
                  size="md"
                />
              </div>

              {/* Reconhecido */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  <span className="text-sm font-medium text-foreground">
                    Reconhecido
                  </span>
                  <span className="ml-auto text-sm font-semibold text-foreground">
                    {metrics.acknowledged}/{metrics.total} ({metrics.pctAck}%)
                  </span>
                </div>
                <Progress
                  value={metrics.pctAck}
                  variant={metrics.pctAck >= 80 ? 'success' : metrics.pctAck >= 50 ? 'warning' : 'error'}
                  size="md"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 2 - Status por usuario                                    */}
      {/* ----------------------------------------------------------------- */}
      <Card className="border-border bg-card">
        <div className="flex items-center justify-between p-6 pb-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <Eye className="w-4 h-4 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              Status
            </h3>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            aria-label="Atualizar dados"
            className="p-2 rounded-lg hover:bg-muted dark:hover:bg-muted text-muted-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <CardContent className="pt-4">
          <Table
            columns={columns}
            data={list}
            loading={loading}
            loadingRows={4}
            searchable={list.length > 5}
            searchPlaceholder="Buscar usuario..."
            emptyMessage="Nenhuma distribuicao registrada"
            compact
            hoverable
            mobileLayout="cards"
            striped
          />
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 3 - Distribuir (admin only)                               */}
      {/* ----------------------------------------------------------------- */}
      {isAdmin && onDistribute ? (
        <Card className="border-border bg-card">
          <div className="flex items-center gap-2 p-6 pb-0">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <Send className="w-4 h-4 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              Distribuir
            </h3>
          </div>

          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Selecione os cargos ou usuarios que devem receber este documento.
            </p>
            <Button
              onClick={onDistribute}
              leftIcon={<Send className="w-4 h-4" />}
            >
              Distribuir Documento
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

export default DistributionPanel
