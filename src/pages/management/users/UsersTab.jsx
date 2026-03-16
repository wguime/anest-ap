import { useMemo } from 'react';
import {
  Badge,
  Button,
  Avatar,
  AvatarFallback,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  SearchBar,
  Select,
} from '@/design-system';
import { Users } from 'lucide-react';
import { COORDENADOR_BADGE, getRoleColor, getRoleName } from '@/utils/userTypes';

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
 * @param {Function} props.onAddUser - Callback when adding a new user
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
  onAddUser,
  searchQuery = '',
  onSearchChange,
  filterRole = '',
  onFilterChange,
  roles = [],
}) {
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

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-[#C8E6C9] dark:border-[#2A3F36] bg-white dark:bg-[#1A2420] p-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Input - mesmo componente usado na HomePage */}
      <SearchBar
        value={searchQuery}
        onChange={(val) => onSearchChange?.(typeof val === 'string' ? val : val?.target?.value || '')}
        placeholder="Buscar usuario..."
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

      {/* User Counter */}
      <p className="text-sm text-[#6B7280] dark:text-[#A3B8B0]">
        {filteredUsers.length === users.length
          ? `${users.length} usuarios | ${activeUsers} ativos`
          : `${filteredUsers.length} de ${users.length} usuarios | ${activeUsers} ativos`}
      </p>

      {/* User List - Accordion Layout */}
      <div className="bg-white dark:bg-[#1A2420] rounded-2xl border border-[#C8E6C9] dark:border-[#2A3F36] overflow-hidden">
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
                          className="h-full w-full object-cover rounded-full"
                        />
                      ) : (
                        <AvatarFallback
                          className="bg-[#E8F5E9] dark:bg-[#2A3F36] text-[#006837] dark:text-[#2ECC71] font-medium text-xs"
                        >
                          {getInitials(user.nome)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-medium text-black dark:text-white truncate">
                        {user.nome}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
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
                            className="bg-[#006837] text-white"
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
                      <p className="text-xs text-[#9CA3AF] dark:text-[#6B8178] mb-1">
                        Email
                      </p>
                      <p className="text-sm text-black dark:text-white">
                        {user.email}
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <div>
                        <p className="text-xs text-[#9CA3AF] dark:text-[#6B8178] mb-1">
                          Ultimo acesso
                        </p>
                        <p className="text-sm text-black dark:text-white">
                          {user.lastAccess ? formatRelativeTime(user.lastAccess) : 'Nunca'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#9CA3AF] dark:text-[#6B8178] mb-1">
                          Total de acessos
                        </p>
                        <p className="text-sm text-black dark:text-white">
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
                      size="sm"
                      variant="outline"
                      className="w-full mt-2 border-[#C8E6C9] dark:border-[#2A3F36] text-[#006837] dark:text-[#2ECC71] hover:bg-[#E8F5E9] dark:hover:bg-[#2A3F36]"
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
          <Users className="w-12 h-12 text-[#9CA3AF] dark:text-[#6B8178] mx-auto mb-3" />
          <p className="text-[#6B7280] dark:text-[#A3B8B0]">
            {searchQuery || filterRole
              ? 'Nenhum usuario encontrado com os filtros aplicados'
              : 'Nenhum usuario cadastrado'}
          </p>
        </div>
      )}

      {/* Add User Button */}
      <Button
        variant="default"
        className="w-full bg-[#006837] hover:bg-[#004225] dark:bg-[#2ECC71] dark:hover:bg-[#27AE60] dark:text-[#0A0F0D]"
        onClick={() => onAddUser?.()}
      >
        <Users className="w-4 h-4 mr-2" />
        + Adicionar Usuario
      </Button>
    </div>
  );
}

export default UsersTab;
