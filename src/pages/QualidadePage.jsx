import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  WidgetCard,
  BottomNav,
} from '@/design-system';
import {
  TrendingUp,
  Network,
  ShieldAlert,
  GraduationCap,
  ChevronLeft,
  ClipboardList,
  CheckSquare,
  PlayCircle,
} from 'lucide-react';
import { useCardPermissions } from '@/hooks/useCardPermissions';

export default function QualidadePage({ onNavigate }) {
  const [activeNav, setActiveNav] = useState('shield');
  const { canAccessCard } = useCardPermissions();

  // Header fixo via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('gestao')}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Qualidade
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
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
                className="w-6 h-6 sm:w-7 sm:h-7 transition-colors text-muted-foreground"
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
