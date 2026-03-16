/**
 * Role Permission Templates
 *
 * Single Source of Truth for:
 * - NAV_STRUCTURE: navigation sections and their card permissions
 * - ROLE_PERMISSION_TEMPLATES: default permissions per role
 *
 * Used by RolesTab (cargo management) and PermissionsModal (user permissions).
 *
 * @module data/rolePermissionTemplates
 */

import {
  Home,
  Shield,
  BarChart3,
  GraduationCap,
  Menu,
  MessageSquare,
  Bell,
  User,
  LayoutGrid,
  Calendar,
  Users,
  Inbox,
  AlertTriangle,
  ShieldAlert,
  FileText,
  Hospital,
  QrCode,
  BookOpen,
  Target,
  TrendingUp,
  ClipboardList,
  FileSearch,
  PlayCircle,
  CheckSquare,
  FileBarChart,
  Network,
  Scale,
  FolderOpen,
  DollarSign,
  Calculator,
  Wrench,
} from 'lucide-react';

/**
 * Navigation structure mapping sections to their cards and permission items.
 * Shared between RolesTab and PermissionsModal (SSOT).
 */
export const NAV_STRUCTURE = {
  home: {
    label: 'Home',
    icon: Home,
    cards: [
      { id: 'comunicados', label: 'Comunicados', icon: MessageSquare },
      { id: 'pendencias', label: 'Pendencias', icon: Bell },
      { id: 'perfil', label: 'Perfil', icon: User },
      { id: 'atalhos', label: 'Atalhos Personalizados', icon: LayoutGrid },
      { id: 'plantao', label: 'Plantao do Dia', icon: Calendar },
      { id: 'ferias', label: 'Ferias', icon: Calendar },
      { id: 'estagios_residencia', label: 'Estagios Residencia', icon: GraduationCap },
      { id: 'plantao_residencia', label: 'Plantao Residencia', icon: Calendar },
      { id: 'escala_funcionarios', label: 'Escala de Funcionarios', icon: Users },
      { id: 'inbox', label: 'Inbox / Mensagens', icon: Inbox },
    ],
  },
  gestao: {
    label: 'Gestao',
    icon: Shield,
    cards: [
      { id: 'incidentes', label: 'Gestao de Incidentes', icon: AlertTriangle },
      { id: 'relatar_notificacao', label: 'Relatar Notificacao', icon: AlertTriangle },
      { id: 'fazer_denuncia', label: 'Fazer Denuncia', icon: ShieldAlert },
      { id: 'meus_relatos', label: 'Meus Relatos', icon: FileText },
      { id: 'notificacao_unimed', label: 'Notificacao Unimed', icon: Hospital },
      { id: 'qrcode_generator', label: 'Gerar QR Code', icon: QrCode },
      { id: 'biblioteca', label: 'Biblioteca de Documentos', icon: BookOpen },
      { id: 'qualidade', label: 'Qualidade', icon: Target },
      { id: 'painel_gestao', label: 'Painel de Gestao', icon: TrendingUp },
      { id: 'planos_acao', label: 'Planos de Acao', icon: ClipboardList },
      { id: 'auditorias', label: 'Auditorias', icon: FileSearch },
      { id: 'auditorias_interativas', label: 'Auditorias Interativas', icon: PlayCircle },
      { id: 'autoavaliacao', label: 'Autoavaliacao Qmentum', icon: CheckSquare },
      { id: 'relatorios', label: 'Relatorios', icon: FileBarChart },
      { id: 'organograma', label: 'Organograma', icon: Network },
      { id: 'etica_bioetica', label: 'Etica e Bioetica', icon: Scale },
      { id: 'comites', label: 'Comites', icon: Users },
      { id: 'desastres', label: 'Desastres', icon: ShieldAlert },
      { id: 'gestao_documental', label: 'Gestao Documental', icon: FolderOpen },
      { id: 'faturamento', label: 'Faturamento', icon: DollarSign },
      { id: 'escalas', label: 'Escalas', icon: Calendar },
      { id: 'reunioes', label: 'Reunioes', icon: Users },
    ],
  },
  dashboard: {
    label: 'Dashboard',
    icon: BarChart3,
    cards: [
      { id: 'dashboard_executivo', label: 'Dashboard Executivo', icon: BarChart3 },
    ],
  },
  educacao: {
    label: 'Educacao',
    icon: GraduationCap,
    cards: [
      { id: 'educacao_continuada', label: 'Educacao Continuada', icon: BookOpen },
      { id: 'rops_desafio', label: 'Desafio ROPs', icon: Target },
      { id: 'residencia', label: 'Residencia Medica', icon: GraduationCap },
    ],
  },
  menu: {
    label: 'Menu',
    icon: Menu,
    cards: [
      { id: 'calculadoras', label: 'Calculadoras', icon: Calculator },
      { id: 'manutencao', label: 'Manutencao', icon: Wrench },
    ],
  },
};

/**
 * Returns an object with all card IDs set to a given value.
 * @param {boolean} value - Value to set (default true)
 * @returns {Object} - { [cardId]: value }
 */
export function getAllCardIds(value = true) {
  const cards = {};
  Object.values(NAV_STRUCTURE).forEach((section) => {
    section.cards.forEach((card) => {
      cards[card.id] = value;
    });
  });
  return cards;
}

/**
 * Default permission templates per role.
 * All cards start as `true` (everything enabled) — admin adjusts later as desired.
 *
 * @type {Object.<string, Object.<string, boolean>>}
 */
export const ROLE_PERMISSION_TEMPLATES = {
  anestesiologista: getAllCardIds(true),
  'medico-residente': getAllCardIds(true),
  enfermeiro: getAllCardIds(true),
  'tec-enfermagem': getAllCardIds(true),
  farmaceutico: getAllCardIds(true),
  colaborador: getAllCardIds(true),
  secretaria: getAllCardIds(true),
};

/**
 * Returns the permission template for a given role, with fallback to roleTemplates state.
 * @param {string} roleId - Role identifier
 * @param {Object} [customTemplates] - Custom templates (from state), overrides defaults
 * @returns {Object.<string, boolean>} - Card permissions map
 */
export function getTemplateForRole(roleId, customTemplates) {
  if (customTemplates && customTemplates[roleId]) {
    return { ...customTemplates[roleId] };
  }
  if (ROLE_PERMISSION_TEMPLATES[roleId]) {
    return { ...ROLE_PERMISSION_TEMPLATES[roleId] };
  }
  // Fallback: all enabled
  return getAllCardIds(true);
}
