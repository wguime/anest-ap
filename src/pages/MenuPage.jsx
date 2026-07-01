import { useEffect, useMemo } from 'react';
import { Calculator, Wrench, ClipboardList, Activity, CalendarCheck, Utensils, Receipt, CalendarClock } from 'lucide-react';
import { WidgetCard } from '@/design-system';
import { PageHeader } from '@/components';
import { useCardPermissions } from '../hooks/useCardPermissions';
import { useCateterPeridural } from '../contexts/CateterPeridualContext';

export default function MenuPage({ onNavigate, goBack }) {
  useEffect(() => {
    document.title = 'Menu — ANEST';
  }, []);

  const { canAccessCard } = useCardPermissions();
  const { cateteres } = useCateterPeridural();

  const cateteresAtivosCount = useMemo(
    () => cateteres.filter((c) => c.status === 'ativo').length,
    [cateteres]
  );
  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader
        title="Menu"
        onBack={goBack}
      />

      {/* Conteudo da pagina */}
      <div className="px-4 sm:px-5 lg:px-6 xl:px-8 py-4">
        {/* Grid de Widgets */}
        <div className="grid grid-cols-2 gap-3 ds-stagger-in">
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
              badge={cateteresAtivosCount > 0 ? cateteresAtivosCount : undefined}
              badgeVariant="active"
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

          {/* Widget Escalas Funcionárias */}
          <WidgetCard
            size="small"
            icon={<CalendarCheck className="w-6 h-6" />}
            title="Escalas Funcionárias"
            subtitle="Sobreaviso e trocas"
            variant="default"
            onClick={() => onNavigate('escalasFuncionarias')}
          />

          {/* Widget Refeição Unimed - Abre página interna (iframe Hoobox) */}
          <WidgetCard
            size="small"
            icon={<Utensils className="w-6 h-6" />}
            title="Refeição Unimed"
            subtitle="Solicitação de refeições"
            variant="default"
            onClick={() => onNavigate('refeicaoUnimed')}
          />

          {/* Widget Codificação Anestésica - calculadora de guia Unimed */}
          <WidgetCard
            size="small"
            icon={<Receipt className="w-6 h-6" />}
            title="Codificação Anestésica"
            subtitle="Cobrança e códigos Unimed"
            variant="default"
            onClick={() => onNavigate('codificacaoAnestesica')}
          />

          {/* Widget Escala Cirúrgica - board diário + painel de liberação */}
          <WidgetCard
            size="small"
            icon={<CalendarClock className="w-6 h-6" />}
            title="Escala Cirúrgica"
            subtitle="Board do dia + liberações"
            variant="default"
            onClick={() => onNavigate('escalaCirurgica')}
          />
        </div>
      </div>
    </div>
  );
}
