/**
 * PermissionsModal Component
 *
 * Modal for editing user permissions in the Centro de Gestao.
 * Displays user info, role selector, and permission toggles organized by nav sections.
 *
 * @module management/components/PermissionsModal
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
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
  LayoutGrid,
  Settings,
  Bell,
  Check,
  GraduationCap,
  Home,
  Shield,
  Menu,
  Calculator,
  User,
  Users,
  Calendar,
  Target,
  BookOpen,
  AlertTriangle,
  Video,
  Wrench,
  MessageSquare,
  ListTodo,
  Zap,
  DollarSign,
  UserCog,
  ShieldAlert,
  TrendingUp,
  Network,
  Scale,
  FileSearch,
  FileBarChart,
  QrCode,
  FileText,
  Hospital,
} from 'lucide-react';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Navigation structure mapping sections to their cards and permission items
 * Organized to reflect all app features
 */
const NAV_STRUCTURE = {
  home: {
    label: 'Home',
    icon: Home,
    cards: [
      { id: 'comunicados', label: 'Comunicados', icon: MessageSquare },
      { id: 'pendencias', label: 'Pendências', icon: Bell },
      { id: 'perfil', label: 'Perfil', icon: User },
      { id: 'atalhos', label: 'Atalhos Personalizados', icon: LayoutGrid },
      { id: 'plantao', label: 'Plantão do Dia', icon: Calendar },
      { id: 'ferias', label: 'Férias', icon: Calendar },
      { id: 'estagios_residencia', label: 'Estágios Residência', icon: GraduationCap },
      { id: 'plantao_residencia', label: 'Plantão Residência', icon: Calendar },
    ],
  },
  gestao: {
    label: 'Gestão',
    icon: Shield,
    cards: [
      { id: 'incidentes', label: 'Gestão de Incidentes', icon: AlertTriangle },
      { id: 'relatar_notificacao', label: 'Relatar Notificação', icon: AlertTriangle },
      { id: 'fazer_denuncia', label: 'Fazer Denúncia', icon: ShieldAlert },
      { id: 'meus_relatos', label: 'Meus Relatos', icon: FileText },
      { id: 'notificacao_unimed', label: 'Notificação Unimed', icon: Hospital },
      { id: 'qrcode_generator', label: 'Gerar QR Code', icon: QrCode },
      { id: 'biblioteca', label: 'Biblioteca de Documentos', icon: BookOpen },
      { id: 'qualidade', label: 'Qualidade', icon: Target },
      { id: 'painel_gestao', label: 'Painel de Gestão', icon: TrendingUp },
      { id: 'organograma', label: 'Organograma', icon: Network },
      { id: 'etica_bioetica', label: 'Ética e Bioética', icon: Scale },
      { id: 'comites', label: 'Comitês', icon: Users },
      { id: 'auditorias', label: 'Auditorias', icon: FileSearch },
      { id: 'relatorios', label: 'Relatórios', icon: FileBarChart },
      { id: 'desastres', label: 'Desastres', icon: ShieldAlert },
      { id: 'faturamento', label: 'Faturamento', icon: DollarSign },
      { id: 'escalas', label: 'Escalas', icon: Calendar },
      { id: 'reunioes', label: 'Reuniões', icon: Users },
    ],
  },
  educacao: {
    label: 'Educação',
    icon: GraduationCap,
    cards: [
      { id: 'educacao_continuada', label: 'Educação Continuada', icon: BookOpen },
      { id: 'rops_desafio', label: 'Desafio ROPs', icon: Target },
      { id: 'residencia', label: 'Residência Médica', icon: GraduationCap },
    ],
  },
  menu: {
    label: 'Menu',
    icon: Menu,
    cards: [
      { id: 'calculadoras', label: 'Calculadoras', icon: Calculator },
      { id: 'manutencao', label: 'Manutenção', icon: Wrench },
    ],
  },
};

/**
 * Mock roles configuration (cargo do usuário - separado de admin)
 * Admin é uma permissão especial separada do cargo
 */
const mockRoles = [
  { id: 'anestesiologista', name: 'Anestesiologista', color: '#2563eb' },
  { id: 'medico-residente', name: 'Médico Residente', color: '#8b5cf6' },
  { id: 'enfermeiro', name: 'Enfermeiro', color: '#10b981' },
  { id: 'tec-enfermagem', name: 'Téc. Enfermagem', color: '#06b6d4' },
  { id: 'farmaceutico', name: 'Farmacêutico', color: '#ec4899' },
  { id: 'colaborador', name: 'Colaborador', color: '#6366f1' },
  { id: 'secretaria', name: 'Secretária', color: '#f59e0b' },
];

// Coordenador é uma função adicional (pode coexistir com outros cargos)
const COORDENADOR_BADGE = { id: 'coordenador', name: 'Coordenador', color: '#16a085' };

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Returns hex color for a given role
 * @param {string} role - The role identifier
 * @returns {string} - Hex color code
 */
function getRoleColor(role) {
  if (role === COORDENADOR_BADGE.id) return COORDENADOR_BADGE.color;
  const roleConfig = mockRoles.find((r) => r.id === role);
  return roleConfig?.color || '#6B7280';
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
function UserHeader({ user, roleColor, roleName, isAdmin }) {
  return (
    <div className="rounded-2xl bg-[#F0FFF4] dark:bg-[#1A2F23] border border-[#C8E6C9] dark:border-[#2A3F36] overflow-hidden">
      {/* Color bar on top */}
      <div className="h-1.5" style={{ backgroundColor: roleColor }} />

      <div className="p-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 shrink-0 ring-2 ring-white dark:ring-[#1A2420] shadow-md">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.nome}
                className="h-full w-full object-cover rounded-full"
              />
            ) : (
              <AvatarFallback
                className="text-lg font-bold"
                style={{
                  backgroundColor: roleColor,
                  color: 'white',
                }}
              >
                {getInitials(user.nome)}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg text-black dark:text-white truncate">
              {user.nome}
            </h3>
            <p className="text-sm text-[#6B7280] dark:text-[#A3B8B0] truncate mb-2">
              {user.email}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: roleColor }}
              >
                {roleName}
              </span>
              {user.isCoordenador && (
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: COORDENADOR_BADGE.color }}
                >
                  {COORDENADOR_BADGE.name}
                </span>
              )}
              {isAdmin && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#006837] text-white">
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
      <label className="block text-sm font-medium text-[#6B7280] dark:text-[#A3B8B0] mb-2">
        Cargo Principal
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white dark:bg-[#1A2420] border border-[#C8E6C9] dark:border-[#2A3F36] text-left transition-colors hover:border-[#2ECC71] focus:outline-none focus:ring-2 focus:ring-[#2ECC71]/50"
      >
        <div className="flex items-center gap-3">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: selectedRoleConfig?.color || '#6B7280' }}
          />
          <span className="font-medium text-black dark:text-white">
            {selectedRoleConfig?.name || 'Selecionar cargo'}
          </span>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-[#9CA3AF] transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 py-2 rounded-xl bg-white dark:bg-[#1A2420] border border-[#C8E6C9] dark:border-[#2A3F36] shadow-lg">
          {mockRoles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => {
                onRoleChange(role.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F0FFF4] dark:hover:bg-[#1A2F23] ${
                selectedRole === role.id
                  ? 'bg-[#F0FFF4] dark:bg-[#1A2F23]'
                  : ''
              }`}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: role.color }}
              />
              <span className="flex-1 font-medium text-black dark:text-white">
                {role.name}
              </span>
              {selectedRole === role.id && (
                <Check className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Permission card - simplified to only show access toggle
 * Administrators automatically get CRUD permissions for all cards they have access to
 */
function PermissionCard({ card, enabled, onToggle }) {
  const Icon = card.icon;

  return (
    <div
      className={`rounded-xl border transition-colors ${
        enabled
          ? 'bg-[#F0FFF4] dark:bg-[#1A2F23] border-[#2ECC71]/30'
          : 'bg-[#F3F4F6] dark:bg-[#1A1F1C] border-[#E5E7EB] dark:border-[#2A3F36]'
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              enabled
                ? 'bg-[#006837]/10 dark:bg-[#2ECC71]/20'
                : 'bg-[#9CA3AF]/10 dark:bg-[#6B8178]/20'
            }`}
          >
            <Icon
              className={`w-4 h-4 ${
                enabled
                  ? 'text-[#006837] dark:text-[#2ECC71]'
                  : 'text-[#9CA3AF] dark:text-[#6B8178]'
              }`}
            />
          </div>
          <span
            className={`text-sm font-medium ${
              enabled
                ? 'text-black dark:text-white'
                : 'text-[#6B7280] dark:text-[#A3B8B0]'
            }`}
          >
            {card.label}
          </span>
        </div>
        <Switch
          checked={enabled}
          onChange={onToggle}
          size="sm"
        />
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
      <h4 className="text-sm font-semibold text-[#6B7280] dark:text-[#A3B8B0] uppercase tracking-wide">
        Configurações Especiais
      </h4>

      <div className="grid gap-3">
        {/* Administrador - Acesso total para criar/editar/excluir */}
        <div className="rounded-xl bg-[#F0FFF4] dark:bg-[#0D1F17] border-2 border-[#006837] dark:border-[#2ECC71] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#006837] flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-[#006837] dark:text-[#2ECC71] block">
                Administrador
              </span>
              <span className="text-sm text-[#6B7280] dark:text-[#A3B8B0]">
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
        <div className="rounded-xl bg-[#FFF7ED] dark:bg-[#2A2520] border border-[#FDBA74]/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#F97316]/10 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-[#F97316]" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-black dark:text-white block">
                Responsável por Notificações
              </span>
              <span className="text-sm text-[#6B7280] dark:text-[#A3B8B0]">
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
        <div className="rounded-xl bg-[#EFF6FF] dark:bg-[#1A2530] border border-[#93C5FD]/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5 text-[#3B82F6]" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-black dark:text-white block">
                Editar Residência
              </span>
              <span className="text-sm text-[#6B7280] dark:text-[#A3B8B0]">
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
        <div className="rounded-xl bg-[#ECFEFF] dark:bg-[#1A2A2D] border border-[#67E8F9]/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#06B6D4]/10 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-[#06B6D4]" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-black dark:text-white block">
                Editar Téc. Enfermagem e Secretárias
              </span>
              <span className="text-sm text-[#6B7280] dark:text-[#A3B8B0]">
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
  // Helper to get all cards enabled by default
  const getAllCardsEnabled = () => {
    const allCards = {};
    Object.values(NAV_STRUCTURE).forEach((section) => {
      section.cards.forEach((card) => {
        allCards[card.id] = true;
      });
    });
    return allCards;
  };

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

  // Get role color
  const roleColor = useMemo(() => getRoleColor(selectedRole), [selectedRole]);

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
      <div className="relative w-full max-w-2xl my-auto bg-white dark:bg-[#1A2420] rounded-3xl shadow-xl flex flex-col" style={{ maxHeight: 'calc(100vh - 32px)' }}>
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 w-10 h-10 rounded-xl flex items-center justify-center text-[#9CA3AF] hover:text-black dark:hover:text-white hover:bg-[#F3F4F6] dark:hover:bg-[#2A3F36] transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#006837]/10 dark:bg-[#2ECC71]/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#006837] dark:text-[#2ECC71]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-black dark:text-white">
                Editar Permissões
              </h2>
              <p className="text-sm text-[#6B7280] dark:text-[#A3B8B0]">
                Configure o acesso do usuario ao sistema
              </p>
            </div>
          </div>

          {/* User Info */}
          <UserHeader
            user={{ ...user, isCoordenador }}
            roleColor={roleColor}
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
            <div className="rounded-xl bg-white dark:bg-[#1A2420] border border-[#C8E6C9] dark:border-[#2A3F36] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-black dark:text-white">
                    Coordenador
                  </p>
                  <p className="text-sm text-[#6B7280] dark:text-[#A3B8B0]">
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

            {/* Permissions by Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-[#6B7280] dark:text-[#A3B8B0] uppercase tracking-wide">
                Permissões por Seção
              </h4>

              <Accordion type="multiple" className="space-y-3">
                {Object.entries(NAV_STRUCTURE).map(([sectionKey, section]) => {
                  const SectionIcon = section.icon;
                  const sectionHasPermissions = section.cards.some(
                    (card) => cardPermissions[card.id]
                  );

                  return (
                    <AccordionItem
                      key={sectionKey}
                      value={sectionKey}
                      className="border border-[#E5E7EB] dark:border-[#2A3F36] rounded-xl overflow-hidden"
                    >
                      <AccordionTrigger
                        className={`px-4 py-3 hover:no-underline ${
                          sectionHasPermissions
                            ? 'bg-[#F0FFF4] dark:bg-[#1A2F23]'
                            : 'bg-[#F3F4F6] dark:bg-[#1A1F1C]'
                        }`}
                      >
                        <div className="flex items-center justify-between flex-1 mr-2">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                sectionHasPermissions
                                  ? 'bg-[#006837]/10 dark:bg-[#2ECC71]/20'
                                  : 'bg-[#9CA3AF]/10 dark:bg-[#6B8178]/20'
                              }`}
                            >
                              <SectionIcon
                                className={`w-4 h-4 ${
                                  sectionHasPermissions
                                    ? 'text-[#006837] dark:text-[#2ECC71]'
                                    : 'text-[#9CA3AF] dark:text-[#6B8178]'
                                }`}
                              />
                            </div>
                            <span
                              className={`font-medium ${
                                sectionHasPermissions
                                  ? 'text-black dark:text-white'
                                  : 'text-[#6B7280] dark:text-[#A3B8B0]'
                              }`}
                            >
                              {section.label}
                            </span>
                          </div>
                          {sectionHasPermissions && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#006837]/10 dark:bg-[#2ECC71]/20 text-[#006837] dark:text-[#2ECC71]">
                              Ativo
                            </span>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-3 bg-white dark:bg-[#1A2420]">
                        <div className="space-y-2">
                          {section.cards.map((card) => (
                            <PermissionCard
                              key={card.id}
                              card={card}
                              enabled={cardPermissions[card.id] || false}
                              onToggle={(enabled) => handleCardToggle(card.id, enabled)}
                            />
                          ))}
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
        <div className="px-6 py-4 bg-[#F9FAFB] dark:bg-[#141A17] border-t border-[#E5E7EB] dark:border-[#2A3F36]">
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full sm:w-auto border-[#C8E6C9] dark:border-[#2A3F36] text-[#6B7280] dark:text-[#A3B8B0] hover:bg-[#F3F4F6] dark:hover:bg-[#1A1F1C]"
            >
              Cancelar
            </Button>
            <Button
              variant="default"
              onClick={handleSave}
              className="w-full sm:w-auto bg-[#006837] hover:bg-[#004225] dark:bg-[#2ECC71] dark:hover:bg-[#27AE60] dark:text-[#0A0F0D]"
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
