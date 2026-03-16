import { createPortal } from 'react-dom';
import { ChevronLeft, Calculator, Wrench, ClipboardList, Activity } from 'lucide-react';
import { WidgetCard } from '@/design-system';
import { useCardPermissions } from '../hooks/useCardPermissions';

export default function MenuPage({ onNavigate, goBack }) {
  const { canAccessCard } = useCardPermissions();
  // Header via Portal (padrão do DS)
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
            Menu
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
      {/* Header via Portal */}
      {createPortal(headerElement, document.body)}

      {/* Espacador para compensar header fixo */}
      <div className="h-14" aria-hidden="true" />

      {/* Conteudo da pagina */}
      <div className="px-4 sm:px-5 lg:px-6 xl:px-8 py-4">
        {/* Grid de Widgets */}
        <div className="grid grid-cols-2 gap-3">
          {/* Widget Calculadoras */}
          {canAccessCard('calculadoras') && (
            <WidgetCard
              size="small"
              icon={<Calculator className="w-6 h-6" />}
              title="Calculadoras"
              variant="default"
              onClick={() => onNavigate('calculadoras')}
            />
          )}

          {/* Widget Critérios UTI */}
          {canAccessCard('criterios_uti') && (
            <WidgetCard
              size="small"
              icon={<ClipboardList className="w-6 h-6" />}
              title="Critérios UTI"
              subtitle="Triagem pós-op"
              variant="default"
              onClick={() => onNavigate('criteriosUti')}
            />
          )}

          {/* Widget Cateter Peridural */}
          {canAccessCard('cateter_peridural') && (
            <WidgetCard
              size="small"
              icon={<Activity className="w-6 h-6" />}
              title="Cateter Peridural"
              subtitle="Controle epidural"
              variant="default"
              onClick={() => onNavigate('cateteresPeridural')}
            />
          )}

          {/* Widget Manutenção - Abre sistema externo FixCare */}
          {canAccessCard('manutencao') && (
            <WidgetCard
              size="small"
              icon={<Wrench className="w-6 h-6" />}
              title="Manutenção"
              subtitle="Configurações e ajustes"
              variant="default"
              onClick={() => window.open('https://app.fixcare.io/auth', '_blank')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
