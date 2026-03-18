import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, Badge, useToast } from '@/design-system'
import { Shield, CheckCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react'
import { useUser } from '@/contexts/UserContext'
import { fetchSolicitacoes, processSolicitacao } from '@/services/lgpdService'

/**
 * Format a date string for display
 */
function formatDate(dateString) {
  if (!dateString) return '-'
  const d = new Date(dateString)
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_CONFIG = {
  pendente: { label: 'Pendente', color: 'bg-amber-500', icon: Clock },
  processada: { label: 'Processada', color: 'bg-green-600', icon: CheckCircle },
}

/**
 * LgpdSolicitacoesTab — Admin interface for LGPD deletion requests
 *
 * Lists all requests from lgpd_solicitacoes table and allows admin
 * to process them (anonymize user data + mark as processed).
 */
function LgpdSolicitacoesTab() {
  const { toast } = useToast()
  const { user } = useUser()
  const [solicitacoes, setSolicitacoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchSolicitacoes()
      setSolicitacoes(data)
    } catch (err) {
      console.error('[LgpdSolicitacoesTab] Error loading:', err)
      toast({
        title: 'Erro ao carregar solicitacoes',
        description: err.message,
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleProcess = useCallback(async (solicitacaoId) => {
    if (!window.confirm(
      'Tem certeza que deseja processar esta solicitacao?\n\n'
      + 'Esta acao vai anonimizar os dados pessoais do usuario e NAO pode ser desfeita.'
    )) return

    setProcessing(solicitacaoId)
    try {
      const result = await processSolicitacao(
        solicitacaoId,
        user?.uid || user?.id,
        user?.displayName || user?.firstName || 'Admin',
      )
      toast({
        title: 'Solicitacao processada',
        description: result.errors?.length
          ? `Concluida com ${result.errors.length} aviso(s).`
          : 'Dados anonimizados com sucesso.',
        variant: result.errors?.length ? 'warning' : 'success',
      })
      loadData()
    } catch (err) {
      console.error('[LgpdSolicitacoesTab] Process error:', err)
      toast({
        title: 'Erro ao processar',
        description: err.message,
        variant: 'error',
      })
    } finally {
      setProcessing(null)
    }
  }, [user, toast, loadData])

  const pendentes = solicitacoes.filter(s => s.status === 'pendente')
  const processadas = solicitacoes.filter(s => s.status === 'processada')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              LGPD — Solicitacoes de Exclusao
            </h2>
            <p className="text-sm text-muted-foreground">
              Art. 18 — Direito de eliminacao de dados pessoais
            </p>
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-muted dark:hover:bg-muted transition-colors disabled:opacity-50"
          title="Atualizar"
        >
          <RefreshCw className={`w-5 h-5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{pendentes.length}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{processadas.length}</p>
              <p className="text-xs text-muted-foreground">Processadas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Carregando solicitacoes...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && solicitacoes.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">
              Nenhuma solicitacao de exclusao registrada.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pending requests */}
      {!loading && pendentes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground dark:text-muted-foreground uppercase tracking-wide">
            Pendentes ({pendentes.length})
          </h3>
          {pendentes.map(sol => (
            <SolicitacaoCard
              key={sol.id}
              solicitacao={sol}
              onProcess={handleProcess}
              processing={processing === sol.id}
            />
          ))}
        </div>
      )}

      {/* Processed requests */}
      {!loading && processadas.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground dark:text-muted-foreground uppercase tracking-wide">
            Processadas ({processadas.length})
          </h3>
          {processadas.map(sol => (
            <SolicitacaoCard
              key={sol.id}
              solicitacao={sol}
              onProcess={null}
              processing={false}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * SolicitacaoCard — Individual request card
 */
function SolicitacaoCard({ solicitacao, onProcess, processing }) {
  const sol = solicitacao
  const config = STATUS_CONFIG[sol.status] || STATUS_CONFIG.pendente
  const StatusIcon = config.icon
  const isPendente = sol.status === 'pendente'

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Status + Date */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${config.color}`}>
                <StatusIcon className="w-3 h-3" />
                {config.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDate(sol.created_at)}
              </span>
            </div>

            {/* User info */}
            <div className="mb-2">
              <p className="text-sm font-medium text-foreground">
                {sol.dados_solicitante?.nome || 'Usuario desconhecido'}
              </p>
              <p className="text-xs text-muted-foreground">
                {sol.dados_solicitante?.email || sol.user_id}
              </p>
            </div>

            {/* Motivo */}
            {sol.motivo && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {sol.motivo}
              </p>
            )}

            {/* Processed info */}
            {sol.status === 'processada' && (
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Processada por {sol.processado_por_nome || 'Admin'} em {formatDate(sol.processado_em)}
                </p>
              </div>
            )}
          </div>

          {/* Action button */}
          {isPendente && onProcess && (
            <button
              onClick={() => onProcess(sol.id)}
              disabled={processing}
              className="shrink-0 px-4 py-2 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {processing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              {processing ? 'Processando...' : 'Processar'}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default LgpdSolicitacoesTab
