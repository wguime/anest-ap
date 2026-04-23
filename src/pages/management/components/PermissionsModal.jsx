/**
 * PermissionsModal Component
 *
 * Modal for editing user permissions in the Centro de Gestao.
 * Displays user info, role selector, and permission toggles organized by nav sections.
 *
 * @module management/components/PermissionsModal
 */

import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/design-system/utils/tokens';
import {
  Button,
  Avatar,
  AvatarFallback,
  Switch,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/design-system';
import {
  X,
  ChevronDown,
  Bell,
  Check,
  GraduationCap,
  Shield,
  Users,
  EyeOff,
} from 'lucide-react';
import { NAV_STRUCTURE, getAllCardIds } from '@/data/rolePermissionTemplates';
import PermissionCardWithSubs from './PermissionCardWithSubs';

/**
 * Mock roles configuration (cargo do usuário - separado de admin)
 * Admin é uma permissão especial separada do cargo
 *
 * `colorClass` → tailwind bg utility (DS token) used for surfaces/badges
 * `dotClass`   → bullet indicator variant
 */
const mockRoles = [
  { id: 'anestesiologista', name: 'Anestesiologista', colorClass: 'bg-category-blue', dotClass: 'bg-category-blue' },
  { id: 'medico-residente', name: 'Médico Residente', colorClass: 'bg-category-purple', dotClass: 'bg-category-purple' },
  { id: 'enfermeiro', name: 'Enfermeiro', colorClass: 'bg-success', dotClass: 'bg-success' },
  { id: 'tec-enfermagem', name: 'Téc. Enfermagem', colorClass: 'bg-category-cyan', dotClass: 'bg-category-cyan' },
  { id: 'farmaceutico', name: 'Farmacêutico', colorClass: 'bg-category-pink', dotClass: 'bg-category-pink' },
  { id: 'colaborador', name: 'Colaborador', colorClass: 'bg-category-indigo', dotClass: 'bg-category-indigo' },
  { id: 'secretaria', name: 'Secretária', colorClass: 'bg-warning', dotClass: 'bg-warning' },
];

// Coordenador é uma função adicional (pode coexistir com outros cargos)
const COORDENADOR_BADGE = { id: 'coordenador', name: 'Coordenador', colorClass: 'bg-category-teal', dotClass: 'bg-category-teal' };

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Returns the Tailwind bg class for a given role (DS token)
 * @param {string} role - The role identifier
 * @returns {string} - Tailwind utility class
 */
function getRoleColorClass(role) {
  if (role === COORDENADOR_BADGE.id) return COORDENADOR_BADGE.colorClass;
  const roleConfig = mockRoles.find((r) => r.id === role);
  return roleConfig?.colorClass || 'bg-muted-foreground';
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
 * Gets the display name for a role
 * @param {string} role - The role identifier
 * @returns {string} - Display name
 */
function getRoleName(role) {
  if (role === COORDENADOR_BADGE.id) return COORDENADOR_BADGE.name;
  const roleConfig = mockRoles.find((r) => r.id === role);
  return roleConfig?.name || role;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * User header with avatar, info and role badge
 */
function UserHeader({ user, roleColorClass, roleName, isAdmin }) {
  return (
    <div className="rounded-2xl bg-background dark:bg-muted border border-border overflow-hidden">
      {/* Color bar on top */}
      <div className={cn('h-1.5', roleColorClass)} />

      <div className="p-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 shrink-0 ring-2 ring-card dark:ring-muted shadow-md">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.nome}
                loading="lazy"
                decoding="async"
                width={56}
                height={56}
                className="h-full w-full object-cover rounded-full"
              />
            ) : (
              <AvatarFallback className={cn('text-lg font-bold text-white', roleColorClass)}>
                {getInitials(user.nome)}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg text-foreground truncate">
              {user.nome}
            </h3>
            <p className="text-sm text-muted-foreground truncate mb-2">
              {user.email}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white',
                  roleColorClass
                )}
              >
                {roleName}
              </span>
              {user.isCoordenador && (
                <span
                  className={cn(
                    'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white',
                    COORDENADOR_BADGE.colorClass
                  )}
                >
                  {COORDENADOR_BADGE.name}
                </span>
              )}
              {isAdmin && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary text-white">
                  Administrador
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Role selector dropdown
 */
function RoleSelector({ selectedRole, onRoleChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedRoleConfig = mockRoles.find((r) => r.id === selectedRole);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-muted-foreground mb-2">
        Cargo Principal
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-card border border-border text-left transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'w-3 h-3 rounded-full shrink-0',
              selectedRoleConfig?.dotClass || 'bg-muted-foreground'
            )}
          />
          <span className="font-medium text-foreground">
            {selectedRoleConfig?.name || 'Selecionar cargo'}
          </span>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-muted-foreground transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 py-2 rounded-xl bg-card border border-border shadow-lg">
          {mockRoles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => {
                onRoleChange(role.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-background dark:hover:bg-muted ${
                selectedRole === role.id
                  ? 'bg-background dark:bg-muted'
                  : ''
              }`}
            >
              <span
                className={cn('w-3 h-3 rounded-full shrink-0', role.dotClass)}
              />
              <span className="flex-1 font-medium text-foreground">
                {role.name}
              </span>
              {selectedRole === role.id && (
                <Check className="w-4 h-4 text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Leaf-level permission row — Nível 2 (ícone) sem sub-ícones.
 * Renders icon in colored box + label + size="sm" Switch.
 */
function PermissionCard({ card, enabled, onToggle }) {
  const Icon = card.icon;

  return (
    <div
      className={`rounded-xl border transition-colors ${
        enabled
          ? 'bg-background dark:bg-muted border-primary/30'
          : 'bg-muted dark:bg-muted border-border dark:border-border'
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              enabled
                ? 'bg-primary/10 dark:bg-primary/20'
                : 'bg-muted-foreground/10 dark:bg-muted-foreground/20'
            }`}
          >
            <Icon
              className={`w-4 h-4 ${
                enabled ? 'text-primary' : 'text-muted-foreground'
              }`}
            />
          </div>
          <span
            className={`text-sm font-medium truncate ${
              enabled ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {card.label}
          </span>
        </div>
        <Switch checked={enabled} onChange={onToggle} size="sm" />
      </div>
    </div>
  );
}


/**
 * Special settings section
 */
function SpecialSettings({
  isAdmin,
  onAdminChange,
  isIncidentResponsible,
  onIncidentResponsibleChange,
  canEditResidencia,
  onCanEditResidenciaChange,
  canEditTecEnfSecretaria,
  onCanEditTecEnfSecretariaChange,
}) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Configurações Especiais
      </h4>

      <div className="grid gap-3">
        {/* Administrador - Acesso total para criar/editar/excluir */}
        <div className="rounded-xl bg-background border-2 border-primary p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-primary block">
                Administrador
              </span>
              <span className="text-sm text-muted-foreground">
                Acesso total - pode criar, editar e excluir qualquer item
              </span>
            </div>
            <Switch
              checked={isAdmin}
              onChange={onAdminChange}
              size="sm"
            />
          </div>
        </div>

        {/* Responsavel por Notificacoes */}
        <div className="rounded-xl bg-category-orange-bg dark:bg-category-orange-bg border border-category-orange/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-category-orange/10 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-category-orange-fg" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-foreground block">
                Responsável por Notificações
              </span>
              <span className="text-sm text-muted-foreground">
                Receber notificações de incidentes e denúncias
              </span>
            </div>
            <Switch
              checked={isIncidentResponsible}
              onChange={onIncidentResponsibleChange}
              size="sm"
            />
          </div>
        </div>

        {/* Editar Residencia */}
        <div className="rounded-xl bg-category-blue-bg dark:bg-category-blue-bg border border-category-blue/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-category-blue/10 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5 text-category-blue-fg" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-foreground block">
                Editar Residência
              </span>
              <span className="text-sm text-muted-foreground">
                Permissão para editar dados da residência médica
              </span>
            </div>
            <Switch
              checked={canEditResidencia}
              onChange={onCanEditResidenciaChange}
              size="sm"
            />
          </div>
        </div>

        {/* Editar Tec. Enfermagem e Secretarias */}
        <div className="rounded-xl bg-category-cyan-bg dark:bg-category-cyan-bg border border-category-cyan/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-category-cyan/10 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-category-cyan-fg" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-foreground block">
                Editar Téc. Enfermagem e Secretárias
              </span>
              <span className="text-sm text-muted-foreground">
                Permissão para editar dados de técnicos de enfermagem e secretárias
              </span>
            </div>
            <Switch
              checked={canEditTecEnfSecretaria}
              onChange={onCanEditTecEnfSecretariaChange}
              size="sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * PermissionsModal Component
 *
 * Modal for editing user permissions in the Centro de Gestao.
 *
 * @param {Object} props
 * @param {Object} props.user - User object with id, nome, email, role, permissions
 * @param {Object} props.incidentConfig - Incident notification configuration
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {Function} props.onSave - Callback when permissions are saved
 */
function PermissionsModal({ user, incidentConfig = {}, onClose, onSave }) {
  // Helper to get all cards + sub-cards enabled by default (uses SSOT recursion)
  const getAllCardsEnabled = () => getAllCardIds(true);

  // State - Simplified: only track which cards user has access to
  // Administrators automatically get CRUD permissions for all cards they have access to
  const initialRole =
    user?.role === 'coordenador' ? 'colaborador' : (user?.role || 'colaborador');
  const [selectedRole, setSelectedRole] = useState(initialRole);
  const [isCoordenador, setIsCoordenador] = useState(
    user?.isCoordenador || user?.role === 'coordenador' || false
  );
  const SPECIAL_PERMISSION_KEYS = ['residencia-edit', 'tec-enf-secretaria-edit'];
  const [cardPermissions, setCardPermissions] = useState(() => {
    // Initialize from user's existing permissions (JSONB field), filtering out special keys
    if (user?.permissions && typeof user.permissions === 'object' && Object.keys(user.permissions).length > 0) {
      const cardPerms = {};
      for (const [key, value] of Object.entries(user.permissions)) {
        if (!SPECIAL_PERMISSION_KEYS.includes(key)) {
          cardPerms[key] = value;
        }
      }
      if (Object.keys(cardPerms).length > 0) return cardPerms;
    }
    return getAllCardsEnabled();
  });
  const [isIncidentResponsible, setIsIncidentResponsible] = useState(
    incidentConfig?.receberIncidentes || false
  );
  const [notificarEmail, setNotificarEmail] = useState(
    incidentConfig?.notificarEmail ?? true
  );
  const [notificarApp, setNotificarApp] = useState(
    incidentConfig?.notificarApp ?? true
  );
  const [canEditResidencia, setCanEditResidencia] = useState(
    user?.permissions?.['residencia-edit'] || false
  );
  const [canEditTecEnfSecretaria, setCanEditTecEnfSecretaria] = useState(
    user?.permissions?.['tec-enf-secretaria-edit'] || false
  );
  const [isAdmin, setIsAdmin] = useState(user?.isAdmin || user?.role === 'administrador' || false);

  // Get role color class (DS token)
  const roleColorClass = useMemo(() => getRoleColorClass(selectedRole), [selectedRole]);

  // Handlers - simplified
  const handleCardToggle = useCallback((cardId, enabled) => {
    setCardPermissions((prev) => ({
      ...prev,
      [cardId]: enabled,
    }));
  }, []);

  const handleSave = useCallback(() => {
    const incidentSettings = {
      receberIncidentes: isIncidentResponsible,
      receberDenuncias: isIncidentResponsible,
      notificarEmail,
      notificarApp,
      categorias: incidentConfig?.categorias || [],
    };
    // Save cardPermissions and isAdmin - admins get CRUD automatically
    onSave?.(selectedRole, { cardPermissions, isAdmin }, incidentSettings, { isCoordenador, canEditResidencia, canEditTecEnfSecretaria });
  }, [
    selectedRole,
    cardPermissions,
    isAdmin,
    isCoordenador,
    canEditResidencia,
    canEditTecEnfSecretaria,
    isIncidentResponsible,
    notificarEmail,
    notificarApp,
    incidentConfig?.categorias,
    onSave,
  ]);

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 dark:bg-black/70 p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl my-auto bg-card rounded-3xl shadow-xl flex flex-col" style={{ maxHeight: 'calc(100dvh - 32px)' }}>
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Editar Permissões
              </h2>
              <p className="text-sm text-muted-foreground">
                Configure o acesso do usuario ao sistema
              </p>
            </div>
          </div>

          {/* User Info */}
          <UserHeader
            user={{ ...user, isCoordenador }}
            roleColorClass={roleColorClass}
            roleName={getRoleName(selectedRole)}
            isAdmin={isAdmin}
          />
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 overscroll-contain">
          <div className="space-y-6">
            {/* Role Selector */}
            <RoleSelector
              selectedRole={selectedRole}
              onRoleChange={setSelectedRole}
            />

            {/* Coordenador (função adicional) */}
            <div className="rounded-xl bg-card border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    Coordenador
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Função adicional (pode coexistir com outros cargos)
                  </p>
                </div>
                <Switch
                  checked={isCoordenador}
                  onChange={setIsCoordenador}
                  size="sm"
                />
              </div>
            </div>

            {/* Permissions by Section — hierarchy: Página > Ícone > Sub-ícone */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Permissões por Seção
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  Página ▸ Ícone ▸ Sub-ícone
                </span>
              </div>

              <Accordion type="multiple" className="space-y-3">
                {Object.entries(NAV_STRUCTURE).map(([sectionKey, section]) => {
                  const SectionIcon = section.icon;
                  // Count active icons at level 2 (ignoring cascade for the badge is fine)
                  const activeCount = section.cards.filter(
                    (c) => cardPermissions[c.id] !== false
                  ).length;
                  const totalCount = section.cards.length;
                  const sectionHasAny = activeCount > 0;

                  return (
                    <AccordionItem
                      key={sectionKey}
                      value={sectionKey}
                      className="border-2 border-primary/20 dark:border-primary/30 rounded-xl overflow-hidden"
                    >
                      <AccordionTrigger
                        className={`px-4 py-3 hover:no-underline ${
                          sectionHasAny
                            ? 'bg-primary/10 dark:bg-primary/15'
                            : 'bg-muted dark:bg-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between flex-1 mr-2 gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                sectionHasAny
                                  ? 'bg-primary text-white'
                                  : 'bg-muted-foreground/20 text-muted-foreground'
                              }`}
                            >
                              <SectionIcon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex flex-col items-start">
                              <span
                                className={`font-bold uppercase tracking-wider text-sm ${
                                  sectionHasAny
                                    ? 'text-primary'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {section.label}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {activeCount}/{totalCount} ícones ativos
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {section.hidden && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-muted text-muted-foreground">
                                <EyeOff className="w-3 h-3" />
                                Oculto
                              </span>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-3 bg-card">
                        <div className="space-y-2">
                          {section.cards.map((card) => {
                            const enabled = cardPermissions[card.id] !== false;
                            if (Array.isArray(card.subCards) && card.subCards.length > 0) {
                              return (
                                <PermissionCardWithSubs
                                  key={card.id}
                                  card={card}
                                  enabled={enabled}
                                  permissions={cardPermissions}
                                  onToggle={(v) => handleCardToggle(card.id, v)}
                                  onSubToggle={(subId, v) => handleCardToggle(subId, v)}
                                />
                              );
                            }
                            return (
                              <PermissionCard
                                key={card.id}
                                card={card}
                                enabled={enabled}
                                onToggle={(v) => handleCardToggle(card.id, v)}
                              />
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>

            {/* Special Settings */}
            <SpecialSettings
              isAdmin={isAdmin}
              onAdminChange={setIsAdmin}
              isIncidentResponsible={isIncidentResponsible}
              onIncidentResponsibleChange={setIsIncidentResponsible}
              canEditResidencia={canEditResidencia}
              onCanEditResidenciaChange={setCanEditResidencia}
              canEditTecEnfSecretaria={canEditTecEnfSecretaria}
              onCanEditTecEnfSecretariaChange={setCanEditTecEnfSecretaria}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-muted dark:bg-muted border-t border-border dark:border-border">
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full sm:w-auto border-border text-muted-foreground hover:bg-muted dark:hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              variant="default"
              onClick={handleSave}
              className="w-full sm:w-auto bg-primary hover:bg-primary-hover dark:hover:bg-primary-hover dark:text-foreground"
            >
              <Check className="w-4 h-4 mr-2" />
              Salvar Permissões
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PermissionsModal;
