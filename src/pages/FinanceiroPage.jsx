import { useState } from 'react';
import { SectionCard } from '@/design-system';
import { PageHeader } from '@/components';
import { GraduationCap, Construction } from 'lucide-react';

export default function FinanceiroPage({ onNavigate }) {
  const [_activeNav, _setActiveNav] = useState('shield');

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader
        title="Financeiro"
        onBack={() => onNavigate('gestao')}
      />

      <div className="px-4 sm:px-5">
        {/* Conteúdo placeholder */}
        <SectionCard
          title="Gestão Financeira"
          className="mb-4"
        >
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Construction className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
              Em Desenvolvimento
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              O módulo de gestão financeira está sendo desenvolvido e estará disponível em breve.
            </p>
          </div>
        </SectionCard>
      </div>

    </div>
  );
}
