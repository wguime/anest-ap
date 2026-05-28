/**
 * FaturamentoPage - Módulo em Construção
 */
import { Hammer } from 'lucide-react';
import { PageHeader } from '../../components';
import { WarningCallout, EmptyState } from '@/design-system';

export default function FaturamentoPage({ _onNavigate, goBack }) {
  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Faturamento" onBack={goBack} />

      <div className="px-4 sm:px-5 py-4">
        <WarningCallout variant="warning" title="Módulo em Desenvolvimento">
          Os dados exibidos são ilustrativos. A integração com dados reais está sendo implementada.
        </WarningCallout>
      </div>

      <div className="px-4 sm:px-5 py-4 flex items-center justify-center min-h-[60vh]">
        <EmptyState
          icon={<Hammer />}
          title="Módulo em Construção"
          description="O módulo de Faturamento está em desenvolvimento e estará disponível em breve."
        />
      </div>
    </div>
  );
}
