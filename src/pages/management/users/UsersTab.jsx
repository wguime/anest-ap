import { useMemo, useEffect } from 'react';
import { Badge, Button, Avatar, AvatarFallback, Accordion, AccordionItem, AccordionTrigger, AccordionContent, Select } from '@/design-system';
import { Users, Mail, ArrowRight, X } from 'lucide-react';
import { COORDENADOR_BADGE, getRoleColor, getRoleName } from '@/utils/userTypes';
import UserSyncHealthAlert from './UserSyncHealthAlert';

/**
 * Formats a date string as a relative time in Portuguese
 * @param {string} dateString - ISO date string
 * @returns {string} - Relative time string (e.g., "ha 2 dias")
 */
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `ha ${diffMins} min`;
  if (diffHours < 24) return `ha ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 30) return `ha ${diffDays} dia${diffDays > 1 ? 's' : ''}`;

  const diffMonths = Math.floor(diffDays / 30);
  return `ha ${diffMonths} mes${diffMonths > 1 ? 'es' : ''}`;
}

/**
 * Extracts initials from a name (up to 2 characters)
 * @param {string} nome - Full name
 * @returns {string} - Initials
 */
function getInitials(nome) {
  if (!nome) return '??';
  return nome
    .replace(/^(Dr\.|Dra\.|Enf\.|Tec\.)\s*/i, '')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * UsersTab Component
 *
 * Manages the user list and permissions in the Centro de Gestao.
 * Supports card and accordion layouts for mobile responsiveness.
 *
 * @param {Object} props
 * @param {Array} props.users - Array of user objects
 * @param {Function} props.onEditUser - Callback when editing a user
 * @param {Function} props.onNavigateToEmails - Callback to switch to Emails tab (creating new users via authorized_emails)
 * @param {string} props.searchQuery - Current search query
 * @param {Function} props.onSearchChange - Callback when search changes
 * @param {string} props.filterRole - Current role filter
 * @param {Function} props.onFilterChange - Callback when filter changes
 * @param {Array} props.roles - Array of role configuration objects
 */
function UsersTab({
  users = [],
  loading = false,
  onEditUser,
  onNavigateToEmails,
  onResolveOrphan,
  searchQuery = '',
  onSearchChange,
  filterRole = '',
  onFilterChange,
  roles = [],
  initialFilterRole,
  initialFilterSearch,
}) {
  // Pré-filtro externo: ao montar, propaga initialFilter* p/ parent (que controla state).
  // Lazy init pattern compatível com KEY+lazy de navegacao.md (parent deve passar `key`
  // distinto quando quiser que UsersTab re-aplique o pré-filtro).
  useEffect(() => {
    if (initialFilterSearch && !searchQuery) {
      onSearchChange?.(initialFilterSearch);
    }
    if (initialFilterRole && !filterRole) {
      onFilterChange?.(initialFilterRole);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter users by search query and role
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        !searchQuery ||
        user.nome?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole = !filterRole || user.role === filterRole;

      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, filterRole]);

  // User statistics
  const activeUsers = useMemo(() => {
    return users.filter((u) => u.active).length;
  }, [users]);

  // Active filter chips — derivados do state controlado pelo parent
  const activeFilters = useMemo(() => {
    const f = [];
    if (searchQuery) {
      f.push({
        key: 'search',
        label: 'Busca',
        value: searchQuery,
        onClear: () => onSearchChange?.(''),
      });
    }
    if (filterRole) {
      const roleObj = roles.find((r) => r.id === filterRole);
      const roleLabel = roleObj?.label || roleObj?.name || getRoleName(filterRole);
      f.push({
        key: 'role',
        label: 'Cargo',
        value: roleLabel,
        onClear: () => onFilterChange?.(''),
      });
    }
    return f;
  }, [searchQuery, filterRole, roles, onSearchChange, onFilterChange]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-3 bg-muted rounded w-1/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Health alert: profiles ↔ authorized_emails sync issues. Admin-only via RPC. */}
      <UserSyncHealthAlert
        onNavigateToEmails={onNavigateToEmails}
        onResolveOrphan={onResolveOrphan}
      />

      {/* Role Filter */}
      {roles.length > 0 && (
        <Select
          value={filterRole || ''}
          onChange={(value) => onFilterChange?.(value)}
          placeholder="Filtrar por cargo"
          options={[
            { value: '', label: 'Todos os cargos' },
            ...roles.map((role) => ({
              value: role.id,
              label: role.label || role.name || getRoleName(role.id),
            })),
          ]}
        />
      )}

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((f) => (
            <span
              key={f.key}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground"
            >
              <span className="text-muted-foreground">{f.label}:</span>
              <span className="font-medium truncate max-w-[160px]">{f.value}</span>
              <button
                type="button"
                onClick={() => f.onClear()}
                aria-label={`Remover filtro ${f.label}`}
                className="ml-1 rounded-full p-1 hover:bg-muted transition-colors"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => activeFilters.forEach((f) => f.onClear())}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Limpar tudo
          </button>
        </div>
      )}

      {/* User Counter */}
      <p className="text-sm text-muted-foreground">
        {filteredUsers.length === users.length
          ? `${users.length} usuarios | ${activeUsers} ativos`
          : `${filteredUsers.length} de ${users.length} usuarios | ${activeUsers} ativos`}
      </p>

      {/* User List - Accordion Layout */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <Accordion type="single" collapsible>
            {filteredUsers.map((user) => (
              <AccordionItem key={user.id} value={user.id}>
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="h-8 w-8">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.nome}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover rounded-full"
                        />
                      ) : (
                        <AvatarFallback
                          className="bg-muted text-primary font-medium text-xs"
                        >
                          {getInitials(user.nome)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-medium text-foreground truncate">
                        {user.nome}
                      </p>
                      {/* Meta linha 2: email · último acesso (visível mesmo colapsado) */}
                      <p className="text-xs text-muted-foreground truncate">
                        <span className="truncate">{user.email || 'sem email'}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="whitespace-nowrap">
                          {user.lastAccess ? formatRelativeTime(user.lastAccess) : 'nunca acessou'}
                        </span>
                      </p>
                      {/* TODO(ds-tokens): role/coordenador badges usam hex inline via getRoleColor/COORDENADOR_BADGE
                          (src/utils/userTypes.js). Refactor: mapear roleId → category-* token (design-tokens.md).
                          Pendente porque getRoleColor é usado em N lugares e exige migração coordenada. */}
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        <Badge
                          size="sm"
                          style={{
                            backgroundColor: getRoleColor(user.role),
                            color: 'white',
                          }}
                        >
                          {getRoleName(user.role)}
                        </Badge>
                        {user.isCoordenador && (
                          <Badge
                            size="sm"
                            style={{
                              backgroundColor: COORDENADOR_BADGE.color,
                              color: 'white',
                            }}
                          >
                            {COORDENADOR_BADGE.name}
                          </Badge>
                        )}
                        {user.isAdmin && (
                          <Badge
                            size="sm"
                            className="bg-primary text-primary-foreground"
                          >
                            Admin
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Email
                      </p>
                      <p className="text-sm text-foreground break-all">
                        {user.email}
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Ultimo acesso
                        </p>
                        <p className="text-sm text-foreground">
                          {user.lastAccess ? formatRelativeTime(user.lastAccess) : 'Nunca'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Total de acessos
                        </p>
                        <p className="text-sm text-foreground">
                          {user.accessCount || 0}
                        </p>
                      </div>
                    </div>
                    {user.customPermissions && (
                      <Badge variant="secondary">
                        Permissoes Personalizadas
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      className="w-full mt-2 min-h-[44px]"
                      onClick={() => onEditUser?.(user)}
                    >
                      Editar Permissoes
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

      {/* Empty State */}
      {filteredUsers.length === 0 && (
        <div className="text-center py-8">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {searchQuery || filterRole
              ? 'Nenhum usuario encontrado com os filtros aplicados'
              : 'Nenhum usuario cadastrado'}
          </p>
        </div>
      )}

      {/* CTA para adicionar novo usuário via allowlist de emails.
          Profiles são criados automaticamente quando user autoriza-do faz primeiro login
          (rpc_create_profile lê authorized_emails e cria o profile). */}
      <div className="rounded-xl border border-border-strong bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Mail className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Adicionar novo usuário</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Autorize o email na aba <strong>Emails</strong> com o cargo desejado.
              O perfil é criado automaticamente no primeiro login.
            </p>
          </div>
        </div>
        {onNavigateToEmails && (
          <Button
            variant="default"
            className="w-full min-h-[44px]"
            onClick={() => onNavigateToEmails()}
            aria-label="Ir para aba de emails autorizados"
          >
            <span>Ir para aba Emails</span>
            <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default UsersTab;
