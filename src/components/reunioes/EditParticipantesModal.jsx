/**
 * EditParticipantesModal — Manage participants of an existing meeting.
 *
 * Standalone component consumed by the tab refactor of ReuniaoDetalhePage.
 * Shows a searchable, filterable list of all active users with role badges.
 * Pre-checks current participants, shows diff summary before saving.
 */
import { useState, useMemo, useCallback } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { Modal, Button, Input, Checkbox, Avatar, Badge, ScrollArea, Spinner, useToast, cn } from '@/design-system';
import { Search, Users, UserPlus, UserMinus, Filter } from 'lucide-react';
import { PERFIS_CONVOCADOS, PERFIL_CONVOCADO_BY_KEY } from '@/constants/reunioes';

// ============================================================================
// HELPERS
// ============================================================================

function getInitials(name) {
  if (!name) return '';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

function computeDiff(originalIds, currentIds) {
  const origSet = new Set(originalIds);
  const currSet = new Set(currentIds);
  const added = currentIds.filter(id => !origSet.has(id));
  const removed = originalIds.filter(id => !currSet.has(id));
  return { added, removed };
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function EditParticipantesModal({
  open,
  onClose,
  reuniao,
  allUsers,
  onSave,
}) {
  const { toast } = useToast();

  // Original participant IDs from the meeting (snapshot at open)
  const originalIds = useMemo(
    () => reuniao?.participantesIds || [],
    [reuniao?.participantesIds]
  );

  // Roles the meeting targets (for highlighting)
  const targetRoles = useMemo(
    () => new Set(reuniao?.destinatariosTipos || []),
    [reuniao?.destinatariosTipos]
  );

  // Selected participant IDs (local state)
  const [selectedIds, setSelectedIds] = useState(() => [...originalIds]);

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [saving, setSaving] = useState(false);

  // Auto-animate the participant list as items are added/removed via filtering
  const [participantesRef] = useAutoAnimate();

  // Active users sorted by name
  const activeUsers = useMemo(() => {
    return (allUsers || [])
      .filter(u => u.active !== false)
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [allUsers]);

  // Filtered list
  const filteredUsers = useMemo(() => {
    let list = activeUsers;

    if (roleFilter) {
      list = list.filter(u => u.role === roleFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(u =>
        (u.nome || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [activeUsers, roleFilter, searchQuery]);

  // Diff between original and current selection
  const diff = useMemo(
    () => computeDiff(originalIds, selectedIds),
    [originalIds, selectedIds]
  );

  const hasChanges = diff.added.length > 0 || diff.removed.length > 0;

  // Handlers
  const toggleUser = useCallback((userId) => {
    setSelectedIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  }, []);

  const selectAllFiltered = useCallback(() => {
    const filteredIds = filteredUsers.map(u => u.id);
    setSelectedIds(prev => {
      const currentSet = new Set(prev);
      filteredIds.forEach(id => currentSet.add(id));
      return [...currentSet];
    });
  }, [filteredUsers]);

  const deselectAllFiltered = useCallback(() => {
    const filteredIdSet = new Set(filteredUsers.map(u => u.id));
    setSelectedIds(prev => prev.filter(id => !filteredIdSet.has(id)));
  }, [filteredUsers]);

  const allFilteredSelected = useMemo(() => {
    if (filteredUsers.length === 0) return false;
    const selSet = new Set(selectedIds);
    return filteredUsers.every(u => selSet.has(u.id));
  }, [filteredUsers, selectedIds]);

  const handleSave = useCallback(async () => {
    if (!hasChanges) {
      onClose();
      return;
    }
    try {
      setSaving(true);
      await onSave(selectedIds);
      toast({
        variant: 'success',
        title: 'Participantes atualizados',
        description: [
          diff.added.length > 0 && `${diff.added.length} adicionado(s)`,
          diff.removed.length > 0 && `${diff.removed.length} removido(s)`,
        ].filter(Boolean).join(', '),
        duration: 4000,
      });
      onClose();
    } catch (error) {
      console.error('[EditParticipantesModal] save error:', error);
      toast({
        variant: 'error',
        title: 'Erro ao atualizar',
        description: error.message || 'Falha ao salvar participantes. Tente novamente.',
        duration: 5000,
      });
    } finally {
      setSaving(false);
    }
  }, [hasChanges, selectedIds, diff, onSave, onClose, toast]);

  const handleClose = useCallback(() => {
    if (!saving) onClose();
  }, [saving, onClose]);

  // ============================================================================
  // RENDER
  // ============================================================================

  const footerContent = (
    <div className="flex flex-col gap-3 w-full">
      {/* Diff summary */}
      {hasChanges && (
        <div className="flex flex-wrap items-center gap-2 justify-center text-xs">
          {diff.added.length > 0 && (
            <span className="inline-flex items-center gap-1 text-success">
              <UserPlus size={14} aria-hidden="true" />
              {diff.added.length} adicionado(s)
            </span>
          )}
          {diff.removed.length > 0 && (
            <span className="inline-flex items-center gap-1 text-destructive">
              <UserMinus size={14} aria-hidden="true" />
              {diff.removed.length} removido(s)
            </span>
          )}
        </div>
      )}
      <div className="flex gap-3 w-full">
        <Button
          variant="outline"
          onClick={handleClose}
          disabled={saving}
          className="flex-1"
          aria-label="Cancelar edição de participantes"
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="flex-1"
          aria-label="Salvar alterações de participantes"
        >
          {saving ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Salvando...
            </>
          ) : (
            `Salvar (${selectedIds.length})`
          )}
        </Button>
      </div>
    </div>
  );

  // Distinct roles present in active users (for filter dropdown)
  const availableRoles = useMemo(() => {
    const roles = new Set(activeUsers.map(u => u.role).filter(Boolean));
    return PERFIS_CONVOCADOS.filter(p => roles.has(p.key));
  }, [activeUsers]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Editar Participantes"
      description={`${selectedIds.length} participante(s) selecionado(s)`}
      size="lg"
      closeOnOverlayClick={!saving}
      closeOnEscape={!saving}
      footer={footerContent}
      aria-label="Modal de edição de participantes da reunião"
    >
      <Modal.Body>
        <div className="space-y-4">
          {/* Search + filter row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                placeholder="Buscar por nome ou e-mail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Buscar participantes"
                icon={<Search size={18} />}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-muted-foreground shrink-0" aria-hidden="true" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                aria-label="Filtrar por perfil"
                className={cn(
                  'min-h-[44px] rounded-[16px] border-2 border-border bg-card px-3 py-2',
                  'text-sm text-foreground outline-none',
                  'focus:border-primary focus:ring-2 focus:ring-primary/20'
                )}
              >
                <option value="">Todos os perfis</option>
                {availableRoles.map(p => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Select all / deselect all for current filter */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {filteredUsers.length} usuário(s)
              {roleFilter && ` com perfil "${PERFIL_CONVOCADO_BY_KEY[roleFilter]?.label || roleFilter}"`}
            </span>
            <button
              type="button"
              onClick={allFilteredSelected ? deselectAllFiltered : selectAllFiltered}
              className="text-primary hover:underline min-h-[44px] px-2"
              aria-label={allFilteredSelected ? 'Desmarcar todos os filtrados' : 'Selecionar todos os filtrados'}
            >
              {allFilteredSelected ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
          </div>

          {/* User list */}
          <ScrollArea className="h-[320px] sm:h-[400px]">
            {filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Users size={32} className="mb-2 opacity-50" aria-hidden="true" />
                <p className="text-sm">Nenhum usuário encontrado</p>
              </div>
            ) : (
              <div ref={participantesRef} className="divide-y divide-border">
                {filteredUsers.map((user) => {
                  const isSelected = selectedIds.includes(user.id);
                  const isTargetRole = targetRoles.has(user.role);
                  const perfil = PERFIL_CONVOCADO_BY_KEY[user.role];

                  return (
                    <div
                      key={user.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleUser(user.id)}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          toggleUser(user.id);
                        }
                      }}
                      aria-pressed={isSelected}
                      aria-label={`${isSelected ? 'Remover' : 'Adicionar'} ${user.nome || user.email}`}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer min-h-[56px]',
                        isSelected ? 'bg-primary/5' : 'hover:bg-muted/50',
                        isTargetRole && !isSelected && 'bg-accent/30'
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggleUser(user.id)}
                        size="sm"
                        compact
                        className="pointer-events-none"
                      />

                      <Avatar
                        size="sm"
                        src={user.photoURL || undefined}
                        alt={user.nome || user.email}
                        initials={getInitials(user.nome)}
                      />

                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm truncate',
                          isSelected ? 'font-semibold text-foreground' : 'text-foreground'
                        )}>
                          {user.nome || user.email}
                        </p>
                        {user.nome && user.email && (
                          <p className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isTargetRole && (
                          <Badge variant="success" badgeStyle="subtle" className="text-[10px]">
                            Convocado
                          </Badge>
                        )}
                        {perfil && (
                          <span
                            className={cn(
                              'text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap',
                              perfil.chipSolidClass
                            )}
                          >
                            {perfil.label}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </Modal.Body>
    </Modal>
  );
}
