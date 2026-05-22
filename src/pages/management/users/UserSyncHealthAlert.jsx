import { useEffect, useState, useCallback } from 'react';
import { Button, Badge } from '@/design-system';
import { AlertTriangle, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { supabase } from '@/config/supabase';
import { cn } from '@/design-system/utils/tokens';

/**
 * UserSyncHealthAlert
 *
 * Surfaceia desincronizações entre profiles ↔ authorized_emails que de outra forma
 * passam despercebidas:
 *   - duplicates: 2+ profiles com mesmo lower(email) (caso Erlei 2026-05-21)
 *   - orphans: profiles sem authorized_emails (rota direta burlando rpc_create_profile)
 *   - unused_emails: authorized_emails sem profile há >30 dias (típico typo)
 *
 * Backed by RPC rpc_user_sync_health() (admin-only via is_admin() check no backend).
 * Non-admin: RPC retorna erro, componente esconde silenciosamente.
 */
function UserSyncHealthAlert({ onNavigateToEmails }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: rpcError } = await supabase.rpc('rpc_user_sync_health');
      if (rpcError) {
        // Non-admin (Permission denied) — esconde silenciosamente
        if (rpcError.message?.includes('Permission denied')) {
          setData({ silentNotAdmin: true });
        } else {
          setError(rpcError.message);
        }
      } else {
        setData(result);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  if (loading || dismissed) return null;
  if (data?.silentNotAdmin) return null;
  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
        Erro carregando health check: {error}
      </div>
    );
  }
  if (!data) return null;

  const dupCount = data.duplicates_count || 0;
  const orphCount = data.orphans_count || 0;
  const unusedCount = data.unused_count || 0;
  const total = dupCount + orphCount + unusedCount;

  // Nada a mostrar — esconde
  if (total === 0) return null;

  // Severidade: duplicates = critical (bug real); orphans/unused = warning
  const isCritical = dupCount > 0;
  const Icon = isCritical ? AlertCircle : AlertTriangle;
  const colorClasses = isCritical
    ? 'border-destructive/40 bg-destructive/10 text-destructive'
    : 'border-warning/40 bg-warning/10 text-warning';

  return (
    <div className={cn('rounded-xl border p-4 space-y-3', colorClasses)}>
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">
            {isCritical ? 'Inconsistências críticas detectadas' : 'Atenção: dados desincronizados'}
          </p>
          <div className="text-xs mt-1 flex gap-3 flex-wrap">
            {dupCount > 0 && (
              <Badge variant="destructive" className="font-mono text-[10px]">
                {dupCount} duplicado{dupCount > 1 ? 's' : ''}
              </Badge>
            )}
            {orphCount > 0 && (
              <Badge variant="warning" className="font-mono text-[10px]">
                {orphCount} órfão{orphCount > 1 ? 's' : ''}
              </Badge>
            )}
            {unusedCount > 0 && (
              <Badge variant="secondary" className="font-mono text-[10px]">
                {unusedCount} email{unusedCount > 1 ? 's' : ''} sem profile
              </Badge>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-background/30 rounded transition-colors shrink-0"
          aria-label="Dispensar alerta (re-aparece no próximo refresh)"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded((v) => !v)}
        className="w-full justify-between"
        aria-expanded={expanded}
      >
        <span>{expanded ? 'Ocultar detalhes' : 'Ver detalhes'}</span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </Button>

      {expanded && (
        <div className="space-y-3 text-xs">
          {dupCount > 0 && (
            <DetailSection title="Profiles duplicados">
              {(data.duplicates || []).map((d) => (
                <DetailRow key={d.email_normalizado}>
                  <span className="font-mono">{d.email_normalizado}</span>
                  <span className="text-muted-foreground">
                    {d.qtd_profiles} profiles · IDs: {(d.profile_ids || []).join(', ')}
                  </span>
                  <span className="text-muted-foreground">
                    Nomes: {(d.nomes || []).join(' / ')}
                  </span>
                </DetailRow>
              ))}
              <p className="text-[11px] text-muted-foreground mt-1">
                Ação: identifique qual profile é o "real" (access_count &gt; 0) e remova o outro.
              </p>
            </DetailSection>
          )}
          {orphCount > 0 && (
            <DetailSection title="Profiles sem email autorizado">
              {(data.orphans || []).slice(0, 10).map((o) => (
                <DetailRow key={o.id}>
                  <span className="font-mono">{o.email}</span>
                  <span>{o.nome} · {o.role}</span>
                  <span className="text-muted-foreground">{o.categoria_orfao}</span>
                </DetailRow>
              ))}
              {(data.orphans || []).length > 10 && (
                <p className="text-[11px] text-muted-foreground">
                  +{(data.orphans || []).length - 10} outros...
                </p>
              )}
            </DetailSection>
          )}
          {unusedCount > 0 && (
            <DetailSection title="Emails autorizados sem profile (>30d)">
              {(data.unused_emails || []).slice(0, 10).map((u) => (
                <DetailRow key={u.email}>
                  <span className="font-mono">{u.email}</span>
                  <span>Adicionado por {u.added_by}</span>
                  <span className="text-muted-foreground">{u.categoria}</span>
                </DetailRow>
              ))}
              {(data.unused_emails || []).length > 10 && (
                <p className="text-[11px] text-muted-foreground">
                  +{(data.unused_emails || []).length - 10} outros...
                </p>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                Ação: revisar e remover emails com typo via aba Emails.
              </p>
            </DetailSection>
          )}
          {onNavigateToEmails && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToEmails}
              className="w-full"
            >
              Ir para aba Emails
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <div>
      <p className="font-semibold text-[11px] uppercase tracking-wide mb-1.5">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function DetailRow({ children }) {
  return (
    <div className="rounded-md bg-background/50 px-2 py-1.5 flex flex-col gap-0.5">
      {children}
    </div>
  );
}

export default UserSyncHealthAlert;
