import React from 'react';
import { Card, CardContent } from '@/design-system';
import { BarChart3, Users, Shield, TrendingUp, FileText, Archive } from 'lucide-react';

/**
 * Extracts the first name from a full name string
 * @param {string} fullName - The full name to extract from
 * @returns {string} The first name
 */
const getFirstName = (fullName) => {
  if (!fullName) return '';
  return fullName.split(' ')[0];
};

/**
 * Formats a date as relative time in Portuguese (e.g., "ha X dias")
 * @param {Date|string|number} date - The date to format
 * @returns {string} The formatted relative time string
 */
const formatRelativeTime = (date) => {
  if (!date) return '';

  const now = new Date();
  const targetDate = date instanceof Date ? date : new Date(date);
  const diffMs = now - targetDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) {
    return 'agora';
  }
  if (diffMinutes < 60) {
    return `ha ${diffMinutes} ${diffMinutes === 1 ? 'minuto' : 'minutos'}`;
  }
  if (diffHours < 24) {
    return `ha ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
  }
  if (diffDays === 1) {
    return 'ha 1 dia';
  }
  if (diffDays < 30) {
    return `ha ${diffDays} dias`;
  }
  if (diffDays < 60) {
    return 'ha 1 mes';
  }
  const diffMonths = Math.floor(diffDays / 30);
  return `ha ${diffMonths} meses`;
};

/**
 * StatsTab - Statistics and dashboard for Centro de Gestao
 *
 * @param {Object} props
 * @param {number} props.totalUsers - Total number of users
 * @param {number} props.activeUsers - Number of active users
 * @param {number} props.customPermUsers - Number of users with custom permissions
 * @param {number} props.adminUsers - Number of admin users
 * @param {Array} props.usersByRole - Array of { id, name, count, color }
 * @param {Array} props.recentAccesses - Array of { id, nome, lastAccess }
 * @param {Array} props.documentStats - Array of { id, titulo, acessos }
 */
const StatsTab = ({
  totalUsers = 0,
  activeUsers = 0,
  customPermUsers = 0,
  adminUsers = 0,
  usersByRole = [],
  recentAccesses = [],
  documentStats = [],
  totalDocuments = 0,
  archivedDocuments = 0,
}) => {
  return (
    <>
      {/* Stats Cards - 3x2 Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        {/* Total Users */}
        <div className="bg-card rounded-2xl p-4 text-center shadow-sm dark:border dark:border-border">
          <p className="text-3xl font-bold text-primary">
            {totalUsers}
          </p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>

        {/* Active Users */}
        <div className="bg-card rounded-2xl p-4 text-center shadow-sm dark:border dark:border-border">
          <p className="text-3xl font-bold text-[#2E8B57] dark:text-[#58D68D]">
            {activeUsers}
          </p>
          <p className="text-xs text-muted-foreground">Ativos</p>
        </div>

        {/* Custom Permissions Users */}
        <div className="bg-card rounded-2xl p-4 text-center shadow-sm dark:border dark:border-border">
          <p className="text-3xl font-bold text-warning">
            {customPermUsers}
          </p>
          <p className="text-xs text-muted-foreground">Personalizados</p>
        </div>

        {/* Admin Users */}
        <div className="bg-card rounded-2xl p-4 text-center shadow-sm dark:border dark:border-border">
          <p className="text-3xl font-bold text-destructive">
            {adminUsers}
          </p>
          <p className="text-xs text-muted-foreground">Admins</p>
        </div>

        {/* Total Documents */}
        <div className="bg-card rounded-2xl p-4 text-center shadow-sm dark:border dark:border-border">
          <p className="text-3xl font-bold text-[#3B82F6]">
            {totalDocuments}
          </p>
          <p className="text-xs text-muted-foreground">Documentos</p>
        </div>

        {/* Archived Documents */}
        <div className="bg-card rounded-2xl p-4 text-center shadow-sm dark:border dark:border-border">
          <p className="text-3xl font-bold text-muted-foreground">
            {archivedDocuments}
          </p>
          <p className="text-xs text-muted-foreground">Arquivados</p>
        </div>
      </div>

      {/* Users by Role */}
      <Card variant="default" className="mb-4 border-border bg-card">
        <CardContent className="p-4">
          <h3 className="font-semibold text-black dark:text-white mb-3">
            Usuarios por Perfil
          </h3>
          <div className="space-y-2">
            {usersByRole.map((role) => (
              <div key={role.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: role.color }}
                  />
                  <span className="text-sm text-black dark:text-white">
                    {role.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Progress bar */}
                  <div className="w-16 h-2 bg-muted dark:bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${totalUsers > 0 ? (role.count / totalUsers) * 100 : 0}%`,
                        backgroundColor: role.color
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground w-6 text-right">
                    {role.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Accesses */}
      <Card variant="default" className="mb-4 border-border bg-card">
        <CardContent className="p-4">
          <h3 className="font-semibold text-black dark:text-white mb-3">
            Ultimos Acessos
          </h3>
          <div className="space-y-2">
            {recentAccesses.map((user) => (
              <div key={user.id} className="flex items-center justify-between py-2">
                <span className="text-sm text-black dark:text-white">
                  {getFirstName(user.nome)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatRelativeTime(user.lastAccess)}
                </span>
              </div>
            ))}
            {recentAccesses.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Nenhum acesso recente
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Most Accessed Documents */}
      <Card variant="default" className="mb-4 border-border bg-card">
        <CardContent className="p-4">
          <h3 className="font-semibold text-black dark:text-white mb-3">
            Documentos Mais Acessados
          </h3>
          <div className="space-y-2">
            {documentStats.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between py-2">
                <span className="text-sm text-black dark:text-white truncate flex-1 mr-4">
                  {doc.titulo}
                </span>
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {doc.acessos} views
                </span>
              </div>
            ))}
            {documentStats.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Nenhum documento acessado
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card variant="default" className="border-border bg-card">
        <CardContent className="p-4">
          <h3 className="font-semibold text-black dark:text-white mb-3">
            Resumo Geral
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-sm text-black dark:text-white">Usuarios ativos</span>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {activeUsers}/{totalUsers}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#3B82F6]" />
                <span className="text-sm text-black dark:text-white">Documentos ativos</span>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {totalDocuments}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <Archive className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-black dark:text-white">Documentos arquivados</span>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {archivedDocuments}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-destructive" />
                <span className="text-sm text-black dark:text-white">Administradores</span>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {adminUsers}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default StatsTab;
