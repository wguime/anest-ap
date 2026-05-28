import React, { useState, useMemo } from 'react';
import { Card, CardContent, Button, Select } from '@/design-system';
import { useToast } from '@/design-system';
import { Mail, Trash2, Copy, Pencil, Check, X, Plus } from 'lucide-react';
import { ROLES, getRoleName, getRoleColor } from '@/utils/userTypes';
import { useUsersManagement } from '@/contexts/UsersManagementContext';
import { cn } from '@/design-system/utils/tokens';

/**
 * EmailsTab - Manages the list of authorized emails that can create accounts.
 *
 * O cargo associado a cada email e sincronizado com a aba "Usuarios" e "Cargos":
 * quando o usuario cria a conta, o perfil ja nasce com o cargo selecionado
 * (via rpc_create_profile lendo authorized_emails.role).
 *
 * @param {Object} props
 * @param {Array<{ email: string, addedAt: string, addedBy: string, role?: string }>} props.authorizedEmails
 * @param {(email: string) => void} props.onRemoveEmail
 * @param {(email: string, role: string|null) => Promise<void>} props.onUpdateEmailRole
 * @param {() => void} props.onAddEmail
 */
function EmailsTab({
  authorizedEmails = [],
  onRemoveEmail,
  onAddEmail,
  onUpdateEmailRole,
  searchQuery = '',
  onSearchChange,
  connectionStatus,
}) {
  const [emailToRemove, setEmailToRemove] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(null);
  const [editingRoleEmail, setEditingRoleEmail] = useState(null);
  const [draftRole, setDraftRole] = useState('');
  const [savingRole, setSavingRole] = useState(false);
  const { toast } = useToast();
  const { users } = useUsersManagement();

  // Build a lookup map: id/firebaseUid → user name.
  // `authorized_emails.added_by` agora armazena o Firebase UID do admin que
  // adicionou o email (em vez da string literal 'Admin'). Resolvemos para o
  // nome humano via este mapa. Emails legados ainda podem ter addedBy='Admin'
  // (string) — o fallback `|| email.addedBy` exibe esse valor cru durante a
  // transição.
  const userNameMap = useMemo(() => {
    const map = {};
    if (users) {
      users.forEach((u) => {
        const name = u.nome || u.email || u.id;
        if (u.id) map[u.id] = name;
        if (u.firebaseUid) map[u.firebaseUid] = name;
      });
    }
    return map;
  }, [users]);

  const filtered = useMemo(() =>
    authorizedEmails.filter(e => !searchQuery || e.email?.toLowerCase().includes(searchQuery.toLowerCase())),
    [authorizedEmails, searchQuery]
  );

  const roleOptions = useMemo(
    () => [
      { value: '', label: 'Sem cargo (padrao: Colaborador)' },
      ...ROLES.map((r) => ({ value: r.id, label: r.name })),
    ],
    []
  );

  const handleCopyEmail = async (email) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      setTimeout(() => setCopiedEmail(null), 2000);
    } catch (error) {
      console.error('Failed to copy email:', error);
    }
  };

  const handleConfirmRemove = async () => {
    if (!emailToRemove || !onRemoveEmail) return;
    setIsRemoving(true);
    try {
      await onRemoveEmail(emailToRemove);
    } catch (error) {
      console.error('Failed to remove email:', error);
      toast({ title: 'Erro ao remover email', variant: 'destructive' });
    } finally {
      setIsRemoving(false);
      setEmailToRemove(null);
    }
  };

  const handleStartEditRole = (item) => {
    setEditingRoleEmail(item.email);
    setDraftRole(item.role || '');
  };

  const handleCancelEditRole = () => {
    setEditingRoleEmail(null);
    setDraftRole('');
  };

  const handleSaveRole = async () => {
    if (!onUpdateEmailRole || !editingRoleEmail) return;
    setSavingRole(true);
    try {
      await onUpdateEmailRole(editingRoleEmail, draftRole || null);
      setEditingRoleEmail(null);
      setDraftRole('');
    } finally {
      setSavingRole(false);
    }
  };

  return (
    <div className="space-y-4 overflow-hidden">
      {/* Header: CTA + status badge inline (no banner top) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          size="sm"
          variant="default"
          onClick={onAddEmail}
          className="min-h-[44px]"
          aria-label="Adicionar email autorizado"
        >
          <Plus className="w-4 h-4 mr-1" />
          Adicionar Email
        </Button>
        {connectionStatus && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium',
              connectionStatus === 'connected' && 'bg-success/10 text-success',
              connectionStatus === 'reconnecting' && 'bg-warning/10 text-warning',
              connectionStatus !== 'connected' && connectionStatus !== 'reconnecting' && 'bg-destructive/10 text-destructive'
            )}
            title={
              connectionStatus === 'connected'
                ? 'Conexao em tempo real ativa'
                : connectionStatus === 'reconnecting'
                  ? 'Reconectando ao servidor'
                  : 'Sem conexao em tempo real'
            }
            role="status"
            aria-live="polite"
          >
            <span
              className={cn(
                'inline-block w-1.5 h-1.5 rounded-full',
                connectionStatus === 'connected' && 'bg-success',
                connectionStatus === 'reconnecting' && 'bg-warning animate-pulse',
                connectionStatus !== 'connected' && connectionStatus !== 'reconnecting' && 'bg-destructive'
              )}
            />
            {connectionStatus === 'connected'
              ? 'Online'
              : connectionStatus === 'reconnecting'
                ? 'Reconectando'
                : 'Offline'}
          </span>
        )}
      </div>

      {/* Filter chip — paridade visual com UsersTab */}
      {searchQuery && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground">
            <span className="text-muted-foreground">Busca:</span>
            <span className="font-medium truncate max-w-[160px]">{searchQuery}</span>
            <button
              type="button"
              onClick={() => onSearchChange?.('')}
              aria-label="Remover filtro de busca"
              className="ml-1 rounded-full p-1 hover:bg-muted transition-colors"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
          <button
            type="button"
            onClick={() => onSearchChange?.('')}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Limpar tudo
          </button>
        </div>
      )}

      {/* Header with counter */}
      <p className="text-sm text-muted-foreground mb-4">
        {filtered.length === authorizedEmails.length
          ? `Emails autorizados a criar conta (${authorizedEmails.length})`
          : `${filtered.length} de ${authorizedEmails.length} emails autorizados`}
      </p>

      {/* Email list */}
      <div className="space-y-3 mb-5">
        {filtered.length === 0 ? (
          <Card variant="default" className="border-border">
            <CardContent className="p-6 text-center">
              <Mail className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchQuery
                  ? `Nenhum email encontrado para "${searchQuery}".`
                  : 'Nenhum email autorizado cadastrado.'}
              </p>
              {searchQuery && (
                <p className="text-xs text-muted-foreground mt-2">
                  Use <strong>+ Adicionar Email</strong> para autorizar este endereço, ou
                  verifique a aba <strong>Usuários</strong> se o usuário já existe (pode
                  ser órfão sem allowlist).
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          filtered.map((item, idx) => {
            const isEditingRole = editingRoleEmail === item.email;
            return (
              <div
                key={`${item.email}-${idx}`}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Email info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-medium text-foreground text-sm">
                        {item.email}
                      </p>
                      {!isEditingRole && (
                        item.role ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
                            style={{ backgroundColor: getRoleColor(item.role) }}
                          >
                            {getRoleName(item.role)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
                            Sem cargo
                          </span>
                        )
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-muted-foreground">
                        Adicionado em {item.addedAt} por {userNameMap[item.addedBy] || item.addedBy}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCopyEmail(item.email)}
                        className="inline-flex items-center justify-center min-w-[32px] min-h-[32px] rounded hover:bg-muted transition-colors"
                        title="Copiar email"
                        aria-label={`Copiar email ${item.email}`}
                      >
                        <Copy
                          className={cn(
                            'w-3.5 h-3.5',
                            copiedEmail === item.email
                              ? 'text-success'
                              : 'text-muted-foreground'
                          )}
                          aria-hidden="true"
                        />
                      </button>
                      {copiedEmail === item.email && (
                        <span className="text-xs text-success">Copiado!</span>
                      )}
                    </div>

                    {/* Role editor */}
                    {isEditingRole && (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <Select
                            value={draftRole}
                            onChange={(val) => setDraftRole(val)}
                            options={roleOptions}
                            size="sm"
                            placeholder="Selecione o cargo"
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={handleSaveRole}
                          disabled={savingRole}
                          className="shrink-0 min-h-[44px]"
                          aria-label="Salvar cargo"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCancelEditRole}
                          disabled={savingRole}
                          className="shrink-0 min-h-[44px]"
                          aria-label="Cancelar edicao de cargo"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  {!isEditingRole && (
                    <div className="flex flex-col gap-2 shrink-0">
                      {onUpdateEmailRole && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStartEditRole(item)}
                          title="Alterar cargo"
                          className="min-h-[44px]"
                          aria-label={`Alterar cargo de ${item.email}`}
                        >
                          <Pencil className="w-4 h-4 mr-1.5" aria-hidden="true" />
                          Cargo
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setEmailToRemove(item.email)}
                        className="min-h-[44px]"
                        aria-label={`Remover email ${item.email}`}
                      >
                        <Trash2 className="w-4 h-4 mr-1.5" aria-hidden="true" />
                        Remover
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Modal for removal */}
      {emailToRemove && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-foreground/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-remove-email-title"
        >
          <Card className="w-full max-w-md mx-4 border-border">
            <CardContent className="p-6">
              <h3 id="confirm-remove-email-title" className="text-lg font-semibold text-foreground mb-2">
                Confirmar Remocao
              </h3>
              <p className="text-muted-foreground mb-4">
                Tem certeza que deseja remover o email{' '}
                <span className="font-medium text-foreground">
                  {emailToRemove}
                </span>{' '}
                da lista de emails autorizados?
              </p>
              <p className="text-xs text-destructive mb-4">
                Esta acao nao podera ser desfeita.
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="ghost"
                  onClick={() => setEmailToRemove(null)}
                  disabled={isRemoving}
                  className="min-h-[44px]"
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmRemove}
                  disabled={isRemoving}
                  leftIcon={<Trash2 className="w-4 h-4" />}
                  className="min-h-[44px]"
                >
                  Remover
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default EmailsTab;
