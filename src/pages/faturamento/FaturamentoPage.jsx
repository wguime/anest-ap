/**
 * FaturamentoPage - Hub de faturamento (Gestão → Faturamento)
 *
 * Desde 2026-07-26 é o hub dos módulos de cobrança que moravam no Menu:
 * Cirurgias Particulares (honorários particulares) e Codificação Anestésica
 * (guia/códigos Unimed). As páginas de notas/eventos/convênios existem em
 * src/pages/faturamento/ mas seguem sem card (nenhuma entrada aqui).
 */
import { HandCoins, Receipt } from 'lucide-react';
import { PageHeader } from '../../components';
import { WidgetCard } from '@/design-system';
import { useCardPermissions } from '../../hooks/useCardPermissions';

export default function FaturamentoPage({ onNavigate, goBack }) {
  const { canAccessCard } = useCardPermissions();

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Faturamento" onBack={goBack} />

      <div className="px-4 sm:px-5 lg:px-6 xl:px-8 py-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 ds-stagger-in">
          {canAccessCard('cirurgias_particulares') && (
            <WidgetCard
              size="small"
              icon={<HandCoins className="w-6 h-6" />}
              title="Cirurgias Particulares"
              subtitle="Cobrança de honorários"
              variant="default"
              onClick={() => onNavigate('cirurgiasParticulares')}
            />
          )}

          <WidgetCard
            size="small"
            icon={<Receipt className="w-6 h-6" />}
            title="Codificação Anestésica"
            subtitle="Cobrança e códigos Unimed"
            variant="default"
            onClick={() => onNavigate('codificacaoAnestesica')}
          />
        </div>
      </div>
    </div>
  );
}
