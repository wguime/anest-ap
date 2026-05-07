import React, { useState, useMemo, useEffect, useId } from 'react';
import { Card, CardContent, Button, SearchBar, SearchToggleButton, Collapsible, CollapsibleContent, Select } from '@/design-system';
import { useToast } from '@/design-system';
import { Mail, Trash2, Copy, Pencil, Check, X, Plus } from 'lucide-react';
import { ROLES, getRoleName, getRoleColor } from '@/utils/userTypes';

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
  const [searchOpen, setSearchOpen] = useState(false);
  const searchPanelId = useId();
  const { toast } = useToast();

  const closeSearch = () => {
    setSearchOpen(false);
    onSearchChange?.('');
  };

  useEffect(() => {
    if (!searchOpen) return;
    const t = setTimeout(() => {
      const el = document.querySelector('[data-slot="anest-search-bar-input"]');
      el?.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') closeSearch(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen]);

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
      {/* Connection status badge */}
      {connectionStatus && connectionStatus !== 'connected' && (
        <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-warning/10 dark:bg-warning/20 text-warning w-fit">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              connectionStatus === 'reconnecting'
                ? 'bg-warning animate-pulse'
                : 'bg-destructive'
            }`}
          />
          {connectionStatus === 'reconnecting' ? 'Reconectando...' : 'Desconectado'}
        </div>
      )}
      {connectionStatus === 'connected' && (
        <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-success/10 dark:bg-success/20 text-success w-fit">
          <span className="inline-block w-2 h-2 rounded-full bg-success" />
          Conectado
        </div>
      )}

      {/* Header: CTA de adicionar email + lupa de busca */}
      <div className="flex items-center justify-between gap-2">
        <Button
          size="sm"
          variant="default"
          onClick={onAddEmail}
          className="bg-primary hover:bg-primary/90 min-h-[44px]"
          aria-label="Adicionar email autorizado"
        >
          <Plus className="w-4 h-4 mr-1" />
          Adicionar Email
        </Button>
        <SearchToggleButton
          size="sm"
          active={searchOpen}
          onClick={() => searchOpen ? closeSearch() : setSearchOpen(true)}
          controlsId={searchPanelId}
        />
      </div>

      {/* Search (toggle via lupa) */}
      <Collapsible open={searchOpen} onOpenChange={(v) => v ? setSearchOpen(true) : closeSearch()}>
        <CollapsibleContent>
          <div id={searchPanelId}>
            <SearchBar
              value={searchQuery}
              onChange={(val) => onSearchChange?.(typeof val === 'string' ? val : val?.target?.value || '')}
              placeholder="Buscar email..."
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

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
                Nenhum email autorizado cadastrado.
              </p>
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
                      <p className="font-medium text-black dark:text-white text-sm">
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
                        Adicionado em {item.addedAt} por {item.addedBy}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCopyEmail(item.email)}
                        className="p-1 rounded hover:bg-muted dark:hover:bg-muted transition-colors"
                        title="Copiar email"
                        aria-label={`Copiar email ${item.email}`}
                      >
                        <Copy
                          className={`w-3.5 h-3.5 ${
                            copiedEmail === item.email
                              ? 'text-success'
                              : 'text-muted-foreground'
                          }`}
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
                          className="shrink-0 bg-primary hover:bg-primary/90"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCancelEditRole}
                          disabled={savingRole}
                          className="shrink-0"
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
                        >
                          <Pencil className="w-4 h-4 mr-1.5" />
                          Cargo
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setEmailToRemove(item.email)}
                      >
                        <Trash2 className="w-4 h-4 mr-1.5" />
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

      {/* Add Email button */}
      <Button
        variant="default"
        className="w-full bg-primary hover:bg-primary/90"
        onClick={onAddEmail}
      >
        <Mail className="w-4 h-4 mr-1" />
        Adicionar Email
      </Button>

      {/* Confirmation Modal for removal */}
      {emailToRemove && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4 border-border">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
                Confirmar Remocao
              </h3>
              <p className="text-muted-foreground mb-4">
                Tem certeza que deseja remover o email{' '}
                <span className="font-medium text-black dark:text-white">
                  {emailToRemove}
                </span>{' '}
                da lista de emails autorizados?
              </p>
              <p className="text-xs text-destructive mb-4">
                Esta acao nao podera ser desfeita.
              </p>
              <div className="flex gap-3 justify-end">
                <Button variant="ghost" onClick={() => setEmailToRemove(null)} disabled={isRemoving}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmRemove}
                  disabled={isRemoving}
                  leftIcon={<Trash2 className="w-4 h-4" />}
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
