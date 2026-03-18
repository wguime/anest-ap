// CentroGestaoShowcase.jsx
// Showcase dos componentes do Centro de Gestao

import { useState, useMemo } from 'react';
import {
  Settings, Users, FileText, Shield, Clock, AlertTriangle,
  CheckCircle, Calendar, History, Lock, DollarSign,
  BarChart3, Search, Filter, Eye, Pencil, Archive,
  Plus, Activity, Scale, BookOpen, FolderOpen,
  ChevronDown, TrendingUp, TrendingDown, Hash,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme.jsx';
import { cn } from '../utils/tokens';

// ============================================================================
// DESIGN SYSTEM TOKENS
// ============================================================================

const TOKENS = {
  light: {
    background: {
      primary: '#F0FFF4',
      card: '#FFFFFF',
      cardHighlight: '#E8F5E9',
    },
    green: {
      dark: '#004225',
      medium: '#006837',
    },
    text: {
      primary: '#000000',
      secondary: '#6B7280',
      muted: '#9CA3AF',
    },
    border: {
      default: '#C8E6C9',
    },
  },
  dark: {
    background: {
      darkest: '#0A0F0D',
      card: '#1A2420',
      cardLight: '#243530',
    },
    green: {
      primary: '#2ECC71',
      muted: '#1E8449',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#A3B8B0',
      muted: '#6B8178',
    },
    border: {
      default: '#2A3F36',
    },
  },
};

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_DOCUMENTS = [
  { id: 'doc-1', title: 'Protocolo de Seguranca do Paciente', code: 'PROT.SEG.001', version: 3, status: 'active' },
  { id: 'doc-2', title: 'Manual de Procedimentos Cirurgicos', code: 'MAN.CIR.001', version: 2, status: 'pending' },
  { id: 'doc-3', title: 'Politica de Controle de Infeccao', code: 'POL.INF.001', version: 1, status: 'overdue' },
  { id: 'doc-4', title: 'Formulario de Auditoria Interna', code: 'FORM.AUD.001', version: 4, status: 'archived' },
];

const MOCK_APPROVALS = [
  { id: 'apr-1', title: 'Protocolo de Seguranca v2.0', category: 'Comites', days: 3 },
  { id: 'apr-2', title: 'Manual de Procedimentos', category: 'Biblioteca', days: 1 },
  { id: 'apr-3', title: 'Relatorio Trimestral Q4', category: 'Relatorios', days: 5 },
];

const MOCK_REVIEWS = [
  { id: 'rev-1', title: 'Protocolo de Higiene das Maos', daysRemaining: 45, month: 'Marco 2026' },
  { id: 'rev-2', title: 'Manual de Qualidade', daysRemaining: 22, month: 'Marco 2026' },
  { id: 'rev-3', title: 'Politica de Privacidade', daysRemaining: 60, month: 'Abril 2026' },
  { id: 'rev-4', title: 'Checklist Cirurgia Segura', daysRemaining: 8, month: 'Abril 2026' },
];

const MOCK_OVERDUE_REVIEWS = [
  { id: 'ovr-1', title: 'Protocolo de Medicamentos', daysOverdue: 12 },
  { id: 'ovr-2', title: 'Formulario de Incidentes', daysOverdue: 5 },
];

const MOCK_AUDIT_TRAIL = [
  { id: 'at-1', action: 'Criado', user: 'Dr. Silva', timestamp: '2026-01-15 09:30', type: 'created' },
  { id: 'at-2', action: 'Atualizado', user: 'Enf. Santos', timestamp: '2026-01-20 14:15', type: 'updated' },
  { id: 'at-3', action: 'Aprovado', user: 'Coord. Lima', timestamp: '2026-01-22 10:00', type: 'approved' },
  { id: 'at-4', action: 'Publicado', user: 'Admin', timestamp: '2026-01-23 08:45', type: 'updated' },
  { id: 'at-5', action: 'Arquivado', user: 'Coord. Lima', timestamp: '2026-02-01 16:30', type: 'archived' },
];

const SIDEBAR_ITEMS = [
  { label: 'Usuarios', icon: Users, color: '#3B82F6' },
  { label: 'Emails', icon: FileText, color: '#8B5CF6' },
  { label: 'Documentos', icon: FolderOpen, color: '#059669', subItems: ['Biblioteca', 'Protocolos', 'Politicas'] },
  { label: 'Estatisticas', icon: BarChart3, color: '#F59E0B' },
  { label: 'Incidentes', icon: AlertTriangle, color: '#DC2626' },
  { label: 'Residencia', icon: BookOpen, color: '#EC4899' },
];

const COMPLIANCE_CATEGORIES = [
  { label: 'Cultura de Seguranca', pct: 92 },
  { label: 'Comunicacao', pct: 85 },
  { label: 'Uso de Medicamentos', pct: 78 },
  { label: 'Prevencao de Infeccoes', pct: 95 },
  { label: 'Avaliacao de Riscos', pct: 80 },
  { label: 'Vida Profissional', pct: 88 },
];

const FILTER_ITEMS = [
  { id: 'f-1', title: 'Protocolo de Seguranca do Paciente', code: 'PROT.SEG.001' },
  { id: 'f-2', title: 'Manual de Procedimentos Cirurgicos', code: 'MAN.CIR.001' },
  { id: 'f-3', title: 'Politica de Controle de Infeccao', code: 'POL.INF.001' },
  { id: 'f-4', title: 'Formulario de Auditoria Interna', code: 'FORM.AUD.001' },
  { id: 'f-5', title: 'Checklist de Cirurgia Segura', code: 'CHECK.CIR.001' },
];

// ============================================================================
// SHOWCASE SECTION WRAPPER
// ============================================================================

function ShowcaseSection({ title, description, children }) {
  const { isDark } = useTheme();
  const t = isDark ? TOKENS.dark : TOKENS.light;

  return (
    <div className="mb-12">
      <h2
        className="text-xl font-bold mb-2"
        style={{ color: t.text.primary }}
      >
        {title}
      </h2>
      {description && (
        <p
          className="text-sm mb-4"
          style={{ color: t.text.secondary }}
        >
          {description}
        </p>
      )}
      <div
        className="rounded-2xl p-6 border"
        style={{
          background: isDark ? TOKENS.dark.background.card : TOKENS.light.background.card,
          borderColor: t.border.default,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN SHOWCASE COMPONENT
// ============================================================================

export function CentroGestaoShowcase() {
  const { isDark } = useTheme();
  const t = isDark ? TOKENS.dark : TOKENS.light;

  // State for interactive demos
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSidebar, setExpandedSidebar] = useState(true);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('todos');

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return FILTER_ITEMS;
    const term = searchTerm.toLowerCase();
    return FILTER_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(term) ||
        item.code.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const statusConfig = {
    active: { label: 'Ativo', borderColor: '#059669', badgeColor: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    pending: { label: 'Pendente', borderColor: '#F59E0B', badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
    overdue: { label: 'Vencido', borderColor: '#DC2626', badgeColor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
    archived: { label: 'Arquivado', borderColor: '#6B7280', badgeColor: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
  };

  const auditTypeConfig = {
    created: { color: '#3B82F6', label: 'Criado' },
    updated: { color: '#F59E0B', label: 'Atualizado' },
    approved: { color: '#059669', label: 'Aprovado' },
    archived: { color: '#6B7280', label: 'Arquivado' },
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-2xl sm:text-3xl font-bold mb-2"
          style={{ color: t.text.primary }}
        >
          Centro de Gestao
        </h1>
        <p
          className="text-base"
          style={{ color: t.text.secondary }}
        >
          Componentes utilizados no painel administrativo de gestao de documentos e usuarios
        </p>
      </div>

      {/* ================================================================== */}
      {/* 1. ManagementLayout Demo */}
      {/* ================================================================== */}
      <ShowcaseSection
        title="1. ManagementLayout Demo"
        description="Mockup estatico da navegacao lateral com itens expandidos e colapsados."
      >
        <div className="flex gap-4">
          {/* Sidebar mockup */}
          <div
            className={cn(
              "rounded-xl border transition-all duration-300 flex-shrink-0",
              expandedSidebar ? "w-56" : "w-16"
            )}
            style={{
              background: isDark ? TOKENS.dark.background.cardLight : '#F9FAFB',
              borderColor: isDark ? TOKENS.dark.border.default : TOKENS.light.border.default,
            }}
          >
            {/* Sidebar header */}
            <div className="p-3 border-b" style={{ borderColor: isDark ? TOKENS.dark.border.default : TOKENS.light.border.default }}>
              <button
                onClick={() => setExpandedSidebar(!expandedSidebar)}
                className="flex items-center gap-2 text-sm font-semibold w-full"
                style={{ color: isDark ? TOKENS.dark.green.primary : TOKENS.light.green.medium }}
              >
                <Settings className="w-5 h-5 flex-shrink-0" />
                {expandedSidebar && <span>Centro de Gestao</span>}
              </button>
            </div>

            {/* Sidebar items */}
            <div className="p-2 space-y-1">
              {SIDEBAR_ITEMS.map((item, idx) => {
                const IconComp = item.icon;
                return (
                  <div key={idx}>
                    <div
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg cursor-default",
                        "hover:bg-black/5 dark:hover:bg-white/5 transition-colors",
                        idx === 0 && "bg-muted"
                      )}
                    >
                      <IconComp className="w-4 h-4 flex-shrink-0" style={{ color: item.color }} />
                      {expandedSidebar && (
                        <span className="text-sm font-medium truncate" style={{ color: t.text.primary }}>
                          {item.label}
                        </span>
                      )}
                      {expandedSidebar && item.subItems && (
                        <ChevronDown className="w-3 h-3 ml-auto flex-shrink-0" style={{ color: t.text.muted }} />
                      )}
                    </div>
                    {/* Sub-items */}
                    {expandedSidebar && item.subItems && idx === 2 && (
                      <div className="ml-7 mt-1 space-y-1">
                        {item.subItems.map((sub, sIdx) => (
                          <div
                            key={sIdx}
                            className="text-xs px-3 py-1.5 rounded-md cursor-default"
                            style={{ color: t.text.secondary }}
                          >
                            {sub}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Content area mockup */}
          <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed p-8"
            style={{ borderColor: isDark ? TOKENS.dark.border.default : TOKENS.light.border.default }}
          >
            <p className="text-sm" style={{ color: t.text.muted }}>
              Area de conteudo principal
            </p>
          </div>
        </div>
      </ShowcaseSection>

      {/* ================================================================== */}
      {/* 2. DocumentCard Variants */}
      {/* ================================================================== */}
      <ShowcaseSection
        title="2. DocumentCard Variants"
        description="4 variantes de cards de documentos com diferentes estados: ativo, pendente, vencido e arquivado."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MOCK_DOCUMENTS.map((doc) => {
            const config = statusConfig[doc.status];
            return (
              <div
                key={doc.id}
                className="rounded-xl p-4 border-l-4 bg-card border border-border"
                style={{ borderLeftColor: config.borderColor }}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-bold leading-tight" style={{ color: t.text.primary }}>
                    {doc.title}
                  </h4>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ml-2", config.badgeColor)}>
                    {config.label}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[11px] font-medium" style={{ color: t.text.muted }}>
                    {doc.code}
                  </span>
                  <span className="text-[11px] font-medium" style={{ color: t.text.muted }}>
                    v{doc.version}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </ShowcaseSection>

      {/* ================================================================== */}
      {/* 3. FilterBar Demo */}
      {/* ================================================================== */}
      <ShowcaseSection
        title="3. FilterBar Demo"
        description="Barra de filtros interativa com busca, dropdown de tipo e botao de acao."
      >
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: t.text.muted }} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar documentos..."
                className={cn(
                  "w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border",
                  "bg-card",
                  "border-border",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary/50",
                  "placeholder:text-muted-foreground dark:placeholder:text-muted-foreground"
                )}
                style={{ color: t.text.primary }}
              />
            </div>

            {/* Filter dropdown mockup */}
            <div className="relative">
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className={cn(
                  "pl-3 pr-8 py-2.5 rounded-xl text-sm border appearance-none cursor-pointer",
                  "bg-card",
                  "border-border",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary/50"
                )}
                style={{ color: t.text.primary }}
              >
                <option value="todos">Todos os tipos</option>
                <option value="protocolo">Protocolos</option>
                <option value="manual">Manuais</option>
                <option value="politica">Politicas</option>
                <option value="formulario">Formularios</option>
              </select>
              <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: t.text.muted }} />
            </div>

            {/* Action button */}
            <button
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold",
                "bg-primary",
                "text-white dark:text-primary-foreground",
                "hover:bg-[#005730] dark:hover:bg-[#27AE60]",
                "transition-colors"
              )}
            >
              <Plus className="w-4 h-4" />
              Novo Documento
            </button>
          </div>

          {/* Filtered results */}
          <div className="space-y-2">
            {filteredItems.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: t.text.muted }}>
                Nenhum documento encontrado
              </p>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4" style={{ color: isDark ? TOKENS.dark.green.primary : TOKENS.light.green.medium }} />
                    <span className="text-sm font-medium" style={{ color: t.text.primary }}>{item.title}</span>
                  </div>
                  <span className="text-xs font-mono" style={{ color: t.text.muted }}>{item.code}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </ShowcaseSection>

      {/* ================================================================== */}
      {/* 4. StatsCard Grid */}
      {/* ================================================================== */}
      <ShowcaseSection
        title="4. StatsCard Grid"
        description="Grid 2x2 de cards de estatisticas com icones, valores e tendencias."
      >
        <div className="grid grid-cols-2 gap-4">
          {/* Total Documentos */}
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">47</p>
            <p className="text-xs mt-1" style={{ color: t.text.muted }}>Total Documentos</p>
          </div>

          {/* Aprovados este mes */}
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <TrendingUp className="w-3 h-3" />
                <span className="text-xs font-bold">+8</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">8</p>
            <p className="text-xs mt-1" style={{ color: t.text.muted }}>Aprovados este mes</p>
          </div>

          {/* Pendentes Revisao */}
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">3</p>
            <p className="text-xs mt-1" style={{ color: t.text.muted }}>Pendentes Revisao</p>
          </div>

          {/* Arquivados */}
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-900/30 flex items-center justify-center">
                <Archive className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">12</p>
            <p className="text-xs mt-1" style={{ color: t.text.muted }}>Arquivados</p>
          </div>
        </div>
      </ShowcaseSection>

      {/* ================================================================== */}
      {/* 5. ComplianceDashboard Mockup */}
      {/* ================================================================== */}
      <ShowcaseSection
        title="5. ComplianceDashboard Mockup"
        description="Painel de conformidade com score geral, barras de categoria e documentos vencidos."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Score card */}
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div className="relative w-24 h-24">
                {/* Progress ring background */}
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                    stroke={isDark ? '#2A3F36' : '#E8F5E9'} />
                  <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                    stroke={isDark ? '#2ECC71' : '#006837'}
                    strokeLinecap="round"
                    strokeDasharray={`${87 * 2.64} ${100 * 2.64}`} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold" style={{ color: isDark ? TOKENS.dark.green.primary : TOKENS.light.green.medium }}>
                    87%
                  </span>
                </div>
              </div>
              <div>
                <h4 className="text-lg font-bold" style={{ color: t.text.primary }}>Score de Conformidade</h4>
                <p className="text-sm" style={{ color: t.text.secondary }}>Baseado em 6 categorias Qmentum</p>
              </div>
            </div>

            {/* Category bars */}
            <div className="space-y-3">
              {COMPLIANCE_CATEGORIES.map((cat, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium" style={{ color: t.text.secondary }}>{cat.label}</span>
                    <span className="text-xs font-bold" style={{ color: t.text.primary }}>{cat.pct}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: isDark ? '#2A3F36' : '#E8F5E9' }}>
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${cat.pct}%`,
                        background: cat.pct >= 90 ? '#059669' : cat.pct >= 80 ? '#F59E0B' : '#DC2626',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Overdue documents */}
          <div>
            <h4 className="text-sm font-semibold mb-3" style={{ color: t.text.primary }}>
              Documentos com Revisao Vencida
            </h4>
            <div className="space-y-2">
              {MOCK_OVERDUE_REVIEWS.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium" style={{ color: t.text.primary }}>{item.title}</span>
                  </div>
                  <span className="text-xs font-bold text-red-600 dark:text-red-400">
                    -{item.daysOverdue}d
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 rounded-xl bg-muted">
              <p className="text-xs" style={{ color: t.text.secondary }}>
                <strong>Dica:</strong> Documentos vencidos devem ser revisados com prioridade para manter a conformidade acima de 85%.
              </p>
            </div>
          </div>
        </div>
      </ShowcaseSection>

      {/* ================================================================== */}
      {/* 6. ApprovalQueue Mockup */}
      {/* ================================================================== */}
      <ShowcaseSection
        title="6. ApprovalQueue Mockup"
        description="Fila de aprovacoes pendentes com acoes de aprovar e rejeitar."
      >
        <div className="space-y-3">
          {MOCK_APPROVALS.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card"
            >
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold truncate" style={{ color: t.text.primary }}>
                  {item.title}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted font-medium"
                    style={{ color: isDark ? TOKENS.dark.green.primary : TOKENS.light.green.medium }}
                  >
                    {item.category}
                  </span>
                  <span className="text-[10px] flex items-center gap-1" style={{ color: t.text.muted }}>
                    <Clock className="w-3 h-3" />
                    {item.days} dia{item.days !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                <button className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">
                  Aprovar
                </button>
                <button className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
                  Rejeitar
                </button>
              </div>
            </div>
          ))}
        </div>
      </ShowcaseSection>

      {/* ================================================================== */}
      {/* 7. ReviewCalendar Mockup */}
      {/* ================================================================== */}
      <ShowcaseSection
        title="7. ReviewCalendar Mockup"
        description="Calendario de proximas revisoes agrupadas por mes e documentos vencidos."
      >
        <div className="space-y-6">
          {/* Proximas Revisoes */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: t.text.primary }}>
              <Calendar className="w-4 h-4" style={{ color: isDark ? TOKENS.dark.green.primary : TOKENS.light.green.medium }} />
              Proximas Revisoes
            </h4>

            {/* Group by month */}
            {['Marco 2026', 'Abril 2026'].map((month) => (
              <div key={month} className="mb-4">
                <p className="text-xs font-bold uppercase tracking-wider mb-2 px-1" style={{ color: t.text.muted }}>
                  {month}
                </p>
                <div className="space-y-2">
                  {MOCK_REVIEWS.filter((r) => r.month === month).map((review) => (
                    <div
                      key={review.id}
                      className="flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4" style={{ color: t.text.muted }} />
                        <span className="text-sm font-medium" style={{ color: t.text.primary }}>{review.title}</span>
                      </div>
                      <span
                        className={cn(
                          "text-xs font-bold px-2 py-0.5 rounded-full",
                          review.daysRemaining >= 30
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        )}
                      >
                        {review.daysRemaining}d
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Documentos Vencidos */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4" />
              Documentos Vencidos
            </h4>
            <div className="space-y-2">
              {MOCK_OVERDUE_REVIEWS.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium" style={{ color: t.text.primary }}>{item.title}</span>
                  </div>
                  <span className="text-xs font-bold text-red-600 dark:text-red-400">
                    {item.daysOverdue} dias atrasado
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ShowcaseSection>

      {/* ================================================================== */}
      {/* 8. AuditTrailModal Demo */}
      {/* ================================================================== */}
      <ShowcaseSection
        title="8. AuditTrailModal Demo"
        description="Botao para exibir o historico de auditoria com timeline de eventos."
      >
        <div className="space-y-4">
          <button
            onClick={() => setShowAuditTrail(!showAuditTrail)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold",
              "bg-primary",
              "text-white dark:text-primary-foreground",
              "hover:bg-[#005730] dark:hover:bg-[#27AE60]",
              "transition-colors"
            )}
          >
            <History className="w-4 h-4" />
            {showAuditTrail ? 'Ocultar Historico' : 'Ver Historico'}
          </button>

          {showAuditTrail && (
            <div className="relative pl-6 space-y-4 border-l-2" style={{ borderColor: isDark ? TOKENS.dark.border.default : TOKENS.light.border.default }}>
              {MOCK_AUDIT_TRAIL.map((entry) => {
                const typeConfig = auditTypeConfig[entry.type] || auditTypeConfig.updated;
                return (
                  <div key={entry.id} className="relative">
                    {/* Dot */}
                    <div
                      className="absolute -left-[calc(1.5rem+5px)] w-3 h-3 rounded-full border-2 border-white dark:border-[#1A2420]"
                      style={{ background: typeConfig.color }}
                    />
                    {/* Content */}
                    <div className="bg-card rounded-xl p-3 border border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                          style={{ background: typeConfig.color }}
                        >
                          {entry.action}
                        </span>
                        <span className="text-xs" style={{ color: t.text.muted }}>{entry.timestamp}</span>
                      </div>
                      <p className="text-sm" style={{ color: t.text.secondary }}>
                        por <strong style={{ color: t.text.primary }}>{entry.user}</strong>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ShowcaseSection>

      {/* ================================================================== */}
      {/* 9. PermissionsModal Reference */}
      {/* ================================================================== */}
      <ShowcaseSection
        title="9. PermissionsModal Reference"
        description="Referencia visual da estrutura do modal de permissoes de usuario."
      >
        <div className="max-w-sm mx-auto bg-card rounded-xl border border-border overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border bg-muted">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Users className="w-5 h-5 text-white dark:text-primary-foreground" />
              </div>
              <div>
                <h4 className="text-sm font-bold" style={{ color: t.text.primary }}>Dr. Carlos Silva</h4>
                <p className="text-xs" style={{ color: t.text.secondary }}>Anestesiologista</p>
              </div>
            </div>
          </div>

          {/* Permission toggles */}
          <div className="p-4 space-y-3">
            {[
              { label: 'Acesso a Documentos', enabled: true },
              { label: 'Aprovar Revisoes', enabled: true },
              { label: 'Gerenciar Usuarios', enabled: false },
              { label: 'Painel Administrativo', enabled: false },
            ].map((perm, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-sm" style={{ color: t.text.primary }}>{perm.label}</span>
                <div
                  className={cn(
                    "w-10 h-6 rounded-full relative transition-colors cursor-default",
                    perm.enabled
                      ? "bg-primary"
                      : "bg-gray-300 dark:bg-gray-600"
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform",
                      perm.enabled ? "translate-x-5" : "translate-x-1"
                    )}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Footer buttons */}
          <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
            <button className="px-4 py-2 rounded-lg text-xs font-semibold border border-border"
              style={{ color: t.text.secondary }}
            >
              Cancelar
            </button>
            <button className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-white dark:text-primary-foreground">
              Salvar
            </button>
          </div>
        </div>
      </ShowcaseSection>

      {/* ================================================================== */}
      {/* 10. Demo Completa */}
      {/* ================================================================== */}
      <ShowcaseSection
        title="10. Demo Completa"
        description="Mockup integrado combinando stats, filtros, cards e compliance score."
      >
        <div className="rounded-xl overflow-hidden" style={{ background: isDark ? '#111916' : '#F0FFF4' }}>
          <div className="p-4 space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-card rounded-xl p-3 text-center border border-border">
                <p className="text-lg font-bold text-green-600 dark:text-green-400">47</p>
                <p className="text-[10px]" style={{ color: t.text.muted }}>Documentos</p>
              </div>
              <div className="bg-card rounded-xl p-3 text-center border border-border">
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">+8</p>
                <p className="text-[10px]" style={{ color: t.text.muted }}>Aprovados</p>
              </div>
              <div className="bg-card rounded-xl p-3 text-center border border-border">
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">3</p>
                <p className="text-[10px]" style={{ color: t.text.muted }}>Pendentes</p>
              </div>
              <div className="bg-card rounded-xl p-3 text-center border border-border">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-lg font-bold" style={{ color: isDark ? TOKENS.dark.green.primary : TOKENS.light.green.medium }}>87%</span>
                </div>
                <p className="text-[10px]" style={{ color: t.text.muted }}>Compliance</p>
              </div>
            </div>

            {/* Filter bar */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: t.text.muted }} />
                <input
                  type="text"
                  placeholder="Buscar documentos..."
                  readOnly
                  className={cn(
                    "w-full pl-10 pr-4 py-2 rounded-xl text-sm border cursor-default",
                    "bg-card",
                    "border-border",
                    "placeholder:text-muted-foreground dark:placeholder:text-muted-foreground"
                  )}
                  style={{ color: t.text.primary }}
                />
              </div>
              <button className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-primary text-white dark:text-primary-foreground">
                <Plus className="w-3 h-3" />
                Novo
              </button>
            </div>

            {/* Document cards grid */}
            <div className="grid grid-cols-2 gap-3">
              {MOCK_DOCUMENTS.map((doc) => {
                const config = statusConfig[doc.status];
                return (
                  <div
                    key={doc.id}
                    className="rounded-xl p-3 border-l-4 bg-card border border-border"
                    style={{ borderLeftColor: config.borderColor }}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="text-xs font-bold leading-tight" style={{ color: t.text.primary }}>
                        {doc.title}
                      </h4>
                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ml-1", config.badgeColor)}>
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px]" style={{ color: t.text.muted }}>{doc.code}</span>
                      <span className="text-[10px]" style={{ color: t.text.muted }}>v{doc.version}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </ShowcaseSection>

      {/* Usage Guidelines */}
      <div
        className="mt-8 p-4 rounded-xl"
        style={{
          background: isDark ? TOKENS.dark.background.card : '#E8F5E9',
          border: `1px solid ${t.border.default}`,
        }}
      >
        <h3
          className="font-semibold mb-2"
          style={{ color: t.text.primary }}
        >
          Guia de Uso
        </h3>
        <ul
          className="text-sm space-y-1"
          style={{ color: t.text.secondary }}
        >
          <li>
            <strong>ManagementLayout:</strong> Sidebar de navegacao com itens expandiveis. Controla a navegacao do Centro de Gestao.
          </li>
          <li>
            <strong>DocumentCard:</strong> Card com borda lateral colorida indicando o status do documento (ativo, pendente, vencido, arquivado).
          </li>
          <li>
            <strong>FilterBar:</strong> Busca com filtros de tipo e botao de acao. Filtra documentos em tempo real.
          </li>
          <li>
            <strong>StatsCard:</strong> Cards de estatisticas com icones e tendencias visuais.
          </li>
          <li>
            <strong>ComplianceDashboard:</strong> Score de conformidade com barras de progresso por categoria.
          </li>
          <li>
            <strong>ApprovalQueue:</strong> Fila de aprovacoes com botoes de acao por item.
          </li>
          <li>
            <strong>ReviewCalendar:</strong> Calendario de revisoes agrupadas por mes com indicadores de urgencia.
          </li>
          <li>
            <strong>AuditTrail:</strong> Timeline de auditoria com tipos de acao codificados por cor.
          </li>
          <li>
            <strong>PermissionsModal:</strong> Interface de gerenciamento de permissoes por usuario.
          </li>
        </ul>
      </div>
    </div>
  );
}

export default CentroGestaoShowcase;
