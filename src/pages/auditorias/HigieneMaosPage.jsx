import { useState } from 'react';
import { SectionCard } from '@/design-system';
import { PageHeader } from '../../components';

export default function HigieneMaosPage({ onNavigate }) {
  const [_activeNav, _setActiveNav] = useState('shield');

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Higiene das Maos" onBack={() => onNavigate('auditorias')} />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        <SectionCard title="Sobre">
          <p className="text-sm text-muted-foreground">Esta secao apresenta as auditorias de adesao a higiene das maos, incluindo formularios de observacao, resultados consolidados e acoes de melhoria. A higienizacao correta das maos e fundamental para prevencao de infeccoes relacionadas a assistencia a saude.</p>
        </SectionCard>
      </div>

    </div>
  );
}
