/**
 * Role Permission Templates
 *
 * Single Source of Truth for:
 * - NAV_STRUCTURE: navigation sections, their cards and (optional) sub-cards
 * - ROLE_PERMISSION_TEMPLATES: default permissions per role
 *
 * Used by RolesTab (cargo management) and PermissionsModal (user permissions).
 *
 * Hierarchy (3 levels):
 *   section (bottom-nav page) → card (icon on the page) → subCard (sub-page within the icon)
 *
 * @module data/rolePermissionTemplates
 */

import { Home, Shield, BarChart3, GraduationCap, Menu, MessageSquare, Bell, User, LayoutGrid, Calendar, Users, Inbox, AlertTriangle, ShieldAlert, FileText, Hospital, QrCode, BookOpen, Target, TrendingUp, ClipboardList, FileSearch, PlayCircle, CheckSquare, FileBarChart, Network, Scale, FolderOpen, DollarSign, Calculator, Activity, Stethoscope } from 'lucide-react';

/**
 * Navigation structure mapping sections → cards → subCards.
 * Shared between RolesTab and PermissionsModal (SSOT).
 *
 * - `hidden: true` on a section signals that the bottom-nav tab is currently
 *   suppressed in the app, but the permission toggles remain available so the
 *   config survives when the tab is re-enabled.
 * - `subCards` is optional; when present, each entry gets its own permission
 *   toggle and the parent behaves as an umbrella with cascade semantics.
 */
export const NAV_STRUCTURE = {
  home: {
    label: 'Inicio',
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
      {
        id: 'incidentes',
        label: 'Notificacoes e Denuncias',
        icon: AlertTriangle,
        subCards: [
          { id: 'relatar_notificacao', label: 'Relatar Notificacao' },
          { id: 'fazer_denuncia', label: 'Fazer Denuncia' },
          { id: 'meus_relatos', label: 'Meus Relatos' },
          { id: 'notificacao_unimed', label: 'Notificacao Unimed' },
          { id: 'qrcode_generator', label: 'Gerar QR Code' },
        ],
      },
      { id: 'biblioteca', label: 'Biblioteca de Documentos', icon: BookOpen },
      { id: 'qualidade', label: 'Qualidade', icon: Target },
      {
        id: 'painel_gestao',
        label: 'Painel de Gestao',
        icon: TrendingUp,
        subCards: [
          { id: 'kpi_infeccao', label: 'KPI Infeccao' },
          { id: 'kpi_adesao', label: 'KPI Adesao' },
          { id: 'kpi_eventos', label: 'KPI Eventos' },
          { id: 'kpi_satisfacao', label: 'KPI Satisfacao' },
          { id: 'kpi_tempo', label: 'KPI Tempo Cirurgico' },
          { id: 'kpi_medicamentos', label: 'KPI Medicamentos' },
        ],
      },
      { id: 'planos_acao', label: 'Planos de Acao', icon: ClipboardList },
      {
        id: 'auditorias',
        label: 'Auditorias',
        icon: FileSearch,
        subCards: [
          { id: 'aud_higiene_maos', label: 'Higiene das Maos' },
          { id: 'aud_uso_medicamentos', label: 'Uso de Medicamentos' },
          { id: 'aud_abreviaturas', label: 'Abreviaturas' },
          { id: 'aud_operacionais', label: 'Operacionais' },
          { id: 'aud_conformidade', label: 'Conformidade' },
        ],
      },
      { id: 'auditorias_interativas', label: 'Auditorias Interativas', icon: PlayCircle },
      { id: 'autoavaliacao', label: 'Autoavaliacao Qmentum', icon: CheckSquare },
      {
        id: 'relatorios',
        label: 'Relatorios',
        icon: FileBarChart,
        subCards: [
          { id: 'rel_trimestral', label: 'Relatorio Trimestral' },
          { id: 'rel_incidentes', label: 'Relatorio de Incidentes' },
          { id: 'rel_indicadores', label: 'Relatorio de Indicadores' },
        ],
      },
      { id: 'organograma', label: 'Organograma', icon: Network },
      {
        id: 'etica_bioetica',
        label: 'Etica e Bioetica',
        icon: Scale,
        subCards: [
          { id: 'dilemas', label: 'Dilemas' },
          { id: 'parecer_uti', label: 'Parecer UTI' },
          { id: 'diretrizes', label: 'Diretrizes' },
          { id: 'emissao_parecer', label: 'Emissao de Parecer' },
          { id: 'codigo_etica', label: 'Codigo de Etica' },
        ],
      },
      { id: 'comites', label: 'Comites', icon: Users },
      {
        id: 'desastres',
        label: 'Planos de Desastres',
        icon: ShieldAlert,
        subCards: [
          { id: 'emerg_incendio', label: 'Incendio' },
          { id: 'emerg_vitimas', label: 'Multiplas Vitimas' },
          { id: 'emerg_pane', label: 'Pane Eletrica' },
          { id: 'emerg_quimico', label: 'Acidente Quimico' },
          { id: 'emerg_inundacao', label: 'Inundacao' },
          { id: 'emerg_bomba', label: 'Ameaca de Bomba' },
          { id: 'plano_manual', label: 'Manual do Plano' },
          { id: 'plano_times', label: 'Times de Emergencia' },
          { id: 'plano_apoio', label: 'Rede de Apoio' },
          { id: 'plano_simulado', label: 'Simulados' },
        ],
      },
      { id: 'gestao_documental', label: 'Gestao Documental', icon: FolderOpen },
      {
        id: 'faturamento',
        label: 'Faturamento',
        icon: DollarSign,
        subCards: [
          // Veio do Menu p/ Gestão → Faturamento (2026-07-26); a barreira real
          // de dados segue sendo a RLS can_write_cirurgias_particulares()
          { id: 'cirurgias_particulares', label: 'Cirurgias Particulares' },
          { id: 'fat_dashboard', label: 'Dashboard' },
          { id: 'fat_eventos', label: 'Eventos' },
          { id: 'fat_notas', label: 'Notas' },
          { id: 'fat_convenios', label: 'Convenios' },
          { id: 'financeiro', label: 'Financeiro' },
        ],
      },
      { id: 'escalas', label: 'Escalas', icon: Calendar },
      { id: 'reunioes', label: 'Reunioes', icon: Users },
    ],
  },
  dashboard: {
    label: 'Dashboard',
    icon: BarChart3,
    hidden: true,
    cards: [
      { id: 'dashboard_executivo', label: 'Dashboard Executivo', icon: BarChart3 },
    ],
  },
  educacao: {
    label: 'Educacao',
    icon: GraduationCap,
    cards: [
      {
        id: 'educacao_continuada',
        label: 'Educacao Continuada',
        icon: BookOpen,
        subCards: [
          { id: 'ec_trilhas', label: 'Trilhas e Cursos' },
          { id: 'ec_certificados', label: 'Certificados' },
          { id: 'ec_pontos', label: 'Pontos' },
          { id: 'ec_admin_trilhas', label: 'Admin: Trilhas' },
          { id: 'ec_admin_aulas', label: 'Admin: Aulas' },
          { id: 'ec_admin_conteudo', label: 'Admin: Conteudo' },
        ],
      },
      {
        id: 'rops_desafio',
        label: 'Desafio ROPs',
        icon: Target,
        subCards: [
          { id: 'rops_quiz', label: 'Quiz' },
          { id: 'rops_podcasts', label: 'Podcasts' },
          { id: 'rops_ranking', label: 'Ranking' },
        ],
      },
      {
        id: 'residencia',
        label: 'Residencia Medica',
        icon: GraduationCap,
        subCards: [
          { id: 'res_gerenciar', label: 'Gerenciar Residencia' },
          { id: 'res_assistente', label: 'Assistente' },
          { id: 'res_trocas_plantao', label: 'Trocas de Plantao' },
          { id: 'res_consulta_plantoes', label: 'Consulta de Plantoes' },
        ],
      },
    ],
  },
  menu: {
    label: 'Menu',
    icon: Menu,
    cards: [
      { id: 'calculadoras', label: 'Calculadoras', icon: Calculator },
      { id: 'criterios_uti', label: 'Criterios UTI', icon: Stethoscope },
      {
        id: 'cateter_peridural',
        label: 'Cateter Peridural',
        icon: Activity,
        subCards: [
          { id: 'cp_novo', label: 'Novo Cateter' },
          { id: 'cp_listagem', label: 'Listagem' },
        ],
      },
      {
        id: 'escalas_sobreaviso',
        label: 'Escalas de Sobreaviso',
        icon: Calendar,
        subCards: [
          { id: 'consulta_sobreaviso', label: 'Consulta Sobreaviso' },
          { id: 'trocas_sobreaviso', label: 'Trocas Sobreaviso' },
        ],
      },
    ],
  },
};

/**
 * Iterates every card and subCard in NAV_STRUCTURE, yielding `{ id, parentId }`.
 * parentId is null for top-level cards and the card id for sub-cards.
 * @param {Object} [navStructure=NAV_STRUCTURE]
 * @returns {Array<{ id: string, parentId: string | null }>}
 */
export function collectAllPermissionIds(navStructure = NAV_STRUCTURE) {
  const result = [];
  Object.values(navStructure).forEach((section) => {
    section.cards.forEach((card) => {
      result.push({ id: card.id, parentId: null });
      if (Array.isArray(card.subCards)) {
        card.subCards.forEach((sub) => {
          result.push({ id: sub.id, parentId: card.id });
        });
      }
    });
  });
  return result;
}

/**
 * Map of subCardId → parentCardId for cascade resolution at runtime.
 * Built once from NAV_STRUCTURE.
 */
export const SUB_CARD_PARENT = (() => {
  const map = {};
  collectAllPermissionIds().forEach(({ id, parentId }) => {
    if (parentId) map[id] = parentId;
  });
  return map;
})();

/**
 * Returns an object with every card id and sub-card id set to a given value.
 * Recursive through subCards.
 * @param {boolean} value - Value to set (default true)
 * @returns {Object} { [id]: value }
 */
export function getAllCardIds(value = true) {
  const cards = {};
  collectAllPermissionIds().forEach(({ id }) => {
    cards[id] = value;
  });
  return cards;
}

/**
 * Default permission templates per role.
 * All cards and sub-cards start as `true` — admin adjusts later.
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
  return getAllCardIds(true);
}
