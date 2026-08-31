import { useState } from 'react';
import { WidgetCard } from '@/design-system';
import { TrendingUp, Network, ShieldAlert, GraduationCap, ClipboardList, CheckSquare, PlayCircle, Bed } from 'lucide-react';
import { PageHeader } from '@/components';
import { useCardPermissions } from '@/hooks/useCardPermissions';

export default function QualidadePage({ onNavigate }) {
  const [_activeNav, _setActiveNav] = useState('shield');
  const { canAccessCard } = useCardPermissions();

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader
        title="Qualidade"
        onBack={() => onNavigate('gestao')}
      />

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
          {/* Braden é risco de lesão por pressão — indicador de acreditação, não
              ato anestésico. Saiu de Calculadoras na triagem de 29/08 e voltou
              aqui por decisão do dono em 31/08/2026. */}
          <WidgetCard
            icon={<Bed className="w-6 h-6" />}
            title="Escala de Braden"
            subtitle="Risco de lesao por pressao"
            variant="interactive"
            onClick={() => onNavigate('escalaBraden')}
          />
        </div>
      </div>

    </div>
  );
}
