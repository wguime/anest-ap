import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  WidgetCard,
  BottomNav,
} from '@/design-system';
import {
  TrendingUp,
  Network,
  Scale,
  Users,
  FileSearch,
  FileBarChart,
  ShieldAlert,
  GraduationCap,
  ChevronLeft,
  ClipboardList,
  CheckSquare,
  PlayCircle,
} from 'lucide-react';
import { useDocuments } from '@/hooks/useDocuments';
import { useCardPermissions } from '@/hooks/useCardPermissions';

export default function QualidadePage({ onNavigate }) {
  const [activeNav, setActiveNav] = useState('shield');
  const { canAccessCard } = useCardPermissions();

  // Get document counts from centralized context (SSOT)
  const { counts, isLoading } = useDocuments();

  // Header fixo via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('gestao')}
              className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
            Qualidade
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
      {/* Header fixo via Portal */}
      {createPortal(headerElement, document.body)}

      {/* Espacador para o header fixo */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 lg:px-6 xl:px-8 pt-4">
        {/* Grid de Cards 2 colunas */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {canAccessCard('painel_gestao') && (
            <WidgetCard
              icon={<TrendingUp className="w-6 h-6" />}
              title="Painel de Gestao"
              subtitle="21 KPIs monitorados"
              variant="interactive"
              onClick={() => onNavigate('painelGestao')}
            />
          )}
          {canAccessCard('planos_acao') && (
            <WidgetCard
              icon={<ClipboardList className="w-6 h-6" />}
              title="Planos de Acao"
              subtitle="Acoes corretivas PDCA"
              variant="interactive"
              onClick={() => onNavigate('planosAcao')}
            />
          )}
          {canAccessCard('auditorias') && (
            <WidgetCard
              icon={<FileSearch className="w-6 h-6" />}
              title="Auditorias"
              subtitle={isLoading ? 'Carregando...' : `${counts.auditorias || 0} documentos`}
              variant="interactive"
              onClick={() => onNavigate('auditorias')}
            />
          )}
          {canAccessCard('auditorias_interativas') && (
            <WidgetCard
              icon={<PlayCircle className="w-6 h-6" />}
              title="Auditorias Interativas"
              subtitle="Checklists com scoring"
              variant="interactive"
              onClick={() => onNavigate('auditoriasInterativas')}
            />
          )}
          {canAccessCard('autoavaliacao') && (
            <WidgetCard
              icon={<CheckSquare className="w-6 h-6" />}
              title="Autoavaliacao"
              subtitle="32 ROPs Qmentum"
              variant="interactive"
              onClick={() => onNavigate('autoavaliacao')}
            />
          )}
          {canAccessCard('relatorios') && (
            <WidgetCard
              icon={<FileBarChart className="w-6 h-6" />}
              title="Relatorios"
              subtitle={isLoading ? 'Carregando...' : `${counts.relatorios || 0} documentos`}
              variant="interactive"
              onClick={() => onNavigate('relatorios')}
            />
          )}
          {canAccessCard('etica_bioetica') && (
            <WidgetCard
              icon={<Scale className="w-6 h-6" />}
              title="Etica e Bioetica"
              subtitle={isLoading ? 'Carregando...' : `${counts.etica || 0} documentos`}
              variant="interactive"
              onClick={() => onNavigate('eticaBioetica')}
            />
          )}
          {canAccessCard('comites') && (
            <WidgetCard
              icon={<Users className="w-6 h-6" />}
              title="Comites"
              subtitle={isLoading ? 'Carregando...' : `${counts.comites || 0} documentos`}
              variant="interactive"
              onClick={() => onNavigate('comites')}
            />
          )}
          {canAccessCard('organograma') && (
            <WidgetCard
              icon={<Network className="w-6 h-6" />}
              title="Organograma"
              subtitle={`Estrutura ${localStorage.getItem('anest-organograma-year') || '2025'}`}
              variant="interactive"
              onClick={() => onNavigate('organograma')}
            />
          )}
          {canAccessCard('desastres') && (
            <WidgetCard
              icon={<ShieldAlert className="w-6 h-6" />}
              title="Desastres"
              subtitle="Planos de emergencia"
              variant="interactive"
              onClick={() => onNavigate('desastres')}
            />
          )}
        </div>
      </div>

      {/* BottomNav fixo */}
      <BottomNav
        items={[
          { icon: 'Home', active: false, id: 'home' },
          { icon: 'Shield', active: true, id: 'shield' },
          {
            icon: (
              <GraduationCap
                className="w-6 h-6 sm:w-7 sm:h-7 transition-colors text-[#6B7280] dark:text-[#6B8178]"
                fill="none"
              />
            ),
            active: false,
            id: 'education',
          },
          { icon: 'Menu', active: false, id: 'menu' },
        ]}
        onItemClick={(item) => {
          setActiveNav(item.id);
          if (item.id === 'home') onNavigate('home');
          else if (item.id === 'shield') onNavigate('gestao');
          else if (item.id === 'education') onNavigate('educacao');
          else if (item.id === 'menu') onNavigate('menuPage');
        }}
      />
    </div>
  );
}
