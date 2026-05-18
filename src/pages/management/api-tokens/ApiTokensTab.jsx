import { useCallback, useEffect, useMemo, useState } from 'react'
import { Key, Plus, ShieldOff, Loader2, RefreshCw, Eye, EyeOff, AlertTriangle, Activity } from 'lucide-react'
import { Card, useToast } from '@/design-system'
import { useUser } from '@/contexts/UserContext'
import supabaseApiTokensService, {
  VALID_SCOPES,
} from '@/services/supabaseApiTokensService'
import GenerateTokenModal from './GenerateTokenModal'

/**
 * ApiTokensTab — Sprint 14c / O2-5 (Wave 4 / B4)
 *
 * Gestão de tokens da API pública v1 (Centro de Gestão → Painel → API).
 * Admin-only. RLS faz o gate; UI só mostra a aba se isAdministrator(user).
 *
 * Estados:
 *  - Lista tokens (ativos / opção mostrar revogados)
 *  - Botão "Gerar token" → GenerateTokenModal (input → reveal one-time)
 *  - Ação "Revogar" em cada card (confirm inline)
 *
 * Empty state quando nenhum token ainda foi gerado.
 */

const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

function relativeFromNow(iso) {
  if (!iso) return null
  const date = new Date(iso)
  if (isNaN(date.getTime())) return null
  const diffMs = date.getTime() - Date.now()
  const diffSec = Math.round(diffMs / 1000)
  const absSec = Math.abs(diffSec)
  if (absSec < 60) return RELATIVE_FORMATTER.format(diffSec, 'second')
  const diffMin = Math.round(diffSec / 60)
  if (Math.abs(diffMin) < 60) return RELATIVE_FORMATTER.format(diffMin, 'minute')
  const diffHr = Math.round(diffMin / 60)
  if (Math.abs(diffHr) < 24) return RELATIVE_FORMATTER.format(diffHr, 'hour')
  const diffDay = Math.round(diffHr / 24)
  return RELATIVE_FORMATTER.format(diffDay, 'day')
}

function formatDate(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ScopeChips({ scopes, legacy }) {
  const list = Array.isArray(scopes) && scopes.length > 0 ? scopes : [...VALID_SCOPES]
  return (
    <div
      className="flex flex-wrap gap-1 items-center"
      data-testid="scope-chips"
      data-legacy={legacy ? 'true' : 'false'}
    >
      {list.map((s) => (
        <span
          key={s}
          aria-label={`Permissão: ${s}`}
          title={s}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium bg-card border border-border text-foreground"
        >
          {s}
        </span>
      ))}
      {legacy ? (
        <span
          data-testid="scope-legacy-indicator"
          title="Token criado antes da migração de scopes granulares (Sprint 16). Mantém acesso aos 3 endpoints."
          className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-muted text-muted-foreground border border-border uppercase tracking-wider"
        >
          legacy
        </span>
      ) : null}
    </div>
  )
}

function StatusBadge({ active }) {
  return (
    <span
      className={
        active
          ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-success/15 text-success border border-success/30'
          : 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border'
      }
    >
      <span
        className={
          active ? 'inline-block w-1.5 h-1.5 rounded-full bg-success' : 'inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground'
        }
      />
      {active ? 'Ativo' : 'Revogado'}
    </span>
  )
}

function TokenCard({ token, onRevoke, isRevoking }) {
  const active = !token.revokedAt
  const lastUsedRel = relativeFromNow(token.lastUsedAt)
  return (
    <Card className="p-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Key className="w-4 h-4 text-primary shrink-0" aria-hidden />
            <h3 className="text-sm font-semibold text-foreground truncate" title={token.name}>
              {token.name}
            </h3>
            <StatusBadge active={active} />
          </div>
          <div className="mt-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Scopes
            </p>
            <ScopeChips scopes={token.scopes} legacy={!!token.legacyScopes} />
          </div>
          <dl className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <div>
              <dt className="font-medium text-foreground">Criado</dt>
              <dd>{formatDate(token.createdAt)}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Último uso</dt>
              <dd title={token.lastUsedAt || ''}>
                {lastUsedRel || (active ? 'Nunca usado' : '—')}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Usos</dt>
              <dd className="inline-flex items-center gap-1">
                <Activity className="w-3 h-3" /> {token.usageCount ?? 0}
              </dd>
            </div>
          </dl>
          {!active ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Revogado {relativeFromNow(token.revokedAt) || ''}
            </p>
          ) : null}
        </div>

        {active ? (
          <button
            type="button"
            onClick={() => onRevoke(token)}
            disabled={isRevoking}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 self-start"
            aria-label={`Revogar token ${token.name}`}
          >
            {isRevoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
            Revogar
          </button>
        ) : null}
      </div>
    </Card>
  )
}

function ApiTokensTab() {
  const { user: currentUser } = useUser()
  const { toast } = useToast()

  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [includeRevoked, setIncludeRevoked] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [revokingId, setRevokingId] = useState(null)
  const [pendingRevoke, setPendingRevoke] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await supabaseApiTokensService.fetchTokens({ includeRevoked })
      setTokens(list)
    } catch (err) {
      const msg = err?.message || 'Erro ao carregar tokens.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [includeRevoked])

  useEffect(() => {
    load()
  }, [load])

  const handleGenerate = useCallback(
    async ({ name, scope, scopes }) =>
      supabaseApiTokensService.generateToken({ name, scope, scopes }),
    []
  )

  const handleAfterCreated = useCallback(() => {
    setShowGenerateModal(false)
    load()
  }, [load])

  const handleRevoke = useCallback(async (token) => {
    if (!token?.id) return
    setRevokingId(token.id)
    try {
      await supabaseApiTokensService.revokeToken(token.id, currentUser)
      toast({ title: `Token "${token.name}" revogado`, variant: 'success' })
      setPendingRevoke(null)
      await load()
    } catch (err) {
      toast({
        title: 'Falha ao revogar token',
        description: err?.message || 'Erro desconhecido.',
        variant: 'error',
      })
    } finally {
      setRevokingId(null)
    }
  }, [currentUser, load, toast])

  const activeCount = useMemo(
    () => tokens.filter((t) => !t.revokedAt).length,
    [tokens]
  )
  const revokedCount = useMemo(
    () => tokens.filter((t) => !!t.revokedAt).length,
    [tokens]
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" aria-hidden /> Tokens da API pública
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Geram acesso read-only para integrações externas via{' '}
            <code className="bg-muted px-1 py-0.5 rounded">/v1/docs</code>. Token plain só é
            exibido no momento da geração.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            aria-label="Recarregar lista"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => setIncludeRevoked((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
            aria-pressed={includeRevoked}
          >
            {includeRevoked ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {includeRevoked ? 'Ocultar revogados' : 'Ver revogados'}
          </button>
          <button
            type="button"
            onClick={() => setShowGenerateModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Gerar token
          </button>
        </div>
      </div>

      {/* KPI mini-cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Ativos</p>
          <p className="text-xl font-semibold text-foreground mt-0.5">{activeCount}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Revogados</p>
          <p className="text-xl font-semibold text-foreground mt-0.5">{revokedCount}</p>
        </Card>
      </div>

      {/* Error banner */}
      {error ? (
        <div
          role="alert"
          className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2 flex items-start gap-2"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* List or empty state */}
      {loading && tokens.length === 0 ? (
        <Card className="p-8 text-center">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
          <p className="text-xs text-muted-foreground mt-2">Carregando tokens...</p>
        </Card>
      ) : tokens.length === 0 ? (
        <Card className="p-8 text-center">
          <Key className="w-8 h-8 text-muted-foreground mx-auto" aria-hidden />
          <p className="text-sm font-medium text-foreground mt-3">
            Nenhum token API gerado.
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            Tokens permitem integrações ler documentos via API pública v1 (read-only). Clique em
            "Gerar token" para criar o primeiro.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3" data-testid="api-tokens-list">
          {tokens.map((t) => (
            <li key={t.id}>
              <TokenCard
                token={t}
                onRevoke={(token) => setPendingRevoke(token)}
                isRevoking={revokingId === t.id}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Generate modal */}
      {showGenerateModal ? (
        <GenerateTokenModal
          open={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          onGenerate={handleGenerate}
          onCreated={handleAfterCreated}
        />
      ) : null}

      {/* Confirm revoke */}
      {pendingRevoke ? (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <ShieldOff className="w-4 h-4 text-destructive" /> Revogar token
            </h3>
            <p className="text-xs text-muted-foreground mt-2">
              O token <strong className="text-foreground">"{pendingRevoke.name}"</strong> deixará
              de funcionar imediatamente. Integrações que dependem dele falharão com 401. Esta
              ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end pt-4">
              <button
                type="button"
                onClick={() => setPendingRevoke(null)}
                disabled={revokingId === pendingRevoke.id}
                className="px-4 py-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleRevoke(pendingRevoke)}
                disabled={revokingId === pendingRevoke.id}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-destructive hover:bg-destructive/90 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {revokingId === pendingRevoke.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Revogando...
                  </>
                ) : (
                  <>
                    <ShieldOff className="w-4 h-4" /> Confirmar revogação
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default ApiTokensTab
