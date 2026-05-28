import { useState } from 'react';
import { SectionCard } from '@/design-system';
import { PageHeader } from '../../components';

export default function AuditoriasConformidadePage({ onNavigate }) {
  const [_activeNav, _setActiveNav] = useState('shield');

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Conformidade e Politicas" onBack={() => onNavigate('auditorias')} />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        <SectionCard title="Sobre">
          <p className="text-sm text-muted-foreground">Esta secao consolida as auditorias de conformidade com politicas institucionais. Verifica a adesao as normas internas, regulamentos e diretrizes estabelecidas pela organizacao, garantindo o alinhamento das praticas com os padroes definidos.</p>
        </SectionCard>
      </div>

    </div>
  );
}
